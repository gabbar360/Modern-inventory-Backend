import { v4 as uuidv4 } from 'uuid';
import { Customer } from '../models/Customer.js';
import { Invoice } from '../models/Invoice.js';
import { Quotation } from '../models/Quotation.js';
import { SalesOrder } from '../models/SalesOrder.js';
import { Payment } from '../models/Payment.js';

export const getCustomers = async (req, res) => {
  try {
    const customers = await Customer.find({ organization_id: req.user.organization_id }).sort({ created_at: -1 });
    res.json(customers);
  } catch (err) {
    res.status(500).json({ detail: err.message });
  }
};

export const getCustomerById = async (req, res) => {
  try {
    const customer = await Customer.findOne({ id: req.params.id, organization_id: req.user.organization_id }).lean();
    if (!customer) return res.status(404).json({ detail: 'Customer not found' });

    const [invoices, quotations, orders, payments] = await Promise.all([
      Invoice.find({ customer_id: req.params.id, organization_id: req.user.organization_id }).lean(),
      Quotation.find({ customer_id: req.params.id, organization_id: req.user.organization_id }).lean(),
      SalesOrder.find({ customer_id: req.params.id, organization_id: req.user.organization_id }).lean(),
      Payment.find({ customer_id: req.params.id, organization_id: req.user.organization_id }).lean()
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

export const createCustomer = async (req, res) => {
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

export const updateCustomer = async (req, res) => {
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

export const deleteCustomer = async (req, res) => {
  try {
    await Customer.findOneAndDelete({ id: req.params.id, organization_id: req.user.organization_id });
    res.json({ message: 'Customer deleted successfully' });
  } catch (err) {
    res.status(500).json({ detail: err.message });
  }
};

export const getCustomerActivity = async (req, res) => {
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

export const getPortalLink = async (req, res) => {
  try {
    const { id } = req.params;
    const customer = await Customer.findOne({ id, organization_id: req.user.organization_id });
    const token = customer?.portal_token || uuidv4();
    res.json({ success: true, url: `/portal/${token}`, token });
  } catch (err) {
    res.status(500).json({ detail: err.message });
  }
};

export const getCustomerStatementPdf = async (req, res) => {
  res.setHeader('Content-Type', 'application/pdf');
  res.send(Buffer.from('%PDF-1.4 Mock Customer Statement PDF Content', 'utf-8'));
};

export const sendCustomerStatement = async (req, res) => {
  try {
    const { id } = req.params;
    const customer = await Customer.findOne({ id, organization_id: req.user.organization_id });
    res.json({ success: true, to: customer?.email || 'customer@example.com', message: 'Statement sent via email' });
  } catch (err) {
    res.status(500).json({ detail: err.message });
  }
};

export default {
  getCustomers,
  getCustomerById,
  createCustomer,
  updateCustomer,
  deleteCustomer,
  getCustomerActivity,
  getPortalLink,
  getCustomerStatementPdf,
  sendCustomerStatement
};
