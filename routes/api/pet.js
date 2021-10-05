const debug = require('debug')('app:routes:api:pet');
const debugError = require('debug')('app:error');
const express = require('express');
const { nanoid } = require('nanoid');
const dbModule = require('../../database');
const { newId } = require('../../database');
const Joi = require('joi');
const validId = require('../../middleware/validId');
const validBody = require('../../middleware/validBody');

// const petsArray = [
//   { _id: '1', name: 'Fido', createdDate: new Date() },
//   { _id: '2', name: 'Watson', createdDate: new Date() },
//   { _id: '3', name: 'Loki', createdDate: new Date() },
// ];

const newPetSchema = Joi.object({
  species: Joi.string()
    .trim()
    .min(1)
    .pattern(/^[^0-9]+$/, 'not numbers')
    .required(),
  name: Joi.string().trim().min(1).required(),
  age: Joi.number().integer().min(0).max(1000).required(),
  gender: Joi.string().trim().length(1).required(),
});
const updatePetSchema = Joi.object({
  species: Joi.string()
    .trim()
    .min(1)
    .pattern(/^[^0-9]+$/, 'not numbers'),
  name: Joi.string().trim().min(1),
  age: Joi.number().integer().min(0).max(1000),
  gender: Joi.string().trim().length(1),
});

// create a router
const router = express.Router();

// define routes
router.get('/list', async (req, res, next) => {
  try {
    debug('get all pets');
    const pets = await dbModule.findAllPets();
    res.json(pets);
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
router.put('/new', validBody(newPetSchema), async (req, res, next) => {
  try {
    const pet = req.body;
    pet._id = newId();
    debug(`insert pet`, pet);

    await dbModule.insertOnePet(pet);
    res.json({ message: 'Pet inserted.' });
  } catch (err) {
    next(err);
  }
});
router.put('/:petId', validId('petId'), validBody(updatePetSchema), async (req, res, next) => {
  try {
    const petId = req.petId;
    const update = req.body;
    debug(`update pet ${petId}`, update);

    const pet = await dbModule.findPetById(petId);
    if (!pet) {
      res.status(404).json({ error: `Pet ${petId} not found.` });
    } else {
      await dbModule.updateOnePet(petId, update);
      res.json({ message: `Pet ${petId} updated.` });
    }
  } catch (err) {
    next(err);
  }
});
router.delete('/:petId', validId('petId'), async (req, res, next) => {
  try {
    const petId = req.petId;
    debug(`delete pet ${petId}`);

    const pet = await dbModule.findPetById(petId);
    if (!pet) {
      res.status(404).json({ error: `Pet ${petId} not found.` });
    } else {
      await dbModule.deleteOnePet(petId);
      res.json({ message: `Pet ${petId} deleted.` });
    }
  } catch (err) {
    next(err);
  }
});

// export router
module.exports = router;
