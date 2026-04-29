const { query } = require('../config/db');

/* -----------------------------------------------------------------------------
 *  Filter / where-clause builder shared by list() and export().
 *
 *  Supported filters:
 *    - action      (substring, case-insensitive)
 *    - entity      (exact)
 *    - entity_id   (exact, numeric)
 *    - user_id     (exact, numeric)
 *    - ip          (substring match; helps trace one client's activity)
 *    - from / to   (ISO date or datetime; both inclusive)
 *    - q           (free-text: matches user name/email, action, entity, entity_id::text)
 * ---------------------------------------------------------------------------*/
function buildWhere(filters = {}) {
  const params = [];
  const parts = ['1=1'];

  if (filters.action) {
    params.push(`%${filters.action}%`);
    parts.push(`l.action ILIKE $${params.length}`);
  }
  if (filters.entity) {
    params.push(filters.entity);
    parts.push(`l.entity = $${params.length}`);
  }
  if (filters.entity_id !== undefined && filters.entity_id !== null && filters.entity_id !== '') {
    params.push(Number(filters.entity_id));
    parts.push(`l.entity_id = $${params.length}`);
  }
  if (filters.user_id !== undefined && filters.user_id !== null && filters.user_id !== '') {
    params.push(Number(filters.user_id));
    parts.push(`l.user_id = $${params.length}`);
  }
  if (filters.ip) {
    params.push(`%${filters.ip}%`);
    parts.push(`l.ip_address ILIKE $${params.length}`);
  }
  if (filters.from) {
    params.push(filters.from);
    parts.push(`l.created_at >= $${params.length}::timestamptz`);
  }
  if (filters.to) {
    // make `to` inclusive: a plain YYYY-MM-DD becomes the END of that day.
    const t = String(filters.to);
    const inclusiveTo = /^\d{4}-\d{2}-\d{2}$/.test(t) ? `${t} 23:59:59.999` : t;
    params.push(inclusiveTo);
    parts.push(`l.created_at <= $${params.length}::timestamptz`);
  }
  if (filters.q) {
    params.push(`%${filters.q}%`);
    const idx = params.length;
    parts.push(
      `(u.name ILIKE $${idx} OR u.email ILIKE $${idx} OR l.action ILIKE $${idx} ` +
      `OR l.entity ILIKE $${idx} OR COALESCE(l.entity_id::text,'') ILIKE $${idx})`
    );
  }

  return { where: parts.join(' AND '), params };
}

/* -----------------------------------------------------------------------------
 *  Meta enrichment — two passes:
 *    1) Resolve known ID-bearing keys inside `meta` to friendly names
 *       (manager, engineer, project_manager, stage_id, pipeline_id, ...).
 *    2) Resolve a "target label" for the row's own `entity` + `entity_id`
 *       so even meta-less rows (auth.login, contact.create, ...) show
 *       something useful in the Details column.
 *
 *  Both passes batch their lookups so `enrichMetaBatch` makes at most a
 *  handful of queries regardless of row count.
 * ---------------------------------------------------------------------------*/
const USER_KEYS = new Set([
  'user_id', 'assigned_to', 'engineer', 'manager',
  'project_manager', 'reporting_manager',
  'owner_id', 'created_by', 'author_id',
  'assigned_engineer_id', 'reporting_manager_id', 'project_manager_id',
]);
const PROJECT_KEYS  = new Set(['project_id']);
const STAGE_KEYS    = new Set(['stage_id', 'pipeline_stage_id', 'from_stage_id', 'to_stage_id']);
const PIPELINE_KEYS = new Set(['pipeline_id']);

/**
 *  Per-entity label query. Each fn returns SQL + a row→label formatter.
 *  Add a new entity by appending an entry here.
 */
