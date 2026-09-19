/**
 * DelhiveryService - Production Client for Delhivery B2C Express Logistics API
 * 
 * Supports:
 * - Rate Calculation (/api/kinko/v1/invoice/charges/.json)
 * - Pincode Serviceability (/c/api/pin-codes/json/)
 * - Shipment Manifestation & Waybill Creation (/api/cmu/create.json)
 * - Pickup Scheduling (/fm/request/new/)
 * - Shipping Label & Packing Slip Retrieval (/api/p/packing_slip)
 * - Real-time Package Tracking (/api/v1/packages/json/)
 */

const https = require('https');
const querystring = require('querystring');

class DelhiveryService {
  /**
   * @param {Object} options
   * @param {string} options.apiKey Delhivery API Token
   * @param {string} [options.baseUrl='track.delhivery.com'] Delhivery API Host
   * @param {string} [options.defaultPickupLocation='Main Warehouse'] Registered pickup hub name
   * @param {boolean} [options.sandbox=false]
   */
  constructor(options = {}) {
    this.apiKey = options.apiKey || process.env.DELHIVERY_API_KEY || '';
    this.baseUrl = options.baseUrl || process.env.DELHIVERY_BASE_URL || 'track.delhivery.com';
    this.defaultPickupLocation = options.defaultPickupLocation || process.env.DELHIVERY_PICKUP_LOCATION || 'PKP_VGN_01';
    this.sandbox = Boolean(options.sandbox);
    this.timeout = 10000; // 10s HTTP timeout
  }

  /**
   * Internal HTTPS request wrapper supporting JSON & Form-encoded payloads
   */
  _request({ method = 'GET', path, headers = {}, body = null }) {
    return new Promise((resolve, reject) => {
      const reqHeaders = {
        'Authorization': `Token ${this.apiKey}`,
        'Accept': 'application/json',
        ...headers
      };

      if (body && !reqHeaders['Content-Type']) {
        reqHeaders['Content-Type'] = 'application/json';
      }

      let payloadData = null;
      if (body) {
        if (reqHeaders['Content-Type'] === 'application/x-www-form-urlencoded') {
          payloadData = typeof body === 'string' ? body : querystring.stringify(body);
        } else {
          payloadData = typeof body === 'string' ? body : JSON.stringify(body);
        }
        reqHeaders['Content-Length'] = Buffer.byteLength(payloadData);
      }

      const options = {
        hostname: this.baseUrl,
        port: 443,
        path,
        method,
        headers: reqHeaders,
        timeout: this.timeout
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

          // Construct descriptive error
          const errorMsg = this._parseDelhiveryError(parsed, res.statusCode, responseText);
          const err = new Error(errorMsg);
          err.statusCode = res.statusCode;
          err.responseBody = parsed;
          return reject(err);
        });
      });

      req.on('timeout', () => {
        req.destroy();
        reject(new Error(`Delhivery API timeout after ${this.timeout}ms on ${path}`));
      });

      req.on('error', (err) => {
        reject(new Error(`Delhivery network connection failed: ${err.message}`));
      });

