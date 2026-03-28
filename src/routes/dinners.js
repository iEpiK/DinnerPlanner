'use strict';

const express = require('express');
const router = express.Router();
const dm = require('../dinnerManager');

router.get('/', (req, res) => {
  try {
    const { type } = req.query;
    const dinners = type ? dm.getDinnersByType(type) : dm.getAllDinners();
    res.json(dinners);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.get('/:id', (req, res) => {
  try {
    const dinner = dm.getDinnerById(Number(req.params.id));
    if (!dinner) return res.status(404).json({ error: 'Dinner not found' });
    res.json(dinner);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.post('/', (req, res) => {
  try {
    const { name, type, isSaturday } = req.body;
    if (!name || !type) return res.status(400).json({ error: 'name and type are required' });
    const dinner = dm.addDinner({ name, type, isSaturday: !!isSaturday });
    res.status(201).json(dinner);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

router.put('/:id', (req, res) => {
  try {
    const dinner = dm.updateDinner(Number(req.params.id), req.body);
    if (!dinner) return res.status(404).json({ error: 'Dinner not found' });
    res.json(dinner);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

router.delete('/:id', (req, res) => {
  try {
    const deleted = dm.deleteDinner(Number(req.params.id));
    if (!deleted) return res.status(404).json({ error: 'Dinner not found' });
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
