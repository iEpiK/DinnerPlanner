'use strict';

const express = require('express');
const path = require('path');
const rateLimit = require('express-rate-limit');
const { initScheduler } = require('./src/scheduler');
const { getDatabase } = require('./src/database');

const app = express();

app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static(path.join(__dirname, 'public')));

// Apply rate limiting to all API routes
const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 200,
  standardHeaders: true,
  legacyHeaders: false,
});
app.use('/api/', apiLimiter);

// API routes
app.use('/api/dinners', require('./src/routes/dinners'));
app.use('/api/plans', require('./src/routes/plans'));
app.use('/api/schedule', require('./src/routes/schedule'));
app.use('/api/family', require('./src/routes/family'));

// Events API
app.get('/api/events', (req, res) => {
  try {
    const events = getDatabase().prepare('SELECT * FROM events ORDER BY date').all();
    res.json(events);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/events', (req, res) => {
  try {
    const { date, note } = req.body;
    if (!date) return res.status(400).json({ error: 'date is required' });
    const result = getDatabase().prepare('INSERT INTO events (date, note) VALUES (?, ?)').run(date, note || null);
    const event = getDatabase().prepare('SELECT * FROM events WHERE id = ?').get(result.lastInsertRowid);
    res.status(201).json(event);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.delete('/api/events/:id', (req, res) => {
  try {
    const result = getDatabase().prepare('DELETE FROM events WHERE id = ?').run(Number(req.params.id));
    if (result.changes === 0) return res.status(404).json({ error: 'Event not found' });
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Events submission page
app.get('/events', (req, res) => {
  res.send(`<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Submit Event Dates - Dinner Planner</title>
  <style>
    body { font-family: sans-serif; max-width: 600px; margin: 40px auto; padding: 0 20px; background: #fdf6ec; color: #3d2b1f; }
    h1 { color: #c0550a; }
    label { display: block; margin-top: 16px; font-weight: bold; }
    input, textarea { width: 100%; padding: 8px; margin-top: 4px; border: 1px solid #ccc; border-radius: 4px; }
    button { margin-top: 20px; background: #c0550a; color: white; border: none; padding: 10px 24px; border-radius: 4px; cursor: pointer; font-size: 16px; }
    button:hover { background: #a04008; }
    #message { margin-top: 16px; padding: 10px; border-radius: 4px; display: none; }
    .success { background: #d4edda; color: #155724; }
    .error { background: #f8d7da; color: #721c24; }
    #events-list { margin-top: 24px; }
    .event-item { background: white; border: 1px solid #ddd; border-radius: 4px; padding: 8px 12px; margin-bottom: 8px; display: flex; justify-content: space-between; align-items: center; }
    .delete-btn { background: #dc3545; color: white; border: none; padding: 4px 10px; border-radius: 3px; cursor: pointer; }
  </style>
</head>
<body>
  <h1>🗓️ Submit Event Dates</h1>
  <p>Please let us know if there are days next month where a simple dinner would be preferred (busy days, parties, outings, etc.)</p>
  <form id="event-form">
    <label for="date">Date</label>
    <input type="date" id="date" name="date" required>
    <label for="note">Note (optional)</label>
    <textarea id="note" name="note" rows="2" placeholder="e.g., Birthday party, Late work day..."></textarea>
    <button type="submit">Submit Date</button>
  </form>
  <div id="message"></div>
  <div id="events-list">
    <h2>Submitted Events</h2>
    <div id="events-container"></div>
  </div>
  <script>
    async function loadEvents() {
      const res = await fetch('/api/events');
      const events = await res.json();
      const container = document.getElementById('events-container');
      container.innerHTML = events.length === 0 ? '<p>No events submitted yet.</p>' :
        events.map(e => \`<div class="event-item"><span><strong>\${e.date}</strong>\${e.note ? ' - ' + e.note : ''}</span><button class="delete-btn" onclick="deleteEvent(\${e.id})">Remove</button></div>\`).join('');
    }
    async function deleteEvent(id) {
      await fetch(\`/api/events/\${id}\`, { method: 'DELETE' });
      loadEvents();
    }
    document.getElementById('event-form').addEventListener('submit', async (e) => {
      e.preventDefault();
      const date = document.getElementById('date').value;
      const note = document.getElementById('note').value;
      const msg = document.getElementById('message');
      try {
        const res = await fetch('/api/events', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ date, note }) });
        if (res.ok) {
          msg.textContent = 'Event date submitted successfully!';
          msg.className = 'success';
          msg.style.display = 'block';
          e.target.reset();
          loadEvents();
        } else {
          const err = await res.json();
          msg.textContent = err.error || 'Failed to submit event.';
          msg.className = 'error';
          msg.style.display = 'block';
        }
      } catch (err) {
        msg.textContent = 'Network error. Please try again.';
        msg.className = 'error';
        msg.style.display = 'block';
      }
    });
    loadEvents();
  </script>
</body>
</html>`);
});

// Plan edit page - rate limited to prevent token enumeration
const editLimiter = rateLimit({ windowMs: 15 * 60 * 1000, max: 100, standardHeaders: true, legacyHeaders: false });
app.get('/plan/edit/:token', editLimiter, (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// Init scheduler (only when not testing)
if (process.env.NODE_ENV !== 'test') {
  try {
    initScheduler();
  } catch (err) {
    console.error('Scheduler init error:', err.message);
  }
}

const PORT = process.env.PORT || 3000;

if (process.env.NODE_ENV !== 'test') {
  app.listen(PORT, () => {
    console.log(`Dinner Planner running on http://localhost:${PORT}`);
  });
}

module.exports = app;
