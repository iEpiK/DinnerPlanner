'use strict';

const { v4: uuidv4 } = require('uuid');
const { getDatabase } = require('./database');

function db() {
  return getDatabase();
}

function shuffle(arr) {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

function getDaysInMonth(year, month) {
  return new Date(year, month, 0).getDate();
}

function pad(n) {
  return String(n).padStart(2, '0');
}

function generateMonthlyPlan(year, month, options = {}) {
  const { eventDates = [], saturdaySpecial = true } = options;

  const allDinners = db().prepare('SELECT * FROM dinners').all();
  const saturdayDinners = allDinners.filter(d => d.is_saturday === 1);

  const eventDateSet = new Set(eventDates.map(e => e.date));
  const eventMap = {};
  for (const e of eventDates) eventMap[e.date] = e.note || '';

  const daysInMonth = getDaysInMonth(year, month);
  const planDays = [];

  // Pool management
  let pool = shuffle([...allDinners]);
  let satPool = shuffle([...saturdayDinners]);
  const recentlyUsed = [];

  function pickFromPool(localPool) {
    if (localPool.length === 0) {
      const recentIds = recentlyUsed.slice(-5).map(r => r.id);
      const filtered = shuffle(allDinners.filter(d => !recentIds.includes(d.id)));
      localPool.push(...(filtered.length > 0 ? filtered : shuffle([...allDinners])));
    }
    const dinner = localPool.shift();
    if (dinner) {
      recentlyUsed.push(dinner);
      if (recentlyUsed.length > 10) recentlyUsed.shift();
    }
    return dinner;
  }

  for (let day = 1; day <= daysInMonth; day++) {
    const dateStr = `${year}-${pad(month)}-${pad(day)}`;
    const dow = new Date(year, month - 1, day).getDay(); // 0=Sun, 6=Sat

    if (eventDateSet.has(dateStr)) {
      planDays.push({
        date: dateStr,
        dinner: null,
        isEvent: true,
        eventNote: eventMap[dateStr],
        dinnerOverride: 'Simple dinner',
      });
      continue;
    }

    let dinner;
    if (saturdaySpecial && dow === 6 && satPool.length > 0) {
      // Try to pick a Saturday dinner
      const recentIds = recentlyUsed.slice(-3).map(r => r.id);
      const filtered = satPool.filter(d => !recentIds.includes(d.id));
      if (filtered.length > 0) {
        dinner = filtered[0];
        const idx = satPool.findIndex(d => d.id === dinner.id);
        satPool.splice(idx, 1);
        recentlyUsed.push(dinner);
        if (recentlyUsed.length > 10) recentlyUsed.shift();
      } else {
        dinner = pickFromPool(pool);
      }
    } else {
      dinner = pickFromPool(pool);
    }

    planDays.push({
      date: dateStr,
      dinner,
      isEvent: false,
      eventNote: null,
      dinnerOverride: null,
    });
  }

  return planDays;
}

function savePlan(year, month, planDays) {
  const database = db();
  const token = uuidv4();

  const planResult = database.prepare(
    'INSERT INTO plans (token, month, year, status) VALUES (?, ?, ?, ?)'
  ).run(token, month, year, 'draft');

  const planId = planResult.lastInsertRowid;

  const insertDay = database.prepare(
    'INSERT INTO plan_days (plan_id, date, dinner_id, is_event, event_note, dinner_override) VALUES (?, ?, ?, ?, ?, ?)'
  );

  const insertAll = database.transaction((days) => {
    for (const d of days) {
      insertDay.run(
        planId,
        d.date,
        d.dinner ? d.dinner.id : null,
        d.isEvent ? 1 : 0,
        d.eventNote || null,
        d.dinnerOverride || null
      );
    }
  });

  insertAll(planDays);

  return getPlan(planId);
}

function getPlan(id) {
  const database = db();
  const plan = database.prepare('SELECT * FROM plans WHERE id = ?').get(id);
  if (!plan) return null;
  const days = database.prepare(`
    SELECT pd.*, d.name as dinner_name, d.type as dinner_type, d.is_saturday as dinner_is_saturday
    FROM plan_days pd
    LEFT JOIN dinners d ON pd.dinner_id = d.id
    WHERE pd.plan_id = ?
    ORDER BY pd.date
  `).all(id);
  return { ...plan, days };
}

function getPlanByToken(token) {
  const database = db();
  const plan = database.prepare('SELECT * FROM plans WHERE token = ?').get(token);
  if (!plan) return null;
  return getPlan(plan.id);
}

function updatePlanDay(planDayId, { dinnerId, dinnerOverride, isEvent, eventNote }) {
  const database = db();
  const existing = database.prepare('SELECT * FROM plan_days WHERE id = ?').get(planDayId);
  if (!existing) return null;

  const updDinnerId = dinnerId !== undefined ? dinnerId : existing.dinner_id;
  const updOverride = dinnerOverride !== undefined ? dinnerOverride : existing.dinner_override;
  const updIsEvent = isEvent !== undefined ? (isEvent ? 1 : 0) : existing.is_event;
  const updNote = eventNote !== undefined ? eventNote : existing.event_note;

  database.prepare(
    'UPDATE plan_days SET dinner_id = ?, dinner_override = ?, is_event = ?, event_note = ? WHERE id = ?'
  ).run(updDinnerId, updOverride, updIsEvent, updNote, planDayId);

  // Update plan updated_at
  database.prepare('UPDATE plans SET updated_at = datetime(\'now\') WHERE id = ?').run(existing.plan_id);

  return database.prepare('SELECT * FROM plan_days WHERE id = ?').get(planDayId);
}

function getAllPlans() {
  return db().prepare('SELECT * FROM plans ORDER BY year DESC, month DESC').all();
}

module.exports = {
  generateMonthlyPlan,
  savePlan,
  getPlan,
  getPlanByToken,
  updatePlanDay,
  getAllPlans,
};
