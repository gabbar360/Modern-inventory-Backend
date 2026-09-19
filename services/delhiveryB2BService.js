/**
 * DelhiveryB2BService - Production Client for Delhivery Freight / LTL (B2B) Logistics API
 * 
 * Supports:
 * - JWT Session Auth (/ums/login)
 * - Pincode Serviceability (/pincode-service/{pincode})
 * - Estimated TAT (/tat/estimate)
 * - Freight Estimation (/freight/estimate)
 * - LR Creation & Manifestation (/manifest)
 * - Live LR Tracking (/lrn/track)
 * - Printable LR Copy (/lr_copy/print/{lrn})
 * - Thermal Shipping Labels (/label/get_urls/{size}/{lrn})
 */

const https = require('https');

class DelhiveryB2BService {
  constructor(options = {}) {
    this.username = options.username || process.env.DELHIVERY_B2B_USERNAME || 'VEGNARGLOBAL9032B2B-b2b';
    this.password = options.password || process.env.DELHIVERY_B2B_PASSWORD || 'New#gabbar_360';
    this.baseUrl = options.baseUrl || process.env.DELHIVERY_B2B_BASE_URL || 'ltl-clients-api-dev.delhivery.com';
    this.jwt = null;
    this.jwtExpiresAt = 0;
  }

  /**
   * Internal HTTPS Request Helper with Bearer Token Authorization
   */
  async _request({ method = 'GET', path, headers = {}, body = null, isFormData = false }) {
    await this.ensureAuthenticated();

    return new Promise((resolve, reject) => {
      const reqHeaders = {
        'Accept': 'application/json',
        ...headers
      };

      if (this.jwt) {
        reqHeaders['Authorization'] = `Bearer ${this.jwt}`;
      }

      let payloadData = null;
      if (body) {
        if (typeof body === 'string') {
          payloadData = body;
        } else if (isFormData) {
          // Form-encoded or multipart
          payloadData = new URLSearchParams(body).toString();
          reqHeaders['Content-Type'] = 'application/x-www-form-urlencoded';
        } else {
          payloadData = JSON.stringify(body);
          if (!reqHeaders['Content-Type']) {
            reqHeaders['Content-Type'] = 'application/json';
          }
        }
        reqHeaders['Content-Length'] = Buffer.byteLength(payloadData);
      }

      const options = {
        hostname: this.baseUrl,
        port: 443,
        path,
        method,
        headers: reqHeaders,
        timeout: 15000
      };

      const req = https.request(options, (res) => {
        let responseText = '';
        res.on('data', chunk => { responseText += chunk; });
        res.on('end', () => {
          let parsed = null;
          try {
            parsed = JSON.parse(responseText);
          } catch (e) {
            parsed = responseText;
          }

          if (res.statusCode >= 200 && res.statusCode < 300) {
            return resolve({ statusCode: res.statusCode, data: parsed, raw: responseText });
          }

          const errorMsg = (parsed && parsed.error && (parsed.error.message || parsed.error)) || responseText || `HTTP ${res.statusCode}`;
          const err = new Error(typeof errorMsg === 'string' ? errorMsg : JSON.stringify(errorMsg));
          err.statusCode = res.statusCode;
          err.responseBody = parsed;
          return reject(err);
        });
      });

      req.on('timeout', () => {
        req.destroy();
        reject(new Error(`Delhivery B2B API timeout after 15s on ${path}`));
      });

      req.on('error', (err) => {
        reject(new Error(`Delhivery B2B connection failed: ${err.message}`));
      });

      if (payloadData) {
        req.write(payloadData);
      }
      req.end();
    });
  }

