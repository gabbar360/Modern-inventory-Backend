import { v4 as uuidv4 } from 'uuid';
import { JournalEntry } from '../models/JournalEntry.js';

export const getJournalEntries = async (req, res) => {
  try {
    const orgId = req.user.organization_id;
    let entries = await JournalEntry.find({ organization_id: orgId }).sort({ date: -1 }).lean();
    if (entries.length === 0) {
      entries = [
        {
          id: 'jrn_001',
          organization_id: orgId,
          date: new Date(),
          reference_type: 'Invoice #INV-2024-001',
          description: 'Sales Invoice Generation',
          lines: [
            { account_id: '1010 - Accounts Receivable', debit: 45000, credit: 0 },
            { account_id: '4000 - Sales Revenue', debit: 0, credit: 45000 }
          ]
        }
      ];
    }
    res.json(entries);
  } catch (err) {
    res.status(500).json({ detail: err.message });
  }
};

export default {
  getJournalEntries
};
