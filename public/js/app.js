'use strict';

// =====================
// State
// =====================
let allDinners = [];
let currentPlanId = null;
// Cache plan day data by id to avoid inline JSON in onclick attributes
const planDayCache = new Map();

// =====================
// Utilities
// =====================
function escHtml(str) {
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

function showToast(msg, type = 'info') {
  const t = document.getElementById('toast');
  t.textContent = msg;
  t.className = `toast ${type}`;
  t.style.display = 'block';
  setTimeout(() => { t.style.display = 'none'; }, 3500);
}

async function apiFetch(url, options = {}) {
  const defaults = { headers: { 'Content-Type': 'application/json' } };
  const res = await fetch(url, { ...defaults, ...options });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || 'API error');
  return data;
}

const MONTH_NAMES = ['January','February','March','April','May','June','July','August','September','October','November','December'];
const DAY_NAMES = ['Sun','Mon','Tue','Wed','Thu','Fri','Sat'];

function typeIcon(type) {
  const icons = { meat:'🥩', vegan:'🥦', poultry:'🍗', fish:'🐟', pasta:'🍝', other:'🍳' };
  return icons[type] || '🍽️';
}

// =====================
// Tab Navigation
// =====================
document.querySelectorAll('.tab-btn').forEach(btn => {
  btn.addEventListener('click', () => {
    document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
    document.querySelectorAll('.tab-content').forEach(s => s.classList.remove('active'));
    btn.classList.add('active');
    document.getElementById(`tab-${btn.dataset.tab}`).classList.add('active');
    if (btn.dataset.tab === 'dashboard') loadDashboard();
    if (btn.dataset.tab === 'dinners') loadDinners();
    if (btn.dataset.tab === 'plans') loadPlans();
    if (btn.dataset.tab === 'schedule') loadSchedule();
    if (btn.dataset.tab === 'family') loadFamily();
  });
});

// Handle /plan/edit/:token URL
function checkEditToken() {
  const m = window.location.pathname.match(/^\/plan\/edit\/([^/]+)$/);
  if (m) {
    const token = m[1];
    // Switch to plans tab and load the plan
    document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
    document.querySelectorAll('.tab-content').forEach(s => s.classList.remove('active'));
    document.querySelector('[data-tab="plans"]').classList.add('active');
    document.getElementById('tab-plans').classList.add('active');
    loadPlanByToken(token);
  }
}

// =====================
// Dashboard
// =====================
async function loadDashboard() {
  try {
    const plans = await apiFetch('/api/plans');
    const container = document.getElementById('dashboard-plan');
    if (!plans.length) {
      container.innerHTML = '<p class="empty-state">No plans yet. Click "Generate This Month\'s Plan" above.</p>';
      return;
    }
    // Show most recent plan
    const latest = plans[0];
    const plan = await apiFetch(`/api/plans/${latest.id}`);
    renderPlanGrid(container, plan, false);
  } catch (err) {
    showToast(err.message, 'error');
  }
}

document.getElementById('btn-generate-plan').addEventListener('click', async () => {
  const now = new Date();
  try {
    const plan = await apiFetch('/api/plans/generate', {
      method: 'POST',
      body: JSON.stringify({ year: now.getFullYear(), month: now.getMonth() + 1 })
    });
    showToast(`Plan for ${MONTH_NAMES[plan.month - 1]} ${plan.year} generated!`, 'success');
    loadDashboard();
  } catch (err) {
    showToast(err.message, 'error');
  }
});

// =====================
// Dinners
// =====================
async function loadDinners() {
  try {
    const type = document.getElementById('filter-type').value;
    const url = type ? `/api/dinners?type=${type}` : '/api/dinners';
    allDinners = await apiFetch(url);
    renderDinnersTable(allDinners);
  } catch (err) {
    showToast(err.message, 'error');
  }
}

function renderDinnersTable(dinners) {
  const tbody = document.getElementById('dinners-tbody');
  if (!dinners.length) {
    tbody.innerHTML = '<tr><td colspan="4" class="empty-state">No dinners found.</td></tr>';
    return;
  }
  tbody.innerHTML = dinners.map(d => `
    <tr>
      <td>${escHtml(d.name)}</td>
      <td><span class="badge badge-${escHtml(d.type)}">${typeIcon(d.type)} ${escHtml(d.type)}</span></td>
      <td>${d.is_saturday ? '⭐ Yes' : 'No'}</td>
      <td>
        <button class="btn btn-sm btn-secondary" onclick="editDinner(${d.id})">✏️ Edit</button>
        <button class="btn btn-sm btn-danger" data-id="${d.id}" data-name="${escHtml(d.name)}" onclick="deleteDinner(this.dataset.id, this.dataset.name)">🗑️ Delete</button>
      </td>
    </tr>
  `).join('');
}

