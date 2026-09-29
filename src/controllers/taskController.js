import { v4 as uuidv4 } from 'uuid';
import { Task } from '../models/Task.js';

export const getTasks = async (req, res) => {
  try {
    const tasks = await Task.find({ organization_id: req.user.organization_id }).sort({ created_at: -1 }).lean();
    res.json(tasks);
  } catch (err) {
    res.status(500).json({ detail: err.message });
  }
};

export const createTask = async (req, res) => {
  try {
    const task = new Task({
      id: `tsk_${uuidv4().slice(0, 8)}`,
      organization_id: req.user.organization_id,
      title: req.body.title || 'New Task',
      description: req.body.description || req.body.notes || '',
      priority: req.body.priority || 'Medium',
      due_date: req.body.due_date ? new Date(req.body.due_date) : undefined
    });
    await task.save();
    res.status(201).json(task);
  } catch (err) {
    res.status(500).json({ detail: err.message });
  }
};

export const updateTask = async (req, res) => {
  try {
    const { id } = req.params;
    await Task.updateOne({ id }, { $set: req.body });
    res.json({ success: true, message: 'Task updated successfully' });
  } catch (err) {
    res.status(500).json({ detail: err.message });
  }
};

export default {
  getTasks,
  createTask,
  updateTask
};
