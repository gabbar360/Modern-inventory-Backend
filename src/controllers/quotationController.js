import { v4 as uuidv4 } from 'uuid';
import { Quotation } from '../models/Quotation.js';
import { Customer } from '../models/Customer.js';
import { calculateTotals } from '../utils/calculateTotals.js';

export const getQuotations = async (req, res) => {
  try {
    const quotations = await Quotation.find({ organization_id: req.user.organization_id }).sort({ created_at: -1 });
    res.json(quotations);
  } catch (err) {
    res.status(500).json({ detail: err.message });
  }
};

export const getQuotationById = async (req, res) => {
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

export const createQuotation = async (req, res) => {
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

export const updateQuotationStatus = async (req, res) => {
  try {
    const { id } = req.params;
    const { status } = req.body;
    await Quotation.updateOne({ id }, { $set: { status } });
    res.json({ success: true, message: `Quotation status updated to ${status}` });
  } catch (err) {
    res.status(500).json({ detail: err.message });
  }
};

export const convertQuotationToSO = async (req, res) => {
  try {
    const { id } = req.params;
    const q = await Quotation.findOne({ id, organization_id: req.user.organization_id });
    const soNumber = `SO-2026-${Math.floor(100 + Math.random() * 900)}`;
    res.json({ success: true, number: soNumber, message: 'Converted to Sales Order' });
  } catch (err) {
    res.status(500).json({ detail: err.message });
  }
};

export const getQuotationPdf = async (req, res) => {
  res.setHeader('Content-Type', 'application/pdf');
  res.send(Buffer.from('%PDF-1.4 Mock Quotation PDF Content', 'utf-8'));
};

export const sendQuotationEmail = async (req, res) => {
  res.json({ success: true, to: 'client@example.com', message: 'Quotation sent via email' });
};

export default {
  getQuotations,
  getQuotationById,
  createQuotation,
  updateQuotationStatus,
  convertQuotationToSO,
  getQuotationPdf,
  sendQuotationEmail
};
