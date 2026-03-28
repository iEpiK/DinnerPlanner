'use strict';

const Database = require('better-sqlite3');
const path = require('path');
const fs = require('fs');

let _db = null;

function getDatabase(dbPath) {
  if (_db) return _db;

  const resolvedPath = dbPath || process.env.DB_PATH || path.join(__dirname, '..', 'data', 'dinner_planner.db');

  if (resolvedPath !== ':memory:') {
    const dir = path.dirname(resolvedPath);
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  }

  _db = new Database(resolvedPath);
  initSchema(_db);
  seedData(_db);
  return _db;
}

function resetDatabase() {
  _db = null;
}

function initSchema(db) {
  db.exec(`
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

  const familyExists = db.prepare('SELECT id FROM family_settings WHERE id = 1').get();
  if (!familyExists) {
    db.prepare('INSERT INTO family_settings (id, adults, kids) VALUES (1, 1, 0)').run();
  }

  const scheduleExists = db.prepare('SELECT id FROM schedule_config WHERE id = 1').get();
  if (!scheduleExists) {
    db.prepare('INSERT INTO schedule_config (id, send_day_of_month, send_hour, send_minute, frequency) VALUES (1, 1, 9, 0, \'monthly\')').run();
  }
}

function seedData(db) {
  const count = db.prepare('SELECT COUNT(*) as cnt FROM dinners').get().cnt;
  if (count > 0) return;

  const dinners = [
    // meat (5)
    { name: 'Beef Stew', type: 'meat', is_saturday: 1 },
    { name: 'Pork Roast', type: 'meat', is_saturday: 1 },
    { name: 'Lamb Chops', type: 'meat', is_saturday: 0 },
    { name: 'Beef Tacos', type: 'meat', is_saturday: 0 },
    { name: 'Meatballs with Sauce', type: 'meat', is_saturday: 0 },
    // vegan (5)
    { name: 'Vegetable Curry', type: 'vegan', is_saturday: 0 },
    { name: 'Lentil Soup', type: 'vegan', is_saturday: 0 },
    { name: 'Chickpea Stew', type: 'vegan', is_saturday: 0 },
    { name: 'Stuffed Bell Peppers', type: 'vegan', is_saturday: 0 },
    { name: 'Black Bean Burgers', type: 'vegan', is_saturday: 0 },
    // poultry (4)
    { name: 'Roast Chicken', type: 'poultry', is_saturday: 1 },
    { name: 'Chicken Stir-fry', type: 'poultry', is_saturday: 0 },
    { name: 'Turkey Meatloaf', type: 'poultry', is_saturday: 0 },
    { name: 'Chicken Tikka Masala', type: 'poultry', is_saturday: 1 },
    // fish (3)
    { name: 'Baked Salmon', type: 'fish', is_saturday: 1 },
    { name: 'Fish Tacos', type: 'fish', is_saturday: 0 },
    { name: 'Shrimp Stir-fry', type: 'fish', is_saturday: 0 },
    // pasta (3)
    { name: 'Spaghetti Bolognese', type: 'pasta', is_saturday: 0 },
    { name: 'Penne Arrabbiata', type: 'pasta', is_saturday: 0 },
    { name: 'Fettuccine Alfredo', type: 'pasta', is_saturday: 0 },
    // other (2)
    { name: 'Cheese Omelette', type: 'other', is_saturday: 0 },
    { name: 'Veggie Pizza', type: 'other', is_saturday: 0 },
  ];

  const insert = db.prepare('INSERT INTO dinners (name, type, is_saturday) VALUES (@name, @type, @is_saturday)');
  const insertAll = db.transaction((items) => {
    for (const d of items) insert.run(d);
  });
  insertAll(dinners);
}

module.exports = { getDatabase, resetDatabase };
