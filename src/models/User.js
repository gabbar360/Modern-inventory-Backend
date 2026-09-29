import mongoose from 'mongoose';
import { OrganizationSchema } from './Organization.js';

export const UserSchema = new mongoose.Schema({
  id: { type: String, required: true, unique: true },
  name: { type: String, required: true },
  email: { type: String, required: true, unique: true },
  password_hash: { type: String, required: true },
  role: { type: String, enum: ['admin', 'manager', 'sales', 'inventory', 'accountant'], default: 'admin' },
  organization_id: { type: String, required: true },
  organization: OrganizationSchema,
  phone: { type: String, default: '' },
  status: { type: String, enum: ['active', 'inactive'], default: 'active' },
  created_at: { type: Date, default: Date.now },
  updated_at: { type: Date, default: Date.now }
});

export const User = mongoose.models.User || mongoose.model('User', UserSchema);
export { Organization } from './Organization.js';
export default User;
