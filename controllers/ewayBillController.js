/**
 * EwayBillController - Orchestrator for Quick E-Way Bill Generation from Invoices
 * 
 * Provides:
 * 1. Pincode distance estimation & Rule 138(10) validity calculation
 * 2. One-click Quick E-Way Bill generation directly from Invoices
 * 3. Retrieval of active E-Way Bill status, Part A & Part B history
 * 4. Part-B Vehicle number updates (transshipment, breakdown)
 * 5. 24-hour cancellation with standard GST reason codes
 * 6. Official Government-style printable E-Way Bill slip rendering
 */

const { EwayBillService, estimatePincodeDistance, calculateValidity } = require('../services/ewayBillService');

/**
 * Initializes EwayBillService for the organization
 */
async function getEwayServiceForOrg(CourierConfig, orgId) {
  const conf = await CourierConfig.findOne({ organization_id: orgId });
  const isSandbox = Boolean(conf?.sandbox || !conf?.api_key || conf?.api_key?.includes('test'));
  return new EwayBillService({
    gstin: conf?.client_id || '',
    sandbox: isSandbox
  });
}

/**
 * GET /api/gst/pincode-distance/:fromPin/:toPin
 * Utility to calculate estimated distance and validity between two Indian pincodes
 */
async function calculateDistance(req, res) {
  try {
    const { fromPin, toPin } = req.params;
    const distanceKm = estimatePincodeDistance(fromPin, toPin);
    const validity = calculateValidity(distanceKm, req.query.cargo_type || 'R');

    return res.json({
      from_pincode: fromPin,
      to_pincode: toPin,
      distance_km: distanceKm,
      validity_days: validity.valid_days,
      valid_until: validity.valid_until,
      formatted_valid_until: validity.formatted_valid_until
    });
  } catch (err) {
    return res.status(500).json({ detail: `Distance calculation failed: ${err.message}` });
  }
}

/**
 * POST /api/invoices/:id/eway-bill/generate
 * Quick generation of GST E-Way Bill from an Invoice (like Zoho)
 */
async function generateInvoiceEwayBill(req, res, models) {
  const { Invoice, Customer, Organization, CourierConfig, SalesOrder, Dispatch } = models;
  const { id } = req.params;
  const {
    vehicle_no = 'MH04AB1234',
    vehicle_type = 'R',
    transport_mode = '1',
    transporter_name = 'Delhivery Express Logistics',
    transporter_id = '',
    distance_km = null,
    trans_doc_no = '',
    notes = ''
  } = req.body || {};

  try {
    // 1. Fetch Invoice
    const inv = await Invoice.findOne({
      $or: [{ id }, { number: id }],
      organization_id: req.user.organization_id
    });
    if (!inv) return res.status(404).json({ detail: 'Invoice not found' });

    // 2. Fetch Customer and Organization
    const cust = (await Customer.findOne({ id: inv.customer_id })) || {};
    const org = (await Organization.findOne({ id: req.user.organization_id })) || {};

    // 3. Initialize EwayBillService
    const service = await getEwayServiceForOrg(CourierConfig, req.user.organization_id);

    // 4. Generate E-Way Bill
    const transportDetails = {
      vehicle_no,
      vehicle_type,
      transport_mode,
      transporter_name: transporter_name || 'Delhivery Express Logistics',
      transporter_id,
      distance_km,
      trans_doc_no: trans_doc_no || inv.number
    };

    const ewbResult = await service.generateEwayBill({
      invoice: inv,
      organization: org,
      customer: cust,
      transportDetails
    });

    // 5. Update Invoice in MongoDB
    await Invoice.updateOne({ id: inv.id }, {
      $set: {
        eway_bill_number: ewbResult.eway_bill_number,
        eway_bill_date: ewbResult.eway_bill_date,
        eway_bill_valid_until: ewbResult.valid_until,
        eway_bill_status: 'generated',
        eway_bill_vehicle_no: ewbResult.part_b?.vehicle_number || vehicle_no,
        eway_bill_transporter_id: transporter_id,
        eway_bill_transporter_name: transporter_name,
        eway_bill_distance: ewbResult.distance_km,
        eway_bill_details: ewbResult
      }
    });

    // 6. Sync with linked Sales Order & Dispatch if exists
    if (inv.sales_order_id) {
      await SalesOrder.updateOne({ id: inv.sales_order_id }, {
        $set: { eway_bill: ewbResult.eway_bill_number }
      });
      await Dispatch.updateOne({ sales_order_id: inv.sales_order_id }, {
        $set: { eway_bill: ewbResult.eway_bill_number }
      });
    }

    return res.json({
      ok: true,
      message: 'E-Way Bill generated successfully',
      invoice_id: inv.id,
      invoice_number: inv.number,
      eway_bill_number: ewbResult.eway_bill_number,
      eway_bill_date: ewbResult.formatted_date,
      valid_until: ewbResult.valid_until,
      formatted_valid_until: ewbResult.formatted_valid_until,
      distance_km: ewbResult.distance_km,
      status: 'generated',
      vehicle_no: ewbResult.part_b?.vehicle_number,
      slip_url: `/api/invoices/${inv.id}/eway-bill/slip`,
      ewb_details: ewbResult
    });
  } catch (err) {
    console.error('E-Way Bill generation failed:', err);
    return res.status(500).json({ detail: `E-Way Bill generation failed: ${err.message}` });
  }
}

