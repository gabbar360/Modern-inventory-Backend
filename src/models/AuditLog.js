import mongoose from 'mongoose';

export const AuditLogSchema = new mongoose.Schema({
  id: { type: String, required: true, unique: true },
  organization_id: { type: String, required: true },
  user_id: { type: String, default: '' },
  user_name: { type: String, default: '' },
  action: { type: String, required: true },
  module: { type: String, required: true },
  details: { type: String, default: '' },
  ip_address: { type: String, default: '' },
  timestamp: { type: Date, default: Date.now }
});

export const AuditLog = mongoose.models.AuditLog || mongoose.model('AuditLog', AuditLogSchema);
export default AuditLog;
