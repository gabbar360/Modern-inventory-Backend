import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { v4 as uuidv4 } from 'uuid';
import { env } from '../../config/env';

export function hashPassword(password: string): string {
  return bcrypt.hashSync(password, 10);
}

export function comparePassword(password: string, hash: string): boolean {
  try {
    return bcrypt.compareSync(password, hash);
  } catch {
    return false;
  }
}

export function generateToken(userId: string, orgId: string, role?: string): string {
  return jwt.sign(
    { sub: userId, org: orgId, role: role || 'Admin', type: 'access' },
    env.JWT_SECRET,
    { expiresIn: '7d' }
  );
}

export function verifyToken(token: string): any {
  return jwt.verify(token, env.JWT_SECRET);
}

export function newUuid(): string {
  return uuidv4();
}
