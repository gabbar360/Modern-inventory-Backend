export const requireRole = (allowedRoles = []) => {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({ detail: 'Unauthorized access' });
    }

    if (allowedRoles.length > 0 && !allowedRoles.includes(req.user.role)) {
      return res.status(403).json({
        detail: `Access denied. Role '${req.user.role}' lacks sufficient permissions.`
      });
    }

    next();
  };
};

export default { requireRole };