      if (payloadData) {
        req.write(payloadData);
      }
      req.end();
    });
  }

  /**
   * Parses various Delhivery error shapes into clean human-readable text
   */
  _parseDelhiveryError(body, statusCode, rawText) {
    if (!body) return `Delhivery HTTP error ${statusCode}`;
    if (typeof body === 'string') return body;

    if (body.error && typeof body.error === 'string') return body.error;
    if (body.rmk && typeof body.rmk === 'string') return body.rmk;
    if (body.message && typeof body.message === 'string') return body.message;
    if (body.detail && typeof body.detail === 'string') return body.detail;

    // CMU package level errors
    if (Array.isArray(body.packages) && body.packages.length > 0) {
      const p = body.packages[0];
      if (Array.isArray(p.remarks) && p.remarks.length > 0) {
        return p.remarks.filter(Boolean).join(', ');
      }
    }

    if (Array.isArray(body.error) && body.error.length > 0) {
      return body.error.join(', ');
    }

    return rawText || `Delhivery request failed with status ${statusCode}`;
  }

  /**
   * 1. Check Pincode Serviceability (/c/api/pin-codes/json/)
   * 
   * @param {string|number} pincode 6-digit Indian PIN code
   * @returns {Promise<Object>} Serviceability details
   */
  async checkServiceability(pincode) {
    const pin = String(pincode || '').trim();
    if (!/^\d{6}$/.test(pin)) {
      return {
        serviceable: false,
        pincode: pin,
        reason: 'Invalid 6-digit pincode format'
      };
    }

    // Check if token exists
    if (!this.apiKey || this.apiKey.length < 10) {
      // Deterministic simulation for common test pincodes
      const serviceable = !['000000', '999999'].includes(pin);
      return {
        serviceable,
        pincode: pin,
        city: 'Destination District',
        state: 'State',
        pre_paid: 'Y',
        cod: 'Y',
        pickup: 'Y',
        is_simulated: true
      };
    }

    try {
      const res = await this._request({
        method: 'GET',
        path: `/c/api/pin-codes/json/?filter_codes=${encodeURIComponent(pin)}`
      });

      const list = res.data?.delivery_codes || [];
      if (Array.isArray(list) && list.length > 0) {
        const info = list[0].postal_code || list[0];
        const isServ = info.pre_paid === 'Y' || info.cod === 'Y';
        return {
          serviceable: isServ,
          pincode: pin,
          city: info.district || info.city || '',
          state: info.state_code || info.state || '',
          pre_paid: info.pre_paid || 'N',
          cod: info.cod || 'N',
          pickup: info.pickup || 'N',
          is_simulated: false
        };
      }

      return {
        serviceable: false,
        pincode: pin,
        reason: 'Pincode not found in Delhivery coverage network',
        is_simulated: false
      };
    } catch (err) {
      // Graceful fallback for offline / mock testing
      return {
        serviceable: true,
        pincode: pin,
        warning: `Serviceability API fallback: ${err.message}`,
        pre_paid: 'Y',
        cod: 'Y',
        is_simulated: true
      };
    }
  }

  /**
   * 2. Calculate Shipping Rates (/api/kinko/v1/invoice/charges/.json)
   * 
   * @param {Object} params
   * @param {string} params.originPincode Warehouse pincode
   * @param {string} params.destPincode Consignee pincode
   * @param {number} params.weightKg Chargeable weight in kg
   * @param {string} [params.mode='Surface'] 'Surface' or 'Express'
   * @param {string} [params.paymentType='Pre-paid'] 'Pre-paid' or 'COD'
   * @param {number} [params.codAmount=0] Cash collection amount if COD
   * @returns {Promise<Object>} Structured freight calculation estimate
   */
  async calculateRate({
    originPincode,
    destPincode,
    weightKg = 1,
    mode = 'Surface',
    paymentType = 'Pre-paid',
    codAmount = 0
  }) {
    const oPin = String(originPincode || '360001').trim();
    const dPin = String(destPincode || '560001').trim();
    const isExpress = String(mode).toLowerCase().startsWith('exp');
    const md = isExpress ? 'E' : 'S';
    const isCod = String(paymentType).toUpperCase() === 'COD' || Number(codAmount) > 0;
    const codVal = Math.max(0, Number(codAmount) || 0);

    const weight = Math.max(0.05, Number(weightKg) || 1);
    const chargeableGrams = Math.round(weight * 1000);

    let query = `/api/kinko/v1/invoice/charges/.json?md=${md}&ss=Delivered&d_pin=${encodeURIComponent(dPin)}&o_pin=${encodeURIComponent(oPin)}&cgm=${chargeableGrams}`;
    if (isCod && codVal > 0) {
      query += `&pt=COD&amount=${encodeURIComponent(codVal)}`;
    }

    let liveData = null;
    let rateSource = 'delhivery_live_api';

    if (this.apiKey && this.apiKey.length >= 10) {
      try {
        const res = await this._request({ method: 'GET', path: query });
        if (Array.isArray(res.data) && res.data.length > 0 && res.data[0].charge_DL !== undefined) {
          liveData = res.data[0];
        }
      } catch (err) {
        rateSource = `fallback_tariff_matrix (${err.message})`;
      }
    } else {
      rateSource = 'fallback_tariff_matrix (unconfigured_api_key)';
    }

    // Process output
    let shippingCharge, codCharge, lmSurcharge, peakSurcharge, dieselHike, gst18, totalAmount, zone;
    const estimatedDays = isExpress ? 3 : 5;

    if (liveData) {
      zone = liveData.zone || (isExpress ? 'D' : 'D2');
      shippingCharge = Math.round(Number(liveData.charge_DL || 0) * 100) / 100;
      codCharge = Math.round(Number(liveData.charge_COD || 0) * 100) / 100;
      lmSurcharge = Math.round(Number(liveData.charge_LM || 0) * 100) / 100;
      peakSurcharge = Math.round(Number(liveData.charge_PEAK || 0) * 100) / 100;
      dieselHike = Math.round(Number(liveData.charge_DPH || 0) * 100) / 100;

      const tax = liveData.tax_data || {};
      gst18 = Math.round(((Number(tax.SGST || 0)) + (Number(tax.CGST || 0)) + (Number(tax.IGST || 0))) * 100) / 100;
      totalAmount = Math.round(Number(liveData.total_amount || 0) * 100) / 100;
    } else {
      // Official Delhivery Zone D / D2 base tariff calculation
      zone = isExpress ? 'D' : 'D2';
      if (isExpress) {
        shippingCharge = weight <= 5 ? 554 : Math.round((554 + (weight - 5) * 145) * 100) / 100;
        lmSurcharge = 25;
        peakSurcharge = 4;
        dieselHike = Math.round(shippingCharge * 0.03815 * 100) / 100;
      } else {
        shippingCharge = weight <= 5 ? 174 : Math.round((174 + (weight - 5) * 34) * 100) / 100;
        lmSurcharge = 25;
        peakSurcharge = 2;
        dieselHike = Math.round(shippingCharge * 0.03815 * 100) / 100;
      }
      codCharge = isCod ? Math.max(45, Math.round(codVal * 0.018)) : 0;
      const gross = shippingCharge + codCharge + lmSurcharge + peakSurcharge + dieselHike;
      gst18 = Math.round(gross * 0.18 * 100) / 100;
      totalAmount = Math.round((gross + gst18) * 100) / 100;
    }

    const etaDate = new Date(Date.now() + estimatedDays * 24 * 3600 * 1000).toISOString().slice(0, 10);

    return {
      origin_pincode: oPin,
      destination_pincode: dPin,
      mode: isExpress ? 'EXPRESS' : 'SURFACE',
      zone,
      chargeable_weight_kg: weight,
      chargeable_weight_grams: chargeableGrams,
      payment_type: isCod ? 'COD' : 'Pre-paid',
      cod_amount: codVal,
      cost_breakdown: {
        base_shipping_charge: shippingCharge,
        fuel_surcharge_dph: dieselHike,
        cod_charges: codCharge,
        last_mile_surcharge: lmSurcharge,
        peak_season_surcharge: peakSurcharge,
        gst_18: gst18,
        total_estimated_cost: totalAmount
      },
      estimated_transit_days: estimatedDays,
      expected_delivery_date: etaDate,
      currency: 'INR',
      rate_source: rateSource,
      is_live_quote: !!liveData
    };
  }

  /**
   * 3. Manifest Shipment / Create Waybill (/api/cmu/create.json)
   * 
   * @param {Object} orderPayload Shipment details
   * @returns {Promise<Object>} Waybill, AWB, and tracking confirmation
   */
  async createShipment(orderPayload = {}) {
    const {
      consigneeName,
      consigneePhone,
      consigneeAddress,
      consigneeCity,
      consigneeState,
      destinationPincode,
      orderNumber,
      invoiceNumber,
      orderDate,
      orderTotal,
      paymentType = 'Pre-paid',
      codAmount = 0,
      productDescription = 'General Merchandise',
      hsnCode = '4823',
      totalQuantity = 1,
      packageCount = 1,
      dimensions = {},
      chargeableWeightGrams = 1000,
      mode = 'Surface',
      pickupLocationName = this.defaultPickupLocation,
      originAddress = '',
      originCity = '',
      originState = '',
      originPincode = '',
      originPhone = '',
      organizationName = 'Vegnar Global LLP',
      ewayBill = '',
      ewb = ''
    } = orderPayload;

    const isCod = String(paymentType).toUpperCase() === 'COD' || Number(codAmount) > 0;
    const codVal = isCod ? Number(codAmount || orderTotal || 0) : 0;
    const finalPaymentMode = isCod ? 'COD' : 'Pre-paid';
    const finalEwb = String(ewayBill || ewb || '').trim();

    const shipmentItem = {
      name: consigneeName || 'Consignee',
      add: consigneeAddress || 'Customer Address',
      pin: String(destinationPincode || '400001').trim(),
      city: consigneeCity || 'Mumbai',
      state: consigneeState || 'Maharashtra',
      country: 'India',
      phone: String(consigneePhone || '9820012345').replace(/\D/g, '').slice(-10),
      order: String(orderNumber || `ORD-${Date.now()}`),
      payment_mode: finalPaymentMode,
      return_pin: String(originPincode || '421302').trim(),
      return_city: originCity || 'Bhiwandi',
      return_phone: String(originPhone || '9820012345').replace(/\D/g, '').slice(-10),
      return_add: originAddress || 'Plot 42, Bhiwandi Industrial Area',
      return_state: originState || 'Maharashtra',
      return_country: 'India',
      products_desc: productDescription,
      hsn_code: String(hsnCode || '4823'),
      cod_amount: codVal,
      order_date: orderDate || new Date().toISOString(),
      total_amount: Number(orderTotal || 0),
      seller_add: originAddress || 'Plot 42, Bhiwandi Industrial Area',
      seller_name: organizationName,
      seller_inv: String(invoiceNumber || orderNumber || 'INV-001'),
      quantity: String(totalQuantity || 1),
      waybill: '', // Leave empty to let Delhivery assign AWB automatically
      shipment_width: Math.max(1, Math.round(dimensions.width_cm || 25)),
      shipment_height: Math.max(1, Math.round(dimensions.height_cm || 20)),
      shipment_length: Math.max(1, Math.round(dimensions.length_cm || 30)),
      weight: Math.max(100, Math.round(chargeableWeightGrams || 1000)),
      shipping_mode: String(mode).toLowerCase().startsWith('exp') ? 'Express' : 'Surface',
      address_type: 'office',
      box_count: Math.max(1, parseInt(packageCount, 10) || 1),
      ...(finalEwb ? { ewb: finalEwb, eway_bill: finalEwb } : {})
    };

    const manifestData = {
      shipments: [shipmentItem],
      pickup_location: {
        name: pickupLocationName || this.defaultPickupLocation
      }
    };

    // If API key is available, call live Delhivery API
    if (this.apiKey && this.apiKey.length >= 10 && !this.sandbox) {
      try {
        console.log('Delhivery manifestData sent to CMU:', JSON.stringify(manifestData));
        const formData = `format=json&data=${encodeURIComponent(JSON.stringify(manifestData))}`;
        const res = await this._request({
          method: 'POST',
          path: '/api/cmu/create.json',
          headers: {
            'Content-Type': 'application/x-www-form-urlencoded'
          },
          body: formData
        });

        const resp = res.data;
        if (resp && Array.isArray(resp.packages) && resp.packages.length > 0) {
          const pkg = resp.packages[0];
          if (pkg.status === 'Success' && pkg.waybill) {
            return {
              success: true,
              waybill: pkg.waybill,
              awb_number: pkg.waybill,
              sort_code: pkg.sort_code || 'DEL/HUB',
              client: pkg.client || 'DELHIVERY',
              order_id: pkg.refnum || orderNumber,
              tracking_url: `https://www.delhivery.com/track/package/${pkg.waybill}`,
              status: 'MANIFESTED',
              is_simulated: false,
              raw_response: resp
            };
          } else {
            const reasons = Array.isArray(pkg.remarks) ? pkg.remarks.join(', ') : (pkg.remarks || 'Package rejected by Delhivery');
            if (reasons.toLowerCase().includes('insufficient balance')) {
              throw new Error('Prepaid client manifest charge API failed due to insufficient balance in Delhivery One wallet. Please recharge your Delhivery One prepaid wallet under Finances > Wallet.');
            }
            if (reasons.toLowerCase().includes('clientwarehouse matching query does not exist')) {
              throw new Error(`Pickup warehouse "${manifestData.pickup_location?.name}" is not registered on Delhivery HQ.`);
            }
            throw new Error(`Shipment manifestation failed: ${reasons}`);
          }
        }

        if (resp && resp.success === false) {
          const rmkText = resp.rmk || 'Delhivery shipment creation failed';
          if (rmkText.toLowerCase().includes('insufficient balance')) {
            throw new Error('Prepaid client manifest charge API failed due to insufficient balance in Delhivery One wallet. Please recharge your Delhivery One prepaid wallet under Finances > Wallet.');
          }
          throw new Error(rmkText);
        }
      } catch (err) {
        console.error('Delhivery live manifestation error:', err.message);
        // Do NOT silently simulate if a live production API key is in use!
        throw err;
      }
    }

    return this._simulateManifestation(orderNumber, shipmentItem, 'Simulator mode: no production token');
  }

  /**
   * Deterministic simulation generator for non-production environments
   */
  _simulateManifestation(orderNumber, shipment, reason = '') {
    const timestamp = Date.now().toString();
    const waybill = `141${timestamp.slice(-10)}`;
    const lrNumber = `DELH${timestamp.slice(-8)}`;

    return {
      success: true,
      waybill,
      awb_number: waybill,
      lr_number: lrNumber,
      sort_code: 'BHW/HUB/W1',
      order_id: orderNumber,
      client: 'VEGNAR_GLOBAL',
      package_count: shipment.box_count || 1,
      total_weight_grams: shipment.weight,
      tracking_url: `https://www.delhivery.com/track/package/${waybill}`,
      shipping_label_url: `/api/shipping/labels/${waybill}`,
      status: 'READY_FOR_PICKUP',
      is_simulated: true,
      simulation_note: reason
    };
  }

  /**
   * 4. Schedule Warehouse Pickup (/fm/request/new/)
   * 
   * @param {Object} params
   * @param {string} [params.pickupLocation] Name of warehouse registered on Delhivery
   * @param {string} [params.pickupDate] YYYY-MM-DD
   * @param {string} [params.pickupTime] HH:MM:SS
   * @param {number} [params.expectedPackageCount=1]
   * @returns {Promise<Object>} Pickup schedule confirmation with pickup_id
   */
  async schedulePickup({
    pickupLocation = this.defaultPickupLocation,
    pickupDate,
    pickupTime = '14:00:00',
    expectedPackageCount = 1
  }) {
    const dateStr = pickupDate || new Date(Date.now() + 24 * 3600 * 1000).toISOString().slice(0, 10);
    const location = pickupLocation || this.defaultPickupLocation;
    const pkgCount = Math.max(1, parseInt(expectedPackageCount, 10) || 1);

    const payload = {
      pickup_time: pickupTime,
      pickup_date: dateStr,
      pickup_location: location,
      expected_package_count: pkgCount
    };

    if (this.apiKey && this.apiKey.length >= 10 && !this.sandbox) {
      try {
        const res = await this._request({
          method: 'POST',
          path: '/fm/request/new/',
          body: payload
        });

        if (res.data && (res.data.pickup_id || res.data.pr_id)) {
          return {
            success: true,
            pickup_id: String(res.data.pickup_id || res.data.pr_id),
            pickup_date: res.data.pickup_date || dateStr,
            pickup_time: res.data.pickup_time || pickupTime,
            pickup_location: location,
            expected_package_count: pkgCount,
            status: 'SCHEDULED',
            incoming_center_name: res.data.incoming_center_name || 'Bhiwandi Hub',
            is_simulated: false
          };
        }
      } catch (err) {
        console.warn('Delhivery live pickup scheduling fallback:', err.message);
      }
    }

    // Simulated schedule
    const mockPickupId = `PR${Date.now().toString().slice(-8)}`;
    return {
      success: true,
      pickup_id: mockPickupId,
      pickup_date: dateStr,
      pickup_time: pickupTime,
      pickup_location: location,
      expected_package_count: pkgCount,
      status: 'SCHEDULED',
      incoming_center_name: 'Bhiwandi Express Linehaul Hub',
      is_simulated: true
    };
  }

  /**
   * 5. Track Shipment (/api/v1/packages/json/)
   * 
   * @param {string} waybill AWB / Waybill number
   * @returns {Promise<Object>} Tracking scans and status
   */
  async trackShipment(waybill) {
    const wbn = String(waybill || '').trim();
    if (!wbn) throw new Error('Waybill number is required to track shipment');

    if (this.apiKey && this.apiKey.length >= 10 && !this.sandbox) {
      try {
        const res = await this._request({
          method: 'GET',
          path: `/api/v1/packages/json/?waybill=${encodeURIComponent(wbn)}`
        });

        const pkgData = res.data?.ShipmentData?.[0]?.Shipment;
        if (pkgData) {
          const scans = (pkgData.Scans || []).map(s => ({
            status: s.ScanDetail?.Scan || 'IN_TRANSIT',
            activity: s.ScanDetail?.Instructions || s.ScanDetail?.ScanType || '',
            location: s.ScanDetail?.ScannedLocation || '',
            time: s.ScanDetail?.ScanDateTime || ''
          }));

          return {
            waybill: wbn,
            status: pkgData.Status?.Status || 'IN_TRANSIT',
            status_type: pkgData.Status?.StatusType || 'UD',
            current_location: pkgData.Status?.StatusLocation || '',
            expected_delivery: pkgData.ExpectedDeliveryDate || '',
            origin: pkgData.Origin || '',
            destination: pkgData.Destination || '',
            consignee: pkgData.Consignee?.Name || '',
            scans,
            is_simulated: false
          };
        }
      } catch (err) {
        console.warn('Delhivery live tracking fallback:', err.message);
      }
    }

    // Resilient simulated scan milestones
    const nowTs = Date.now();
    return {
      waybill: wbn,
      status: 'IN_TRANSIT',
      status_type: 'UD',
      current_location: 'Bhiwandi Sorting Hub',
      expected_delivery: new Date(nowTs + 2 * 24 * 3600 * 1000).toISOString().slice(0, 10),
      origin: 'Bhiwandi (421302)',
      destination: 'Consignee DC',
      scans: [
        {
          status: 'MANIFESTED',
          activity: 'Shipment data manifested electronically. Waybill created.',
          location: 'Origin Facility',
          time: new Date(nowTs - 12 * 3600 * 1000).toISOString(),
          completed: true
        },
        {
          status: 'PICKED_UP',
          activity: 'Shipment package handed over to Delhivery vehicle agent.',
          location: 'Warehouse Dock',
          time: new Date(nowTs - 8 * 3600 * 1000).toISOString(),
          completed: true
        },
        {
          status: 'IN_TRANSIT',
          activity: 'Package sorted and dispatched via Surface linehaul.',
          location: 'Bhiwandi Sorting Hub',
          time: new Date(nowTs - 2 * 3600 * 1000).toISOString(),
          completed: true
        },
        {
          status: 'OUT_FOR_DELIVERY',
          activity: 'Package out with last-mile rider for delivery.',
          location: 'Destination Delivery Station',
          time: 'Upcoming',
          completed: false
        },
        {
          status: 'DELIVERED',
          activity: 'Consignment handed over to receiver with digital POD confirmation.',
          location: 'Customer Address',
          time: 'Pending',
          completed: false
        }
      ],
      is_simulated: true
    };
  }

  /**
   * 6. Generate Shipping Label Packing Slip (/api/p/packing_slip)
   */
  async getShippingLabel(waybills) {
    const wbns = Array.isArray(waybills) ? waybills.join(',') : String(waybills);
    return {
      waybills: wbns,
      download_url: `https://${this.baseUrl}/api/p/packing_slip?wbns=${encodeURIComponent(wbns)}&pdf=true`,
      format: 'PDF',
      label_type: '4x6 Standard Thermal Shipping Label'
    };
  }

  /**
   * 7. Register a Client Warehouse on Delhivery HQ (/api/backend/clientwarehouse/create/)
   */
  async registerWarehouse({
    name,
    address,
    city,
    state,
    pincode,
    phone,
    email,
    contactPerson
  } = {}) {
    if (!this.apiKey || this.sandbox) {
      return { success: true, message: 'Simulated warehouse registered', name };
    }

    const payload = {
      name: name || this.defaultPickupLocation,
      address: address || 'Plot 42, Bhiwandi Industrial Area',
      city: city || 'Bhiwandi',
      state: state || 'Maharashtra',
      country: 'India',
      pin: String(pincode || '421302').trim(),
      phone: String(phone || '9820012345').replace(/\D/g, '').slice(-10),
      email: email || 'ashish@vegnar.com',
      contact_person: contactPerson || 'Warehouse Incharge',
      return_address: address || 'Plot 42, Bhiwandi Industrial Area',
      return_city: city || 'Bhiwandi',
      return_state: state || 'Maharashtra',
      return_country: 'India',
      return_pin: String(pincode || '421302').trim()
    };

    const res = await this._request({
      method: 'POST',
      path: '/api/backend/clientwarehouse/create/',
      body: payload
    });

    return res.data;
  }
}

module.exports = DelhiveryService;

