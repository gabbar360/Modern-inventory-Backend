import mongoose from 'mongoose';

export const JournalLineSchema = new mongoose.Schema({
  account_id: { type: String, required: true },
  debit: { type: Number, default: 0 },
  credit: { type: Number, default: 0 }
});

export const JournalEntrySchema = new mongoose.Schema({
  id: { type: String, required: true, unique: true },
  organization_id: { type: String, required: true, index: true },
  date: { type: Date, default: Date.now },
  reference_type: { type: String, required: true },
  description: { type: String, default: '' },
  lines: [JournalLineSchema],
  created_at: { type: Date, default: Date.now }
});

export const JournalEntry = mongoose.models.JournalEntry || mongoose.model('JournalEntry', JournalEntrySchema);
export default JournalEntry;
