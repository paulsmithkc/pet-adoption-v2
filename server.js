const debug = require('debug')('app:server');
const debugError = require('debug')('app:error');
const express = require('express');
const { nanoid } = require('nanoid');
const config = require('config');
const dbModule = require('./database');

// define custom objectId validator
const Joi = require('joi');
Joi.objectId = () => {
  return Joi.any().custom((value, helpers) => {
    try {
      if (!value) {
        return helpers.error('any.objectId');
      } else if (typeof value !== 'string' && typeof value !== 'object') {
        return helpers.error('any.objectId');
      } else {
        return new ObjectId(value);
      }
    } catch (err) {
      return helpers.error('any.objectId');
    }
  })
  .rule({
    message: { 'any.objectId': '{#label} was not a valid ObjectId' }
  })
};

// construct express app
const app = express();
app.use(express.urlencoded({ extended: false }));
app.use(express.json());

// define routes
app.use('/api/pet', require('./routes/api/pet'));

// handle errors
app.use((req, res, next) => {
  debugError('Page not found.');
  res.status(404).json({ error: 'Page not found.' });
});
app.use((err, req, res, next) => {
  debugError(err);
  res.status(500).json({ error: err.message });
});

// start listening for requests
const host = config.get('http.host');
const port = config.get('http.port');
app.listen(port, () => {
  debug(`Server running at http://${host}:${port}`);
});
