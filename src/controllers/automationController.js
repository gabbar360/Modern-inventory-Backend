import { v4 as uuidv4 } from 'uuid';
import { AutomationRule } from '../models/AutomationRule.js';

export const getAutomationRules = async (req, res) => {
  try {
    const rules = await AutomationRule.find({ organization_id: req.user.organization_id }).lean();
    res.json(rules);
  } catch (err) {
    res.status(500).json({ detail: err.message });
  }
};

export const createAutomationRule = async (req, res) => {
  try {
    const rule = new AutomationRule({
      id: `rule_${uuidv4().slice(0, 8)}`,
      organization_id: req.user.organization_id,
      ...req.body
    });
    await rule.save();
    res.status(201).json(rule);
  } catch (err) {
    res.status(500).json({ detail: err.message });
  }
};

export const toggleAutomationRule = async (req, res) => {
  try {
    const { id } = req.params;
    const { enabled } = req.body;
    await AutomationRule.updateOne({ id }, { $set: { enabled } });
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ detail: err.message });
  }
};

export default {
  getAutomationRules,
  createAutomationRule,
  toggleAutomationRule
};
