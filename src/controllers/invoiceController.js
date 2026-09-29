import { v4 as uuidv4 } from 'uuid';
import { Invoice } from '../models/Invoice.js';
import { Customer } from '../models/Customer.js';
import { calculateTotals } from '../utils/calculateTotals.js';

export const getInvoices = async (req, res) => {
  try {
    const invoices = await Invoice.find({ organization_id: req.user.organization_id }).sort({ created_at: -1 });
    res.json(invoices);
  } catch (err) {
    res.status(500).json({ detail: err.message });
  }
};

export const getInvoiceById = async (req, res) => {
  try {
    const invoice = await Invoice.findOne({ id: req.params.id, organization_id: req.user.organization_id });
    if (!invoice) return res.status(404).json({ detail: 'Invoice not found' });
    res.json(invoice);
  } catch (err) {
    res.status(500).json({ detail: err.message });
  }
};

export const createInvoice = async (req, res) => {
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

export const updateInvoice = async (req, res) => {
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

export const getInvoicePdf = async (req, res) => {
  res.setHeader('Content-Type', 'application/pdf');
  res.send(Buffer.from('%PDF-1.4 Mock Invoice PDF Content', 'utf-8'));
};

export const sendInvoiceEmail = async (req, res) => {
  res.json({ success: true, to: 'client@example.com', message: 'Invoice email sent' });
};

export const sendInvoiceReminder = async (req, res) => {
  res.json({ success: true, to: 'client@example.com', message: 'Payment reminder sent' });
};

export const ewayBillGenerate = async (req, res) => {
  res.json({ success: true, eway_bill_number: `EWB${Math.floor(100000000000 + Math.random() * 900000000000)}`, status: 'generated' });
};

export const ewayBillUpdateVehicle = async (req, res) => {
  res.json({ success: true, message: 'Vehicle updated successfully' });
};

export const ewayBillCancel = async (req, res) => {
  res.json({ success: true, message: 'E-Way Bill cancelled' });
};

export const getEwayBillSlip = async (req, res) => {
  res.setHeader('Content-Type', 'application/pdf');
  res.send(Buffer.from('%PDF-1.4 Mock Eway Bill Slip', 'utf-8'));
};

export default {
  getInvoices,
  getInvoiceById,
  createInvoice,
  updateInvoice,
  getInvoicePdf,
  sendInvoiceEmail,
  sendInvoiceReminder,
  ewayBillGenerate,
  ewayBillUpdateVehicle,
  ewayBillCancel,
  getEwayBillSlip
};
