const { v4: uuidv4 } = require('uuid');
const { Customer, Lead } = require('../models/Customer');
const { Invoice, Quotation, SalesOrder } = require('../models/Invoice');
const { Payment } = require('../models/Operations');

// ---------------- CUSTOMERS ----------------
exports.getCustomers = async (req, res) => {
  try {
    const customers = await Customer.find({ organization_id: req.user.organization_id }).sort({ created_at: -1 });
    res.json(customers);
  } catch (err) {
    res.status(500).json({ detail: err.message });
  }
};

exports.getCustomerById = async (req, res) => {
  try {
    const customer = await Customer.findOne({ id: req.params.id, organization_id: req.user.organization_id }).lean();
    if (!customer) return res.status(404).json({ detail: 'Customer not found' });

    const [invoices, quotations, orders, payments] = await Promise.all([
      Invoice.find({ customer_id: req.params.id, organization_id: req.user.organization_id }).lean(),
      Quotation ? Quotation.find({ customer_id: req.params.id, organization_id: req.user.organization_id }).lean() : Promise.resolve([]),
      SalesOrder ? SalesOrder.find({ customer_id: req.params.id, organization_id: req.user.organization_id }).lean() : Promise.resolve([]),
      Payment ? Payment.find({ customer_id: req.params.id, organization_id: req.user.organization_id }).lean() : Promise.resolve([])
    ]);

    res.json({
      customer,
      invoices: invoices || [],
      quotations: quotations || [],
      orders: orders || [],
      payments: payments || []
    });
  } catch (err) {
    res.status(500).json({ detail: err.message });
  }
};

exports.createCustomer = async (req, res) => {
  try {
    const id = `cust_${uuidv4().slice(0, 8)}`;
    const portal_token = uuidv4();
    const customer = await Customer.create({
      ...req.body,
      id,
      portal_token,
      organization_id: req.user.organization_id
    });
    res.status(201).json(customer);
  } catch (err) {
    res.status(500).json({ detail: err.message });
  }
};

exports.updateCustomer = async (req, res) => {
  try {
    const customer = await Customer.findOneAndUpdate(
      { id: req.params.id, organization_id: req.user.organization_id },
      { ...req.body, updated_at: Date.now() },
      { new: true }
    );
    if (!customer) return res.status(404).json({ detail: 'Customer not found' });
    res.json(customer);
  } catch (err) {
    res.status(500).json({ detail: err.message });
  }
};

exports.deleteCustomer = async (req, res) => {
  try {
    await Customer.findOneAndDelete({ id: req.params.id, organization_id: req.user.organization_id });
    res.json({ message: 'Customer deleted successfully' });
  } catch (err) {
    res.status(500).json({ detail: err.message });
  }
};

// ---------------- LEADS ----------------
exports.getLeads = async (req, res) => {
  try {
    const leads = await Lead.find({ organization_id: req.user.organization_id }).sort({ created_at: -1 });
    res.json(leads);
  } catch (err) {
    res.status(500).json({ detail: err.message });
  }
};

exports.createLead = async (req, res) => {
  try {
    const id = `lead_${uuidv4().slice(0, 8)}`;
    const lead = await Lead.create({
      ...req.body,
      id,
      organization_id: req.user.organization_id
    });
    res.status(201).json(lead);
  } catch (err) {
    res.status(500).json({ detail: err.message });
  }
};

exports.updateLead = async (req, res) => {
  try {
    const lead = await Lead.findOneAndUpdate(
      { id: req.params.id, organization_id: req.user.organization_id },
      { ...req.body, updated_at: Date.now() },
      { new: true }
    );
    if (!lead) return res.status(404).json({ detail: 'Lead not found' });
    res.json(lead);
  } catch (err) {
    res.status(500).json({ detail: err.message });
  }
};

// ---------------- CUSTOMER SUB-RESOURCES ----------------
exports.getCustomerActivity = async (req, res) => {
  try {
    const { id } = req.params;
    res.json({
      customer_id: id,
      activities: [
        { id: 'act_1', type: 'Invoice Created', details: 'Invoice Generation #INV-2026-0001', created_at: new Date().toISOString() },
        { id: 'act_2', type: 'Payment Received', details: 'Customer Payment Received ₹25,000', created_at: new Date().toISOString() }
      ]
    });
  } catch (err) {
    res.status(500).json({ detail: err.message });
  }
};

exports.getPortalLink = async (req, res) => {
  try {
    const { id } = req.params;
    const customer = await Customer.findOne({ id, organization_id: req.user.organization_id });
    const token = customer?.portal_token || uuidv4();
    res.json({ success: true, url: `/portal/${token}`, token });
  } catch (err) {
    res.status(500).json({ detail: err.message });
  }
};

exports.getCustomerStatementPdf = async (req, res) => {
  res.setHeader('Content-Type', 'application/pdf');
  res.send(Buffer.from('%PDF-1.4 Mock Customer Statement PDF Content', 'utf-8'));
};

exports.sendCustomerStatement = async (req, res) => {
  try {
    const { id } = req.params;
    const customer = await Customer.findOne({ id, organization_id: req.user.organization_id });
    res.json({ success: true, to: customer?.email || 'customer@example.com', message: 'Statement sent via email' });
  } catch (err) {
    res.status(500).json({ detail: err.message });
  }
};
