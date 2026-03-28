'use strict';

const express = require('express');
const router = express.Router();
const { getDatabase } = require('../database');

router.get('/', (req, res) => {
  try {
    const settings = getDatabase().prepare('SELECT * FROM family_settings WHERE id = 1').get();
    res.json(settings);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.put('/', (req, res) => {
  try {
    const db = getDatabase();
    const current = db.prepare('SELECT * FROM family_settings WHERE id = 1').get();
    const { adults, kids } = req.body;
    db.prepare('UPDATE family_settings SET adults = ?, kids = ?, updated_at = datetime(\'now\') WHERE id = 1')
      .run(adults ?? current.adults, kids ?? current.kids);
    res.json(db.prepare('SELECT * FROM family_settings WHERE id = 1').get());
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
