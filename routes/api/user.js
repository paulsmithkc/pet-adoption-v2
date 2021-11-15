const debug = require('debug')('app:api:user');
const debugError = require('debug')('app:error');
const _ = require('lodash');
const express = require('express');
const Joi = require('joi');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const config = require('config');
const validBody = require('../../middleware/validBody');
const validId = require('../../middleware/validId');
const isLoggedIn = require('../../middleware/isLoggedIn');
const hasPermission = require('../../middleware/hasPermission');

const {
  newId,
  connect,
  insertOneUser,
  updateOneUser,
  findUserById,
  findUserByEmail,
  saveEdit,
  findRoleByName,
} = require('../../database');

async function issueAuthToken(user) {
  const authPayload = {
    _id: user._id,
    email: user.email,
    fullName: user.fullName,
    role: user.role,
  };

  // get role names
  const roleNames = Array.isArray(user.role) ? user.role : [user.role];

  // get all of the roles in parallel
  const roles = await Promise.all(
    roleNames.map((roleName) => findRoleByName(roleName))
  );

  // combine the permission tables
  const permissions = {};
  for (const role of roles) {
    if (role && role.permissions) {
      for (const permission in role.permissions) {
        if (role.permissions[permission] === true) {
          permissions[permission] = true;
        }
      }
    }
  }

  // update the token payload
  authPayload.permissions = permissions;

  // issue token
  const authSecret = config.get('auth.secret');
  const authOptions = { expiresIn: config.get('auth.tokenExpiresIn') };
  const authToken = jwt.sign(authPayload, authSecret, authOptions);
  return authToken;
}

function setAuthCookie(res, authToken) {
  const cookieOptions = {
    httpOnly: true,
    maxAge: parseInt(config.get('auth.cookieMaxAge')),
  };
  res.cookie('authToken', authToken, cookieOptions);
}

const registerSchema = Joi.object({
  email: Joi.string().trim().lowercase().email().required(),
  password: Joi.string().trim().min(8).required(),
  fullName: Joi.string().trim().min(1).required(),
});
const loginSchema = Joi.object({
  email: Joi.string().trim().lowercase().email().required(),
  password: Joi.string().trim().min(8).required(),
});

const roleSchema = Joi.string().valid(
  'admin',
  'manager',
  'employee',
  'customer'
);
const updateSelfSchema = Joi.object({
  password: Joi.string().trim().min(8),
  fullName: Joi.string().trim().min(1),
  role: Joi.alternatives().try(roleSchema, Joi.array().items(roleSchema)),
});
const updateAnySchema = Joi.object({
  password: Joi.string().trim().min(8),
  fullName: Joi.string().trim().min(1),
  role: Joi.alternatives().try(roleSchema, Joi.array().items(roleSchema)),
});

const router = new express.Router();

router.post('/register', validBody(registerSchema), async (req, res, next) => {
  try {
    const user = {
      ...req.body,
      _id: newId(),
      createdDate: new Date(),
      role: 'customer',
      createdOn: new Date(),
    };

    // hash password
    const saltRounds = parseInt(config.get('auth.saltRounds'));
    user.password = await bcrypt.hash(user.password, saltRounds);

    if (await findUserByEmail(user.email)) {
      res
        .status(400)
        .json({ error: `Email "${user.email}" is already in use!` });
    } else {
      const dbResult = await insertOneUser(user);
      debug('register result:', dbResult);

      // issue new token
      const authToken = await issueAuthToken(user);
      setAuthCookie(res, authToken);

      res.json({
        message: 'New User Registered!',
        userId: user._id,
        token: authToken,
      });
    }
  } catch (err) {
    next(err);
  }
});
router.post('/login', validBody(loginSchema), async (req, res, next) => {
  try {
    const login = req.body;
    const user = await findUserByEmail(login.email);
    if (user && (await bcrypt.compare(login.password, user.password))) {
      // issue new token
      const authToken = await issueAuthToken(user);
      setAuthCookie(res, authToken);

      res.json({
        message: 'Welcome Back!',
        userId: user._id,
        token: authToken,
      });
    } else {
      res.status(400).json({ error: 'Invalid Credentials!' });
    }
  } catch (err) {
    next(err);
  }
});
router.put(
  '/me',
  isLoggedIn(),
  validBody(updateSelfSchema),
  async (req, res, next) => {
    // self-service update
    try {
      const userId = newId(req.auth._id);
      const update = req.body;

      if (update.password) {
        const saltRounds = parseInt(config.get('auth.saltRounds'));
        update.password = await bcrypt.hash(update.password, saltRounds);
      }
      if (update.role) {
        if (!req.auth.permissions['manageUsers']) {
          return res
            .status(403)
            .json({ error: 'You do not have permission to change your role!' });
        } else if (Array.isArray(update.role)) {
          // role is already an array
        } else {
          update.role = [update.role];
        }
      }
      if (!_.isEmpty(update)) {
        update.lastUpdatedBy = _.pick(
          req.auth,
          '_id',
          'email',
          'fullName',
          'role'
        );
        update.lastUpdated = new Date();
      }
      debug('update me:', update);

      // update user document
      const dbResult = await updateOneUser(userId, update);
      debug('update me result:', dbResult);

      // save edit for audit trail
      const edit = {
        timestamp: new Date(),
        op: 'update',
        col: 'users',
        target: { userId },
        update,
        auth: req.auth,
      };
      await saveEdit(edit);
      debug('edit saved');

      // issue new token
      const authToken = await issueAuthToken({ ...req.auth, ...update });
      setAuthCookie(res, authToken);

      // send response
      if (updateResult.matchedCount > 0) {
        res.json({ message: 'User Updated!', userId, token: authToken });
      } else {
        res.status(404).json({ error: 'User not found!' });
      }
    } catch (err) {
      next(err);
    }
  }
);
router.put(
  '/:userId',
  hasPermission('manageUsers'),
  validId('userId'),
  validBody(updateAnySchema),
  async (req, res, next) => {
    // admin update
    try {
      const userId = req.userId;
      const update = req.body;

      if (update.password) {
        const saltRounds = parseInt(config.get('auth.saltRounds'));
        update.password = await bcrypt.hash(update.password, saltRounds);
      }
      if (update.role) {
        if (Array.isArray(update.role)) {
          // role is already an array
        } else {
          update.role = [update.role];
        }
      }
      if (!_.isEmpty(update)) {
        update.lastUpdatedBy = _.pick(
          req.auth,
          '_id',
          'email',
          'fullName',
          'role'
        );
        update.lastUpdated = new Date();
      }
      debug('update:', update);

      // update user document
      const updateResult = await updateOneUser(userId, update);
      debug('update result:', updateResult);

      // save edit for audit trail
      const edit = {
        timestamp: new Date(),
        op: 'update',
        col: 'users',
        target: { userId },
        update,
        auth: req.auth,
      };
      await saveEdit(edit);
      debug('edit saved');

      // issue new token, when updating self
      let authToken;
      if (userId.equals(req.auth._id)) {
        authToken = await issueAuthToken({ ...req.auth, ...update });
        setAuthCookie(res, authToken);
      }

      // send response
      if (updateResult.matchedCount > 0) {
        res.json({ message: 'User Updated!', userId, token: authToken });
      } else {
        res.status(404).json({ error: 'User not found!' });
      }
    } catch (err) {
      next(err);
    }
  }
);

module.exports = router;
