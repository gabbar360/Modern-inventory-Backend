const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { v4: uuidv4 } = require('uuid');
const { User, Organization } = require('../models/User');
const { JWT_SECRET } = require('../config/env');

exports.register = async (req, res) => {
  try {
    const { name, email, password, org_name, phone } = req.body;
    if (!email || !password || !name) {
      return res.status(400).json({ detail: 'Name, email and password are required' });
    }

    const existingUser = await User.findOne({ email: email.toLowerCase() });
    if (existingUser) {
      return res.status(400).json({ detail: 'User with this email already exists' });
    }

    const orgId = `org_${uuidv4().slice(0, 8)}`;
    const organization = {
      id: orgId,
      name: org_name || `${name}'s Organization`,
      email: email,
      phone: phone || ''
    };
    await Organization.create(organization);

    const password_hash = await bcrypt.hash(password, 10);
    const userId = `usr_${uuidv4().slice(0, 8)}`;

    const user = await User.create({
      id: userId,
      name,
      email: email.toLowerCase(),
      password_hash,
      role: 'admin',
      organization_id: orgId,
      organization,
      phone: phone || ''
    });

    const token = jwt.sign({ sub: user.id, email: user.email, role: user.role, org: orgId }, JWT_SECRET, { expiresIn: '7d' });

    res.json({
      access_token: token,
      token_type: 'bearer',
      user: { id: user.id, name: user.name, email: user.email, role: user.role },
      organization
    });
  } catch (err) {
    res.status(500).json({ detail: err.message });
  }
};

exports.login = async (req, res) => {
  try {
    const { email, password } = req.body;
    if (!email || !password) {
      return res.status(400).json({ detail: 'Email and password required' });
    }

    const user = await User.findOne({ email: email.toLowerCase() });
    if (!user) {
      return res.status(400).json({ detail: 'Invalid email or password' });
    }

    const validPass = await bcrypt.compare(password, user.password_hash);
    if (!validPass) {
      return res.status(400).json({ detail: 'Invalid email or password' });
    }

    const token = jwt.sign({ sub: user.id, email: user.email, role: user.role, org: user.organization_id }, JWT_SECRET, { expiresIn: '7d' });

    res.json({
      access_token: token,
      token_type: 'bearer',
      user: { id: user.id, name: user.name, email: user.email, role: user.role },
      organization: user.organization
    });
  } catch (err) {
    res.status(500).json({ detail: err.message });
  }
};

exports.getMe = async (req, res) => {
  try {
    const user = await User.findOne({ id: req.user.id });
    if (!user) return res.status(404).json({ detail: 'User not found' });
    res.json({ user, organization: user.organization });
  } catch (err) {
    res.status(500).json({ detail: err.message });
  }
};

exports.getUsers = async (req, res) => {
  try {
    const users = await User.find({ organization_id: req.user.organization_id }).select('-password_hash');
    res.json(users);
  } catch (err) {
    res.status(500).json({ detail: err.message });
  }
};

exports.logout = (req, res) => {
  res.json({ message: 'Logged out successfully' });
};
