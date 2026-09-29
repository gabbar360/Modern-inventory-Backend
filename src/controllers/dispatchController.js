import { v4 as uuidv4 } from 'uuid';
import { Dispatch } from '../models/Dispatch.js';

export const getDispatches = async (req, res) => {
  try {
    const items = await Dispatch.find({ organization_id: req.user.organization_id }).sort({ created_at: -1 });
    res.json(items);
  } catch (err) {
    res.status(500).json({ detail: err.message });
  }
};

export const createDispatch = async (req, res) => {
  try {
    const dispatch = new Dispatch({
      id: `dsp_${uuidv4().slice(0, 8)}`,
      organization_id: req.user.organization_id,
      tracking_number: `DELH${Math.floor(10000000 + Math.random() * 90000000)}`,
      ...req.body
    });
    await dispatch.save();
    res.status(201).json(dispatch);
  } catch (err) {
    res.status(500).json({ detail: err.message });
  }
};

export const trackDispatch = async (req, res) => {
  res.json({
    tracking_number: req.params.id,
    status: 'In Transit',
    current_location: 'Central Distribution Hub, Mumbai',
    estimated_delivery: new Date(Date.now() + 86400000 * 2).toISOString()
  });
};

export const cancelDispatch = async (req, res) => {
  res.json({ success: true, message: 'Dispatch cancelled' });
};

export const getPincodeInfo = async (req, res) => {
  const { pincode } = req.params;
  res.json({
    pincode: pincode || '421302',
    city: 'Bhiwandi',
    state: 'Maharashtra',
    serviceable: true,
    estimated_distance_km: 35
  });
};

export const getFreightEstimate = async (req, res) => {
  res.json({
    success: true,
    estimated_cost: 450,
    carrier: 'Delhivery B2B Express',
    estimated_days: 2
  });
};

export const getCourierConfig = async (req, res) => {
  res.json({ partner: 'Delhivery', api_key_configured: true });
};

export default {
  getDispatches,
  createDispatch,
  trackDispatch,
  cancelDispatch,
  getPincodeInfo,
  getFreightEstimate,
  getCourierConfig
};
