const debug = require('debug')('app:api:user');
const express = require('express');
const Joi = require('joi');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const config = require('config');
const validBody = require('../../middleware/validBody');
const validId = require('../../middleware/validId');

const {
  newId,
  insertUser,
  updateUser,
  getUserById,
  getUserByEmail,
  saveEdit,
} = require('../../database');

const registerSchema = Joi.object({
  email: Joi.string().trim().lowercase().email().required(),
  password: Joi.string().trim().min(8).required(),
  fullName: Joi.string().trim().min(1).required(),
});
const loginSchema = Joi.object({
  email: Joi.string().trim().lowercase().email().required(),
  password: Joi.string().trim().min(8).required(),
});
const updateSchema = Joi.object({
  password: Joi.string().trim().min(8),
  fullName: Joi.string().trim().min(1),
});

const router = new express.Router();

router.post('/register', validBody(registerSchema), async (req, res, next) => {
  try {
    const user = {
      ...req.body,
      _id: newId(),
      createdDate: new Date(),
      role: 'customer',
    };

    // hash password
    const saltRounds = parseInt(config.get('auth.saltRounds'));
    user.password = await bcrypt.hash(user.password, saltRounds);

    if (await getUserByEmail(user.email)) {
      res
        .status(400)
        .json({ error: `Email "${user.email}" is already in use!` });
    } else {
      const dbResult = await insertUser(user);
      debug('register result:', dbResult);

      // issue token
      const authPayload = {
        _id: user._id,
        email: user.email,
        fullName: user.fullName,
        role: user.role,
      };
      const authSecret = config.get('auth.secret');
      const authOptions = { expiresIn: config.get('auth.tokenExpiresIn') };
      const authToken = jwt.sign(authPayload, authSecret, authOptions);

      // create a cookie
      const cookieOptions = {
        httpOnly: true,
        maxAge: parseInt(config.get('auth.cookieMaxAge')),
      };
      res.cookie('authToken', authToken, cookieOptions);

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
    const user = await getUserByEmail(login.email);
    if (user && (await bcrypt.compare(login.password, user.password))) {
      // issue token
      const authPayload = {
        _id: user._id,
        email: user.email,
        fullName: user.fullName,
        role: user.role,
      };
      const authSecret = config.get('auth.secret');
      const authOptions = { expiresIn: config.get('auth.tokenExpiresIn') };
      const authToken = jwt.sign(authPayload, authSecret, authOptions);

      // create a cookie
      const cookieOptions = {
        httpOnly: true,
        maxAge: parseInt(config.get('auth.cookieMaxAge')),
      };
      res.cookie('authToken', authToken, cookieOptions);

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
router.put('/me', validBody(updateSchema), async (req, res, next) => {
  // self-service update
  try {
    if (!req.auth) {
      return res.status(401).json({ error: 'You must be logged in!' });
    }

    const userId = newId(req.auth._id);
    const update = req.body;

    if (update.password) {
      const saltRounds = parseInt(config.get('auth.saltRounds'));
      update.password = await bcrypt.hash(update.password, saltRounds);
    }
    if (Object.keys(update).length > 0) {
      update.lastUpdatedOn = new Date();
      update.lastUpdatedBy = {
        _id: req.auth._id,
        email: req.auth.email,
        fullName: req.auth.fullName,
        role: req.auth.role,
      };
    }

    const dbResult = await updateUser(userId, update);
    debug('update me result:', dbResult);

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

    res.json({ message: 'User Updated!' });

  } catch (err) {
    next(err);
  }
});
router.put(
  '/:userId',
  validId('userId'),
  validBody(updateSchema),
  async (req, res, next) => {
    // admin update
    try {
      const userId = req.userId;
      const update = req.body;

      if (update.password) {
        const saltRounds = parseInt(config.get('auth.saltRounds'));
        update.password = await bcrypt.hash(update.password, saltRounds);
      }

      const dbResult = await updateUser(userId, update);
      debug('update result:', dbResult);

      if (dbResult.matchedCount > 0) {
        res.json({ message: 'User Updated!', userId });
      } else {
        res.status(404).json({ error: 'User not found!' });
      }
    } catch (err) {
      next(err);
    }
  }
);

module.exports = router;
