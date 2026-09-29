import mongoose from 'mongoose';

export const CustomerSchema = new mongoose.Schema({
  id: { type: String, required: true, unique: true },
  organization_id: { type: String, required: true },
  name: { type: String, required: true },
  company_name: { type: String, default: '' },
  email: { type: String, default: '' },
  phone: { type: String, default: '' },
  gstin: { type: String, default: '' },
  address: {
    street: { type: String, default: '' },
    city: { type: String, default: '' },
    state: { type: String, default: '' },
    pincode: { type: String, default: '' },
    country: { type: String, default: 'India' }
  },
  shipping_address: {
    street: { type: String, default: '' },
    city: { type: String, default: '' },
    state: { type: String, default: '' },
    pincode: { type: String, default: '' },
    country: { type: String, default: 'India' }
  },
  opening_balance: { type: Number, default: 0 },
  current_balance: { type: Number, default: 0 },
  credit_limit: { type: Number, default: 0 },
  payment_terms: { type: String, default: 'Net 30' },
  portal_token: { type: String, default: '' },
  notes: { type: String, default: '' },
  created_at: { type: Date, default: Date.now },
  updated_at: { type: Date, default: Date.now }
});

export const Customer = mongoose.models.Customer || mongoose.model('Customer', CustomerSchema);
export { Lead } from './Lead.js';
export default Customer;
