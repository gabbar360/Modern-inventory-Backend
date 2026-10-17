import { v4 as uuidv4 } from 'uuid';
import { Vendor } from '../models/Vendor.js';

export const getVendors = async (req, res) => {
  try {
    const vendors = await Vendor.find({ organization_id: req.user.organization_id }).sort({ created_at: -1 });
    res.json(vendors);
  } catch (err) {
    res.status(500).json({ detail: err.message });
  }
};

export const createVendor = async (req, res) => {
  try {
    const id = req.body.id || `vnd_${uuidv4().slice(0, 8)}`;
    const name = req.body.name || req.body.company_name || 'Vendor';
    const company_name = req.body.company_name || name;
    const phone = req.body.phone || req.body.mobile || '';

    const vendor = await Vendor.create({
      ...req.body,
      id,
      name,
      company_name,
      phone,
      organization_id: req.user.organization_id
    });
    res.status(201).json(vendor);
  } catch (err) {
    res.status(500).json({ detail: err.message });
  }
};

export const updateVendor = async (req, res) => {
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

export const deleteVendor = async (req, res) => {
  try {
    await Vendor.findOneAndDelete({ id: req.params.id, organization_id: req.user.organization_id });
    res.json({ message: 'Vendor deleted successfully' });
  } catch (err) {
    res.status(500).json({ detail: err.message });
  }
};

export default {
  getVendors,
  createVendor,
  updateVendor,
  deleteVendor
};
