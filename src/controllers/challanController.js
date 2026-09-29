import { v4 as uuidv4 } from 'uuid';
import { Challan } from '../models/Challan.js';

export const getChallans = async (req, res) => {
  try {
    const items = await Challan.find({ organization_id: req.user.organization_id }).sort({ created_at: -1 });
    res.json(items);
  } catch (err) {
    res.status(500).json({ detail: err.message });
  }
};

export const createChallan = async (req, res) => {
  try {
    const count = await Challan.countDocuments({ organization_id: req.user.organization_id });
    const challan = new Challan({
      id: `chn_${uuidv4().slice(0, 8)}`,
      organization_id: req.user.organization_id,
      number: `DC-2026-${String(count + 1).padStart(4, '0')}`,
      ...req.body
    });
    await challan.save();
    res.status(201).json(challan);
  } catch (err) {
    res.status(500).json({ detail: err.message });
  }
};

export default {
  getChallans,
  createChallan
};
