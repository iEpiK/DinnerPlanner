'use strict';

process.env.NODE_ENV = 'test';

jest.mock('../src/database', () => {
  const Database = require('better-sqlite3');
  let _db = null;
  function getDatabase() {
    if (_db) return _db;
    _db = new Database(':memory:');
    _db.exec(`
      CREATE TABLE IF NOT EXISTS dinners (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL,
        type TEXT NOT NULL CHECK(type IN ('meat','vegan','poultry','fish','pasta','other')),
        is_saturday INTEGER NOT NULL DEFAULT 0,
        created_at TEXT NOT NULL DEFAULT (datetime('now'))
      );
      CREATE TABLE IF NOT EXISTS plans (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        token TEXT NOT NULL UNIQUE,
        month INTEGER NOT NULL,
        year INTEGER NOT NULL,
        status TEXT NOT NULL DEFAULT 'draft',
        created_at TEXT NOT NULL DEFAULT (datetime('now')),
        updated_at TEXT NOT NULL DEFAULT (datetime('now'))
      );
      CREATE TABLE IF NOT EXISTS plan_days (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        plan_id INTEGER NOT NULL REFERENCES plans(id) ON DELETE CASCADE,
        date TEXT NOT NULL,
        dinner_id INTEGER REFERENCES dinners(id) ON DELETE SET NULL,
        is_event INTEGER NOT NULL DEFAULT 0,
        event_note TEXT,
        dinner_override TEXT
      );
      CREATE TABLE IF NOT EXISTS family_settings (
        id INTEGER PRIMARY KEY CHECK(id = 1),
        adults INTEGER NOT NULL DEFAULT 1,
        kids INTEGER NOT NULL DEFAULT 0,
        updated_at TEXT NOT NULL DEFAULT (datetime('now'))
      );
      CREATE TABLE IF NOT EXISTS schedule_config (
        id INTEGER PRIMARY KEY CHECK(id = 1),
        send_day_of_month INTEGER NOT NULL DEFAULT 1,
        send_hour INTEGER NOT NULL DEFAULT 9,
        send_minute INTEGER NOT NULL DEFAULT 0,
        frequency TEXT NOT NULL DEFAULT 'monthly',
        recipient_emails TEXT NOT NULL DEFAULT '[]',
        smtp_host TEXT NOT NULL DEFAULT '',
        smtp_port INTEGER NOT NULL DEFAULT 587,
        smtp_user TEXT NOT NULL DEFAULT '',
        smtp_pass TEXT NOT NULL DEFAULT '',
        smtp_from TEXT NOT NULL DEFAULT '',
        updated_at TEXT NOT NULL DEFAULT (datetime('now'))
      );
      CREATE TABLE IF NOT EXISTS events (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        date TEXT NOT NULL,
        note TEXT,
        created_at TEXT NOT NULL DEFAULT (datetime('now'))
      );
    `);
    _db.prepare('INSERT OR IGNORE INTO family_settings (id, adults, kids) VALUES (1, 1, 0)').run();
    _db.prepare('INSERT OR IGNORE INTO schedule_config (id) VALUES (1)').run();
    const dinners = [
      { name: 'Beef Stew', type: 'meat', is_saturday: 1 },
      { name: 'Pork Roast', type: 'meat', is_saturday: 1 },
      { name: 'Lamb Chops', type: 'meat', is_saturday: 0 },
      { name: 'Beef Tacos', type: 'meat', is_saturday: 0 },
      { name: 'Meatballs', type: 'meat', is_saturday: 0 },
      { name: 'Vegetable Curry', type: 'vegan', is_saturday: 0 },
      { name: 'Lentil Soup', type: 'vegan', is_saturday: 0 },
      { name: 'Chickpea Stew', type: 'vegan', is_saturday: 0 },
      { name: 'Stuffed Peppers', type: 'vegan', is_saturday: 0 },
      { name: 'Black Bean Burgers', type: 'vegan', is_saturday: 0 },
      { name: 'Roast Chicken', type: 'poultry', is_saturday: 1 },
      { name: 'Chicken Stir-fry', type: 'poultry', is_saturday: 0 },
      { name: 'Turkey Meatloaf', type: 'poultry', is_saturday: 0 },
      { name: 'Chicken Tikka', type: 'poultry', is_saturday: 1 },
      { name: 'Baked Salmon', type: 'fish', is_saturday: 1 },
      { name: 'Fish Tacos', type: 'fish', is_saturday: 0 },
      { name: 'Shrimp Stir-fry', type: 'fish', is_saturday: 0 },
      { name: 'Spaghetti Bolognese', type: 'pasta', is_saturday: 0 },
      { name: 'Penne Arrabbiata', type: 'pasta', is_saturday: 0 },
      { name: 'Fettuccine Alfredo', type: 'pasta', is_saturday: 0 },
      { name: 'Cheese Omelette', type: 'other', is_saturday: 0 },
      { name: 'Veggie Pizza', type: 'other', is_saturday: 0 },
    ];
    const ins = _db.prepare('INSERT INTO dinners (name, type, is_saturday) VALUES (@name, @type, @is_saturday)');
    const insAll = _db.transaction((items) => { for (const d of items) ins.run(d); });
    insAll(dinners);
    return _db;
  }
  function resetDatabase() { _db = null; }
  return { getDatabase, resetDatabase };
});

const request = require('supertest');
const app = require('../server');

describe('API Integration Tests', () => {
  test('GET /api/dinners returns 200', async () => {
    const res = await request(app).get('/api/dinners');
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body)).toBe(true);
  });

  test('POST /api/dinners creates dinner', async () => {
    const res = await request(app)
      .post('/api/dinners')
      .send({ name: 'API Test Dinner', type: 'pasta', isSaturday: false });
    expect(res.status).toBe(201);
    expect(res.body.name).toBe('API Test Dinner');
    expect(res.body.type).toBe('pasta');
  });

  test('GET /api/family returns family settings', async () => {
    const res = await request(app).get('/api/family');
    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('adults');
    expect(res.body).toHaveProperty('kids');
  });

  test('PUT /api/family updates family settings', async () => {
    const res = await request(app)
      .put('/api/family')
      .send({ adults: 2, kids: 3 });
    expect(res.status).toBe(200);
    expect(res.body.adults).toBe(2);
    expect(res.body.kids).toBe(3);
  });

  test('GET /api/schedule returns schedule config', async () => {
    const res = await request(app).get('/api/schedule');
    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('send_day_of_month');
    expect(res.body).toHaveProperty('smtp_host');
    expect(res.body.smtp_pass).toBe('');
  });

  test('POST /api/plans/generate generates a plan', async () => {
    const res = await request(app)
      .post('/api/plans/generate')
      .send({ year: 2024, month: 6 });
    expect(res.status).toBe(201);
    expect(res.body).toHaveProperty('token');
    expect(res.body.days).toHaveLength(30); // June has 30 days
  });
});
