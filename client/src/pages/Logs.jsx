import { useEffect, useMemo, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import toast from 'react-hot-toast';
import * as logsService from '../services/logsService';
import * as usersService from '../services/usersService';
import { useAuth } from '../context/AuthContext.jsx';
import PageHeader from '../components/ui/PageHeader.jsx';
import Icon from '../components/ui/Icon.jsx';

/* ----------------------------------------------------------------------------
 *  Visual config — action category → color + icon
 *
 *  We map by the `action.split('.')[1]` suffix (verb), with a few special
 *  rules for full action names (auth.login, ticket.escalate, ...).
 * --------------------------------------------------------------------------*/
const ACTION_STYLE = {
  login:        { tone: 'green',   icon: 'login' },
  logout:       { tone: 'slate',   icon: 'logout' },
  register:     { tone: 'green',   icon: 'plus' },
  create:       { tone: 'blue',    icon: 'plus' },
  update:       { tone: 'indigo',  icon: 'pencil' },
  edit:         { tone: 'indigo',  icon: 'pencil' },
  assign:       { tone: 'amber',   icon: 'arrowRight' },
  unassign:     { tone: 'amber',   icon: 'arrowRight' },
  status:       { tone: 'cyan',    icon: 'refresh' },
  toggle_status:{ tone: 'cyan',    icon: 'refresh' },
  stage:        { tone: 'cyan',    icon: 'refresh' },
  move_stage:   { tone: 'cyan',    icon: 'refresh' },
  complete:     { tone: 'green',   icon: 'checkCircle' },
  comment:      { tone: 'sky',     icon: 'envelope' },
  escalate:     { tone: 'rose',    icon: 'spark' },
  delete:       { tone: 'red',     icon: 'trash' },
};
const TONE = {
  green:  'bg-emerald-50 text-emerald-700 ring-emerald-200 dark:bg-emerald-900/30 dark:text-emerald-300 dark:ring-emerald-800',
  blue:   'bg-blue-50 text-blue-700 ring-blue-200 dark:bg-blue-900/30 dark:text-blue-300 dark:ring-blue-800',
  indigo: 'bg-indigo-50 text-indigo-700 ring-indigo-200 dark:bg-indigo-900/30 dark:text-indigo-300 dark:ring-indigo-800',
  amber:  'bg-amber-50 text-amber-700 ring-amber-200 dark:bg-amber-900/30 dark:text-amber-300 dark:ring-amber-800',
  cyan:   'bg-cyan-50 text-cyan-700 ring-cyan-200 dark:bg-cyan-900/30 dark:text-cyan-300 dark:ring-cyan-800',
  sky:    'bg-sky-50 text-sky-700 ring-sky-200 dark:bg-sky-900/30 dark:text-sky-300 dark:ring-sky-800',
  rose:   'bg-rose-50 text-rose-700 ring-rose-200 dark:bg-rose-900/30 dark:text-rose-300 dark:ring-rose-800',
  red:    'bg-red-50 text-red-700 ring-red-200 dark:bg-red-900/30 dark:text-red-300 dark:ring-red-800',
  slate:  'bg-slate-100 text-slate-700 ring-slate-200 dark:bg-slate-800 dark:text-slate-300 dark:ring-slate-700',
};

function actionStyleFor(action = '') {
  const verb = action.includes('.') ? action.split('.')[1] : action;
  return ACTION_STYLE[verb] || { tone: 'slate', icon: 'document' };
}

/* ----------------------------------------------------------------------------
 *  Entity → URL builder. Keeps row icons clickable.
 * --------------------------------------------------------------------------*/
function entityHref(entity, id) {
  if (!entity || !id) return null;
  switch (entity) {
    case 'tickets':  return `/tickets/${id}`;
    case 'users':    return `/users`;            // users page (no detail route)
    case 'leads':    return `/leads`;
    case 'deals':    return `/deals`;
    case 'contacts': return `/contacts`;
    case 'tasks':    return `/tasks`;
    default:         return null;
  }
}

/* ----------------------------------------------------------------------------
 *  Date helpers
 *
 *  The date inputs hand back YYYY-MM-DD in the user's *local* calendar.
 *  Postgres compares timestamptz columns in UTC, so we must convert
 *  local-day boundaries → UTC ISO strings before sending to the server,
 *  otherwise users in non-UTC timezones lose hours of records.
 * --------------------------------------------------------------------------*/
const localDay = (d) => {
  // Format YYYY-MM-DD in *local* time (not UTC) so date-pickers and quick
  // chips agree with what the user sees on the wall clock.
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
};
const today = () => localDay(new Date());
const daysAgo = (n) => localDay(new Date(Date.now() - n * 864e5));

/**
 * Convert a YYYY-MM-DD picker value to the UTC ISO of:
 *  - start-of-day local time when `which === 'start'`
 *  - end-of-day local time when `which === 'end'`
 * Returns '' when input is empty so we don't push a useless filter.
 */
function toUtcBoundary(ymd, which) {
  if (!ymd || !/^\d{4}-\d{2}-\d{2}$/.test(ymd)) return '';
  const [y, m, d] = ymd.split('-').map(Number);
  const local = which === 'end'
    ? new Date(y, m - 1, d, 23, 59, 59, 999)
    : new Date(y, m - 1, d, 0, 0, 0, 0);
  return local.toISOString();
}

/* ----------------------------------------------------------------------------
 *  Sub-components
 * --------------------------------------------------------------------------*/
function ActionBadge({ action }) {
  const { tone, icon } = actionStyleFor(action);
  return (
    <span
      className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-medium ring-1 ${TONE[tone]}`}
    >
      <Icon name={icon} className="w-3.5 h-3.5" strokeWidth={2} />
      {action}
    </span>
  );
}

function MetaCell({ summary, meta, meta_resolved, before, after }) {
  // Build supplementary chips from raw meta — but skip keys we already
  // expressed inside the summary so the row reads cleanly.
  const HIDE = new Set([
    'target', 'manager', 'engineer', 'user_id', 'stage_id', 'pipeline_stage_id',
    'from_stage_id', 'to_stage_id', 'pipeline_id', 'project_id',
    'is_active', 'completed', 'status', 'level', 'from', 'to', 'stage',
  ]);

  const merged = { ...(meta || {}), ...(meta_resolved || {}) };
  const entries = Object.entries(merged).filter(
    ([k, v]) => !HIDE.has(k) && v !== null && v !== undefined && v !== '',
  );

  // Compute before/after diff (only fields that actually changed).
  const diff = useMemo(() => buildDiff(before, after), [before, after]);
  const [showDiff, setShowDiff] = useState(false);

  if (!summary && !entries.length && !diff.length) return <span className="text-gray-400">—</span>;

  return (
    <div className="space-y-1 max-w-md">
      {summary && (
        <div className="text-[13px] text-gray-800 dark:text-slate-100 leading-snug" title={summary}>
          {summary}
        </div>
      )}
      {entries.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {entries.slice(0, 6).map(([k, v]) => {
            const val = Array.isArray(v)
              ? v.join(', ')
              : typeof v === 'object'
                ? JSON.stringify(v)
                : String(v);
            return (
              <span
                key={k}
                className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[11px] bg-gray-100 text-gray-700 dark:bg-slate-800 dark:text-slate-300"
                title={`${k}: ${val}`}
              >
                <span className="text-gray-500 dark:text-slate-400">{prettyKey(k)}:</span>
                <span className="font-medium">{val}</span>
              </span>
            );
          })}
          {entries.length > 6 && (
            <span className="text-[11px] text-gray-400">+{entries.length - 6} more</span>
          )}
        </div>
      )}
      {diff.length > 0 && (
        <div>
          <button
            type="button"
            onClick={() => setShowDiff((s) => !s)}
            className="inline-flex items-center gap-1 text-[11px] font-medium text-brand-600 hover:text-brand-700 dark:text-brand-400"
          >
            <Icon name={showDiff ? 'chevronDown' : 'chevronRight'} className="w-3 h-3" />
            {showDiff ? 'Hide' : 'View'} {diff.length} field change{diff.length === 1 ? '' : 's'}
          </button>
          {showDiff && (
            <div className="mt-1.5 rounded-md border border-gray-200 dark:border-slate-700 bg-gray-50 dark:bg-slate-900/60 p-2 space-y-1">
              {diff.map(({ key, from, to }) => (
                <div key={key} className="flex items-start gap-2 text-[11px]">
                  <span className="font-mono text-gray-500 dark:text-slate-400 shrink-0 w-32 truncate" title={key}>
                    {prettyKey(key)}
                  </span>
                  <span className="px-1.5 py-0.5 rounded bg-rose-100 text-rose-700 dark:bg-rose-900/40 dark:text-rose-300 line-through truncate max-w-[140px]" title={String(from)}>
                    {fmtDiffVal(from)}
                  </span>
                  <Icon name="arrowRight" className="w-3 h-3 text-gray-400 mt-0.5" />
                  <span className="px-1.5 py-0.5 rounded bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300 truncate max-w-[140px]" title={String(to)}>
                    {fmtDiffVal(to)}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

/**
 * Compute the field-by-field changes between two snapshot objects.
 * Returns [{ key, from, to }] for keys whose values differ. Ignores fields
 * that are equal-after-stringify so we don't surface noise like
 * `null` ↔ `""`.
 */
function buildDiff(before, after) {
  if (!before && !after) return [];
  const keys = new Set([
    ...Object.keys(before || {}),
    ...Object.keys(after  || {}),
  ]);
  const out = [];
  for (const k of keys) {
    const a = before ? before[k] : undefined;
    const b = after  ? after[k]  : undefined;
    if (JSON.stringify(a ?? null) === JSON.stringify(b ?? null)) continue;
    out.push({ key: k, from: a, to: b });
  }
  return out;
}

function fmtDiffVal(v) {
  if (v === null || v === undefined || v === '') return '—';
  if (typeof v === 'object') return JSON.stringify(v);
  const s = String(v);
  return s.length > 40 ? s.slice(0, 40) + '…' : s;
}

function prettyKey(k) {
  return k
    .replace(/_/g, ' ')
    .replace(/\bid\b/i, '')
    .replace(/\s+/g, ' ')
    .trim()
    .replace(/^\w/, (c) => c.toUpperCase());
}

/**
 * Compact origin cell: IP + a friendly browser/OS tag distilled from the
 * user-agent string. Full UA stays in the tooltip for forensics.
 */
function OriginCell({ ip, ua }) {
  if (!ip && !ua) return <span className="text-gray-400">—</span>;
  const tag = friendlyUa(ua);
  return (
    <div className="text-[11px] leading-tight" title={ua || ''}>
      {ip && (
        <div className="font-mono text-gray-700 dark:text-slate-300 truncate">{ip}</div>
      )}
      {tag && (
        <div className="text-gray-500 dark:text-slate-400 truncate">{tag}</div>
      )}
    </div>
  );
}

function friendlyUa(ua = '') {
  if (!ua) return '';
  const browser =
    /edg/i.test(ua)        ? 'Edge'    :
    /chrome/i.test(ua)     ? 'Chrome'  :
    /firefox/i.test(ua)    ? 'Firefox' :
    /safari/i.test(ua)     ? 'Safari'  : 'Browser';
  const os =
    /windows/i.test(ua)    ? 'Windows' :
    /mac os|macintosh/i.test(ua) ? 'macOS' :
    /android/i.test(ua)    ? 'Android' :
    /iphone|ipad|ios/i.test(ua) ? 'iOS' :
    /linux/i.test(ua)      ? 'Linux'   : '';
  return os ? `${browser} · ${os}` : browser;
}

function EntityCell({ entity, entity_id }) {
  if (!entity) return <span className="text-gray-400">—</span>;
  const href = entityHref(entity, entity_id);
  const label = entity_id ? `${entity} #${entity_id}` : entity;
  if (href) {
    return (
      <Link
        to={href}
        className="inline-flex items-center gap-1 text-[12px] text-brand-600 hover:text-brand-700 hover:underline dark:text-brand-400"
      >
        <Icon name={entity === 'users' ? 'userCircle' : entity === 'tickets' ? 'ticket' : 'document'} className="w-3.5 h-3.5" />
        {label}
      </Link>
    );
  }
  return <span className="text-[12px] text-gray-700 dark:text-slate-300">{label}</span>;
}

function FilterChip({ active, label, onClick, icon }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={
        'inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium border transition ' +
        (active
          ? 'bg-brand-600 text-white border-brand-600 shadow-sm'
          : 'bg-white text-gray-700 border-gray-200 hover:bg-gray-50 dark:bg-slate-900 dark:text-slate-300 dark:border-slate-700 dark:hover:bg-slate-800')
      }
    >
      {icon && <Icon name={icon} className="w-3.5 h-3.5" />}
      {label}
    </button>
  );
}

/* ----------------------------------------------------------------------------
 *  Main page
 * --------------------------------------------------------------------------*/
export default function Logs() {
  const { user } = useAuth();
  const isAdmin = user?.role === 'admin';

  const [view, setView] = useState('table');         // 'table' | 'timeline'
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(50);

  // Filters
  const [q, setQ]               = useState('');
  const [userId, setUserId]     = useState('');
  const [action, setAction]     = useState('');
  const [entity, setEntity]     = useState('');
  const [ip, setIp]             = useState('');
  const [from, setFrom]         = useState('');
  const [to, setTo]             = useState('');
  const [quickKey, setQuickKey] = useState('all');

  // Data
  const [rows, setRows]   = useState([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(false);
  const [users, setUsers]       = useState([]);
  const [actions, setActions]   = useState([]);
  const [entities, setEntities] = useState([]);

  /* ---------------- Initial dropdown sources ---------------- */
  useEffect(() => {
    Promise.all([
      usersService.list({}).catch(() => ({ data: [] })),
      logsService.distinctActions().catch(() => []),
      logsService.distinctEntities().catch(() => []),
    ]).then(([u, a, e]) => {
      setUsers(Array.isArray(u?.data) ? u.data : (Array.isArray(u) ? u : []));
      setActions(a || []);
      setEntities(e || []);
    });
  }, []);

  /* ---------------- Fetch logs (debounced on filter change) ---------------- */
  const debounceRef = useRef();
  useEffect(() => {
    clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => fetchLogs(), 250);
    return () => clearTimeout(debounceRef.current);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [q, userId, action, entity, ip, from, to, page, limit]);

  // Build the filter payload with local→UTC date conversion.
  function buildParams(extra = {}) {
    return {
      q:       q       || undefined,
      user_id: userId  || undefined,
      action:  action  || undefined,
      entity:  entity  || undefined,
      ip:      ip      || undefined,
      from:    toUtcBoundary(from, 'start') || undefined,
      to:      toUtcBoundary(to,   'end')   || undefined,
      ...extra,
    };
  }

  async function fetchLogs() {
    setLoading(true);
    try {
      const r = await logsService.list(buildParams({ page, limit }));
      setRows(Array.isArray(r?.data) ? r.data : []);
      setTotal(Number(r?.total || 0));
    } catch (err) {
      toast.error(err?.response?.data?.message || 'Failed to load audit logs');
    } finally {
      setLoading(false);
    }
  }

  /* ---------------- Quick-range buttons ---------------- */
  function applyQuick(key) {
    setQuickKey(key);
    setPage(1);
    if (key === 'today')  { setFrom(today());     setTo(today()); }
    else if (key === '24h')   { setFrom(daysAgo(1)); setTo(today()); }
    else if (key === '7d')    { setFrom(daysAgo(7)); setTo(today()); }
    else                       { setFrom('');          setTo('');       }
  }

  /* ---------------- Export ---------------- */
  async function doExport(format) {
    const t = toast.loading(`Exporting ${format.toUpperCase()}…`);
    try {
      await logsService.exportLogs(buildParams(), format);
      toast.success(`Audit logs exported as ${format.toUpperCase()}`, { id: t });
    } catch (err) {
      toast.error(err?.response?.data?.message || 'Export failed', { id: t });
    }
  }

  async function doPurge() {
    if (!confirm('Permanently delete logs older than 7 days? This cannot be undone.')) return;
    try {
      const r = await logsService.purgeNow(7);
      toast.success(`Removed ${r.deleted} log row(s) older than ${r.days} day(s)`);
      fetchLogs();
    } catch (err) {
      toast.error(err?.response?.data?.message || 'Purge failed');
    }
  }

  function clearAll() {
    setQ(''); setUserId(''); setAction(''); setEntity(''); setIp('');
    setFrom(''); setTo(''); setQuickKey('all'); setPage(1);
  }

  const hasFilters = q || userId || action || entity || ip || from || to;
  const totalPages = Math.max(1, Math.ceil(total / limit));

  /* ============================================================ */
  return (
    <>
      <PageHeader
        title="Audit Logs"
        subtitle="Every important action across the system. Logs are auto-purged after 7 days."
        actions={
          <div className="flex items-center gap-2">
            <button className="btn-secondary" onClick={() => doExport('csv')} title="Export current filter to CSV">
              <Icon name="download" className="w-4 h-4" /> CSV
            </button>
            <button className="btn-secondary" onClick={() => doExport('json')} title="Export current filter to JSON">
              <Icon name="download" className="w-4 h-4" /> JSON
            </button>
            {isAdmin && (
              <button className="btn-ghost text-red-600" onClick={doPurge} title="Delete logs older than 7 days">
                <Icon name="trash" className="w-4 h-4" /> Purge old
              </button>
            )}
          </div>
        }
      />

      {/* ---------------- Filter bar ---------------- */}
      <div className="card p-4 mb-4 space-y-4">
        {/* Search row */}
        <div className="flex flex-wrap items-center gap-2">
          <div className="relative flex-1 min-w-[260px]">
            <Icon name="search" className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
            <input
              className="input pl-9"
              placeholder="Search user, action, entity, or ID…"
              value={q}
              onChange={(e) => { setQ(e.target.value); setPage(1); }}
            />
          </div>
          <div className="flex items-center bg-gray-100 dark:bg-slate-800 rounded-lg p-1 gap-1">
            <button
              type="button"
              onClick={() => setView('table')}
              className={`px-2.5 py-1 rounded-md text-xs flex items-center gap-1 ${view === 'table' ? 'bg-white dark:bg-slate-700 text-gray-900 dark:text-slate-100 shadow-sm' : 'text-gray-600 dark:text-slate-400'}`}
            >
              <Icon name="list" className="w-3.5 h-3.5" /> Table
            </button>
            <button
              type="button"
              onClick={() => setView('timeline')}
              className={`px-2.5 py-1 rounded-md text-xs flex items-center gap-1 ${view === 'timeline' ? 'bg-white dark:bg-slate-700 text-gray-900 dark:text-slate-100 shadow-sm' : 'text-gray-600 dark:text-slate-400'}`}
            >
              <Icon name="clock" className="w-3.5 h-3.5" /> Timeline
            </button>
          </div>
        </div>

        {/* Dropdown row */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-6 gap-2">
          <select className="input" value={userId} onChange={(e) => { setUserId(e.target.value); setPage(1); }}>
            <option value="">All users</option>
            {users.map((u) => <option key={u.id} value={u.id}>{u.name} · {u.email}</option>)}
          </select>
          <select className="input" value={action} onChange={(e) => { setAction(e.target.value); setPage(1); }}>
            <option value="">All actions</option>
            {actions.map((a) => <option key={a.action} value={a.action}>{a.action} ({a.count})</option>)}
          </select>
          <select className="input" value={entity} onChange={(e) => { setEntity(e.target.value); setPage(1); }}>
            <option value="">All entities</option>
            {entities.map((e) => <option key={e.entity} value={e.entity}>{e.entity} ({e.count})</option>)}
          </select>
          <input
            type="text"
            className="input font-mono text-xs"
            placeholder="IP address (e.g. 203.0.113…)"
            value={ip}
            onChange={(e) => { setIp(e.target.value); setPage(1); }}
          />
          <input type="date" className="input" value={from} onChange={(e) => { setFrom(e.target.value); setQuickKey('custom'); setPage(1); }} />
          <input type="date" className="input" value={to} onChange={(e) => { setTo(e.target.value); setQuickKey('custom'); setPage(1); }} />
        </div>

        {/* Quick chips + clear */}
        <div className="flex flex-wrap items-center gap-2">
          <FilterChip active={quickKey === 'all'}   label="All"            icon="globe"    onClick={() => applyQuick('all')} />
          <FilterChip active={quickKey === 'today'} label="Today"          icon="calendar" onClick={() => applyQuick('today')} />
          <FilterChip active={quickKey === '24h'}   label="Last 24 hours"  icon="clock"    onClick={() => applyQuick('24h')} />
          <FilterChip active={quickKey === '7d'}    label="Last 7 days"    icon="calendar" onClick={() => applyQuick('7d')} />
          <div className="flex-1" />
          {hasFilters && (
            <button className="btn-ghost text-xs" onClick={clearAll}>
              <Icon name="x" className="w-3.5 h-3.5" /> Clear all
            </button>
          )}
          <span className="text-xs text-gray-500 dark:text-slate-400">
            {loading ? 'Loading…' : `${total.toLocaleString()} record${total === 1 ? '' : 's'}`}
          </span>
        </div>
      </div>

      {/* ---------------- Body ---------------- */}
      {view === 'table' ? (
        <TableView rows={rows} loading={loading} />
      ) : (
        <TimelineView rows={rows} loading={loading} />
      )}

      {/* ---------------- Pagination ---------------- */}
      <div className="flex items-center justify-between gap-2 mt-4 text-sm">
        <div className="text-gray-500 dark:text-slate-400">
          Page {page} of {totalPages} · Showing {rows.length} of {total.toLocaleString()}
        </div>
        <div className="flex items-center gap-2">
          <select
            className="input !py-1 !w-auto"
            value={limit}
            onChange={(e) => { setLimit(Number(e.target.value)); setPage(1); }}
          >
            {[25, 50, 100, 200].map((n) => <option key={n} value={n}>{n} / page</option>)}
          </select>
          <button className="btn-secondary !py-1 !px-3" disabled={page <= 1} onClick={() => setPage(page - 1)}>Prev</button>
          <button className="btn-secondary !py-1 !px-3" disabled={page >= totalPages} onClick={() => setPage(page + 1)}>Next</button>
        </div>
      </div>
    </>
  );
}

/* ----------------------------------------------------------------------------
 *  Views
 * --------------------------------------------------------------------------*/
function TableView({ rows, loading }) {
  return (
    <div className="table-wrap">
      <table className="crm-table">
        <thead>
          <tr>
            <th className="w-44">When</th>
            <th className="w-48">User</th>
            <th className="w-36">Origin</th>
            <th className="w-44">Action</th>
            <th className="w-40">Entity</th>
            <th>Details</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((l) => (
            <tr key={l.id} className="align-top">
              <td className="text-xs text-gray-500 dark:text-slate-400 whitespace-nowrap">
                <div>{new Date(l.created_at).toLocaleString()}</div>
                <div className="text-[10px] text-gray-400">{relativeTime(l.created_at)}</div>
              </td>
              <td>
                {l.user_name
                  ? <div>
                      <div className="font-medium text-gray-900 dark:text-slate-100">{l.user_name}</div>
                      <div className="text-[11px] text-gray-500 dark:text-slate-400">{l.user_email}</div>
                    </div>
                  : <span className="text-gray-400 italic">system</span>}
              </td>
              <td><OriginCell ip={l.ip_address} ua={l.user_agent} /></td>
              <td><ActionBadge action={l.action} /></td>
              <td><EntityCell entity={l.entity} entity_id={l.entity_id} /></td>
              <td>
                <MetaCell
                  summary={l.summary}
                  meta={l.meta}
                  meta_resolved={l.meta_resolved}
                  before={l.before_data}
                  after={l.after_data}
                />
              </td>
            </tr>
          ))}
          {rows.length === 0 && !loading && (
            <tr><td colSpan={6} className="text-center text-gray-500 dark:text-slate-400 py-12">
              <Icon name="document" className="w-8 h-8 mx-auto mb-2 text-gray-300" />
              No logs match your filters.
            </td></tr>
          )}
        </tbody>
      </table>
    </div>
  );
}

function TimelineView({ rows, loading }) {
  // Group by day
  const groups = useMemo(() => {
    const m = new Map();
    for (const r of rows) {
      const k = new Date(r.created_at).toLocaleDateString();
      if (!m.has(k)) m.set(k, []);
      m.get(k).push(r);
    }
    return Array.from(m.entries());
  }, [rows]);

  if (rows.length === 0 && !loading) {
    return (
      <div className="card p-12 text-center text-gray-500 dark:text-slate-400">
        <Icon name="clock" className="w-8 h-8 mx-auto mb-2 text-gray-300" />
        No logs match your filters.
      </div>
    );
  }

  return (
    <div className="card p-6">
      {groups.map(([day, items]) => (
        <div key={day} className="mb-6 last:mb-0">
          <div className="text-xs font-semibold uppercase tracking-wider text-gray-500 dark:text-slate-400 mb-3">{day}</div>
          <ol className="relative border-l-2 border-gray-100 dark:border-slate-800 pl-6 space-y-4">
            {items.map((l) => {
              const { tone, icon } = actionStyleFor(l.action);
              return (
                <li key={l.id} className="relative">
                  <span className={`absolute -left-[31px] top-1 inline-flex items-center justify-center w-5 h-5 rounded-full ring-4 ring-white dark:ring-slate-900 ${TONE[tone]}`}>
                    <Icon name={icon} className="w-3 h-3" strokeWidth={2.25} />
                  </span>
                  <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                    <span className="font-medium text-gray-900 dark:text-slate-100">{l.user_name || 'system'}</span>
                    <ActionBadge action={l.action} />
                    {l.entity && <EntityCell entity={l.entity} entity_id={l.entity_id} />}
                    {l.ip_address && (
                      <span className="text-[10px] font-mono text-gray-400 dark:text-slate-500" title={l.user_agent || ''}>
                        {l.ip_address}
                      </span>
                    )}
                    <span className="text-xs text-gray-400 ml-auto">{new Date(l.created_at).toLocaleTimeString()}</span>
                  </div>
                  <div className="mt-1.5">
                    <MetaCell
                      summary={l.summary}
                      meta={l.meta}
                      meta_resolved={l.meta_resolved}
                      before={l.before_data}
                      after={l.after_data}
                    />
                  </div>
                </li>
              );
            })}
          </ol>
        </div>
      ))}
    </div>
  );
}

/* ----------------------------------------------------------------------------
 *  Misc
 * --------------------------------------------------------------------------*/
function relativeTime(iso) {
  const sec = Math.floor((Date.now() - new Date(iso).getTime()) / 1000);
  if (sec < 60)        return `${sec}s ago`;
  if (sec < 3600)      return `${Math.floor(sec / 60)}m ago`;
  if (sec < 86400)     return `${Math.floor(sec / 3600)}h ago`;
  if (sec < 7 * 86400) return `${Math.floor(sec / 86400)}d ago`;
  return new Date(iso).toLocaleDateString();
}
