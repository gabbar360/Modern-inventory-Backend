const { v4: uuidv4 } = require('uuid');
const { Vendor, PurchaseOrder, VendorBill } = require('../models/Vendor');

// ---------------- VENDORS ----------------
exports.getVendors = async (req, res) => {
  try {
    const vendors = await Vendor.find({ organization_id: req.user.organization_id }).sort({ created_at: -1 });
    res.json(vendors);
  } catch (err) {
    res.status(500).json({ detail: err.message });
  }
};

exports.createVendor = async (req, res) => {
  try {
    const id = `vnd_${uuidv4().slice(0, 8)}`;
    const vendor = await Vendor.create({
      ...req.body,
      id,
      organization_id: req.user.organization_id
    });
    res.status(201).json(vendor);
  } catch (err) {
    res.status(500).json({ detail: err.message });
  }
};

exports.updateVendor = async (req, res) => {
  try {
    const vendor = await Vendor.findOneAndUpdate(
      { id: req.params.id, organization_id: req.user.organization_id },
      { ...req.body, updated_at: Date.now() },
      { new: true }
    );
    if (!vendor) return res.status(404).json({ detail: 'Vendor not found' });
    res.json(vendor);
  } catch (err) {
    res.status(500).json({ detail: err.message });
  }
};

exports.deleteVendor = async (req, res) => {
  try {
    await Vendor.findOneAndDelete({ id: req.params.id, organization_id: req.user.organization_id });
    res.json({ message: 'Vendor deleted successfully' });
  } catch (err) {
    res.status(500).json({ detail: err.message });
  }
};


// ---------------- PURCHASE ORDERS ----------------
exports.getPurchaseOrders = async (req, res) => {
  try {
    const pos = await PurchaseOrder.find({ organization_id: req.user.organization_id }).sort({ created_at: -1 });
    res.json(pos);
  } catch (err) {
    res.status(500).json({ detail: err.message });
  }
};

exports.createPurchaseOrder = async (req, res) => {
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

// ---------------- VENDOR BILLS ----------------
exports.getVendorBills = async (req, res) => {
  try {
    const bills = await VendorBill.find({ organization_id: req.user.organization_id }).sort({ created_at: -1 });
    res.json(bills);
  } catch (err) {
    res.status(500).json({ detail: err.message });
  }
};

exports.createVendorBill = async (req, res) => {
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
