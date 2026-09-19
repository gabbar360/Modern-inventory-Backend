import { UserModel, IUser } from './auth.model';
import { hashPassword, comparePassword, generateToken, newUuid } from '../../core/utils/hash.utils';
import { AppError } from '../../core/errors/AppError';
import { logger } from '../../config/logger';

export class AuthService {
  async register(data: { email: string; password: string; name?: string; org_id?: string; role?: string }) {
    const existing = await UserModel.findOne({ email: data.email.toLowerCase() });
    if (existing) {
      throw new AppError('User already exists with this email', 400);
    }

    const user = new UserModel({
      id: newUuid(),
      email: data.email.toLowerCase(),
      password_hash: hashPassword(data.password),
      name: data.name || data.email.split('@')[0],
      role: data.role || 'Admin',
      org_id: data.org_id || 'org_vegnar_01'
    });

    await user.save();
    const token = generateToken(user.id, user.org_id, user.role);
    const sanitized = this.sanitizeUser(user);
    const org = this.getOrganization();

    return {
      access_token: token,
      token,
      user: sanitized,
      organization: org
    };
  }

  async login(data: { email: string; password: string }) {
    let user = await UserModel.findOne({ email: data.email.toLowerCase() });

    // Auto seed demo credentials if needed
    if (!user) {
      if (data.email.toLowerCase() === 'chauhanashish360@gmail.com' && data.password === 'Admin@123') {
        user = await this.seedChauhanAdmin();
      } else if (data.email.toLowerCase() === 'admin@vegnar.com' && data.password === 'admin123') {
        user = await this.seedDefaultAdmin();
      }
    }

    if (!user || !comparePassword(data.password, user.password_hash)) {
      throw new AppError('Invalid email or password', 401);
    }

    const token = generateToken(user.id, user.org_id, user.role);
    const sanitized = this.sanitizeUser(user);
    const org = this.getOrganization();

    return {
      access_token: token,
      token,
      user: sanitized,
      organization: org
    };
  }

  async getProfile(userId: string) {
    let user = await UserModel.findOne({ id: userId });
    if (!user) {
      user = await UserModel.findOne({ email: 'chauhanashish360@gmail.com' });
    }
    if (!user) {
      user = await this.seedChauhanAdmin();
    }
    const sanitized = this.sanitizeUser(user);
    const org = this.getOrganization();

    return {
      user: sanitized,
      organization: org
    };
  }

  async seedChauhanAdmin() {
    let existing = await UserModel.findOne({ email: 'chauhanashish360@gmail.com' });
    if (existing) return existing;

    const admin = new UserModel({
      id: 'usr_chauhan_admin',
      email: 'chauhanashish360@gmail.com',
      password_hash: hashPassword('Admin@123'),
      name: 'Ashish Chauhan',
      role: 'Super Admin',
      org_id: 'org_vegnar_01'
    });

    await admin.save();
    logger.info('🔑 Auto-seeded Ashish Chauhan admin: chauhanashish360@gmail.com / Admin@123');
    return admin;
  }

  async seedDefaultAdmin() {
    let existing = await UserModel.findOne({ email: 'admin@vegnar.com' });
    if (existing) return existing;

    const admin = new UserModel({
      id: 'usr_demo_admin',
      email: 'admin@vegnar.com',
      password_hash: hashPassword('admin123'),
      name: 'System Admin',
      role: 'Super Admin',
      org_id: 'org_vegnar_01'
    });

    await admin.save();
    logger.info('🔑 Auto-seeded default admin: admin@vegnar.com / admin123');
    return admin;
  }

  private getOrganization() {
    return {
      id: 'org_vegnar_01',
      name: 'Vegnar ERP Corp',
      code: 'VEGNAR-01',
      currency: 'INR'
    };
  }

  private sanitizeUser(user: IUser) {
    const obj = user.toObject();
    delete (obj as any).password_hash;
    delete (obj as any)._id;
    delete (obj as any).__v;
    return obj;
  }
}

export const authService = new AuthService();
