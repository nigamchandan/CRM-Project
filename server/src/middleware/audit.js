const { query } = require('../config/db');
const { emitBroadcast } = require('../config/socket');

/**
 * Production-grade audit logger.
 *
 * Backwards compatible with the old `writeLog({ userId, action, entity,
 * entityId, meta })` shape, but also accepts:
 *   - `req`     → captures IP + user-agent automatically
 *   - `before`  → JSON snapshot of the entity *before* the change
 *   - `after`   → JSON snapshot of the entity *after* the change
 *
 * The richer signature is what every reviewer / compliance officer actually
 * wants: "who changed what, from where, and what did it look like before".
 */
function pickIp(req) {
  if (!req) return null;
  // Express returns the proxy-aware IP when `trust proxy` is enabled.
  // Fall back to the raw socket address otherwise.
  const ip = req.ip || (req.connection && req.connection.remoteAddress) || null;
  if (!ip) return null;
  // Strip the IPv6-mapped-IPv4 prefix so logs read "127.0.0.1" not "::ffff:127.0.0.1".
  return ip.replace(/^::ffff:/i, '').slice(0, 45);
}

function pickUa(req) {
  if (!req || !req.headers) return null;
  const raw = req.headers['user-agent'];
  if (!raw) return null;
  // Truncate to schema length (400) so a pathological UA can't blow up the insert.
  return String(raw).slice(0, 400);
}

/**
 * Strip volatile / oversized fields from a snapshot before persisting.
 * We keep the shape recognisable but drop big descriptions, html bodies,
 * timestamps that change every save, etc.
 */
function sanitizeSnapshot(obj) {
  if (!obj || typeof obj !== 'object') return null;
  const out = { ...obj };
  // Always drop these — noisy and never useful in a diff.
  delete out.updated_at;
  delete out.password_hash;
  delete out.password;
  // Cap any very long string field to keep meta small.
  for (const k of Object.keys(out)) {
    if (typeof out[k] === 'string' && out[k].length > 500) {
      out[k] = out[k].slice(0, 500) + '…';
    }
  }
  return out;
}

async function writeLog({
  userId  = null,
  action,
  entity  = null,
  entityId = null,
  meta    = null,
  req     = null,
  before  = null,
  after   = null,
} = {}) {
  try {
    const ip  = pickIp(req);
    const ua  = pickUa(req);
    const bef = before ? sanitizeSnapshot(before) : null;
    const aft = after  ? sanitizeSnapshot(after)  : null;

    const { rows } = await query(
      `INSERT INTO logs
         (user_id, action, entity, entity_id, meta, ip_address, user_agent, before_data, after_data)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
       RETURNING *`,
      [
        userId,
        action,
        entity,
        entityId,
        meta ? JSON.stringify(meta) : null,
        ip,
        ua,
        bef ? JSON.stringify(bef) : null,
        aft ? JSON.stringify(aft) : null,
      ]
    );
    const log = rows[0];

    // Enrich with user info so clients can render the row directly.
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
