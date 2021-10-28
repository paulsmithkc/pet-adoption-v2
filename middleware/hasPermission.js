function hasPermission(permission) {
  return (req, res, next) => {
    if (!req.auth) {
      return res.status(401).json({ error: 'You are not logged in!' });
    } else if (!req.auth.permissions) {
      return res.status(403).json({ error: 'You do not have any permissions!' });
    } else if (!req.auth.permissions[permission]) {
      return res.status(403).json({ error: `You do not have permission ${permission}!` });
    } else {
      return next();
    }
  };
}

module.exports = hasPermission;