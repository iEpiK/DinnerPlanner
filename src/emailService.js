'use strict';

const nodemailer = require('nodemailer');
const { getDatabase } = require('./database');
const { getPlan } = require('./planGenerator');

const APP_HOST = process.env.APP_HOST || 'localhost:3000';

function getConfig() {
  return getDatabase().prepare('SELECT * FROM schedule_config WHERE id = 1').get();
}

function getTransport() {
  const config = getConfig();
  return nodemailer.createTransport({
    host: config.smtp_host,
    port: config.smtp_port,
    secure: config.smtp_port === 465,
    auth: {
      user: config.smtp_user,
      pass: config.smtp_pass,
    },
  });
}

const MONTH_NAMES = [
  'January','February','March','April','May','June',
  'July','August','September','October','November','December'
];

function formatPlanHtml(plan) {
  const monthName = MONTH_NAMES[plan.month - 1];
  let rows = '';
  for (const day of plan.days) {
    const dateObj = new Date(day.date + 'T00:00:00');
    const dayName = ['Sun','Mon','Tue','Wed','Thu','Fri','Sat'][dateObj.getDay()];
    let dinner = '';
    if (day.is_event) {
      dinner = `<em>Event: ${day.event_note || ''} - ${day.dinner_override || 'Simple dinner'}</em>`;
    } else if (day.dinner_name) {
      dinner = day.dinner_name;
    } else if (day.dinner_override) {
      dinner = day.dinner_override;
    }
    rows += `<tr><td>${dayName} ${day.date}</td><td>${dinner}</td></tr>`;
  }

  return `
    <html><body>
    <h2>Dinner Plan for ${monthName} ${plan.year}</h2>
    <table border="1" cellpadding="6" cellspacing="0">
      <thead><tr><th>Date</th><th>Dinner</th></tr></thead>
      <tbody>${rows}</tbody>
    </table>
    <p><a href="http://${APP_HOST}/plan/edit/${plan.token}">Edit this plan</a></p>
    </body></html>
  `;
}

async function sendDinnerPlan(planId) {
  const config = getConfig();
  const recipients = JSON.parse(config.recipient_emails || '[]');
  if (!recipients.length) throw new Error('No recipient emails configured');

  const plan = getPlan(planId);
  if (!plan) throw new Error(`Plan ${planId} not found`);

  const monthName = MONTH_NAMES[plan.month - 1];
  const transport = getTransport();

  await transport.sendMail({
    from: config.smtp_from,
    to: recipients.join(', '),
    subject: `Dinner Plan for ${monthName} ${plan.year}`,
    html: formatPlanHtml(plan),
  });

  getDatabase().prepare('UPDATE plans SET status = \'sent\', updated_at = datetime(\'now\') WHERE id = ?').run(planId);
}

async function sendEditLink(planId, toEmail) {
  const config = getConfig();
  const plan = getPlan(planId);
  if (!plan) throw new Error(`Plan ${planId} not found`);

  const transport = getTransport();
  const editUrl = `http://${APP_HOST}/plan/edit/${plan.token}`;
  const monthName = MONTH_NAMES[plan.month - 1];

  await transport.sendMail({
    from: config.smtp_from,
    to: toEmail,
    subject: `Edit Dinner Plan for ${monthName} ${plan.year}`,
    html: `<p>You can edit the dinner plan for ${monthName} ${plan.year} here:</p><p><a href="${editUrl}">${editUrl}</a></p>`,
  });
}

async function sendEventInquiry() {
  const config = getConfig();
  const recipients = JSON.parse(config.recipient_emails || '[]');
  if (!recipients.length) throw new Error('No recipient emails configured');

  const transport = getTransport();
  const eventsUrl = `http://${APP_HOST}/events`;

  await transport.sendMail({
    from: config.smtp_from,
    to: recipients.join(', '),
    subject: 'Upcoming Month - Please Submit Event Dates',
    html: `
      <p>Hi!</p>
      <p>We're planning next month's dinners. Please let us know if there are any days where a simple dinner would be preferred (e.g., busy days, parties, outings).</p>
      <p>Submit your event dates here: <a href="${eventsUrl}">${eventsUrl}</a></p>
      <p>Thank you!</p>
    `,
  });
}

module.exports = { getTransport, sendDinnerPlan, sendEditLink, sendEventInquiry };
