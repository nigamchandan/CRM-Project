const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { query } = require('../config/db');

function signToken(user) {
  return jwt.sign(
    { id: user.id, email: user.email, role: user.role },
    process.env.JWT_SECRET,
    { expiresIn: process.env.JWT_EXPIRES_IN || '7d' }
  );
}

function sanitize(user) {
  if (!user) return null;
  const { password, ...rest } = user;
  return rest;
}

exports.register = async ({ name, email, password }) => {
  const existing = await query('SELECT id FROM users WHERE email = $1', [email]);
  if (existing.rows.length) {
    const err = new Error('Email already registered'); err.status = 409; throw err;
  }

  // Bootstrap: if the system has no users at all, the first signup becomes admin.
  // Otherwise, public registration always creates a 'user' role (least privilege).
  const userCount = (await query('SELECT COUNT(*)::int AS c FROM users')).rows[0].c;
  const role = userCount === 0 ? 'admin' : 'user';

  const hash = await bcrypt.hash(password, 10);
  const { rows } = await query(
    `INSERT INTO users (name, email, password, role, is_active)
     VALUES ($1, $2, $3, $4, TRUE) RETURNING *`,
    [name, email, hash, role]
  );
  const user = sanitize(rows[0]);
  return { user, token: signToken(user) };
};

exports.login = async ({ email, password }) => {
  const { rows } = await query('SELECT * FROM users WHERE email = $1', [email]);
  const user = rows[0];
  if (!user || !user.is_active) {
    const err = new Error('Invalid credentials'); err.status = 401; throw err;
  }
  const ok = await bcrypt.compare(password, user.password);
  if (!ok) { const err = new Error('Invalid credentials'); err.status = 401; throw err; }
  const clean = sanitize(user);
  return { user: clean, token: signToken(clean) };
};

exports.getById = async (id) => {
  const { rows } = await query('SELECT * FROM users WHERE id = $1', [id]);
  return sanitize(rows[0]);
};
