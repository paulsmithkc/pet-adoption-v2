const debug = require('debug')('app:middleware:auth');
const config = require('config');
const jwt = require('jsonwebtoken');

const authSecret = config.get('auth.secret');

const auth = () => {
  return (req, res, next) => {
    const authHeader = req.headers['authorization'];
    const authCookie = req.cookies.authToken;

    if (authHeader) {
      const [authType, authToken] = authHeader.split(' ', 2);
      if (authType === 'Bearer' && authToken) {
        try {
          req.auth = jwt.verify(authToken, authSecret);
        } catch (err) {
          debug('invalid token');
        }
      }    
    } else if (authCookie) {
      try {
        req.auth = jwt.verify(authCookie, authSecret);
        const cookieOptions = {
          httpOnly: true,
          maxAge: parseInt(config.get('auth.cookieMaxAge')),
        };
        res.cookie('authToken', authToken, cookieOptions);
      } catch (err) {
        debug('invalid token');
      }    
    }

    next();
  };
};

module.exports = auth;