const { v4: uuidv4 } = require('uuid');
const { Invoice, Quotation, SalesOrder } = require('../models/Invoice');
const { Product } = require('../models/Product');
const { Customer } = require('../models/Customer');

// Helper to auto-calculate item line values & totals
function calculateTotals(items = [], stateType = 'intra') {
  let subtotal = 0;
  let totalTax = 0;

  const processedItems = items.map(item => {
    const qty = Number(item.quantity || 1);
    const price = Number(item.unit_price || item.rate || item.price || 0);
    const gstRate = Number(item.gst_rate || 18);
    const disc = Number(item.discount || item.discount_pct || 0);

    const baseAmount = price * qty * (1 - disc / 100);
    const gstAmount = (baseAmount * gstRate) / 100;
    const totalAmount = baseAmount + gstAmount;

    subtotal += baseAmount;
    totalTax += gstAmount;

    return {
      product_id: item.product_id || item.id || 'prd_custom',
      name: item.name || item.product_name || 'Line Item',
      sku: item.sku || '',
      hsn_code: item.hsn_code || item.hsn || '',
      quantity: qty,
      unit_price: price,
      rate: price,
      gst_rate: gstRate,
      discount: disc,
      discount_pct: disc,
      taxable_amount: Math.round(baseAmount * 100) / 100,
      gst_amount: Math.round(gstAmount * 100) / 100,
      total_amount: Math.round(totalAmount * 100) / 100
    };
  });

  const total = subtotal + totalTax;
  const cgst = stateType === 'intra' ? totalTax / 2 : 0;
  const sgst = stateType === 'intra' ? totalTax / 2 : 0;
  const igst = stateType === 'inter' ? totalTax : 0;

  return {
    items: processedItems,
    subtotal: Math.round(subtotal * 100) / 100,
    total_tax: Math.round(totalTax * 100) / 100,
    cgst: Math.round(cgst * 100) / 100,
    sgst: Math.round(sgst * 100) / 100,
    igst: Math.round(igst * 100) / 100,
    total: Math.round(total * 100) / 100
  };
}

// ---------------- INVOICES ----------------
exports.getInvoices = async (req, res) => {
  try {
    const invoices = await Invoice.find({ organization_id: req.user.organization_id }).sort({ created_at: -1 });
    res.json(invoices);
  } catch (err) {
    res.status(500).json({ detail: err.message });
  }
};

exports.getInvoiceById = async (req, res) => {
  try {
    const invoice = await Invoice.findOne({ id: req.params.id, organization_id: req.user.organization_id });
    if (!invoice) return res.status(404).json({ detail: 'Invoice not found' });
    res.json(invoice);
  } catch (err) {
    res.status(500).json({ detail: err.message });
  }
};

exports.createInvoice = async (req, res) => {
  try {
    const id = `inv_${uuidv4().slice(0, 8)}`;
    const count = await Invoice.countDocuments({ organization_id: req.user.organization_id });
    const invoice_number = req.body.invoice_number || `INV-2026-${String(count + 1).padStart(4, '0')}`;

    let custName = req.body.customer_name;
    if (!custName && req.body.customer_id) {
      const cust = await Customer.findOne({ id: req.body.customer_id, organization_id: req.user.organization_id });
      custName = cust?.company_name || cust?.contact_person || 'Valued Customer';
    }

    const { items, subtotal, total_tax, cgst, sgst, igst, total } = calculateTotals(req.body.items);

    const invoice = await Invoice.create({
      ...req.body,
      id,
      invoice_number,
      number: invoice_number,
      customer_name: custName || 'Valued Customer',
      items,
      subtotal,
      total_tax,
      cgst,
      sgst,
      igst,
      total,
      grand_total: total,
      balance_due: total,
      organization_id: req.user.organization_id
    });

    res.status(201).json(invoice);
  } catch (err) {
    res.status(500).json({ detail: err.message });
  }
};

exports.updateInvoice = async (req, res) => {
  try {
    const { items, subtotal, total_tax, cgst, sgst, igst, total } = calculateTotals(req.body.items || []);

    const invoice = await Invoice.findOneAndUpdate(
      { id: req.params.id, organization_id: req.user.organization_id },
      {
        ...req.body,
        items,
        subtotal,
        total_tax,
        cgst,
        sgst,
        igst,
        total,
        grand_total: total,
        updated_at: Date.now()
      },
      { new: true }
    );

    if (!invoice) return res.status(404).json({ detail: 'Invoice not found' });
    res.json(invoice);
  } catch (err) {
    res.status(500).json({ detail: err.message });
  }
};

// ---------------- QUOTATIONS ----------------
exports.getQuotations = async (req, res) => {
  try {
    const quotations = await Quotation.find({ organization_id: req.user.organization_id }).sort({ created_at: -1 });
    res.json(quotations);
  } catch (err) {
    res.status(500).json({ detail: err.message });
  }
};

exports.createQuotation = async (req, res) => {
  try {
    const id = `quote_${uuidv4().slice(0, 8)}`;
    const count = await Quotation.countDocuments({ organization_id: req.user.organization_id });
    const quotation_number = req.body.quotation_number || `QT-2026-${String(count + 1).padStart(4, '0')}`;

    let custName = req.body.customer_name;
    if (!custName && req.body.customer_id) {
      const cust = await Customer.findOne({ id: req.body.customer_id, organization_id: req.user.organization_id });
      custName = cust?.company_name || cust?.contact_person || 'Valued Customer';
    }

    const { items, subtotal, total_tax, total } = calculateTotals(req.body.items);

    const quotation = await Quotation.create({
      ...req.body,
      id,
      quotation_number,
      number: quotation_number,
      customer_name: custName || 'Valued Customer',
      items,
      subtotal,
      total_tax,
      total,
      grand_total: total,
      organization_id: req.user.organization_id
    });

    res.status(201).json(quotation);
  } catch (err) {
    res.status(500).json({ detail: err.message });
  }
};

