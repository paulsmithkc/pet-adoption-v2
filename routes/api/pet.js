const debug = require('debug')('app:routes:api:pet');
const debugError = require('debug')('app:error');
const express = require('express');
const { nanoid } = require('nanoid');
const dbModule = require('../../database');
const { newId, connect } = require('../../database');
const Joi = require('joi');
const validId = require('../../middleware/validId');
const validBody = require('../../middleware/validBody');
const isLoggedIn = require('../../middleware/isLoggedIn');
const hasPermission = require('../../middleware/hasPermission');

// const petsArray = [
//   { _id: '1', name: 'Fido', createdDate: new Date() },
//   { _id: '2', name: 'Watson', createdDate: new Date() },
//   { _id: '3', name: 'Loki', createdDate: new Date() },
// ];

const newPetSchema = Joi.object({
  species: Joi.string().trim().min(1).required(),
  name: Joi.string().trim().min(1).required(),
  age: Joi.number().integer().min(0).max(1000).required(),
  gender: Joi.string().trim().length(1).required(),
});
const updatePetSchema = Joi.object({
  species: Joi.string().trim().min(1),
  name: Joi.string().trim().min(1),
  age: Joi.number().integer().min(0).max(1000),
  gender: Joi.string().trim().length(1),
});

// create a router
const router = express.Router();

// define routes
router.get('/list', async (req, res, next) => {
  try {
    // get inputs
    let { keywords, species, minAge, maxAge, sortBy, pageNumber, pageSize } =
      req.query;
    debug(req.query);

    // match stage
    const match = {};
    if (keywords) {
      match.$text = { $search: keywords };
    }
    if (species) {
      match.species = { $eq: species };
    }

    minAge = parseInt(minAge);
    maxAge = parseInt(maxAge);
    if (minAge && maxAge) {
      match.age = { $gte: minAge, $lte: maxAge };
    } else if (minAge) {
      match.age = { $gte: minAge };
    } else if (maxAge) {
      match.age = { $lte: maxAge };
    }

    // sort stage
    let sort = { name: 1, createdDate: 1 };
    switch (sortBy) {
      case 'species':
        sort = { species: 1, name: 1, createdDate: 1 };
        break;
      case 'species_desc':
        sort = { species: -1, name: -1, createdDate: -1 };
        break;
      case 'name':
        sort = { name: 1, createdDate: 1 };
        break;
      case 'name_desc':
        sort = { name: -1, createdDate: -1 };
        break;
      case 'age':
        sort = { age: 1, createdDate: 1 };
        break;
      case 'age_desc':
        sort = { age: -1, createdDate: -1 };
        break;
      case 'gender':
        sort = { gender: 1, name: 1, createdDate: 1 };
        break;
      case 'gender_desc':
        sort = { gender: -1, name: -1, createdDate: -1 };
        break;
      case 'newest':
        sort = { createdDate: -1 };
        break;
      case 'oldest':
        sort = { createdDate: 1 };
        break;
    }

    // project stage
    const project = { species: 1, name: 1, age: 1, gender: 1 };

    // skip & limit stages
    pageNumber = parseInt(pageNumber) || 1;
    pageSize = parseInt(pageSize) || 5;
    const skip = (pageNumber - 1) * pageSize;
    const limit = pageSize;

    // pipeline
    const pipeline = [
      { $match: match },
      { $sort: sort },
      { $project: project },
      { $skip: skip },
      { $limit: limit },
    ];

    const db = await connect();
    const cursor = db.collection('pets').aggregate(pipeline);
    const results = await cursor.toArray();

    res.json(results);
  } catch (err) {
    next(err);
  }
});
router.get('/:petId', validId('petId'), async (req, res, next) => {
  try {
    const petId = req.petId;
    const pet = await dbModule.findPetById(petId);
    if (!pet) {
      res.status(404).json({ error: `Pet ${petId} not found.` });
    } else {
      res.json(pet);
    }
  } catch (err) {
    next(err);
  }
});
router.put(
  '/new',
  hasPermission('insertPet'),
  validBody(newPetSchema),
  async (req, res, next) => {
    try {
      const petId = newId();
      const pet = { ...req.body, _id: petId };
      debug(`insert pet`, pet);

      await dbModule.insertOnePet(pet);
      res.json({ message: 'Pet inserted.', petId });
    } catch (err) {
      next(err);
    }
  }
);
router.put(
  '/:petId',
  hasPermission('updatePet'),
  validId('petId'),
  validBody(updatePetSchema),
  async (req, res, next) => {
    try {
      const petId = req.petId;
      const update = req.body;
      debug(`update pet ${petId}`, update);

      const pet = await dbModule.findPetById(petId);
      if (!pet) {
        res.status(404).json({ error: `Pet ${petId} not found.` });
      } else {
        await dbModule.updateOnePet(petId, update);
        res.json({ message: `Pet ${petId} updated.`, petId });
      }
    } catch (err) {
      next(err);
    }
  }
);
router.delete(
  '/:petId',
  hasPermission('deletePet'),
  validId('petId'),
  async (req, res, next) => {
    try {
      const petId = req.petId;
      debug(`delete pet ${petId}`);

      const pet = await dbModule.findPetById(petId);
      if (!pet) {
        res.status(404).json({ error: `Pet ${petId} not found.` });
      } else {
        await dbModule.deleteOnePet(petId);
        res.json({ message: `Pet ${petId} deleted.`, petId });
      }
    } catch (err) {
      next(err);
    }
  }
);

// export router
module.exports = router;
