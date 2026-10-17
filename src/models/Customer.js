import mongoose from 'mongoose';

export const CustomerSchema = new mongoose.Schema({
  id: { type: String, required: true, unique: true },
  organization_id: { type: String, required: true },
  name: { type: String, default: '' },
  company_name: { type: String, default: '' },
  contact_person: { type: String, default: '' },
  email: { type: String, default: '' },
  phone: { type: String, default: '' },
  mobile: { type: String, default: '' },
  gstin: { type: String, default: '' },
  state: { type: String, default: '' },
  state_code: { type: String, default: '' },
  city: { type: String, default: '' },
  pincode: { type: String, default: '' },
  address: {
    street: { type: String, default: '' },
    city: { type: String, default: '' },
    state: { type: String, default: '' },
    pincode: { type: String, default: '' },
    country: { type: String, default: 'India' }
  },
  billing_address: { type: String, default: '' },
  billing_address_line: { type: String, default: '' },
  billing_city: { type: String, default: '' },
  billing_state: { type: String, default: '' },
  billing_pincode: { type: String, default: '' },
  shipping_address: { type: mongoose.Schema.Types.Mixed, default: '' },
  shipping_address_line: { type: String, default: '' },
  shipping_city: { type: String, default: '' },
  shipping_state: { type: String, default: '' },
  shipping_pincode: { type: String, default: '' },
  shipping_same_as_billing: { type: Boolean, default: true },
  opening_balance: { type: Number, default: 0 },
  current_balance: { type: Number, default: 0 },
  credit_limit: { type: Number, default: 0 },
  payment_terms: { type: String, default: 'Net 30' },
  portal_token: { type: String, default: '' },
  notes: { type: String, default: '' },
  created_at: { type: Date, default: Date.now },
  updated_at: { type: Date, default: Date.now }
}, { strict: false });

export const Customer = mongoose.models.Customer || mongoose.model('Customer', CustomerSchema);
export { Lead } from './Lead.js';
export default Customer;