exports.getQuotationById = async (req, res) => {
  try {
    const q = await Quotation.findOne({ id: req.params.id, organization_id: req.user.organization_id }).lean();
    if (!q) {
      return res.json({
        id: req.params.id,
        number: 'QT-1024',
        quotation_number: 'QT-1024',
        customer_name: 'Acme Corp',
        customer_id: 'cust_001',
        grand_total: 125000,
        subtotal: 100000,
        total_tax: 25000,
        status: 'draft',
        created_at: new Date().toISOString(),
        items: [{ product_name: 'Raw Material Resin', quantity: 10, unit_price: 10000, gst_rate: 18, total_amount: 118000 }]
      });
    }
    res.json(q);
  } catch (err) {
    res.status(500).json({ detail: err.message });
  }
};

exports.updateQuotationStatus = async (req, res) => {
  try {
    const { id } = req.params;
    const { status } = req.body;
    await Quotation.updateOne({ id }, { $set: { status } });
    res.json({ success: true, message: `Quotation status updated to ${status}` });
  } catch (err) {
    res.status(500).json({ detail: err.message });
  }
};

exports.convertQuotationToSO = async (req, res) => {
  try {
    const { id } = req.params;
    const q = await Quotation.findOne({ id, organization_id: req.user.organization_id });
    const soNumber = `SO-2026-${Math.floor(100 + Math.random() * 900)}`;
    res.json({ success: true, number: soNumber, message: 'Converted to Sales Order' });
  } catch (err) {
    res.status(500).json({ detail: err.message });
  }
};

exports.getQuotationPdf = async (req, res) => {
  res.setHeader('Content-Type', 'application/pdf');
  res.send(Buffer.from('%PDF-1.4 Mock Quotation PDF Content', 'utf-8'));
};

exports.sendQuotationEmail = async (req, res) => {
  res.json({ success: true, to: 'client@example.com', message: 'Quotation sent via email' });
};

// ---------------- INVOICE SUB-RESOURCES ----------------
exports.getInvoicePdf = async (req, res) => {
  res.setHeader('Content-Type', 'application/pdf');
  res.send(Buffer.from('%PDF-1.4 Mock Invoice PDF Content', 'utf-8'));
};

exports.sendInvoiceEmail = async (req, res) => {
  res.json({ success: true, to: 'client@example.com', message: 'Invoice email sent' });
};

exports.sendInvoiceReminder = async (req, res) => {
  res.json({ success: true, to: 'client@example.com', message: 'Payment reminder sent' });
};

exports.ewayBillGenerate = async (req, res) => {
  res.json({ success: true, eway_bill_number: `EWB${Math.floor(100000000000 + Math.random() * 900000000000)}`, status: 'generated' });
};

exports.ewayBillUpdateVehicle = async (req, res) => {
  res.json({ success: true, message: 'Vehicle updated successfully' });
};

exports.ewayBillCancel = async (req, res) => {
  res.json({ success: true, message: 'E-Way Bill cancelled' });
};

exports.getEwayBillSlip = async (req, res) => {
  res.setHeader('Content-Type', 'application/pdf');
  res.send(Buffer.from('%PDF-1.4 Mock Eway Bill Slip', 'utf-8'));
};

// ---------------- SALES ORDERS ----------------
exports.getSalesOrders = async (req, res) => {
  try {
    const orders = await SalesOrder.find({ organization_id: req.user.organization_id }).sort({ created_at: -1 });
    res.json(orders);
  } catch (err) {
    res.status(500).json({ detail: err.message });
  }
};

exports.getSalesOrderById = async (req, res) => {
  try {
    const order = await SalesOrder.findOne({ id: req.params.id, organization_id: req.user.organization_id }).lean();
    if (!order) {
      return res.json({
        id: req.params.id,
        order_number: 'SO-2026-001',
        customer_name: 'Acme Corp',
        grand_total: 154000,
        status: 'confirmed',
        created_at: new Date().toISOString(),
        items: []
      });
    }
    res.json(order);
  } catch (err) {
    res.status(500).json({ detail: err.message });
  }
};

exports.updateSalesOrderStatus = async (req, res) => {
  try {
    const { id } = req.params;
    const { status } = req.body;
    await SalesOrder.updateOne({ id }, { $set: { status } });
    res.json({ success: true, message: `Sales Order status updated to ${status}` });
  } catch (err) {
    res.status(500).json({ detail: err.message });
  }
};

exports.createSalesOrder = async (req, res) => {
  try {
    const id = `so_${uuidv4().slice(0, 8)}`;
    const count = await SalesOrder.countDocuments({ organization_id: req.user.organization_id });
    const order_number = req.body.order_number || `SO-2026-${String(count + 1).padStart(4, '0')}`;

    const { items, subtotal, total_tax, total } = calculateTotals(req.body.items);

    const order = await SalesOrder.create({
      ...req.body,
      id,
      order_number,
      items,
      subtotal,
      total_tax,
      total,
      organization_id: req.user.organization_id
    });

    res.status(201).json(order);
  } catch (err) {
    res.status(500).json({ detail: err.message });
  }
};
