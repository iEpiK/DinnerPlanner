'use strict';

process.env.DB_PATH = ':memory:';
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
    // Seed 22 dinners
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

const pg = require('../src/planGenerator');

describe('PlanGenerator', () => {
  test('should generate plan covering all days in month', () => {
    const plan = pg.generateMonthlyPlan(2024, 1, {}); // January 2024 = 31 days
    expect(plan).toHaveLength(31);
    const dates = plan.map(d => d.date);
    expect(dates[0]).toBe('2024-01-01');
    expect(dates[30]).toBe('2024-01-31');
  });

  test('should not repeat same dinner on consecutive days', () => {
    const plan = pg.generateMonthlyPlan(2024, 3, {});
    for (let i = 1; i < plan.length; i++) {
      const prev = plan[i - 1];
      const curr = plan[i];
      if (!prev.isEvent && !curr.isEvent && prev.dinner && curr.dinner) {
        expect(curr.dinner.id).not.toBe(prev.dinner.id);
      }
    }
  });

  test('should assign event dinners for event dates', () => {
    const plan = pg.generateMonthlyPlan(2024, 2, { eventDates: [{ date: '2024-02-10', note: 'Birthday party' }] });
    const eventDay = plan.find(d => d.date === '2024-02-10');
    expect(eventDay).toBeDefined();
    expect(eventDay.isEvent).toBe(true);
    expect(eventDay.eventNote).toBe('Birthday party');
  });

  test('should save and retrieve plan by token', () => {
    const planDays = pg.generateMonthlyPlan(2024, 4, {});
    const saved = pg.savePlan(2024, 4, planDays);
    expect(saved).toBeDefined();
    expect(saved.token).toBeDefined();
    expect(saved.days).toHaveLength(30); // April has 30 days

    const retrieved = pg.getPlanByToken(saved.token);
    expect(retrieved).toBeDefined();
    expect(retrieved.id).toBe(saved.id);
    expect(retrieved.token).toBe(saved.token);
  });
});
