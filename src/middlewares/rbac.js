export const requireRole = (allowedSlugs = []) => {
  return (req, res, next) => {
    if (!req.user)
      return res.status(401).json({ detail: 'Unauthorized access' });

    // SUPER_ADMIN ko hamesha allow karo
    if (req.user.role === 'SUPER_ADMIN') return next();

    if (allowedSlugs.length > 0 && !allowedSlugs.includes(req.user.role)) {
      return res.status(403).json({
        detail: `Access denied. Role '${req.user.role}' lacks sufficient permissions.`,
      });
    }

    next();
  };
};

export default { requireRole };