document.getElementById('filter-type').addEventListener('change', loadDinners);

document.getElementById('btn-add-dinner').addEventListener('click', () => {
  document.getElementById('dinner-form-container').style.display = 'block';
  document.getElementById('dinner-form-title').textContent = 'Add New Dinner';
  document.getElementById('dinner-form-submit').textContent = 'Add Dinner';
  document.getElementById('dinner-id').value = '';
  document.getElementById('dinner-form').reset();
});

document.getElementById('dinner-form-cancel').addEventListener('click', () => {
  document.getElementById('dinner-form-container').style.display = 'none';
});

document.getElementById('dinner-form').addEventListener('submit', async (e) => {
  e.preventDefault();
  const id = document.getElementById('dinner-id').value;
  const name = document.getElementById('dinner-name').value;
  const type = document.getElementById('dinner-type').value;
  const isSaturday = document.getElementById('dinner-saturday').checked;

  try {
    if (id) {
      await apiFetch(`/api/dinners/${id}`, { method: 'PUT', body: JSON.stringify({ name, type, isSaturday }) });
      showToast('Dinner updated!', 'success');
    } else {
      await apiFetch('/api/dinners', { method: 'POST', body: JSON.stringify({ name, type, isSaturday }) });
      showToast('Dinner added!', 'success');
    }
    document.getElementById('dinner-form-container').style.display = 'none';
    loadDinners();
  } catch (err) {
    showToast(err.message, 'error');
  }
});

function editDinner(id) {
  const d = allDinners.find(x => x.id === id);
  if (!d) return;
  document.getElementById('dinner-form-container').style.display = 'block';
  document.getElementById('dinner-form-title').textContent = 'Edit Dinner';
  document.getElementById('dinner-form-submit').textContent = 'Save Changes';
  document.getElementById('dinner-id').value = d.id;
  document.getElementById('dinner-name').value = d.name;
  document.getElementById('dinner-type').value = d.type;
  document.getElementById('dinner-saturday').checked = d.is_saturday === 1;
}

async function deleteDinner(id, name) {
  const dinner = allDinners.find(x => x.id === Number(id));
  const displayName = dinner ? dinner.name : name;
  if (!confirm(`Delete "${displayName}"?`)) return;
  try {
    await apiFetch(`/api/dinners/${id}`, { method: 'DELETE' });
    showToast('Dinner deleted.', 'success');
    loadDinners();
  } catch (err) {
    showToast(err.message, 'error');
  }
}

// =====================
// Plans
// =====================
async function loadPlans() {
  document.getElementById('plans-list').style.display = 'block';
  document.getElementById('plan-detail').style.display = 'none';
  try {
    const plans = await apiFetch('/api/plans');
    const container = document.getElementById('plans-list');
    if (!plans.length) {
      container.innerHTML = '<p class="empty-state">No plans generated yet.</p>';
      return;
    }
    container.innerHTML = `<div class="plans-list">${plans.map(p => `
      <div class="plan-card">
        <div class="plan-card-info">
          <h4>${MONTH_NAMES[p.month - 1]} ${p.year}</h4>
          <p>Created ${new Date(p.created_at).toLocaleDateString()}</p>
        </div>
        <div class="actions">
          <span class="status-badge status-${p.status}">${p.status}</span>
          <button class="btn btn-sm btn-secondary" onclick="viewPlan(${p.id})">👁️ View</button>
          <button class="btn btn-sm btn-success" onclick="sendPlan(${p.id})">📧 Send</button>
        </div>
      </div>
    `).join('')}</div>`;
  } catch (err) {
    showToast(err.message, 'error');
  }
}

async function viewPlan(id) {
  try {
    const plan = await apiFetch(`/api/plans/${id}`);
    currentPlanId = id;
    document.getElementById('plans-list').style.display = 'none';
    document.getElementById('plan-detail').style.display = 'block';
    document.getElementById('plan-detail-title').textContent = `${MONTH_NAMES[plan.month - 1]} ${plan.year} Plan`;
    document.getElementById('btn-send-plan').onclick = () => sendPlan(id);
    renderPlanGrid(document.getElementById('plan-detail-grid'), plan, true);
  } catch (err) {
    showToast(err.message, 'error');
  }
}

async function loadPlanByToken(token) {
  try {
    const plan = await apiFetch(`/api/plans/edit/${token}`);
    currentPlanId = plan.id;
    document.getElementById('plans-list').style.display = 'none';
    document.getElementById('plan-detail').style.display = 'block';
    document.getElementById('plan-detail-title').textContent = `${MONTH_NAMES[plan.month - 1]} ${plan.year} Plan (Edit Link)`;
    document.getElementById('btn-send-plan').onclick = () => sendPlan(plan.id);
    renderPlanGrid(document.getElementById('plan-detail-grid'), plan, true);
  } catch (err) {
    showToast('Plan not found or invalid link.', 'error');
  }
}

