import mongoose from 'mongoose';

export const TaskSchema = new mongoose.Schema({
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

export const Task = mongoose.models.Task || mongoose.model('Task', TaskSchema);
export default Task;
