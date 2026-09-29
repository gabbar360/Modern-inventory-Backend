import { v4 as uuidv4 } from 'uuid';
import { Template } from '../models/Template.js';

export const getTemplates = async (req, res) => {
  try {
    const templates = await Template.find({ organization_id: req.user.organization_id }).lean();
    res.json(templates);
  } catch (err) {
    res.status(500).json({ detail: err.message });
  }
};

export const createTemplate = async (req, res) => {
  try {
    const template = new Template({
      id: `tmpl_${uuidv4().slice(0, 8)}`,
      organization_id: req.user.organization_id,
      ...req.body
    });
    await template.save();
    res.status(201).json(template);
  } catch (err) {
    res.status(500).json({ detail: err.message });
  }
};

export default {
  getTemplates,
  createTemplate
};