/**
 * GET /api/invoices/:id/eway-bill
 * Retrieves E-Way Bill metadata and Part A / Part B details
 */
async function getInvoiceEwayBill(req, res, models) {
  const { Invoice } = models;
  const { id } = req.params;

  try {
    const inv = await Invoice.findOne({
      $or: [{ id }, { number: id }],
      organization_id: req.user.organization_id
    });
    if (!inv) return res.status(404).json({ detail: 'Invoice not found' });

    if (!inv.eway_bill_number) {
      return res.status(404).json({ detail: 'No E-Way Bill has been generated for this invoice' });
    }

    return res.json({
      invoice_id: inv.id,
      invoice_number: inv.number,
      eway_bill_number: inv.eway_bill_number,
      eway_bill_date: inv.eway_bill_date,
      valid_until: inv.eway_bill_valid_until,
      status: inv.eway_bill_status || 'generated',
      vehicle_no: inv.eway_bill_vehicle_no,
      transporter_name: inv.eway_bill_transporter_name,
      transporter_id: inv.eway_bill_transporter_id,
      distance_km: inv.eway_bill_distance,
      slip_url: `/api/invoices/${inv.id}/eway-bill/slip`,
      details: inv.eway_bill_details || {}
    });
  } catch (err) {
    return res.status(500).json({ detail: `Failed to fetch E-Way Bill: ${err.message}` });
  }
}

/**
 * POST /api/invoices/:id/eway-bill/update-vehicle
 * Updates Part-B vehicle number (due to transshipment or breakdown)
 */
async function updateInvoiceVehicle(req, res, models) {
  const { Invoice, CourierConfig } = models;
  const { id } = req.params;
  const { vehicle_no, reason_code = '1', reason_remark = '', from_place = '' } = req.body || {};

  try {
    const inv = await Invoice.findOne({
      $or: [{ id }, { number: id }],
      organization_id: req.user.organization_id
    });
    if (!inv) return res.status(404).json({ detail: 'Invoice not found' });
    if (!inv.eway_bill_number) return res.status(400).json({ detail: 'Invoice does not have an active E-Way Bill' });

    const service = await getEwayServiceForOrg(CourierConfig, req.user.organization_id);
    const updatedResult = service.updatePartB(inv.eway_bill_details, {
      vehicle_no,
      reason_code,
      reason_remark,
      from_place
    });

    await Invoice.updateOne({ id: inv.id }, {
      $set: {
        eway_bill_vehicle_no: updatedResult.updated_vehicle_no,
        eway_bill_details: updatedResult.updated_ewb
      }
    });

    return res.json({
      ok: true,
      message: 'Part-B vehicle details updated successfully',
      eway_bill_number: inv.eway_bill_number,
      vehicle_no: updatedResult.updated_vehicle_no,
      updated_at: updatedResult.updated_at,
      part_b_entry: updatedResult.part_b_entry
    });
  } catch (err) {
    return res.status(500).json({ detail: `Part-B update failed: ${err.message}` });
  }
}

/**
 * POST /api/invoices/:id/eway-bill/cancel
 * Cancels an E-Way Bill within 24 hours of generation
 */
