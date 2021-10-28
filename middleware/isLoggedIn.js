function isLoggedIn() {
  return (req, res, next) => {
    if (!req.auth) {
      return res.status(401).json({ error: 'You are not logged in!' });
    } else {
      return next();
    }
  };
}

module.exports = isLoggedIn;