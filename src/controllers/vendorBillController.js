import { v4 as uuidv4 } from 'uuid';
import { VendorBill } from '../models/VendorBill.js';

export const getVendorBills = async (req, res) => {
  try {
    const bills = await VendorBill.find({ organization_id: req.user.organization_id }).sort({ created_at: -1 });
    res.json(bills);
  } catch (err) {
    res.status(500).json({ detail: err.message });
  }
};

export const createVendorBill = async (req, res) => {
  try {
    const id = `bill_${uuidv4().slice(0, 8)}`;
    const count = await VendorBill.countDocuments({ organization_id: req.user.organization_id });
    const bill_number = req.body.bill_number || `BILL-2026-${String(count + 1).padStart(4, '0')}`;

    const bill = await VendorBill.create({
      ...req.body,
      id,
      bill_number,
      balance_due: req.body.total || 0,
      organization_id: req.user.organization_id
    });
    res.status(201).json(bill);
  } catch (err) {
    res.status(500).json({ detail: err.message });
  }
};

export default {
  getVendorBills,
  createVendorBill
};
