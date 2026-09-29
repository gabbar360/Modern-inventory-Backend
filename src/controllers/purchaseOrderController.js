import { v4 as uuidv4 } from 'uuid';
import { PurchaseOrder } from '../models/PurchaseOrder.js';

export const getPurchaseOrders = async (req, res) => {
  try {
    const pos = await PurchaseOrder.find({ organization_id: req.user.organization_id }).sort({ created_at: -1 });
    res.json(pos);
  } catch (err) {
    res.status(500).json({ detail: err.message });
  }
};

export const createPurchaseOrder = async (req, res) => {
  try {
    const id = `po_${uuidv4().slice(0, 8)}`;
    const count = await PurchaseOrder.countDocuments({ organization_id: req.user.organization_id });
    const po_number = req.body.po_number || `PO-2026-${String(count + 1).padStart(4, '0')}`;

    const po = await PurchaseOrder.create({
      ...req.body,
      id,
      po_number,
      organization_id: req.user.organization_id
    });
    res.status(201).json(po);
  } catch (err) {
    res.status(500).json({ detail: err.message });
  }
};

export default {
  getPurchaseOrders,
  createPurchaseOrder
};
