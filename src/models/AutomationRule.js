import mongoose from 'mongoose';

export const AutomationRuleSchema = new mongoose.Schema({
  id: { type: String, required: true, unique: true },
  organization_id: { type: String, required: true, index: true },
  name: { type: String, required: true },
  trigger: { type: String, required: true },
  action: { type: String, required: true },
  template: { type: String, default: '' },
  enabled: { type: Boolean, default: true },
  created_at: { type: Date, default: Date.now }
});

export const AutomationRule = mongoose.models.AutomationRule || mongoose.model('AutomationRule', AutomationRuleSchema);
export default AutomationRule;
