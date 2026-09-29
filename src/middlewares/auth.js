import jwt from 'jsonwebtoken';
import { User } from '../models/User.js';

const JWT_SECRET = process.env.JWT_SECRET || 'vegnar_erp_super_secret_jwt_key_2026_prod';

export const authenticateToken = async (req, res, next) => {
  try {
    const authHeader = req.headers.authorization || req.headers.Authorization;
    let token = null;

    if (authHeader && authHeader.startsWith('Bearer ')) {
      token = authHeader.split(' ')[1];
    } else if (req.cookies && req.cookies.access_token) {
      token = req.cookies.access_token;
    }

    if (!token) {
      return res.status(401).json({ detail: 'Authentication token missing or invalid' });
    }

    const decoded = jwt.verify(token, JWT_SECRET);
    const user = await User.findOne({ id: decoded.sub });

    if (!user) {
      return res.status(401).json({ detail: 'User account not found or disabled' });
    }

    req.user = {
      id: user.id,
      name: user.name,
      email: user.email,
      role: user.role,
      organization_id: user.organization_id
    };
    req.org = user.organization;
    next();
  } catch (err) {
    return res.status(401).json({ detail: 'Invalid or expired session token', error: err.message });
  }
};

export default { authenticateToken };
