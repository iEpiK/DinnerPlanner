'use strict';

const cron = require('node-cron');
const { getDatabase } = require('./database');

let currentTask = null;

function getConfig() {
  return getDatabase().prepare('SELECT * FROM schedule_config WHERE id = 1').get();
}

function buildCronExpression(config) {
  // minute hour day-of-month * *
  return `${config.send_minute} ${config.send_hour} ${config.send_day_of_month} * *`;
}

function initScheduler() {
  if (currentTask) {
    currentTask.stop();
    currentTask = null;
  }

  const config = getConfig();
  const expr = buildCronExpression(config);

  if (!cron.validate(expr)) {
    console.warn(`Invalid cron expression: ${expr}`);
    return;
  }

  currentTask = cron.schedule(expr, async () => {
    console.log('[Scheduler] Running scheduled plan send...');
    try {
      const { generateMonthlyPlan, savePlan } = require('./planGenerator');
      const { sendDinnerPlan } = require('./emailService');
      const db = getDatabase();

      const now = new Date();
      // Generate for next month
      let year = now.getFullYear();
      let month = now.getMonth() + 2;
      if (month > 12) { month = 1; year++; }

      const family = db.prepare('SELECT * FROM family_settings WHERE id = 1').get();
      const events = db.prepare('SELECT * FROM events WHERE date LIKE ?').all(`${year}-${String(month).padStart(2,'0')}-%`);
      const eventDates = events.map(e => ({ date: e.date, note: e.note }));

      const planDays = generateMonthlyPlan(year, month, {
        familyAdults: family.adults,
        familyKids: family.kids,
        eventDates,
        saturdaySpecial: true,
      });

      const plan = savePlan(year, month, planDays);
      await sendDinnerPlan(plan.id);
      console.log(`[Scheduler] Plan sent for ${month}/${year}`);
    } catch (err) {
      console.error('[Scheduler] Error:', err.message);
    }
  });

  console.log(`[Scheduler] Initialized with expression: ${expr}`);
  return currentTask;
}

function restartScheduler() {
  return initScheduler();
}

function getSchedulerStatus() {
  const config = getConfig();
  const expr = buildCronExpression(config);
  return {
    cronExpression: expr,
    isRunning: currentTask !== null,
    config: {
      sendDayOfMonth: config.send_day_of_month,
      sendHour: config.send_hour,
      sendMinute: config.send_minute,
      frequency: config.frequency,
    },
  };
}

module.exports = { initScheduler, restartScheduler, getSchedulerStatus };