function renderPlanGrid(container, plan, editable) {
  const firstDay = new Date(plan.year, plan.month - 1, 1).getDay();

  planDayCache.clear();
  for (const day of plan.days) planDayCache.set(day.id, day);

  let html = `<div class="plan-month-header">${MONTH_NAMES[plan.month - 1]} ${plan.year}</div>`;
  html += '<div class="plan-grid">';
  
  // Day headers
  DAY_NAMES.forEach(d => { html += `<div class="plan-day-header">${d}</div>`; });
  
  // Empty cells before first day
  for (let i = 0; i < firstDay; i++) {
    html += '<div class="plan-day empty"></div>';
  }

  // Days
  for (const day of plan.days) {
    const dateObj = new Date(day.date + 'T00:00:00');
    const dow = dateObj.getDay();
    const isSat = dow === 6;
    let classes = 'plan-day';
    if (day.is_event) classes += ' event-day';
    else if (isSat) classes += ' saturday';

    let dinnerText = '';
    if (day.is_event) {
      dinnerText = `<span class="day-event-badge">📅 Event</span><br>${escHtml(day.event_note || '')}`;
    } else if (day.dinner_name) {
      dinnerText = `${typeIcon(day.dinner_type)} ${escHtml(day.dinner_name)}`;
    } else if (day.dinner_override) {
      dinnerText = escHtml(day.dinner_override);
    }

    const editAttr = editable ? `data-day-id="${day.id}"` : '';
    html += `<div class="${classes}" ${editAttr}>
      <div class="day-number">${dateObj.getDate()}</div>
      <div class="day-dinner">${dinnerText}</div>
    </div>`;
  }

  html += '</div>';
  container.innerHTML = html;

  if (editable) {
    container.querySelectorAll('.plan-day[data-day-id]').forEach(el => {
      el.addEventListener('click', () => {
        const dayId = parseInt(el.dataset.dayId);
        const dayData = planDayCache.get(dayId);
        if (dayData) openEditDayModal(dayId, dayData);
      });
    });
  }
}

async function sendPlan(id) {
  if (!confirm('Send this plan by email?')) return;
  try {
    await apiFetch(`/api/plans/${id}/send`, { method: 'POST' });
    showToast('Plan sent by email!', 'success');
    loadPlans();
  } catch (err) {
    showToast(err.message, 'error');
  }
}

document.getElementById('btn-back-plans').addEventListener('click', () => {
  document.getElementById('plan-detail').style.display = 'none';
  document.getElementById('plans-list').style.display = 'block';
  currentPlanId = null;
  loadPlans();
});

document.getElementById('btn-generate-plan-2').addEventListener('click', () => {
  const now = new Date();
  document.getElementById('gen-year').value = now.getFullYear();
  document.getElementById('gen-month').value = now.getMonth() + 1;
  document.getElementById('generate-form-container').style.display = 'block';
});

document.getElementById('generate-form-cancel').addEventListener('click', () => {
  document.getElementById('generate-form-container').style.display = 'none';
});

document.getElementById('generate-form').addEventListener('submit', async (e) => {
  e.preventDefault();
  const year = parseInt(document.getElementById('gen-year').value);
  const month = parseInt(document.getElementById('gen-month').value);
  try {
    const plan = await apiFetch('/api/plans/generate', { method: 'POST', body: JSON.stringify({ year, month }) });
    showToast(`Plan for ${MONTH_NAMES[plan.month - 1]} ${plan.year} generated!`, 'success');
    document.getElementById('generate-form-container').style.display = 'none';
    loadPlans();
  } catch (err) {
    showToast(err.message, 'error');
  }
});

// =====================
// Edit Day Modal
// =====================
async function openEditDayModal(dayId, dayData) {
  // Populate dinner select
  if (!allDinners.length) {
    allDinners = await apiFetch('/api/dinners');
  }
  const sel = document.getElementById('edit-dinner-select');
  sel.innerHTML = '<option value="">-- None --</option>' +
    allDinners.map(d => `<option value="${d.id}" ${dayData.dinner_id == d.id ? 'selected' : ''}>${typeIcon(d.type)} ${escHtml(d.name)}</option>`).join('');

  document.getElementById('edit-day-id').value = dayId;
  document.getElementById('edit-dinner-override').value = dayData.dinner_override || '';
  document.getElementById('edit-is-event').checked = dayData.is_event == 1;
  document.getElementById('edit-event-note').value = dayData.event_note || '';
  document.getElementById('modal-overlay').style.display = 'flex';
}

document.getElementById('modal-cancel').addEventListener('click', () => {
  document.getElementById('modal-overlay').style.display = 'none';
});

