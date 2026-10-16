import mongoose from 'mongoose';

export const OrganizationSchema = new mongoose.Schema({
  // Identity
  name:         { type: String, required: true },
  legal_name:   { type: String, default: '' },
  display_name: { type: String, default: '' },
  logo:         { type: String, default: '' },

  // Contact
  email:   { type: String, default: '' },
  phone:   { type: String, default: '' },
  website: { type: String, default: '' },

  // Address
  address:    { type: String, default: '' },
  city:       { type: String, default: '' },
  state:      { type: String, default: '' },
  state_code: { type: String, default: '' },
  country:    { type: String, default: 'India' },
  pin:        { type: String, default: '' },

  // Tax
  gstin: { type: String, default: '' },
  pan:   { type: String, default: '' },
  cin:   { type: String, default: '' },
  tan:   { type: String, default: '' },

  // Bank
  bank_name:      { type: String, default: '' },
  account_holder: { type: String, default: '' },
  account_number: { type: String, default: '' },
  ifsc:           { type: String, default: '' },
  swift:          { type: String, default: '' },
  branch:         { type: String, default: '' },
  upi_id:         { type: String, default: '' },

  created_at: { type: Date, default: Date.now },
});

export const Organization = mongoose.models.Organization || mongoose.model('Organization', OrganizationSchema);
export default Organization;
