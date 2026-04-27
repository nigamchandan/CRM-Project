const bcrypt = require('bcryptjs');
const { query } = require('../config/db');

const SAFE = 'id, name, email, role, is_active, created_at, updated_at';

exports.list = async ({ page = 1, limit = 20, search = '' } = {}) => {
  const offset = (Number(page) - 1) * Number(limit);
  const params = [`%${search}%`, Number(limit), offset];
  const { rows } = await query(
    `SELECT ${SAFE} FROM users
     WHERE name ILIKE $1 OR email ILIKE $1
     ORDER BY created_at DESC LIMIT $2 OFFSET $3`, params
  );
  const total = await query(`SELECT COUNT(*)::int AS c FROM users WHERE name ILIKE $1 OR email ILIKE $1`, [`%${search}%`]);
  return { data: rows, total: total.rows[0].c, page: Number(page), limit: Number(limit) };
};

exports.getById = async (id) => {
  const { rows } = await query(`SELECT ${SAFE} FROM users WHERE id = $1`, [id]);
  return rows[0];
};

exports.create = async ({ name, email, password, role = 'user' }) => {
  const hash = await bcrypt.hash(password || 'changeme123', 10);
  const { rows } = await query(
    `INSERT INTO users (name, email, password, role, is_active)
     VALUES ($1,$2,$3,$4,TRUE) RETURNING ${SAFE}`,
    [name, email, hash, role]
  );
  return rows[0];
};

exports.update = async (id, { name, email, role }) => {
  const { rows } = await query(
    `UPDATE users SET
       name = COALESCE($2,name),
       email = COALESCE($3,email),
       role = COALESCE($4,role),
       updated_at = NOW()
     WHERE id = $1 RETURNING ${SAFE}`,
    [id, name, email, role]
  );
  return rows[0];
};

exports.setActive = async (id, is_active) => {
  const { rows } = await query(
    `UPDATE users SET is_active = $2, updated_at = NOW() WHERE id = $1 RETURNING ${SAFE}`,
    [id, !!is_active]
  );
  return rows[0];
};

exports.remove = async (id) => {
  await query('DELETE FROM users WHERE id = $1', [id]);
};
