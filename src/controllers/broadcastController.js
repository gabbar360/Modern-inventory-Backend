import { v4 as uuidv4 } from 'uuid';
import { Broadcast } from '../models/Broadcast.js';

export const getBroadcasts = async (req, res) => {
  try {
    const broadcasts = await Broadcast.find({ organization_id: req.user.organization_id }).sort({ sent_at: -1 });
    res.json(broadcasts);
  } catch (err) {
    res.status(500).json({ detail: err.message });
  }
};

export const createBroadcast = async (req, res) => {
  try {
    const b = new Broadcast({
      id: `bc_${uuidv4().slice(0, 8)}`,
      organization_id: req.user.organization_id,
      ...req.body
    });
    await b.save();
    res.status(201).json(b);
  } catch (err) {
    res.status(500).json({ detail: err.message });
  }
};

export const previewBroadcast = async (req, res) => {
  res.json({ recipient_count: 50, audience: 'all' });
};

export default {
  getBroadcasts,
  createBroadcast,
  previewBroadcast
};
