const { query } = require('../config/db');
const { emitBroadcast } = require('../config/socket');

async function writeLog({ userId = null, action, entity = null, entityId = null, meta = null }) {
  try {
    const { rows } = await query(
      `INSERT INTO logs (user_id, action, entity, entity_id, meta)
       VALUES ($1, $2, $3, $4, $5) RETURNING *`,
      [userId, action, entity, entityId, meta ? JSON.stringify(meta) : null]
    );
    const log = rows[0];

    // Enrich with user info so clients can render it directly
    let user_name = null, user_email = null;
    if (log.user_id) {
      const u = await query('SELECT name, email FROM users WHERE id = $1', [log.user_id]);
      if (u.rows[0]) { user_name = u.rows[0].name; user_email = u.rows[0].email; }
    }

    emitBroadcast('activity:new', { ...log, user_name, user_email });
    return log;
  } catch (err) {
    console.error('[audit] failed to write log:', err.message);
  }
}

module.exports = { writeLog };
