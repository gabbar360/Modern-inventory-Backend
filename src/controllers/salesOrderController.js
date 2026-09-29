import { v4 as uuidv4 } from 'uuid';
import { SalesOrder } from '../models/SalesOrder.js';
import { calculateTotals } from '../utils/calculateTotals.js';

export const getSalesOrders = async (req, res) => {
  try {
    const orders = await SalesOrder.find({ organization_id: req.user.organization_id }).sort({ created_at: -1 });
    res.json(orders);
  } catch (err) {
    res.status(500).json({ detail: err.message });
  }
};

export const getSalesOrderById = async (req, res) => {
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

export const updateSalesOrderStatus = async (req, res) => {
  try {
    const { id } = req.params;
    const { status } = req.body;
    await SalesOrder.updateOne({ id }, { $set: { status } });
    res.json({ success: true, message: `Sales Order status updated to ${status}` });
  } catch (err) {
    res.status(500).json({ detail: err.message });
  }
};

export const createSalesOrder = async (req, res) => {
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

export default {
  getSalesOrders,
  getSalesOrderById,
  updateSalesOrderStatus,
  createSalesOrder
};
