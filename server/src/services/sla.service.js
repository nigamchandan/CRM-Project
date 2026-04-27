const { query } = require('../config/db');

const DEFAULT_POLICY = {
  critical: { response_minutes: 15,  resolution_hours: 4,  business_hours: false },
  high:     { response_minutes: 30,  resolution_hours: 8,  business_hours: false },
  medium:   { response_minutes: 60,  resolution_hours: 24, business_hours: true  },
  low:      { response_minutes: 240, resolution_hours: 72, business_hours: true  },
};

let cache = null;
let cacheAt = 0;
const CACHE_MS = 30_000;

async function loadFromDb() {
  const { rows } = await query(`SELECT value FROM settings WHERE key = 'sla.policy'`);
  if (rows[0]?.value) {
    try {
      return typeof rows[0].value === 'string' ? JSON.parse(rows[0].value) : rows[0].value;
    } catch { /* fall through */ }
  }
  return null;
}

exports.getPolicy = async ({ fresh = false } = {}) => {
  if (!fresh && cache && Date.now() - cacheAt < CACHE_MS) return cache;
  const fromDb = await loadFromDb();
  cache  = { ...DEFAULT_POLICY, ...(fromDb || {}) };
  cacheAt = Date.now();
  return cache;
};

exports.setPolicy = async (newPolicy) => {
  // shallow-merge each priority bucket so partial edits work
  const current = await exports.getPolicy({ fresh: true });
  const merged = { ...current };
  for (const [k, v] of Object.entries(newPolicy || {})) {
    if (typeof v === 'object' && v !== null) merged[k] = { ...(merged[k] || {}), ...v };
  }
  await query(
    `INSERT INTO settings (key,value) VALUES ('sla.policy', $1::jsonb)
     ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value, updated_at = NOW()`,
    [JSON.stringify(merged)]
  );
  cache = merged;
  cacheAt = Date.now();
  return merged;
};

exports.computeDueAt = async (priority, fromDate = new Date()) => {
  const policy = await exports.getPolicy();
  const bucket = policy[priority] || policy.medium;
  const hours  = Number(bucket?.resolution_hours) || 24;
  return new Date(fromDate.getTime() + hours * 3600 * 1000);
};

exports.DEFAULT_POLICY = DEFAULT_POLICY;
