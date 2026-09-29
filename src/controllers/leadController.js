import { v4 as uuidv4 } from 'uuid';
import { Lead } from '../models/Lead.js';

export const getLeads = async (req, res) => {
  try {
    const leads = await Lead.find({ organization_id: req.user.organization_id }).sort({ created_at: -1 });
    res.json(leads);
  } catch (err) {
    res.status(500).json({ detail: err.message });
  }
};

export const createLead = async (req, res) => {
  try {
    const id = `lead_${uuidv4().slice(0, 8)}`;
    const lead = await Lead.create({
      ...req.body,
      id,
      organization_id: req.user.organization_id
    });
    res.status(201).json(lead);
  } catch (err) {
    res.status(500).json({ detail: err.message });
  }
};

export const updateLead = async (req, res) => {
  try {
    const lead = await Lead.findOneAndUpdate(
      { id: req.params.id, organization_id: req.user.organization_id },
      { ...req.body, updated_at: Date.now() },
      { new: true }
    );
    if (!lead) return res.status(404).json({ detail: 'Lead not found' });
    res.json(lead);
  } catch (err) {
    res.status(500).json({ detail: err.message });
  }
};

export const deleteLead = async (req, res) => {
  try {
    await Lead.findOneAndDelete({ id: req.params.id, organization_id: req.user.organization_id });
    res.json({ message: 'Lead deleted successfully' });
  } catch (err) {
    res.status(500).json({ detail: err.message });
  }
};

export default {
  getLeads,
  createLead,
  updateLead,
  deleteLead
};
