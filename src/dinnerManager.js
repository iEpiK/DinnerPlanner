'use strict';

const { getDatabase } = require('./database');

const VALID_TYPES = ['meat', 'vegan', 'poultry', 'fish', 'pasta', 'other'];

function db() {
  return getDatabase();
}

function getAllDinners() {
  return db().prepare('SELECT * FROM dinners ORDER BY name').all();
}

function getDinnerById(id) {
  return db().prepare('SELECT * FROM dinners WHERE id = ?').get(id);
}

function addDinner({ name, type, isSaturday }) {
  if (!VALID_TYPES.includes(type)) {
    throw new Error(`Invalid dinner type: ${type}. Must be one of: ${VALID_TYPES.join(', ')}`);
  }
  const result = db().prepare(
    'INSERT INTO dinners (name, type, is_saturday) VALUES (?, ?, ?)'
  ).run(name, type, isSaturday ? 1 : 0);
  return getDinnerById(result.lastInsertRowid);
}

function updateDinner(id, { name, type, isSaturday }) {
  if (type !== undefined && !VALID_TYPES.includes(type)) {
    throw new Error(`Invalid dinner type: ${type}. Must be one of: ${VALID_TYPES.join(', ')}`);
  }
  const existing = getDinnerById(id);
  if (!existing) return null;
  const updatedName = name !== undefined ? name : existing.name;
  const updatedType = type !== undefined ? type : existing.type;
  const updatedSat = isSaturday !== undefined ? (isSaturday ? 1 : 0) : existing.is_saturday;
  db().prepare(
    'UPDATE dinners SET name = ?, type = ?, is_saturday = ? WHERE id = ?'
  ).run(updatedName, updatedType, updatedSat, id);
  return getDinnerById(id);
}

function deleteDinner(id) {
  const result = db().prepare('DELETE FROM dinners WHERE id = ?').run(id);
  return result.changes > 0;
}

function getDinnersByType(type) {
  return db().prepare('SELECT * FROM dinners WHERE type = ? ORDER BY name').all(type);
}

function getSaturdayDinners() {
  return db().prepare('SELECT * FROM dinners WHERE is_saturday = 1 ORDER BY name').all();
}

function getWeekdayDinners() {
  return db().prepare('SELECT * FROM dinners WHERE is_saturday = 0 ORDER BY name').all();
}

module.exports = {
  getAllDinners,
  getDinnerById,
  addDinner,
  updateDinner,
  deleteDinner,
  getDinnersByType,
  getSaturdayDinners,
  getWeekdayDinners,
  VALID_TYPES,
};
