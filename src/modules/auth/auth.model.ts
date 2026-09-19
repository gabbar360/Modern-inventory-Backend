import mongoose, { Schema, Document } from 'mongoose';

export interface IUser extends Document {
  id: string;
  email: string;
  password_hash: string;
  name?: string;
  role: string;
  org_id: string;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

const UserSchema = new Schema<IUser>({
  id: { type: String, required: true, unique: true },
  email: { type: String, required: true, lowercase: true, unique: true },
  password_hash: { type: String, required: true },
  name: { type: String, default: 'User' },
  role: { type: String, default: 'Admin' },
  org_id: { type: String, default: 'org_vegnar_01' },
  is_active: { type: Boolean, default: true },
  created_at: { type: String, default: () => new Date().toISOString() },
  updated_at: { type: String, default: () => new Date().toISOString() }
});

export const UserModel = mongoose.model<IUser>('User', UserSchema);
