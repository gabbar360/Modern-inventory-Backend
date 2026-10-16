import jwt from 'jsonwebtoken';
import { User } from '../models/User.js';

const JWT_SECRET = process.env.JWT_SECRET || 'vegnar_erp_super_secret_jwt_key_2026_prod';

export const authenticateToken = async (req, res, next) => {
  try {
    const authHeader = req.headers.authorization || req.headers.Authorization;
    let token = null;

    if (authHeader?.startsWith('Bearer ')) {
      token = authHeader.split(' ')[1];
    } else if (req.cookies?.access_token) {
      token = req.cookies.access_token;
    }

    if (!token)
      return res.status(401).json({ detail: 'Authentication token missing or invalid' });

    const decoded = jwt.verify(token, JWT_SECRET);

    const user = await User.findById(decoded.sub).populate('roleId');
    if (!user)
      return res.status(401).json({ detail: 'User account not found or disabled' });

    if (user.status === 'inactive')
      return res.status(403).json({ detail: 'Account is inactive' });

    req.user = {
      id: user._id,
      name: user.name,
      email: user.email,
      role: user.roleId?.slug || 'viewer',
      roleId: user.roleId?._id || null,
      organization_id: user.organization_id || null,
    };
    req.org = user.organization || null;

    next();
  } catch (err) {
    return res.status(401).json({ detail: 'Invalid or expired session token', error: err.message });
  }
};

export default { authenticateToken };