document.getElementById('edit-day-form').addEventListener('submit', async (e) => {
  e.preventDefault();
  const dayId = document.getElementById('edit-day-id').value;
  const dinnerId = document.getElementById('edit-dinner-select').value || null;
  const dinnerOverride = document.getElementById('edit-dinner-override').value || null;
  const isEvent = document.getElementById('edit-is-event').checked;
  const eventNote = document.getElementById('edit-event-note').value || null;
  try {
    await apiFetch(`/api/plans/day/${dayId}`, {
      method: 'PUT',
      body: JSON.stringify({ dinnerId: dinnerId ? Number(dinnerId) : null, dinnerOverride, isEvent, eventNote })
    });
    document.getElementById('modal-overlay').style.display = 'none';
    showToast('Day updated!', 'success');
    if (currentPlanId) viewPlan(currentPlanId);
  } catch (err) {
    showToast(err.message, 'error');
  }
});

// =====================
// Schedule
// =====================
async function loadSchedule() {
  try {
    const config = await apiFetch('/api/schedule');
    document.getElementById('send-day').value = config.send_day_of_month;
    document.getElementById('send-hour').value = config.send_hour;
    document.getElementById('send-minute').value = config.send_minute;
    document.getElementById('smtp-host').value = config.smtp_host || '';
    document.getElementById('smtp-port').value = config.smtp_port || 587;
    document.getElementById('smtp-user').value = config.smtp_user || '';
    document.getElementById('smtp-pass').value = '';
    document.getElementById('smtp-from').value = config.smtp_from || '';
    const emails = Array.isArray(config.recipient_emails) ? config.recipient_emails : [];
    document.getElementById('recipient-emails').value = emails.join('\n');

    // Load scheduler status
    const status = await apiFetch('/api/schedule/status');
    const sc = document.getElementById('schedule-status');
    sc.style.display = 'block';
    sc.innerHTML = `<strong>Scheduler Status:</strong> ${status.isRunning ? '✅ Running' : '⚠️ Not running'} | Cron: <code>${status.cronExpression}</code>`;
  } catch (err) {
    showToast(err.message, 'error');
  }
}

document.getElementById('schedule-form').addEventListener('submit', async (e) => {
  e.preventDefault();
  const recipientText = document.getElementById('recipient-emails').value;
  const recipients = recipientText.split('\n').map(s => s.trim()).filter(Boolean);
  const pass = document.getElementById('smtp-pass').value;
  const body = {
    send_day_of_month: parseInt(document.getElementById('send-day').value),
    send_hour: parseInt(document.getElementById('send-hour').value),
    send_minute: parseInt(document.getElementById('send-minute').value),
    recipient_emails: recipients,
    smtp_host: document.getElementById('smtp-host').value,
    smtp_port: parseInt(document.getElementById('smtp-port').value),
    smtp_user: document.getElementById('smtp-user').value,
    smtp_from: document.getElementById('smtp-from').value,
  };
  if (pass) body.smtp_pass = pass;
  try {
    await apiFetch('/api/schedule', { method: 'PUT', body: JSON.stringify(body) });
    showToast('Schedule settings saved!', 'success');
    loadSchedule();
  } catch (err) {
    showToast(err.message, 'error');
  }
});

document.getElementById('btn-send-inquiry').addEventListener('click', async () => {
  if (!confirm('Send event inquiry email to all recipients?')) return;
  try {
    await apiFetch('/api/schedule/send-inquiry', { method: 'POST' });
    showToast('Event inquiry email sent!', 'success');
  } catch (err) {
    showToast(err.message, 'error');
  }
});

// =====================
// Family
// =====================
async function loadFamily() {
  try {
    const settings = await apiFetch('/api/family');
    document.getElementById('family-adults').value = settings.adults;
    document.getElementById('family-kids').value = settings.kids;
    updateFamilyTotal(settings.adults, settings.kids);
  } catch (err) {
    showToast(err.message, 'error');
  }
}

function updateFamilyTotal(adults, kids) {
  const total = adults + kids;
  document.getElementById('family-total').textContent = `Total family members: ${total} (${adults} adult${adults !== 1 ? 's' : ''}, ${kids} kid${kids !== 1 ? 's' : ''})`;
}

document.getElementById('family-form').addEventListener('submit', async (e) => {
  e.preventDefault();
  const adults = parseInt(document.getElementById('family-adults').value);
  const kids = parseInt(document.getElementById('family-kids').value);
  try {
    const settings = await apiFetch('/api/family', { method: 'PUT', body: JSON.stringify({ adults, kids }) });
    showToast('Family settings saved!', 'success');
    updateFamilyTotal(settings.adults, settings.kids);
  } catch (err) {
    showToast(err.message, 'error');
  }
});

// =====================
// Initialize
// =====================
loadDashboard();
loadDinners();
checkEditToken();
