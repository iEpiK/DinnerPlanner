'use strict';

process.env.DB_PATH = ':memory:';
process.env.NODE_ENV = 'test';

// Reset module cache to get a fresh DB instance per test file
jest.resetModules();

const { getDatabase, resetDatabase } = require('../src/database');

// Patch database module to always use :memory:
jest.mock('../src/database', () => {
  const Database = require('better-sqlite3');
  let _db = null;
  function getDatabase() {
    if (_db) return _db;
    _db = new Database(':memory:');
    // Re-run schema init
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
    return _db;
  }
  function resetDatabase() { _db = null; }
  return { getDatabase, resetDatabase };
});

const dm = require('../src/dinnerManager');

describe('DinnerManager', () => {
  test('should add a dinner successfully', () => {
    const dinner = dm.addDinner({ name: 'Test Beef', type: 'meat', isSaturday: false });
    expect(dinner).toBeDefined();
    expect(dinner.name).toBe('Test Beef');
    expect(dinner.type).toBe('meat');
    expect(dinner.is_saturday).toBe(0);
  });

  test('should reject invalid dinner type', () => {
    expect(() => dm.addDinner({ name: 'Bad', type: 'invalid', isSaturday: false }))
      .toThrow(/Invalid dinner type/);
  });

  test('should get all dinners', () => {
    dm.addDinner({ name: 'Pasta', type: 'pasta', isSaturday: false });
    const all = dm.getAllDinners();
    expect(Array.isArray(all)).toBe(true);
    expect(all.length).toBeGreaterThan(0);
  });

  test('should update a dinner', () => {
    const dinner = dm.addDinner({ name: 'Original', type: 'vegan', isSaturday: false });
    const updated = dm.updateDinner(dinner.id, { name: 'Updated', type: 'fish', isSaturday: true });
    expect(updated.name).toBe('Updated');
    expect(updated.type).toBe('fish');
    expect(updated.is_saturday).toBe(1);
  });

  test('should delete a dinner', () => {
    const dinner = dm.addDinner({ name: 'ToDelete', type: 'other', isSaturday: false });
    const result = dm.deleteDinner(dinner.id);
    expect(result).toBe(true);
    expect(dm.getDinnerById(dinner.id)).toBeUndefined();
  });

  test('should filter by type', () => {
    dm.addDinner({ name: 'Chicken A', type: 'poultry', isSaturday: false });
    dm.addDinner({ name: 'Chicken B', type: 'poultry', isSaturday: true });
    const poultry = dm.getDinnersByType('poultry');
    expect(poultry.every(d => d.type === 'poultry')).toBe(true);
    expect(poultry.length).toBeGreaterThanOrEqual(2);
  });

  test('should get Saturday dinners', () => {
    dm.addDinner({ name: 'Saturday Special', type: 'meat', isSaturday: true });
    const satDinners = dm.getSaturdayDinners();
    expect(satDinners.every(d => d.is_saturday === 1)).toBe(true);
    expect(satDinners.length).toBeGreaterThanOrEqual(1);
  });
});
