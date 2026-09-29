import mongoose from 'mongoose';

const WarehouseSchema = new mongoose.Schema({
  id: { type: String, required: true, unique: true },
  organization_id: { type: String, required: true },
  name: { type: String, required: true },
  code: { type: String, required: true },
  address: { type: String, default: '' },
  city: { type: String, default: '' },
  state: { type: String, default: '' },
  manager_name: { type: String, default: '' },
  is_primary: { type: Boolean, default: false },
  created_at: { type: Date, default: Date.now }
});

const StockLedgerSchema = new mongoose.Schema({
  id: { type: String, required: true, unique: true },
  organization_id: { type: String, required: true },
  product_id: { type: String, required: true },
  product_name: { type: String, default: '' },
  warehouse_id: { type: String, default: 'default' },
  type: { type: String, enum: ['IN', 'OUT', 'ADJUSTMENT', 'TRANSFER'], required: true },
  quantity: { type: Number, required: true },
  reference_type: { type: String, default: '' },
  reference_id: { type: String, default: '' },
  notes: { type: String, default: '' },
  created_at: { type: Date, default: Date.now }
});

const ExpenseSchema = new mongoose.Schema({
  id: { type: String, required: true, unique: true },
  organization_id: { type: String, required: true },
  title: { type: String, default: '' },
  category: { type: String, required: true },
  subcategory: { type: String, default: '' },
  amount: { type: Number, required: true },
  tax_amount: { type: Number, default: 0 },
  payment_mode: { type: String, default: 'Bank Transfer' },
  reference_no: { type: String, default: '' },
  vendor_name: { type: String, default: '' },
  notes: { type: String, default: '' },
  description: { type: String, default: '' },
  date: { type: Date, default: Date.now },
  expense_date: { type: Date, default: Date.now },
  receipt_url: { type: String, default: '' },
  created_at: { type: Date, default: Date.now }
});

const TaskSchema = new mongoose.Schema({
  id: { type: String, required: true, unique: true },
  organization_id: { type: String, required: true },
  title: { type: String, required: true },
  description: { type: String, default: '' },
  priority: { type: String, enum: ['Low', 'Medium', 'High', 'Urgent'], default: 'Medium' },
  status: { type: String, enum: ['Pending', 'In Progress', 'Completed'], default: 'Pending' },
  due_date: { type: Date },
  assigned_to: { type: String, default: '' },
  created_at: { type: Date, default: Date.now }
});

const AuditLogSchema = new mongoose.Schema({
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

export const Warehouse = mongoose.models.Warehouse || mongoose.model('Warehouse', WarehouseSchema);
export const StockLedger = mongoose.models.StockLedger || mongoose.model('StockLedger', StockLedgerSchema);
export const Expense = mongoose.models.Expense || mongoose.model('Expense', ExpenseSchema);
export const Task = mongoose.models.Task || mongoose.model('Task', TaskSchema);
export const AuditLog = mongoose.models.AuditLog || mongoose.model('AuditLog', AuditLogSchema);

export default {
  Warehouse,
  StockLedger,
  Expense,
  Task,
  AuditLog
};
