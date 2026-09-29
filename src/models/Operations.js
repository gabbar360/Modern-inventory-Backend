import mongoose from 'mongoose';

// Journal Entry (Accounting / Double-Entry Ledger)
const JournalLineSchema = new mongoose.Schema({
  account_id: { type: String, required: true },
  debit: { type: Number, default: 0 },
  credit: { type: Number, default: 0 }
});

const JournalEntrySchema = new mongoose.Schema({
  id: { type: String, required: true, unique: true },
  organization_id: { type: String, required: true, index: true },
  date: { type: Date, default: Date.now },
  reference_type: { type: String, required: true },
  description: { type: String, default: '' },
  lines: [JournalLineSchema],
  created_at: { type: Date, default: Date.now }
});

// Automation Rules
const AutomationRuleSchema = new mongoose.Schema({
  id: { type: String, required: true, unique: true },
  organization_id: { type: String, required: true, index: true },
  name: { type: String, required: true },
  trigger: { type: String, required: true },
  action: { type: String, required: true },
  template: { type: String, default: '' },
  enabled: { type: Boolean, default: true },
  created_at: { type: Date, default: Date.now }
});

// Document / Invoice Templates
const TemplateSchema = new mongoose.Schema({
  id: { type: String, required: true, unique: true },
  organization_id: { type: String, required: true, index: true },
  name: { type: String, required: true },
  type: { type: String, default: 'invoice' },
  document_type: { type: String, default: 'invoice' },
  header: { type: String, default: '' },
  footer: { type: String, default: '' },
  html_content: { type: String, default: '' },
  is_default: { type: Boolean, default: false },
  created_at: { type: Date, default: Date.now }
});

// Marketing / WhatsApp / Email Broadcasts
const BroadcastSchema = new mongoose.Schema({
  id: { type: String, required: true, unique: true },
  organization_id: { type: String, required: true, index: true },
  subject: { type: String, required: true },
  channel: { type: String, default: 'Email' },
  recipient_count: { type: Number, default: 0 },
  audience: { type: String, default: 'all' },
  filter_state: { type: String, default: '' },
  status: { type: String, default: 'sent' },
  sent_at: { type: Date, default: Date.now },
  created_at: { type: Date, default: Date.now }
});

// Courier Dispatch & Tracking
const DispatchSchema = new mongoose.Schema({
  id: { type: String, required: true, unique: true },
  organization_id: { type: String, required: true, index: true },
  order_id: { type: String, required: true },
  courier: { type: String, default: 'Delhivery B2B' },
  tracking_number: { type: String, required: true },
  status: { type: String, default: 'scheduled' },
  estimated_delivery: { type: String, default: '' },
  created_at: { type: Date, default: Date.now }
});

// Delivery Challans
const ChallanSchema = new mongoose.Schema({
  id: { type: String, required: true, unique: true },
  organization_id: { type: String, required: true, index: true },
  number: { type: String, required: true },
  customer_name: { type: String, required: true },
  challan_date: { type: String, default: '' },
  status: { type: String, default: 'issued' },
  total_amount: { type: Number, default: 0 },
  created_at: { type: Date, default: Date.now }
});

// Payments (Received & Payments Made)
const PaymentSchema = new mongoose.Schema({
  id: { type: String, required: true, unique: true },
  organization_id: { type: String, required: true, index: true },
  payment_type: { type: String, enum: ['received', 'made'], required: true, index: true },
  number: { type: String, required: true },
  customer_name: { type: String, default: '' },
  vendor_name: { type: String, default: '' },
  amount: { type: Number, required: true },
  mode: { type: String, default: 'Bank Transfer' },
  payment_date: { type: String, default: '' },
  reference: { type: String, default: '' },
  created_at: { type: Date, default: Date.now }
});

// Document Approvals
const ApprovalSchema = new mongoose.Schema({
  id: { type: String, required: true, unique: true },
  organization_id: { type: String, required: true, index: true },
  title: { type: String, required: true },
  document_type: { type: String, enum: ['quotation', 'purchase_order', 'discount'], required: true },
  number: { type: String, default: '' },
  customer_name: { type: String, default: '' },
  vendor_name: { type: String, default: '' },
  grand_total: { type: Number, default: 0 },
  requester: { type: String, default: 'Sales Manager' },
  status: { type: String, enum: ['pending', 'approved', 'rejected'], default: 'pending', index: true },
  created_at: { type: Date, default: Date.now }
});

export const JournalEntry = mongoose.models.JournalEntry || mongoose.model('JournalEntry', JournalEntrySchema);
export const AutomationRule = mongoose.models.AutomationRule || mongoose.model('AutomationRule', AutomationRuleSchema);
export const Template = mongoose.models.Template || mongoose.model('Template', TemplateSchema);
export const Broadcast = mongoose.models.Broadcast || mongoose.model('Broadcast', BroadcastSchema);
export const Dispatch = mongoose.models.Dispatch || mongoose.model('Dispatch', DispatchSchema);
export const Challan = mongoose.models.Challan || mongoose.model('Challan', ChallanSchema);
export const Payment = mongoose.models.Payment || mongoose.model('Payment', PaymentSchema);
export const Approval = mongoose.models.Approval || mongoose.model('Approval', ApprovalSchema);

export default {
  JournalEntry,
  AutomationRule,
  Template,
  Broadcast,
  Dispatch,
  Challan,
  Payment,
  Approval
};
