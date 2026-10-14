import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { User, Organization } from '../models/User.js';
import { Role } from '../models/Role.js';

const JWT_SECRET = process.env.JWT_SECRET || 'vegnar_erp_super_secret_jwt_key_2026_prod';

export const login = async (req, res) => {
  try {
    const { email, password } = req.body;
    if (!email || !password)
      return res.status(400).json({ detail: 'Email and password required' });

    const user = await User.findOne({ email: email.toLowerCase() }).populate('roleId');
    if (!user) return res.status(400).json({ detail: 'Invalid email or password' });

    if (user.status === 'inactive')
      return res.status(403).json({ detail: 'Account is inactive' });

    const validPass = await bcrypt.compare(password, user.password_hash);
    if (!validPass) return res.status(400).json({ detail: 'Invalid email or password' });

    const roleSlug = user.roleId?.slug || 'viewer';

    const token = jwt.sign(
      { sub: user._id, email: user.email, role: roleSlug, org: user.organization_id },
      JWT_SECRET,
      { expiresIn: '7d' }
    );

    res.json({
      access_token: token,
      token_type: 'bearer',
      user: {
        id: user._id,
        name: user.name,
        email: user.email,
        role: roleSlug,
        roleId: user.roleId?._id,
      },
      organization: user.organization || null,
    });
  } catch (err) {
    res.status(500).json({ detail: err.message });
  }
};

export const register = async (req, res) => {
  try {
    const { name, email, password, organization_name, phone } = req.body;
    if (!email || !password || !name || !organization_name)
      return res.status(400).json({ detail: 'Name, email, password and organization name are required' });

    const existingUser = await User.findOne({ email: email.toLowerCase() });
    if (existingUser)
      return res.status(400).json({ detail: 'User with this email already exists' });

    // Organization create karo
    const org = await Organization.create({
      name: organization_name,
      email,
      phone: phone || '',
    });

    // Admin role dhundo
    const adminRole = await Role.findOne({ slug: 'admin' });
    if (!adminRole)
      return res.status(500).json({ detail: 'Roles not seeded. Run npm run seed first.' });

    const password_hash = await bcrypt.hash(password, 10);

    const user = await User.create({
      name,
      email: email.toLowerCase(),
      password_hash,
      roleId: adminRole._id,
      organization_id: org._id,
      organization: org,
      phone: phone || '',
    });

    const token = jwt.sign(
      { sub: user._id, email: user.email, role: adminRole.slug, org: org._id },
      JWT_SECRET,
      { expiresIn: '7d' }
    );

    res.status(201).json({
      access_token: token,
      token_type: 'bearer',
      user: { id: user._id, name: user.name, email: user.email, role: adminRole.slug, roleId: adminRole._id },
      organization: org,
    });
  } catch (err) {
    res.status(500).json({ detail: err.message });
  }
};

export const getMe = async (req, res) => {
  try {
    const user = await User.findById(req.user.id).populate('roleId').select('-password_hash');
    if (!user) return res.status(404).json({ detail: 'User not found' });
    res.json({
      user: { ...user.toObject(), role: user.roleId?.slug },
      organization: user.organization || null,
    });
  } catch (err) {
    res.status(500).json({ detail: err.message });
  }
};

export const getUsers = async (req, res) => {
  try {
    const users = await User.find({ organization_id: req.user.organization_id })
      .populate('roleId')
      .select('-password_hash');
    res.json(users.map(u => ({ ...u.toObject(), role: u.roleId?.slug })));
  } catch (err) {
    res.status(500).json({ detail: err.message });
  }
};

export const logout = (req, res) => {
  res.json({ message: 'Logged out successfully' });
};

export default { login, register, getMe, getUsers, logout };