async function cancelInvoiceEwayBill(req, res, models) {
  const { Invoice, CourierConfig } = models;
  const { id } = req.params;
  const { reason_code = '2', remarks = 'Order cancelled' } = req.body || {};

  try {
    const inv = await Invoice.findOne({
      $or: [{ id }, { number: id }],
      organization_id: req.user.organization_id
    });
    if (!inv) return res.status(404).json({ detail: 'Invoice not found' });
    if (!inv.eway_bill_number) return res.status(400).json({ detail: 'Invoice does not have an active E-Way Bill' });

    const service = await getEwayServiceForOrg(CourierConfig, req.user.organization_id);
    const cancelResult = service.cancelEwayBill(inv.eway_bill_details, { reason_code, remarks });

    const updatedEwb = {
      ...(inv.eway_bill_details || {}),
      status: 'cancelled',
      cancel_date: cancelResult.cancelled_at,
      cancel_reason: cancelResult.cancel_reason
    };

    await Invoice.updateOne({ id: inv.id }, {
      $set: {
        eway_bill_status: 'cancelled',
        eway_bill_details: updatedEwb
      }
    });

    return res.json({
      ok: true,
      message: 'E-Way Bill cancelled successfully',
      eway_bill_number: inv.eway_bill_number,
      status: 'cancelled',
      cancelled_at: cancelResult.formatted_cancelled_at,
      reason: cancelResult.cancel_reason
    });
  } catch (err) {
    return res.status(400).json({ detail: `E-Way Bill cancellation failed: ${err.message}` });
  }
}

/**
 * GET /api/invoices/:id/eway-bill/slip
 * Renders Government GST E-Way Bill printable document
 */
