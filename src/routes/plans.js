'use strict';

const express = require('express');
const router = express.Router();
const pg = require('../planGenerator');
const { sendDinnerPlan } = require('../emailService');
const { getDatabase } = require('../database');

router.get('/', (req, res) => {
  try {
    res.json(pg.getAllPlans());
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.get('/edit/:token', (req, res) => {
  try {
    const plan = pg.getPlanByToken(req.params.token);
    if (!plan) return res.status(404).json({ error: 'Plan not found' });
    res.json(plan);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.get('/:id', (req, res) => {
  try {
    const plan = pg.getPlan(Number(req.params.id));
    if (!plan) return res.status(404).json({ error: 'Plan not found' });
    res.json(plan);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.post('/generate', (req, res) => {
  try {
    let { year, month } = req.body;
    year = Number(year);
    month = Number(month);
    if (!year || !month || month < 1 || month > 12) {
      return res.status(400).json({ error: 'Valid year and month (1-12) are required' });
    }

    const db = getDatabase();
    const family = db.prepare('SELECT * FROM family_settings WHERE id = 1').get();
    const events = db.prepare('SELECT * FROM events WHERE date LIKE ?')
      .all(`${year}-${String(month).padStart(2,'0')}-%`);
    const eventDates = events.map(e => ({ date: e.date, note: e.note }));

    const planDays = pg.generateMonthlyPlan(year, month, {
      familyAdults: family.adults,
      familyKids: family.kids,
      eventDates,
      saturdaySpecial: true,
    });

    const plan = pg.savePlan(year, month, planDays);
    res.status(201).json(plan);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.post('/:id/send', async (req, res) => {
  try {
    await sendDinnerPlan(Number(req.params.id));
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.put('/day/:dayId', (req, res) => {
  try {
    const updated = pg.updatePlanDay(Number(req.params.dayId), req.body);
    if (!updated) return res.status(404).json({ error: 'Plan day not found' });
    res.json(updated);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
