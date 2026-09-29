import { v4 as uuidv4 } from 'uuid';
import { Payment } from '../models/Payment.js';

export const getPayments = async (req, res) => {
  try {
    const items = await Payment.find({ organization_id: req.user.organization_id, payment_type: 'received' }).sort({ created_at: -1 });
    res.json(items);
  } catch (err) {
    res.status(500).json({ detail: err.message });
  }
};

export const createPayment = async (req, res) => {
  try {
    const count = await Payment.countDocuments({ organization_id: req.user.organization_id, payment_type: 'received' });
    const payment = new Payment({
      id: `pay_${uuidv4().slice(0, 8)}`,
      organization_id: req.user.organization_id,
      payment_type: 'received',
      number: `PAY-2026-${String(count + 1).padStart(4, '0')}`,
      ...req.body
    });
    await payment.save();
    res.status(201).json(payment);
  } catch (err) {
    res.status(500).json({ detail: err.message });
  }
};

export const getPaymentsMade = async (req, res) => {
  try {
    const items = await Payment.find({ organization_id: req.user.organization_id, payment_type: 'made' }).sort({ created_at: -1 });
    res.json(items);
  } catch (err) {
    res.status(500).json({ detail: err.message });
  }
};

export const createPaymentMade = async (req, res) => {
  try {
    const count = await Payment.countDocuments({ organization_id: req.user.organization_id, payment_type: 'made' });
    const payment = new Payment({
      id: `pm_${uuidv4().slice(0, 8)}`,
      organization_id: req.user.organization_id,
      payment_type: 'made',
      number: `PM-2026-${String(count + 1).padStart(4, '0')}`,
      ...req.body
    });
    await payment.save();
    res.status(201).json(payment);
  } catch (err) {
    res.status(500).json({ detail: err.message });
  }
};

export const getCreditNotes = async (req, res) => res.json([]);
export const createCreditNote = async (req, res) => res.status(201).json({ success: true, message: 'Credit Note issued' });
export const getDebitNotes = async (req, res) => res.json([]);
export const createDebitNote = async (req, res) => res.status(201).json({ success: true, message: 'Debit Note issued' });

export default {
  getPayments,
  createPayment,
  getPaymentsMade,
  createPaymentMade,
  getCreditNotes,
  createCreditNote,
  getDebitNotes,
  createDebitNote
};
