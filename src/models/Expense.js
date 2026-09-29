import mongoose from 'mongoose';

export const ExpenseSchema = new mongoose.Schema({
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

export const Expense = mongoose.models.Expense || mongoose.model('Expense', ExpenseSchema);
export default Expense;