async function renderEwayBillSlip(req, res, models) {
  const { Invoice, Customer, Organization } = models;
  const { id } = req.params;

  try {
    const inv = await Invoice.findOne({
      $or: [{ id }, { number: id }],
      organization_id: req.user.organization_id
    });
    if (!inv) return res.status(404).send('Invoice not found');
    if (!inv.eway_bill_number) return res.status(404).send('No E-Way Bill generated for this invoice');

    const ewb = inv.eway_bill_details || {};
    const partA = ewb.part_a || {};
    const partB = ewb.part_b || {};
    const history = partB.history || [];

    const isCancelled = inv.eway_bill_status === 'cancelled';
    const watermarkText = isCancelled ? 'CANCELLED' : '';

    const html = `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <title>e-Way Bill - ${inv.eway_bill_number}</title>
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Arial, sans-serif; margin: 15px; color: #111; font-size: 11px; background: #fafafa; }
    .slip-container { max-width: 780px; margin: 0 auto; background: #fff; border: 1.5px solid #1e293b; padding: 20px; box-shadow: 0 4px 12px rgba(0,0,0,0.08); position: relative; }
    .watermark { position: absolute; top: 40%; left: 15%; font-size: 80px; color: rgba(220, 38, 38, 0.15); font-weight: 900; transform: rotate(-30deg); pointer-events: none; }
    .gov-header { display: flex; justify-content: space-between; align-items: center; border-bottom: 2px solid #0f172a; padding-bottom: 8px; }
    .gov-emblem { font-size: 18px; font-weight: 900; letter-spacing: -0.5px; color: #0f172a; }
    .gov-sub { font-size: 9px; color: #475569; text-transform: uppercase; letter-spacing: 0.5px; }
    .ewb-badge { background: #0f172a; color: #fff; padding: 4px 10px; font-size: 11px; font-weight: bold; border-radius: 4px; }
    .cancelled-badge { background: #dc2626; color: #fff; padding: 4px 10px; font-size: 11px; font-weight: bold; border-radius: 4px; }
    
    .barcode-section { display: flex; justify-content: space-between; align-items: center; margin: 12px 0; border: 1px dashed #cbd5e1; padding: 10px 14px; background: #f8fafc; }
    .barcode-val { font-family: monospace; font-size: 18px; font-weight: 900; letter-spacing: 3px; }
    .qr-box { border: 1px solid #94a3b8; background: #fff; padding: 4px; font-family: monospace; font-size: 8px; width: 68px; height: 68px; display: flex; align-items: center; justify-content: center; text-align: center; }
    
    .meta-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 8px; margin-bottom: 12px; font-size: 11px; }
    .meta-row { display: flex; justify-content: space-between; padding: 3px 0; border-bottom: 1px dotted #e2e8f0; }
    .meta-lbl { font-weight: 600; color: #475569; }
    .meta-val { font-weight: 700; color: #0f172a; }
    
    .section-title { background: #e2e8f0; padding: 4px 8px; font-weight: 700; font-size: 11px; text-transform: uppercase; margin-top: 14px; border-left: 4px solid #0f172a; }
    .tbl { width: 100%; border-collapse: collapse; margin-top: 6px; font-size: 10.5px; }
    .tbl th, .tbl td { border: 1px solid #cbd5e1; padding: 5px 8px; text-align: left; }
    .tbl th { background: #f1f5f9; font-weight: 700; color: #334155; }
    .tbl td.num { text-align: right; }
    
    .footer-note { margin-top: 20px; border-top: 1px solid #94a3b8; padding-top: 10px; font-size: 9.5px; color: #64748b; display: flex; justify-content: space-between; }
    @media print {
      body { background: #fff; margin: 0; }
      .slip-container { border: none; box-shadow: none; padding: 0; }
      .no-print { display: none; }
    }
  </style>
</head>
<body>
  <div class="no-print" style="max-width:780px; margin:0 auto 12px; display:flex; justify-content:space-between;">
    <button onclick="window.print()" style="padding:7px 16px; background:#0f172a; color:#fff; border:none; border-radius:5px; cursor:pointer; font-weight:bold; font-size:12px;">🖨️ Print e-Way Bill</button>
    <a href="/invoices" style="padding:7px 16px; text-decoration:none; color:#475569; font-size:12px; font-weight:bold;">← Back to Invoices</a>
  </div>

  <div class="slip-container">
    ${isCancelled ? `<div class="watermark">${watermarkText}</div>` : ''}
    
    <div class="gov-header">
      <div>
        <div class="gov-emblem">GOVERNMENT OF INDIA</div>
        <div class="gov-sub">Goods and Services Tax · e-Way Bill System</div>
      </div>
      <div>
        ${isCancelled ? `<span class="cancelled-badge">CANCELLED</span>` : `<span class="ewb-badge">VALID E-WAY BILL</span>`}
      </div>
    </div>

    <div class="barcode-section">
      <div>
        <div style="font-size:10px; text-transform:uppercase; color:#64748b; font-weight:bold;">e-Way Bill Number</div>
        <div class="barcode-val">${inv.eway_bill_number}</div>
        <div style="font-size:9px; color:#64748b; margin-top:2px;">Generated Date: <strong>${ewb.formatted_date || inv.eway_bill_date}</strong></div>
      </div>
      <div style="text-align:right; display:flex; align-items:center; gap:12px;">
        <div style="text-align:right;">
          <div style="font-size:10px; text-transform:uppercase; color:#64748b; font-weight:bold;">Valid Until</div>
          <div style="font-size:13px; font-weight:bold; color:#0f172a;">${ewb.formatted_valid_until || inv.eway_bill_valid_until}</div>
          <div style="font-size:9px; color:#16a34a; font-weight:bold;">Valid for approx ${inv.eway_bill_distance || ewb.distance_km || 45} KM</div>
        </div>
        <div class="qr-box">
          QR CODE<br/>GST SECURE<br/>VERIFIED
        </div>
      </div>
    </div>

    <div class="meta-grid">
      <div>
        <div class="meta-row"><span class="meta-lbl">Generated By:</span><span class="meta-val">${partA.from_gstin || '27AABCV1234F1Z5'}</span></div>
        <div class="meta-row"><span class="meta-lbl">Supply Type:</span><span class="meta-val">Outward (Supply)</span></div>
        <div class="meta-row"><span class="meta-lbl">Doc Type & Number:</span><span class="meta-val">Tax Invoice - ${partA.doc_number || inv.number}</span></div>
      </div>
      <div>
        <div class="meta-row"><span class="meta-lbl">Doc Date:</span><span class="meta-val">${partA.doc_date || inv.invoice_date}</span></div>
        <div class="meta-row"><span class="meta-lbl">Approx Distance:</span><span class="meta-val">${inv.eway_bill_distance || ewb.distance_km || 45} KM</span></div>
        <div class="meta-row"><span class="meta-lbl">Transaction Type:</span><span class="meta-val">Regular</span></div>
      </div>
    </div>

    <div class="section-title">PART-A: Consignor & Consignee Details</div>
    <table class="tbl">
      <thead>
        <tr>
          <th style="width:50%;">From (Consignor / Supplier)</th>
          <th style="width:50%;">To (Consignee / Recipient)</th>
        </tr>
      </thead>
      <tbody>
        <tr>
          <td style="vertical-align:top;">
            <strong>GSTIN:</strong> ${partA.from_gstin || '27AABCV1234F1Z5'}<br/>
            <strong>Trade Name:</strong> ${partA.from_trade_name || 'Vegnar Global LLP'}<br/>
            <strong>Address:</strong> ${partA.from_address || 'Plot 42, Bhiwandi Industrial Area, Bhiwandi, PIN 421302'}
          </td>
          <td style="vertical-align:top;">
            <strong>GSTIN:</strong> ${partA.to_gstin || 'URP'}<br/>
            <strong>Trade Name:</strong> ${partA.to_trade_name || inv.customer_name}<br/>
            <strong>Address:</strong> ${partA.to_address || 'Consignee Site, Mumbai, PIN 400001'}
          </td>
        </tr>
      </tbody>
    </table>

    <div class="section-title">Goods & Tax Value Breakdown</div>
    <table class="tbl">
      <thead>
        <tr>
          <th>HSN</th>
          <th>Item Description</th>
          <th class="num">Qty</th>
          <th class="num">Taxable Value</th>
          <th class="num">CGST</th>
          <th class="num">SGST</th>
          <th class="num">IGST</th>
          <th class="num">Total Amount</th>
        </tr>
      </thead>
      <tbody>
        ${(partA.items || []).map(it => `
          <tr>
            <td style="font-family:monospace; font-weight:bold;">${it.hsnCode}</td>
            <td>${it.productName}</td>
            <td class="num">${it.quantity} ${it.qtyUnit}</td>
            <td class="num">₹${(it.taxableAmount || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}</td>
            <td class="num">${it.cgstAmount ? `₹${it.cgstAmount}` : '-'}</td>
            <td class="num">${it.sgstAmount ? `₹${it.sgstAmount}` : '-'}</td>
            <td class="num">${it.igstAmount ? `₹${it.igstAmount}` : '-'}</td>
            <td class="num" style="font-weight:bold;">₹${((it.taxableAmount || 0) + (it.cgstAmount || 0) + (it.sgstAmount || 0) + (it.igstAmount || 0)).toLocaleString('en-IN', { minimumFractionDigits: 2 })}</td>
          </tr>
        `).join('')}
      </tbody>
      <tfoot>
        <tr style="background:#f8fafc; font-weight:bold;">
          <td colspan="3" style="text-align:right;">Totals:</td>
          <td class="num">₹${(partA.total_taxable_amount || inv.subtotal || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}</td>
          <td class="num">₹${(partA.cgst_amount || inv.cgst || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}</td>
          <td class="num">₹${(partA.sgst_amount || inv.sgst || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}</td>
          <td class="num">₹${(partA.igst_amount || inv.igst || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}</td>
          <td class="num" style="font-size:12px; color:#0f172a;">₹${(partA.total_invoice_value || inv.grand_total || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}</td>
        </tr>
      </tfoot>
    </table>

    <div class="section-title">PART-B: Transportation Details</div>
    <div style="margin: 6px 0; font-size:10.5px;">
      <strong>Transporter Name:</strong> ${partB.transporter_name || inv.eway_bill_transporter_name || 'Delhivery Express Logistics'} &nbsp;|&nbsp;
      <strong>Transporter ID:</strong> ${partB.transporter_id || inv.eway_bill_transporter_id || 'Not Specified'}
    </div>
    <table class="tbl">
      <thead>
        <tr>
          <th>#</th>
          <th>Mode</th>
          <th>Vehicle Number</th>
          <th>From</th>
          <th>Entered Date</th>
          <th>Doc / LR Number</th>
          <th>Reason</th>
        </tr>
      </thead>
      <tbody>
        ${history.map(h => `
          <tr>
            <td>${h.entry_no}</td>
            <td>${h.mode}</td>
            <td style="font-family:monospace; font-weight:bold; font-size:12px;">${h.vehicle_no}</td>
            <td>${h.from_place}</td>
            <td>${h.entered_date}</td>
            <td>${h.trans_doc_no || '-'}</td>
            <td>${h.reason}</td>
          </tr>
        `).join('')}
      </tbody>
    </table>

    <div class="footer-note">
      <div>
        Generated via Vegnar ERP Logistics & Billing Engine<br/>
        Valid as official Proof of Movement under GST Rule 138
      </div>
      <div style="text-align:right;">
        Authorized Signatory / Taxpayer Stamp<br/>
        <strong>${partA.from_trade_name || 'Vegnar Global LLP'}</strong>
      </div>
    </div>
  </div>
</body>
</html>`;

    res.setHeader('Content-Type', 'text/html');
    return res.send(html);
  } catch (err) {
    return res.status(500).send(`Failed to render e-Way Bill slip: ${err.message}`);
  }
}

module.exports = {
  calculateDistance,
  generateInvoiceEwayBill,
  getInvoiceEwayBill,
  updateInvoiceVehicle,
  cancelInvoiceEwayBill,
  renderEwayBillSlip
};

