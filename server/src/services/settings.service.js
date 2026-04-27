const { query } = require('../config/db');

exports.getAll = async () => {
  const { rows } = await query('SELECT key, value FROM settings');
  return rows.reduce((acc, r) => { acc[r.key] = r.value; return acc; }, {});
};

exports.upsert = async (kv) => {
  const entries = Object.entries(kv || {});
  for (const [key, value] of entries) {
    await query(
      `INSERT INTO settings (key, value) VALUES ($1, $2)
       ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value, updated_at = NOW()`,
      [key, JSON.stringify(value)]
    );
  }
  return exports.getAll();
};
