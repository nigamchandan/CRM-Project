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

/**
 *  Self-service profile update — only the fields a user is allowed to change
 *  about themselves. Role / is_active are intentionally NOT here (admin-only).
 */
exports.updateProfile = async (id, { name, email }) => {
  if (email) {
    const dupe = await query('SELECT id FROM users WHERE email = $1 AND id <> $2', [email, id]);
    if (dupe.rows.length) {
      const err = new Error('That email is already in use'); err.status = 409; throw err;
    }
  }
  const { rows } = await query(
    `UPDATE users SET
       name  = COALESCE($2, name),
       email = COALESCE($3, email),
       updated_at = NOW()
     WHERE id = $1
     RETURNING *`,
    [id, name || null, email || null],
  );
  return sanitize(rows[0]);
};

/**
 *  Change own password. Verifies `current_password` first (so a stolen
 *  session token can't silently rotate the password without the secret).
 */
exports.changePassword = async (id, { current_password, new_password }) => {
  if (!new_password || String(new_password).length < 6) {
    const err = new Error('New password must be at least 6 characters'); err.status = 400; throw err;
  }
  const { rows } = await query('SELECT password FROM users WHERE id = $1', [id]);
  if (!rows.length) { const err = new Error('User not found'); err.status = 404; throw err; }
  const ok = await bcrypt.compare(String(current_password || ''), rows[0].password);
  if (!ok) { const err = new Error('Current password is incorrect'); err.status = 401; throw err; }
  const hash = await bcrypt.hash(new_password, 10);
  await query('UPDATE users SET password = $1, updated_at = NOW() WHERE id = $2', [hash, id]);
  return { ok: true };
};
