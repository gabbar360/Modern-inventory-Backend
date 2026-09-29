import mongoose from 'mongoose';

export const TemplateSchema = new mongoose.Schema({
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

export const Template = mongoose.models.Template || mongoose.model('Template', TemplateSchema);
export default Template;
