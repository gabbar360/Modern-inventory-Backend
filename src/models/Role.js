import mongoose from 'mongoose';

const RoleSchema = new mongoose.Schema({
  name: { type: String, required: true, unique: true },   // "Sales Manager"
  slug: { type: String, required: true, unique: true },   // "sales_manager"
  is_system: { type: Boolean, default: false },           // true = delete nahi ho sakta
  created_at: { type: Date, default: Date.now },
});

export const Role = mongoose.models.Role || mongoose.model('Role', RoleSchema);
export default Role;