const ENTITY_LABEL = {
  users:     { sql: `SELECT id, name, email FROM users WHERE id = ANY($1::int[])`,
               fmt: (r) => r.name + (r.email ? ` · ${r.email}` : '') },
  contacts:  { sql: `SELECT id, name, email FROM contacts WHERE id = ANY($1::int[])`,
               fmt: (r) => r.name + (r.email ? ` · ${r.email}` : '') },
  leads:     { sql: `SELECT id, name, company FROM leads WHERE id = ANY($1::int[])`,
               fmt: (r) => r.name + (r.company ? ` · ${r.company}` : '') },
  deals:     { sql: `SELECT id, title FROM deals WHERE id = ANY($1::int[])`,
               fmt: (r) => r.title || `Deal #${r.id}` },
  tasks:     { sql: `SELECT id, title FROM tasks WHERE id = ANY($1::int[])`,
               fmt: (r) => r.title || `Task #${r.id}` },
  tickets:   { sql: `SELECT id, ticket_no, subject FROM tickets WHERE id = ANY($1::int[])`,
               fmt: (r) => `${r.ticket_no || `Ticket #${r.id}`}${r.subject ? ' · ' + r.subject : ''}` },
  projects:  { sql: `SELECT id, name FROM projects WHERE id = ANY($1::int[])`,
               fmt: (r) => r.name || `Project #${r.id}` },
};

async function enrichMetaBatch(rows) {
  if (!rows.length) return rows;

  /* ---- pass 1: collect IDs to resolve ---- */
  const userIds     = new Set();
  const projectIds  = new Set();
  const stageIds    = new Set();
  const pipelineIds = new Set();
  const entityIdsBy = {}; // { users: Set<int>, contacts: Set<int>, ... }

  const collect = (val, set) => {
    if (val === null || val === undefined) return;
    if (Array.isArray(val)) val.forEach((v) => collect(v, set));
    else if (typeof val === 'number') set.add(val);
    else if (typeof val === 'string' && /^\d+$/.test(val)) set.add(Number(val));
  };

  for (const r of rows) {
    // entity label
    if (r.entity && r.entity_id && ENTITY_LABEL[r.entity]) {
      (entityIdsBy[r.entity] ||= new Set()).add(Number(r.entity_id));
    }
    // meta keys
    if (r.meta && typeof r.meta === 'object') {
      for (const [k, v] of Object.entries(r.meta)) {
        if (USER_KEYS.has(k))     collect(v, userIds);
        if (PROJECT_KEYS.has(k))  collect(v, projectIds);
        if (STAGE_KEYS.has(k))    collect(v, stageIds);
        if (PIPELINE_KEYS.has(k)) collect(v, pipelineIds);
      }
      // ticket.assign uses {engineer, manager} as raw user IDs
      if (r.action === 'ticket.assign') {
        collect(r.meta.engineer, userIds);
        collect(r.meta.manager,  userIds);
      }
    }
  }

  /* ---- pass 2: fetch maps in parallel ---- */
  const [userMap, projectMap, stageMap, pipelineMap, entityLabelMaps] = await Promise.all([
    fetchMap(userIds,     `SELECT id, name FROM users     WHERE id = ANY($1::int[])`),
    fetchMap(projectIds,  `SELECT id, name FROM projects  WHERE id = ANY($1::int[])`),
    fetchMap(stageIds,    `SELECT id, name FROM ticket_pipeline_stages WHERE id = ANY($1::int[])`),
    fetchMap(pipelineIds, `SELECT id, name FROM ticket_pipelines WHERE id = ANY($1::int[])`),
    fetchEntityLabels(entityIdsBy),
  ]);

  /* ---- pass 3: stitch + build a human summary per row ---- */
  return rows.map((r) => {
    const resolved = {};

    if (r.meta && typeof r.meta === 'object') {
      for (const [k, v] of Object.entries(r.meta)) {
        const map =
          USER_KEYS.has(k)     ? userMap     :
          PROJECT_KEYS.has(k)  ? projectMap  :
          STAGE_KEYS.has(k)    ? stageMap    :
          PIPELINE_KEYS.has(k) ? pipelineMap : null;
        if (!map) continue;
        const name = lookup(v, map);
        if (name !== undefined) resolved[k] = name;
      }
    }

    const lblMap = entityLabelMaps[r.entity];
    if (lblMap && r.entity_id && lblMap.has(Number(r.entity_id))) {
      resolved.target = lblMap.get(Number(r.entity_id));
    }

    return {
      ...r,
      meta_resolved: Object.keys(resolved).length ? resolved : undefined,
      summary: buildSummary(r, resolved),
    };
  });
}

/* -----------------------------------------------------------------------------
 *  Action → English sentence builder.
 *
 *  Each handler receives:
 *    row      — the raw log row (action, entity, entity_id, meta, ...)
 *    resolved — { target?, manager?, engineer?, stage_id?, ... } from pass 3
 *
 *  Anything not registered falls back to a generic
 *  "<verb> <entity> <target>" sentence so we always emit something.
 * ---------------------------------------------------------------------------*/
function targetOrId(row, resolved) {
  if (resolved.target) return resolved.target;
  if (row.entity && row.entity_id) return `${row.entity} #${row.entity_id}`;
  if (row.entity) return row.entity;
  return '';
}

const SUMMARY = {
  // --- auth / self-service ---
  'auth.login':              () => 'Signed in to the CRM',
  'auth.logout':             () => 'Signed out',
  'auth.register':           (r, x) => `Registered new account ${x.target || ''}`.trim(),
  'profile.update':          (r) => {
    const m = r.meta || {};
    const parts = [];
    if (m.name)  parts.push(`name "${m.name.from || '—'}" → "${m.name.to || '—'}"`);
    if (m.email) parts.push(`email ${m.email.from || '—'} → ${m.email.to || '—'}`);
    return parts.length ? `Updated own profile (${parts.join(', ')})` : 'Updated own profile';
  },
  'profile.password_change': () => 'Changed own password',

  // --- users ---
  'user.create':        (r, x) => `Created user ${x.target || `#${r.entity_id}`}`,
  'user.update':        (r, x) => `Updated user ${x.target || `#${r.entity_id}`}`,
  'user.delete':        (r, x) => `Deleted user ${x.target || `#${r.entity_id}`}`,
  'user.toggle_status': (r, x) => {
    const active = r.meta && r.meta.is_active;
    return `${active ? 'Activated' : 'Deactivated'} user ${x.target || `#${r.entity_id}`}`;
  },

  // --- contacts ---
  'contact.create': (r, x) => `Created contact ${x.target || `#${r.entity_id}`}`,
  'contact.update': (r, x) => `Updated contact ${x.target || `#${r.entity_id}`}`,
  'contact.delete': (r, x) => `Deleted contact ${x.target || `#${r.entity_id}`}`,

  // --- leads ---
  'lead.create': (r, x) => `Created lead ${x.target || `#${r.entity_id}`}`,
  'lead.update': (r, x) => `Updated lead ${x.target || `#${r.entity_id}`}`,
  'lead.delete': (r, x) => `Deleted lead ${x.target || `#${r.entity_id}`}`,
  'lead.assign': (r, x) => {
    const who = x.user_id || (r.meta && r.meta.user_id ? `user #${r.meta.user_id}` : 'someone');
    return `Assigned lead ${x.target || `#${r.entity_id}`} to ${who}`;
  },
  'lead.status': (r, x) => `Changed lead ${x.target || `#${r.entity_id}`} status → ${r.meta?.status || ''}`.trim(),

  // --- deals ---
  'deal.create':     (r, x) => `Created deal ${x.target || `#${r.entity_id}`}`,
  'deal.update':     (r, x) => `Updated deal ${x.target || `#${r.entity_id}`}`,
  'deal.delete':     (r, x) => `Deleted deal ${x.target || `#${r.entity_id}`}`,
  'deal.move_stage': (r, x) => {
    const stage = x.stage_id || (r.meta && r.meta.stage_id ? `stage #${r.meta.stage_id}` : 'a new stage');
    return `Moved deal ${x.target || `#${r.entity_id}`} to "${stage}"`;
  },

  // --- tasks ---
  'task.create':   (r, x) => `Created task ${x.target || `#${r.entity_id}`}`,
  'task.update':   (r, x) => `Updated task ${x.target || `#${r.entity_id}`}`,
  'task.delete':   (r, x) => `Deleted task ${x.target || `#${r.entity_id}`}`,
  'task.complete': (r, x) => `${r.meta && r.meta.completed ? 'Completed' : 'Reopened'} task ${x.target || `#${r.entity_id}`}`,

  // --- tickets ---
  'ticket.create':   (r, x) => `Created ticket ${x.target || `#${r.entity_id}`}`,
  'ticket.update':   (r, x) => `Updated ticket ${x.target || `#${r.entity_id}`}`,
  'ticket.delete':   (r, x) => `Deleted ticket ${x.target || `#${r.entity_id}`}`,
  'ticket.comment':           (r, x) => `Commented on ticket ${x.target || `#${r.entity_id}`}`,
  'ticket.comment.internal':  (r, x) => `Added internal note on ticket ${x.target || `#${r.entity_id}`}`,
  'ticket.status':   (r, x) => `Changed ticket ${x.target || `#${r.entity_id}`} status → ${r.meta?.status || ''}`.trim(),
  'ticket.escalate': (r, x) => `Escalated ticket ${x.target || `#${r.entity_id}`}${r.meta?.level ? ` to L${r.meta.level}` : ''}`,
  'ticket.sla_warning': (r, x) => {
    const m = r.meta?.remaining_minutes;
    return `SLA at risk on ticket ${x.target || `#${r.entity_id}`}${m != null ? ` (${m} min remaining)` : ''}`;
  },
  'ticket.sla_breach':  (r, x) => {
    const o = r.meta?.overdue_minutes;
    const lv = r.meta?.level;
    return `SLA breached on ticket ${x.target || `#${r.entity_id}`}${o != null ? ` (overdue ${o} min)` : ''}${lv ? ` — auto-escalated to L${lv}` : ''}`;
  },
  'ticket.stage':    (r, x) => {
    const from = r.meta?.from, to = r.meta?.to;
    if (from && to) return `Moved ticket ${x.target || `#${r.entity_id}`} from "${from}" → "${to}"`;
    if (to)         return `Moved ticket ${x.target || `#${r.entity_id}`} to "${to}"`;
    return `Updated stage for ticket ${x.target || `#${r.entity_id}`}`;
  },
  'ticket.assign':   (r, x) => {
    const parts = [];
    if (x.manager)  parts.push(`Manager ${x.manager}`);
    if (x.engineer) parts.push(`Engineer ${x.engineer}`);
    return `Assigned ticket ${x.target || `#${r.entity_id}`}${parts.length ? ' to ' + parts.join(' + ') : ''}`;
  },
};

function buildSummary(row, resolved) {
  try {
    const fn = SUMMARY[row.action];
    if (fn) return String(fn(row, resolved) || '').trim();

    // Generic fallback: "Updated tickets TKT-00016 · Server crash"
    const verb = (row.action.split('.')[1] || row.action).replace(/_/g, ' ');
    const noun = row.entity || '';
    const tail = targetOrId(row, resolved);
    return [verb.charAt(0).toUpperCase() + verb.slice(1), noun, tail].filter(Boolean).join(' ').trim();
  } catch {
    return row.action;
  }
}

async function fetchMap(idSet, sql) {
  if (!idSet.size) return new Map();
  const { rows } = await query(sql, [Array.from(idSet)]);
  return new Map(rows.map((r) => [r.id, r.name]));
}

async function fetchEntityLabels(entityIdsBy) {
  const out = {};
  await Promise.all(Object.entries(entityIdsBy).map(async ([entity, idSet]) => {
    const cfg = ENTITY_LABEL[entity];
    if (!cfg || !idSet.size) return;
    try {
      const { rows } = await query(cfg.sql, [Array.from(idSet)]);
      out[entity] = new Map(rows.map((r) => [r.id, cfg.fmt(r)]));
    } catch (err) {
      // entity table missing in some installs — skip silently
      console.warn(`[logs] enrich entity ${entity} skipped:`, err.message);
    }
  }));
  return out;
}

function lookup(val, map) {
  if (val === null || val === undefined) return undefined;
  if (Array.isArray(val)) return val.map((v) => lookup(v, map)).filter(Boolean);
  const id = typeof val === 'number' ? val : (/^\d+$/.test(String(val)) ? Number(val) : null);
  return id !== null ? map.get(id) : undefined;
}

/* -----------------------------------------------------------------------------
 *  Public API
 * ---------------------------------------------------------------------------*/

exports.list = async (filters = {}) => {
  const page  = Math.max(1, Number(filters.page  || 1));
  const limit = Math.min(500, Math.max(1, Number(filters.limit || 50)));
  const offset = (page - 1) * limit;
  const dir = String(filters.order || 'desc').toLowerCase() === 'asc' ? 'ASC' : 'DESC';

  const { where, params } = buildWhere(filters);
  const dataParams = [...params, limit, offset];

  const { rows } = await query(
    `SELECT l.*, u.name AS user_name, u.email AS user_email
     FROM logs l
     LEFT JOIN users u ON u.id = l.user_id
     WHERE ${where}
     ORDER BY l.created_at ${dir}, l.id ${dir}
     LIMIT $${dataParams.length - 1} OFFSET $${dataParams.length}`,
    dataParams,
  );

  const totalRes = await query(
    `SELECT COUNT(*)::int AS c
     FROM logs l
     LEFT JOIN users u ON u.id = l.user_id
     WHERE ${where}`,
    params,
  );

  const enriched = await enrichMetaBatch(rows);
  return { data: enriched, total: totalRes.rows[0].c, page, limit };
};

/**
 * Same filters as list() but no pagination — used by export.
 * Hard-capped to 50k rows to avoid runaway exports.
 */
exports.listAll = async (filters = {}) => {
  const dir = String(filters.order || 'desc').toLowerCase() === 'asc' ? 'ASC' : 'DESC';
  const { where, params } = buildWhere(filters);
  const cap = Math.min(50_000, Math.max(1, Number(filters.cap || 10_000)));
  params.push(cap);
  const { rows } = await query(
    `SELECT l.*, u.name AS user_name, u.email AS user_email
     FROM logs l
     LEFT JOIN users u ON u.id = l.user_id
     WHERE ${where}
     ORDER BY l.created_at ${dir}, l.id ${dir}
     LIMIT $${params.length}`,
    params,
  );
  return enrichMetaBatch(rows);
};

/** Distinct values for filter dropdowns (last 7 days only — matches retention). */
exports.distinctActions = async () => {
  const { rows } = await query(
    `SELECT action, COUNT(*)::int AS count
     FROM logs
     WHERE created_at >= NOW() - INTERVAL '7 days'
     GROUP BY action ORDER BY count DESC, action ASC LIMIT 100`
  );
  return rows;
};

exports.distinctEntities = async () => {
  const { rows } = await query(
    `SELECT entity, COUNT(*)::int AS count
     FROM logs
     WHERE entity IS NOT NULL AND created_at >= NOW() - INTERVAL '7 days'
     GROUP BY entity ORDER BY count DESC, entity ASC LIMIT 100`
  );
  return rows;
};

/** Manual purge endpoint (admin-triggered "clean up now"). */
exports.purgeOlderThan = async (days = 7) => {
  const r = await query(
    `DELETE FROM logs WHERE created_at < NOW() - ($1::int || ' days')::interval`,
    [Number(days)]
  );
  return { deleted: r.rowCount, days: Number(days) };
};
