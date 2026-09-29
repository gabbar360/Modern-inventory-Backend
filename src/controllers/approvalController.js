import { Approval } from '../models/Approval.js';

export const getPendingApprovals = async (req, res) => {
  try {
    const orgId = req.user.organization_id;
    const approvals = await Approval.find({ organization_id: orgId, status: 'pending' }).lean();
    res.json(approvals);
  } catch (err) {
    res.status(500).json({ detail: err.message });
  }
};

export const getApprovals = async (req, res) => {
  try {
    const orgId = req.user.organization_id;
    const approvals = await Approval.find({ organization_id: orgId }).lean();
    res.json({
      quotations: approvals.filter(a => a.document_type === 'quotation'),
      purchase_orders: approvals.filter(a => a.document_type === 'purchase_order')
    });
  } catch (err) {
    res.status(500).json({ detail: err.message });
  }
};

export const approveDocument = async (req, res) => {
  try {
    const { id } = req.params;
    const { status } = req.body;
    await Approval.updateOne({ id }, { $set: { status: status || 'approved' } });
    res.json({ success: true, message: `Document ${status || 'approved'}` });
  } catch (err) {
    res.status(500).json({ detail: err.message });
  }
};

export const approveItem = async (req, res) => {
  res.json({ success: true, message: 'Approved' });
};

export const rejectItem = async (req, res) => {
  res.json({ success: true, message: 'Rejected' });
};

export default {
  getPendingApprovals,
  getApprovals,
  approveDocument,
  approveItem,
  rejectItem
};