  /**
   * 1. Authenticate via /ums/login and obtain JWT
   */
  async login() {
    const postData = JSON.stringify({
      username: this.username,
      password: this.password
    });

    return new Promise((resolve, reject) => {
      const options = {
        hostname: this.baseUrl,
        port: 443,
        path: '/ums/login',
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Content-Length': Buffer.byteLength(postData)
        }
      };

      const req = https.request(options, (res) => {
        let responseText = '';
        res.on('data', chunk => { responseText += chunk; });
        res.on('end', () => {
          try {
            const data = JSON.parse(responseText);
            if (res.statusCode === 200 && data.success && data.data?.jwt) {
              this.jwt = data.data.jwt;
              // JWT valid for 24h, expire slightly earlier
              this.jwtExpiresAt = Date.now() + 20 * 60 * 60 * 1000;
              return resolve(data.data);
            }
            const errMsg = data.error?.message || data.message || 'Login failed';
            reject(new Error(`Delhivery B2B Login failed: ${errMsg}`));
          } catch (e) {
            reject(new Error(`Delhivery B2B parse error: ${responseText}`));
          }
        });
      });

      req.on('error', (err) => reject(new Error(`Delhivery B2B Login network error: ${err.message}`)));
      req.write(postData);
      req.end();
    });
  }

  /**
   * Ensure JWT token is valid before executing requests
   */
  async ensureAuthenticated() {
    if (!this.jwt || Date.now() > this.jwtExpiresAt) {
      await this.login();
    }
  }

  /**
   * 2. Check Pincode Serviceability (/pincode-service/{pincode})
   */
  async checkPincode(pincode, weight = 0) {
    const pin = String(pincode || '').trim();
    let path = `/pincode-service/${pin}`;
    if (weight > 0) {
      path += `?weight=${weight}`;
    }
    const res = await this._request({ method: 'GET', path });
    return res.data;
  }

  /**
   * 3. Get Estimated TAT (/tat/estimate)
   */
  async getExpectedTAT(originPin, destinationPin) {
    const path = `/tat/estimate?origin_pin=${encodeURIComponent(originPin)}&destination_pin=${encodeURIComponent(destinationPin)}`;
    const res = await this._request({ method: 'GET', path });
    return res.data;
  }

  /**
   * 4. Estimate Freight Charges (/freight/estimate)
   */
  async estimateFreight({
    sourcePin,
    destinationPin,
    weightGrams = 5000,
    dimensions = [],
    invoiceAmount = 1000,
    freightMode = 'fod'
  }) {
    const payload = {
      source_pin: String(sourcePin).trim(),
      consignee_pin: String(destinationPin).trim(),
      freight_mode: freightMode,
      payment_mode: 'prepaid',
      inv_amount: Number(invoiceAmount || 0),
      weight_g: Math.max(100, Math.round(weightGrams || 1000)),
      dimensions: dimensions.map(d => ({
        length_cm: Math.max(1, Math.round(d.length_cm || 30)),
        width_cm: Math.max(1, Math.round(d.width_cm || 25)),
        height_cm: Math.max(1, Math.round(d.height_cm || 20)),
        box_count: Math.max(1, parseInt(d.box_count, 10) || 1)
      }))
    };

    const res = await this._request({ method: 'POST', path: '/freight/estimate', body: payload });
    return res.data;
  }

  /**
   * 5. Create B2B Shipment / LR (/manifest)
   * Submits multipart manifest to Delhivery B2B and automatically polls
   * GET /manifest?job_id=<job_id> to return the finalized official LR number and waybills.
   */
  async createLR({
    orderNumber,
    pickupWarehouseName = 'Vegnar warehouse',
    weightKg = 10,
    freightMode = null, // 'fod' or null for prepaid
    paymentMode = 'prepaid',
    consigneeName,
    consigneeAddress,
    consigneeCity,
    consigneeState,
    consigneePincode,
    consigneePhone,
    consigneeEmail = '',
    billingName = 'Vegnar Global LLP',
    billingAddress = 'B623, RK ICONIC, NEAR AYODHYA CHOWK, RAJKOT, GUJARAT',
    billingCity = 'Rajkot',
    billingState = 'Gujarat',
    billingPincode = '360007',
    billingPhone = '9033331031',
    billingGstin = '24ABAFC3901A1ZV',
    invoiceNumber,
    invoiceAmount,
    invoiceDate,
    ewayBill,
    dimensions = [],
    productDescription = 'Vegnar Eco Biodegradable Tableware Goods'
  }) {
    const boxes = dimensions.length > 0 ? dimensions.map(d => ({
      order_id: String(orderNumber),
      description: productDescription,
      length_cm: Math.max(1, Math.round(d.length_cm || 35)),
      width_cm: Math.max(1, Math.round(d.width_cm || 25)),
      height_cm: Math.max(1, Math.round(d.height_cm || 20)),
      box_count: Math.max(1, parseInt(d.box_count, 10) || 1),
      weight: Math.round((Number(weightKg) || 5) * 1000)
    })) : [{
      order_id: String(orderNumber),
      description: productDescription,
      length_cm: 35,
      width_cm: 25,
      height_cm: 20,
      box_count: 1,
      weight: Math.round((Number(weightKg) || 5) * 1000)
    }];

    const formParams = {
      weight: String(Math.max(1000, Math.round((Number(weightKg) || 5) * 1000))),
      pickup_location_name: pickupWarehouseName || 'Vegnar warehouse',
      payment_mode: paymentMode || 'prepaid',
      shipment_details: JSON.stringify(boxes),
      dropoff_location: JSON.stringify({
        consignee_name: consigneeName || 'Consignee',
        address: consigneeAddress || 'Site Address',
        city: consigneeCity || 'Shivamogga',
        state: consigneeState || 'Karnataka',
        zip: String(consigneePincode || '577222').trim(),
        phone: String(consigneePhone || '9820012345').replace(/\D/g, '').slice(-10),
        email: consigneeEmail || ''
      }),
      billing_address: JSON.stringify({
        name: billingName,
        company: billingName,
        consignor: billingName,
        address: billingAddress,
        city: billingCity,
        state: billingState,
        pin: String(billingPincode).trim(),
        phone: String(billingPhone).replace(/\D/g, '').slice(-10),
        gst_number: billingGstin,
        pan_number: billingGstin.length >= 12 ? billingGstin.slice(2, 12) : 'AAPFU0932F'
      }),
      invoices: JSON.stringify([{
        inv_num: String(invoiceNumber || orderNumber),
        inv_amt: Number(invoiceAmount || 0),
        inv_date: invoiceDate || new Date().toISOString().slice(0, 10),
        ...(ewayBill ? { ewaybill: String(ewayBill).trim() } : {})
      }])
    };

    if (freightMode) {
      formParams.freight_mode = freightMode;
    }

    const manifestRes = await this._request({
      method: 'POST',
      path: '/manifest',
      body: formParams,
      isFormData: true
    });

    const initialData = manifestRes.data || {};
    const jobId = initialData.job_id || initialData.data?.job_id;

    if (!jobId) {
      return initialData;
    }

    // Automatically poll GET /manifest?job_id=<jobId> until LR number is generated
    let finalLRData = initialData;
    const maxAttempts = 6;
    for (let attempt = 1; attempt <= maxAttempts; attempt++) {
      await new Promise(r => setTimeout(r, 1200));
      try {
        const jobStatus = await this.getManifestJobStatus(jobId);
        if (jobStatus && jobStatus.data && jobStatus.data.lrnum) {
          finalLRData = {
            success: true,
            job_id: jobId,
            lr_number: jobStatus.data.lrnum,
            lrnum: jobStatus.data.lrnum,
            waybills: jobStatus.data.waybills || [],
            master_waybill: jobStatus.data.master_waybill || (jobStatus.data.waybills && jobStatus.data.waybills[0]) || '',
            doc_waybill: jobStatus.data.doc_waybill || '',
            status: jobStatus.data.status || 'Complete',
            pickup_location: pickupWarehouseName || 'Vegnar_Rajkot',
            raw: jobStatus.data
          };
          break;
        }
      } catch (err) {
        console.warn(`Delhivery B2B Manifest status poll attempt ${attempt} warning:`, err.message);
      }
    }

    return finalLRData;
  }

  /**
   * Check Status of Manifest Job (/manifest?job_id={job_id})
   */
  async getManifestJobStatus(jobId) {
    const res = await this._request({
      method: 'GET',
      path: `/manifest?job_id=${encodeURIComponent(jobId)}`
    });
    return res.data;
  }

  /**
   * 6. Track LR (/lrn/track?lrnum={lrnum})
   */
  async trackLR(lrnum) {
    const res = await this._request({
      method: 'GET',
      path: `/lrn/track?lrnum=${encodeURIComponent(lrnum)}&all_wbns=true`
    });
    return res.data;
  }

  /**
   * 7. Freight Charges Breakup (/lrn/freight-breakup?lrns={lrns})
   */
  async getFreightBreakup(lrns) {
    const lrnStr = Array.isArray(lrns) ? lrns.join(',') : String(lrns || '');
    const res = await this._request({
      method: 'GET',
      path: `/lrn/freight-breakup?lrns=${encodeURIComponent(lrnStr)}`
    });
    return res.data;
  }

  /**
   * 8. Printable LR Copy URL (/lr_copy/print/{lrn})
   */
  getLRCopyUrl(lrn, type = 'consignor') {
    return `https://${this.baseUrl}/lr_copy/print/${encodeURIComponent(lrn)}?lr_copy_type=${type}`;
  }

  /**
   * 9. Download Printable Official LR PDF Buffer
   */
  async getLRCopyPdfBuffer(lrn) {
    await this.ensureAuthenticated();
    return new Promise((resolve, reject) => {
      const options = {
        hostname: this.baseUrl,
        port: 443,
        path: `/lr_copy/print/${encodeURIComponent(lrn)}`,
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${this.jwt}`,
          'Accept': 'application/pdf, application/json'
        },
        timeout: 15000
      };

      const req = https.request(options, (res) => {
        const chunks = [];
        res.on('data', chunk => chunks.push(chunk));
        res.on('end', () => {
          const buffer = Buffer.concat(chunks);
          if (res.statusCode >= 200 && res.statusCode < 300) {
            return resolve(buffer);
          }
          let errBody = buffer.toString('utf8');
          reject(new Error(`Delhivery LR Print PDF error (${res.statusCode}): ${errBody}`));
        });
      });

      req.on('timeout', () => { req.destroy(); reject(new Error('Delhivery LR PDF request timeout')); });
      req.on('error', reject);
      req.end();
    });
  }

  /**
   * 10. Printable Shipping Label URL (/label/get_urls/{size}/{lrn})
   */
  async getShippingLabelUrls(lrn, size = '4x6') {
    const res = await this._request({
      method: 'GET',
      path: `/label/get_urls/${size}/${encodeURIComponent(lrn)}`
    });
    return res.data;
  }
}

/**
 * Factory helper: Instantiate DelhiveryB2BService using DB config or environment
 */
async function getDelhiveryB2BServiceForOrg(CourierConfig, orgId) {
  let conf = null;
  if (CourierConfig && orgId) {
    try {
      conf = await CourierConfig.findOne({ organization_id: orgId });
    } catch (e) {
      console.warn('Could not load CourierConfig for B2B:', e.message);
    }
  }

  const username = conf?.b2b_username || process.env.DELHIVERY_B2B_USERNAME || 'VEGNARGLOBAL9032B2B-b2b';
  const password = conf?.b2b_password || process.env.DELHIVERY_B2B_PASSWORD || 'New#gabbar_360';
  const baseUrl = conf?.b2b_base_url || process.env.DELHIVERY_B2B_BASE_URL || 'ltl-clients-api-dev.delhivery.com';

  return new DelhiveryB2BService({
    username,
    password,
    baseUrl
  });
}

module.exports = {
  DelhiveryB2BService,
  getDelhiveryB2BServiceForOrg
};
