const debug = require('debug')('app:routes:api:pet');
const debugError = require('debug')('app:error');
const express = require('express');
const { nanoid } = require('nanoid');

const petsArray = [
  { _id: '1', name: 'Fido', createdDate: new Date() },
  { _id: '2', name: 'Watson', createdDate: new Date() },
  { _id: '3', name: 'Loki', createdDate: new Date() },
];

// create a router
const router = express.Router();

// define routes
router.get('/list', (req, res, next) => {
  res.json(petsArray);
});
router.get('/:petId', (req, res, next) => {
  const petId = req.params.petId;

  // array lookup
  // const pet = petsArray[petId];
  // res.json(pet);

  // linear search
  // let pet = null;
  // for (const p of petsArray) {
  //   if (p.name == petId) {
  //     pet = p;
  //     break;
  //   }
  // }
  // res.json(pet);

  // using find
  const pet = petsArray.find((x) => x._id == petId);
  if (!pet) {
    res.status(404).json({ error: 'Pet not found.' });
  } else {
    res.json(pet);
  }
});
router.put('/new', (req, res, next) => {
  const petId = nanoid();
  const { species, name, gender } = req.body;
  const age = parseInt(req.body.age);

  const pet = {
    _id: petId,
    species, // species: species,
    name,
    age,
    gender,
    createdDate: new Date(),
  };

  if (!species) {
    res.status(400).json({ error: 'Species required.' });
  } else if (!name) {
    res.status(400).json({ error: 'Name required.' });
  } else if (!age) {
    res.status(400).json({ error: 'Age required.' });
  } else if (!gender) {
    res.status(400).json({ error: 'Gender required.' });
  } else {
    petsArray.push(pet);
    res.json(pet);
  }
});
router.put('/:petId', (req, res, next) => {
  const petId = req.params.petId;
  const { species, name, age, gender } = req.body;

  const pet = petsArray.find((x) => x._id == petId);
  if (!pet) {
    res.status(404).json({ error: 'Pet not found.' });
  } else {
    if (species != undefined) {
      pet.species = species;
    }
    if (name != undefined) {
      pet.name = name;
    }
    if (age != undefined) {
      pet.age = parseInt(age);
    }
    if (gender != undefined) {
      pet.gender = gender;
    }
    pet.lastUpdated = new Date();
    res.json(pet);
  }
});
router.delete('/:petId', (req, res, next) => {
  const petId = req.params.petId;
  const index = petsArray.findIndex((x) => x._id == petId);
  if (index < 0) {
    res.status(404).json({ error: 'Pet not found.' });
  } else {
    petsArray.splice(index, 1);
    res.json({ message: 'Pet deleted.' });
  }
});

// export router
module.exports = router;
