'use strict';

const express = require('express');
const router = express.Router();
const { getDatabase } = require('../database');
const { restartScheduler, getSchedulerStatus } = require('../scheduler');
const { sendEventInquiry } = require('../emailService');

router.get('/', (req, res) => {
  try {
    const config = getDatabase().prepare('SELECT * FROM schedule_config WHERE id = 1').get();
    const safe = { ...config };
    safe.smtp_pass = safe.smtp_pass ? '***' : '';
    safe.recipient_emails = JSON.parse(safe.recipient_emails || '[]');
    res.json(safe);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.put('/', (req, res) => {
  try {
    const db = getDatabase();
    const current = db.prepare('SELECT * FROM schedule_config WHERE id = 1').get();
    const {
      send_day_of_month,
      send_hour,
      send_minute,
      frequency,
      recipient_emails,
      smtp_host,
      smtp_port,
      smtp_user,
      smtp_pass,
      smtp_from,
    } = req.body;

    const updatedEmails = recipient_emails !== undefined
      ? JSON.stringify(Array.isArray(recipient_emails) ? recipient_emails : [recipient_emails])
      : current.recipient_emails;

    // Only update smtp_pass if a non-masked value is provided
    const updatedPass = (smtp_pass && smtp_pass !== '***') ? smtp_pass : current.smtp_pass;

    db.prepare(`UPDATE schedule_config SET
      send_day_of_month = ?,
      send_hour = ?,
      send_minute = ?,
      frequency = ?,
      recipient_emails = ?,
      smtp_host = ?,
      smtp_port = ?,
      smtp_user = ?,
      smtp_pass = ?,
      smtp_from = ?,
      updated_at = datetime('now')
      WHERE id = 1`).run(
      send_day_of_month ?? current.send_day_of_month,
      send_hour ?? current.send_hour,
      send_minute ?? current.send_minute,
      frequency ?? current.frequency,
      updatedEmails,
      smtp_host ?? current.smtp_host,
      smtp_port ?? current.smtp_port,
      smtp_user ?? current.smtp_user,
      updatedPass,
      smtp_from ?? current.smtp_from,
    );

    restartScheduler();
    const updated = db.prepare('SELECT * FROM schedule_config WHERE id = 1').get();
    updated.smtp_pass = updated.smtp_pass ? '***' : '';
    updated.recipient_emails = JSON.parse(updated.recipient_emails || '[]');
    res.json(updated);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.post('/send-inquiry', async (req, res) => {
  try {
    await sendEventInquiry();
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.get('/status', (req, res) => {
  try {
    res.json(getSchedulerStatus());
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
