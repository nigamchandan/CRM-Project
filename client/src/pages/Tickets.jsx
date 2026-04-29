import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';
import * as ticketsService from '../services/ticketsService';
import * as pipelinesService from '../services/ticketPipelinesService';
import * as usersService from '../services/usersService';
import * as projectsService from '../services/projectsService';
import * as workloadService from '../services/workloadService';
import EmptyState from '../components/ui/EmptyState.jsx';
import CreateTicketDrawer, { QuickTicketButton } from '../components/tickets/CreateTicketDrawer.jsx';
import InlinePriority from '../components/tickets/InlinePriority.jsx';
import InlineOwner from '../components/tickets/InlineOwner.jsx';
import ContextMenu from '../components/ui/ContextMenu.jsx';
import usePopoverDismiss from '../hooks/usePopoverDismiss.js';
import { useAuth } from '../context/AuthContext';
import { useCreateHandler } from '../context/PaletteContext.jsx';

/* ----------------------------------------------------------------------------
 *  Tickets list — HubSpot-style:
 *    • Saved-view tabs (All / My open / Unassigned / Closed)
 *    • Filter chips: Pipeline, Owner, Create date, Last activity date, Priority
 *    • Advanced filters slide-down (status, source, escalated, SLA breached)
 *    • Sortable + draggable column headers (persisted via localStorage)
 *    • Edit columns popover (show / hide / reset)
 *    • List / grid layout toggle
 * ------------------------------------------------------------------------- */

const PRIORITY_LABEL = { critical: 'Urgent', high: 'High', medium: 'Medium', low: 'Low' };
const PRIORITY_DOT   = {
  critical: 'bg-red-500', high: 'bg-orange-500',
  medium:   'bg-amber-400', low: 'bg-gray-400',
};

const TICKET_TYPE_STYLE = {
  incident: 'bg-rose-50 text-rose-700 ring-rose-200 dark:bg-rose-900/40 dark:text-rose-300 dark:ring-rose-800',
  request:  'bg-sky-50 text-sky-700 ring-sky-200 dark:bg-sky-900/40 dark:text-sky-300 dark:ring-sky-800',
};
function TicketTypeBadge({ type }) {
  const t = type || 'incident';
  const cls = TICKET_TYPE_STYLE[t] || TICKET_TYPE_STYLE.incident;
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-medium ring-1 capitalize ${cls}`}>
      {t}
    </span>
  );
}

const SAVED_VIEWS = [
  { id: 'all',        label: 'All tickets'      },
  { id: 'mine_open',  label: 'My open tickets'  },
  { id: 'unassigned', label: 'Unassigned'       },
  { id: 'closed',     label: 'Closed tickets'   },
];

const PAGE_SIZE = 20;

/* ---------------------------------------------------------------- COLUMNS */
// Single source of truth for what columns exist, how they sort, and how each
// cell renders. The UI consumes this through `columnOrder` / `hiddenCols`.
const COLUMNS = [
  {
    id: 'id', label: 'Ticket #', sortKey: 'id', minW: 110,
    render: (t) => (
      <span className="text-xs font-mono font-medium text-gray-700 dark:text-slate-300">
        {t.ticket_no || `#${t.id}`}
      </span>
    ),
  },
  {
    id: 'subject', label: 'Ticket name', sortKey: 'subject', minW: 280,
    render: (t, ctx) => (
      <>
        <Link
          to={`/tickets/${t.id}`}
          onClick={ctx.stop}
          className="text-blue-600 dark:text-blue-400 hover:underline font-medium"
        >
          {t.subject}
        </Link>
        {t.reporter_name && (
          <div className="text-[11px] text-gray-500 dark:text-slate-500 mt-0.5">
            Reported by {t.reporter_name}
          </div>
        )}
      </>
    ),
  },
  {
    id: 'pipeline', label: 'Pipeline', sortKey: 'pipeline', minW: 140,
    render: (t) => <span className="text-gray-700 dark:text-slate-300">{t.pipeline_name || '—'}</span>,
  },
  {
    id: 'stage', label: 'Stage', sortKey: 'stage', minW: 200,
    render: (t, ctx) => (
      <div onClick={ctx.stop}>
        <StageChip ticket={t} setStage={ctx.setStage} />
      </div>
    ),
  },
  {
    id: 'owner', label: 'Ticket owner', sortKey: 'owner', minW: 160,
    render: (t, ctx) => (
      <div onClick={ctx.stop}>
        <InlineOwner
          ticket={t}
          users={ctx.users}
          onChange={ctx.reload}
          readOnly={!ctx.canAssign}
        />
      </div>
    ),
  },
  {
    id: 'priority', label: 'Priority', sortKey: 'priority', minW: 130,
    render: (t, ctx) => (
      <div onClick={ctx.stop}>
        <InlinePriority
          ticket={t}
          onChange={ctx.reload}
          readOnly={!ctx.canEditPriority}
        />
      </div>
    ),
  },
  {
    id: 'ticket_type', label: 'Type', sortKey: null, minW: 100,
    render: (t) => <TicketTypeBadge type={t.ticket_type} />,
  },
  {
    id: 'project', label: 'Project', sortKey: 'project', minW: 140,
    render: (t) => <span className="text-gray-700 dark:text-slate-300">{t.project_name || '—'}</span>,
  },
  {
    id: 'created', label: 'Create date', sortKey: 'newest', minW: 130,
    render: (t) => (
      <span className="text-xs text-gray-500 dark:text-slate-400">
        {new Date(t.created_at).toLocaleDateString()}
      </span>
    ),
  },
  {
    id: 'updated', label: 'Last activity', sortKey: 'updated', minW: 130,
    render: (t) => (
      <span className="text-xs text-gray-500 dark:text-slate-400">
        {new Date(t.updated_at || t.created_at).toLocaleDateString()}
      </span>
    ),
  },
  {
    id: 'close_date', label: 'Close date', sortKey: 'close_date', minW: 130,
    render: (t) => t.closed_at
      ? <span className="text-xs text-gray-500 dark:text-slate-400">{new Date(t.closed_at).toLocaleDateString()}</span>
      : <span className="text-gray-400">—</span>,
  },
  {
    id: 'sla', label: 'SLA due', sortKey: 'sla', minW: 130,
    render: (t) => {
      if (!t.sla_due_at) return <span className="text-gray-400">—</span>;
      const past = new Date(t.sla_due_at).getTime() < Date.now() && t.status !== 'closed';
      return (
        <span className={`text-xs ${past ? 'text-red-600 dark:text-red-400 font-medium' : 'text-gray-500 dark:text-slate-400'}`}>
          {new Date(t.sla_due_at).toLocaleDateString()}
        </span>
      );
    },
  },
  {
    // Case age is derived from created_at — sort uses 'newest' (newest first =
    // smallest age first); not exposed for column-level sort to avoid a
    // duplicate arrow next to the Create date column.
    id: 'case_age', label: 'Case age', sortKey: null, minW: 110,
    render: (t) => {
      const days = Math.floor((Date.now() - new Date(t.created_at).getTime()) / 86400000);
      const tone = days >= 30 ? 'text-red-600 dark:text-red-400'
                 : days >= 7  ? 'text-amber-600 dark:text-amber-400'
                 : 'text-gray-500 dark:text-slate-400';
      return <span className={`text-xs ${tone}`}>{days}d</span>;
    },
  },
  {
    id: 'reporter', label: 'Reporter', sortKey: null, minW: 180,
    render: (t) => t.reporter_name
      ? (
        <div>
          <div className="text-gray-700 dark:text-slate-300">{t.reporter_name}</div>
          {t.reporter_email && (
            <div className="text-[11px] text-gray-500 dark:text-slate-500">{t.reporter_email}</div>
          )}
        </div>
      )
      : <span className="text-gray-400">—</span>,
  },
];
const COL_BY_ID = Object.fromEntries(COLUMNS.map((c) => [c.id, c]));
const DEFAULT_ORDER  = ['subject', 'pipeline', 'stage', 'owner', 'priority', 'ticket_type', 'project', 'created'];
const DEFAULT_HIDDEN = ['id', 'updated', 'close_date', 'sla', 'case_age', 'reporter'];

const LS_ORDER = 'crm.tickets.cols.order';
const LS_HIDE  = 'crm.tickets.cols.hidden';
const LS_QUICK = 'crm.tickets.quickFilters';

/* ---------------------------------------------------------- QUICK-FILTERS
 *  HubSpot-style "+ Add a quick filter" catalog.  Only the filters that are
 *  genuinely useful for a support workflow — no NPS / CSAT / survey noise.
 *  Each entry is rendered as a removable chip in the toolbar when active.
 *
 *    kind: 'date_range' → Today / 7d / 30d / 90d / Year dropdown
 *    kind: 'select'     → Custom static options
 *    kind: 'text'       → Free-text input chip (used inside a popover)
 */
// `columnId` links a filter to the table column it pertains to, so adding a
// filter automatically reveals the matching column (HubSpot does the same).
const QUICK_FILTER_CATALOG = [
  { id: 'ticket_number', columnId: 'id',         label: 'Ticket number',  desc: 'Find an exact ticket by ID',         kind: 'text',       placeholder: 'e.g. 123' },
  { id: 'close_date',    columnId: 'close_date', label: 'Close date',     desc: 'When the ticket was closed',         kind: 'date_range' },
  { id: 'sla_due',       columnId: 'sla',        label: 'SLA due date',   desc: 'When the SLA deadline falls',        kind: 'date_range' },
  { id: 'case_age',      columnId: 'case_age',   label: 'Case age',       desc: 'Time since the ticket was opened',   kind: 'select', options: [
    { value: '',       label: 'Any age' },
    { value: 'lt_1d',  label: 'Less than 1 day' },
    { value: '1_7d',   label: '1 – 7 days' },
    { value: '7_30d',  label: '7 – 30 days' },
    { value: 'gt_30d', label: 'More than 30 days' },
  ]},
  { id: 'reporter',      columnId: 'reporter',   label: 'Reporter',       desc: 'Search by reporter name or email',   kind: 'text',       placeholder: 'name or email' },
];
const QF_BY_ID = Object.fromEntries(QUICK_FILTER_CATALOG.map((f) => [f.id, f]));

function loadQuickFilters() {
  try {
    const raw = JSON.parse(localStorage.getItem(LS_QUICK) || 'null');
    if (!raw || !Array.isArray(raw.active)) return { active: [], values: {} };
    return {
      active: raw.active.filter((id) => QF_BY_ID[id]),
      values: raw.values || {},
    };
  } catch { return { active: [], values: {} }; }
}

function caseAgeToHours(value) {
  switch (value) {
    case 'lt_1d':  return { min: 0,      max: 24 };
    case '1_7d':   return { min: 24,     max: 24 * 7 };
    case '7_30d':  return { min: 24 * 7, max: 24 * 30 };
    case 'gt_30d': return { min: 24 * 30 };
    default:       return null;
  }
}

function loadCols() {
  try {
    const order  = JSON.parse(localStorage.getItem(LS_ORDER) || 'null');
    const hidden = JSON.parse(localStorage.getItem(LS_HIDE)  || 'null');
    return {
      order:  Array.isArray(order)  && order.every((id) => COL_BY_ID[id])  ? order  : DEFAULT_ORDER,
      hidden: Array.isArray(hidden) ? hidden : DEFAULT_HIDDEN,
    };
  } catch { return { order: DEFAULT_ORDER, hidden: DEFAULT_HIDDEN }; }
}

/* ============================================================== component */
export default function Tickets() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const isEngineer = user?.role === 'engineer';
  const isStaff = ['admin', 'manager'].includes(user?.role);
  // Engineers can re-prioritise their own work but cannot reassign tickets;
  // managers/admins can do both.  Server-side `sanitizeUpdateBody` enforces
  // the same rules, so this just keeps the UI honest.
  const canAssign       = isStaff;
  const canEditPriority = isStaff || user?.role === 'engineer';

  // Engineers only see "their" tickets — server-side row-level scoping enforces
  // it, but we also tighten the UI: drop "All" / "Unassigned" tabs, default to
  // "My open", and hide the create button (engineers don't open new tickets;
  // customers / managers do).
  const savedViews = isEngineer
    ? [
        { id: 'mine_open', label: 'My open tickets'   },
        { id: 'closed',    label: 'My closed tickets' },
      ]
    : SAVED_VIEWS;

  const [data, setData]   = useState([]);
  const [total, setTotal] = useState(0);
  const [page, setPage]   = useState(1);
  const [search, setSearch] = useState('');

  const [view, setView]     = useState(isEngineer ? 'mine_open' : 'all');
  const [layout, setLayout] = useState('list');

  const [pipelines, setPipelines] = useState([]);
  const [users, setUsers]         = useState([]);
  const [projects, setProjects]   = useState([]);

  const [pipelineId, setPipelineId]     = useState('');
  const [ownerId, setOwnerId]           = useState('');
  const [priority, setPriority]         = useState('');
  const [ticketType, setTicketType]     = useState('');
  const [createdRange, setCreatedRange] = useState('');
  const [updatedRange, setUpdatedRange] = useState('');

  // Advanced filters
  const [advOpen, setAdvOpen]    = useState(false);
  const [advFilters, setAdvFilters] = useState({
    status: '', source: '', project_id: '',
    escalated: false, has_sla_breach: false,
  });

  // Quick filters (the HubSpot "+" — user-pickable, removable chips)
  const initialQuick = useMemo(() => loadQuickFilters(), []);
  const [activeQuick, setActiveQuick] = useState(initialQuick.active);
  const [quickValues, setQuickValues] = useState(initialQuick.values);
  useEffect(() => {
    localStorage.setItem(LS_QUICK, JSON.stringify({ active: activeQuick, values: quickValues }));
  }, [activeQuick, quickValues]);

  const addQuickFilter = (id) => {
    if (activeQuick.includes(id)) return;
    setActiveQuick([...activeQuick, id]);
    // Auto-reveal the matching column so the user actually sees their filter's data.
    const def = QF_BY_ID[id];
    if (def?.columnId && COL_BY_ID[def.columnId]) {
      setColumnOrder((prev) => (prev.includes(def.columnId) ? prev : [...prev, def.columnId]));
      setHiddenCols((s) => {
        if (!s.has(def.columnId)) return s;
        const n = new Set(s); n.delete(def.columnId); return n;
      });
    }
  };
  const removeQuickFilter = (id) => {
    setActiveQuick(activeQuick.filter((x) => x !== id));
    setQuickValues((v) => { const n = { ...v }; delete n[id]; return n; });
    setPage(1);
  };
  const setQuickValue = (id, value) => {
    setQuickValues((v) => ({ ...v, [id]: value }));
    setPage(1);
  };

  // Sort state — translates to the backend `sort` param.
  // dir: 'asc' | 'desc'.  When sortKey is the column's default/desc form, dir is
  // 'desc'; clicking again toggles to 'asc'; clicking again resets.
  const [sort, setSort] = useState({ key: 'newest', dir: 'desc' });

  // Persisted column order + hidden columns
  const initial = useMemo(() => loadCols(), []);
  const [columnOrder, setColumnOrder] = useState(initial.order);
  const [hiddenCols,  setHiddenCols]  = useState(new Set(initial.hidden));
  useEffect(() => { localStorage.setItem(LS_ORDER, JSON.stringify(columnOrder)); }, [columnOrder]);
  useEffect(() => { localStorage.setItem(LS_HIDE,  JSON.stringify(Array.from(hiddenCols))); }, [hiddenCols]);

  const visibleColumns = useMemo(
    () => columnOrder.filter((id) => COL_BY_ID[id] && !hiddenCols.has(id)).map((id) => COL_BY_ID[id]),
    [columnOrder, hiddenCols]
  );

  const [drawer, setDrawer] = useState(false);

  // Register the page-aware "N" hotkey + palette quick action.  Engineers
  // can't open new tickets, so we leave the handler unset for them and the
  // shortcut becomes a no-op.
  const openCreate = useCallback(() => setDrawer(true), []);
  useCreateHandler(isEngineer ? null : openCreate, 'Create ticket');

  /* ---------- bootstrapping ---------- */
  useEffect(() => {
    pipelinesService.listPipelines({ active: true }).then(setPipelines).catch(() => {});
    usersService.list({ limit: 200 }).then((r) => setUsers(r?.data ?? r ?? [])).catch(() => {});
    projectsService.list({ limit: 200 }).then((r) => setProjects(r?.data ?? r ?? [])).catch(() => {});
  }, []);

  /* ---------- saved-view + chips → query params ---------- */
  const queryParams = useMemo(() => {
    const params = { search, page, limit: PAGE_SIZE, sort: backendSort(sort) };
    if (pipelineId) params.pipeline_id = pipelineId;
    if (ownerId)    params.engineer_id = ownerId;
    if (priority)   params.priority    = priority;
    if (ticketType) params.ticket_type = ticketType;

    const c = dateRangeToParams(createdRange);
    if (c?.after)  params.created_after  = c.after;
    if (c?.before) params.created_before = c.before;

    const u = dateRangeToParams(updatedRange);
    if (u?.after)  params.updated_after  = u.after;
    if (u?.before) params.updated_before = u.before;

    if (advFilters.status)         params.status     = advFilters.status;
    if (advFilters.source)         params.source     = advFilters.source;
    if (advFilters.project_id)     params.project_id = advFilters.project_id;
    if (advFilters.escalated)      params.escalated  = true;
    if (advFilters.has_sla_breach) params.has_sla_breach = true;

    // ---- Quick filters → query params ----
    if (activeQuick.includes('ticket_number') && quickValues.ticket_number) {
      const n = Number(String(quickValues.ticket_number).replace(/\D/g, ''));
      if (n) params.id = n;
    }
    if (activeQuick.includes('close_date') && quickValues.close_date) {
      const r = dateRangeToParams(quickValues.close_date);
      if (r) { params.closed_after = r.after; params.closed_before = r.before; }
    }
    if (activeQuick.includes('sla_due') && quickValues.sla_due) {
      const r = dateRangeToParams(quickValues.sla_due);
      if (r) { params.sla_after = r.after; params.sla_before = r.before; }
    }
    if (activeQuick.includes('case_age') && quickValues.case_age) {
      const a = caseAgeToHours(quickValues.case_age);
      if (a?.min != null) params.min_age_hours = a.min;
      if (a?.max != null) params.max_age_hours = a.max;
    }
    if (activeQuick.includes('reporter') && quickValues.reporter) {
      params.reporter = quickValues.reporter;
    }

    if (view === 'mine_open')  { params.mine = true; params.not_closed = true; }
    if (view === 'unassigned') { params.unassigned = true; }
    if (view === 'closed')     { params.status = 'closed'; }
    return params;
  }, [search, page, pipelineId, ownerId, priority, ticketType, view, createdRange, updatedRange, advFilters, sort, activeQuick, quickValues]);

  /* ---------- load ---------- */
  const load = () => {
    ticketsService.list(queryParams).then((res) => {
      setData(res?.data || []);
      setTotal(res?.total ?? (res?.data?.length || 0));
    }).catch(() => {});
  };
  useEffect(() => { const t = setTimeout(load, 200); return () => clearTimeout(t); /* eslint-disable-next-line */ },
    [queryParams]);

  /* ---------- inline stage move ---------- */
  const setStage = async (ticket, stageId) => {
    try {
      await ticketsService.setStage(ticket.id, Number(stageId));
      toast.success('Stage updated');
      load();
    } catch (e) {
      toast.error(e?.response?.data?.message || 'Update failed');
    }
  };

  /* ---------- right-click context menu state ---------- */
  const [ctxMenu, setCtxMenu] = useState(null); // { x, y, ticket } | null
  const onRowContext = (ticket) => (e) => {
    e.preventDefault();
    setCtxMenu({ x: e.clientX, y: e.clientY, ticket });
  };
  const closeCtxMenu = useCallback(() => setCtxMenu(null), []);

  const ctxItems = useMemo(() => {
    if (!ctxMenu) return [];
    const t = ctxMenu.ticket;
    const items = [
      { id: 'open', icon: 'arrowRight', label: 'Open ticket', onClick: () => navigate(`/tickets/${t.id}`) },
    ];
    if (canAssign) {
      items.push({
        id: 'suggest',
        icon: 'sparkles',
        label: 'Auto-assign least loaded',
        onClick: async () => {
          try {
            const r = await workloadService.suggest({ exclude_id: t.engineer_id || undefined });
            const u = r?.user;
            if (!u) { toast.error('No engineer available'); return; }
            await ticketsService.assign(t.id, { user_id: u.id });
            toast.success(`Assigned to ${u.name}`);
            load();
          } catch (err) {
            toast.error(err?.response?.data?.message || 'Assign failed');
          }
        },
      });
      items.push({
        id: 'unassign',
        icon: 'x',
        label: 'Unassign',
        disabled: !t.engineer_id,
        onClick: async () => {
          try {
            await ticketsService.assign(t.id, { user_id: null });
            toast.success('Unassigned');
            load();
          } catch (err) {
            toast.error(err?.response?.data?.message || 'Update failed');
          }
        },
      });
    }
    if (canEditPriority) {
      items.push({ divider: true });
      ['critical','high','medium','low'].forEach((p) => {
        items.push({
          id: `prio-${p}`,
          icon: 'spark',
          label: `Priority: ${PRIORITY_LABEL[p]}`,
          disabled: t.priority === p,
          onClick: async () => {
            try {
              await ticketsService.update(t.id, { priority: p });
              toast.success(`Priority → ${PRIORITY_LABEL[p]}`);
              load();
            } catch (err) {
              toast.error(err?.response?.data?.message || 'Update failed');
            }
          },
        });
      });
    }
    if (isStaff) {
      items.push({ divider: true });
      items.push({
        id: 'escalate',
        icon: 'trendingUp',
        label: 'Escalate ticket',
        onClick: async () => {
          try {
            await ticketsService.escalate(t.id);
            toast.success('Escalated');
            load();
          } catch (err) {
            toast.error(err?.response?.data?.message || 'Escalate failed');
          }
        },
      });
    }
    if (user?.role === 'admin') {
      items.push({ divider: true });
      items.push({
        id: 'delete',
        icon: 'trash',
        label: 'Delete ticket',
        tone: 'danger',
        onClick: async () => {
          if (!confirm(`Delete ticket "${t.subject}"? This cannot be undone.`)) return;
          try {
            await ticketsService.remove(t.id);
            toast.success('Deleted');
            load();
          } catch (err) {
            toast.error(err?.response?.data?.message || 'Delete failed');
          }
        },
      });
    }
    return items;
  }, [ctxMenu, canAssign, canEditPriority, isStaff, user, navigate]); // eslint-disable-line react-hooks/exhaustive-deps

  /* ---------- header click handlers ---------- */
  const onHeaderSort = (col) => {
    if (!col.sortKey) return;
    setPage(1);
    if (sort.key === col.sortKey) {
      // Same column — toggle direction, then reset on the third click.
      if (sort.dir === 'desc') setSort({ key: col.sortKey, dir: 'asc' });
      else setSort({ key: 'newest', dir: 'desc' });
    } else {
      // New column — text columns start A→Z, others start with the most useful direction.
      const startDir = ['subject', 'sla'].includes(col.sortKey) ? 'asc' : 'desc';
      setSort({ key: col.sortKey, dir: startDir });
    }
  };

  /* ---------- header drag & drop ---------- */
  const dragRef = useRef(null);
  const onHeaderDragStart = (id) => (e) => {
    dragRef.current = id;
    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setData('text/plain', id);
  };
  const onHeaderDragOver = (e) => { e.preventDefault(); e.dataTransfer.dropEffect = 'move'; };
  const onHeaderDrop = (targetId) => (e) => {
    e.preventDefault();
    const draggedId = dragRef.current || e.dataTransfer.getData('text/plain');
    if (!draggedId || draggedId === targetId) return;
    setColumnOrder((prev) => {
      const next = prev.filter((id) => id !== draggedId);
      const idx  = next.indexOf(targetId);
      next.splice(idx >= 0 ? idx : next.length, 0, draggedId);
      return next;
    });
    dragRef.current = null;
  };

  /* ---------- counters ---------- */
  const recordsLabel = `${total} record${total === 1 ? '' : 's'}`;

  const quickFilterCount = activeQuick.reduce((n, id) => n + (quickValues[id] ? 1 : 0), 0);
  const activeFilterCount =
    (pipelineId ? 1 : 0) + (ownerId ? 1 : 0) + (priority ? 1 : 0) + (ticketType ? 1 : 0) +
    (createdRange ? 1 : 0) + (updatedRange ? 1 : 0) +
    (advFilters.status ? 1 : 0) + (advFilters.source ? 1 : 0) + (advFilters.project_id ? 1 : 0) +
    (advFilters.escalated ? 1 : 0) + (advFilters.has_sla_breach ? 1 : 0) +
    quickFilterCount;

  const clearAll = () => {
    setPipelineId(''); setOwnerId(''); setPriority(''); setTicketType('');
    setCreatedRange(''); setUpdatedRange('');
    setAdvFilters({ status: '', source: '', project_id: '', escalated: false, has_sla_breach: false });
    setActiveQuick([]);
    setQuickValues({});
    setPage(1);
  };

  /* ============================================================ render */
  return (
    <div className="-mx-4 -mt-4 px-4 pt-4 md:-mt-6 md:pt-6 min-h-screen bg-gray-50 dark:bg-slate-950">
      {/* Title row */}
      <div className="flex items-baseline justify-between mb-3">
        <div>
          <h1 className="text-2xl font-semibold text-gray-900 dark:text-slate-100 flex items-center gap-2">
            Tickets <span className="text-gray-400">▾</span>
          </h1>
          <p className="text-xs text-gray-500 dark:text-slate-400 mt-0.5">{recordsLabel}</p>
        </div>
        {!isEngineer && (
          <button
            onClick={() => setDrawer(true)}
            className="px-4 py-2 rounded-md bg-orange-500 hover:bg-orange-600 text-white font-semibold shadow-sm transition"
          >
            + Create ticket
          </button>
        )}
      </div>

      {/* Saved-view tabs */}
      <div className="border-b border-gray-200 dark:border-slate-700 flex items-center gap-1">
        {savedViews.map((v) => (
          <button
            key={v.id}
            onClick={() => { setView(v.id); setPage(1); }}
            className={`px-4 py-2 text-sm relative -mb-px border-b-2 transition
              ${view === v.id
                ? 'border-orange-500 text-gray-900 dark:text-slate-100 font-medium'
                : 'border-transparent text-gray-500 dark:text-slate-400 hover:text-gray-800 dark:hover:text-slate-200'}`}
          >
            {v.label}
            {view === v.id && v.id !== 'all' && !isEngineer && (
              <span
                role="button"
                aria-label="Reset view"
                className="ml-2 text-gray-400 hover:text-gray-600 cursor-pointer"
                onClick={(e) => { e.stopPropagation(); setView('all'); setPage(1); }}
              >×</span>
            )}
          </button>
        ))}
      </div>

      {/* Filter chip row */}
      <div className="flex flex-wrap items-center gap-2 py-3 border-b border-gray-200 dark:border-slate-700">
        {/* List / Grid toggle */}
        <div className="inline-flex rounded-md border border-gray-300 dark:border-slate-700 overflow-hidden">
          <button
            onClick={() => setLayout('list')}
            className={`px-2.5 py-1.5 text-sm flex items-center
              ${layout === 'list' ? 'bg-gray-100 dark:bg-slate-800' : 'hover:bg-gray-50 dark:hover:bg-slate-800/60'}`}
            title="List view"
          >☰</button>
          <button
            onClick={() => setLayout('grid')}
            className={`px-2.5 py-1.5 text-sm flex items-center border-l border-gray-300 dark:border-slate-700
              ${layout === 'grid' ? 'bg-gray-100 dark:bg-slate-800' : 'hover:bg-gray-50 dark:hover:bg-slate-800/60'}`}
            title="Grid view"
          >▦</button>
        </div>

        <FilterChip label="All pipelines" value={pipelineId} onChange={(v) => { setPipelineId(v); setPage(1); }}
          options={[{ value: '', label: 'All pipelines' }, ...pipelines.map(p => ({ value: p.id, label: p.name }))]} />
        {!isEngineer && (
          <FilterChip label="Ticket owner" value={ownerId} onChange={(v) => { setOwnerId(v); setPage(1); }}
            options={[{ value: '', label: 'Any owner' },
              ...users.filter(u => ['engineer','manager','admin'].includes(u.role))
                     .map(u => ({ value: u.id, label: u.name }))]} />
        )}
        <FilterChip label="Create date" value={createdRange} onChange={(v) => { setCreatedRange(v); setPage(1); }}
          options={DATE_RANGE_OPTIONS} />
        <FilterChip label="Last activity date" value={updatedRange} onChange={(v) => { setUpdatedRange(v); setPage(1); }}
          options={DATE_RANGE_OPTIONS} />
        <FilterChip label="Priority" value={priority} onChange={(v) => { setPriority(v); setPage(1); }}
          options={[{ value: '', label: 'Any priority' },
            { value: 'critical', label: 'Urgent' },
            { value: 'high', label: 'High' },
            { value: 'medium', label: 'Medium' },
            { value: 'low', label: 'Low' }]} />
        <FilterChip label="Type" value={ticketType} onChange={(v) => { setTicketType(v); setPage(1); }}
          options={[{ value: '', label: 'Any type' },
            { value: 'incident', label: 'Incident' },
            { value: 'request',  label: 'Request'  }]} />

        {/* User-added quick filters render inline as removable chips */}
        {activeQuick.map((id) => {
          const def = QF_BY_ID[id]; if (!def) return null;
          return (
            <QuickFilterChip
              key={id}
              def={def}
              value={quickValues[id] || ''}
              onChange={(v) => setQuickValue(id, v)}
              onRemove={() => removeQuickFilter(id)}
            />
          );
        })}

        <AddQuickFilterButton
          activeIds={activeQuick}
          onPick={(id) => { addQuickFilter(id); setPage(1); }}
        />

        <button
          onClick={() => setAdvOpen((v) => !v)}
          className={`inline-flex items-center gap-1.5 text-sm px-3 py-1.5 rounded-md border transition
            ${advOpen || activeFilterCount > 0
              ? 'bg-teal-50 text-teal-700 border-teal-300 dark:bg-teal-500/10 dark:text-teal-300 dark:border-teal-700'
              : 'bg-white text-gray-700 border-gray-300 hover:bg-gray-50 dark:bg-slate-900 dark:text-slate-300 dark:border-slate-700 dark:hover:bg-slate-800'}`}
        >
          ≡ Advanced filters
          {activeFilterCount > 0 && (
            <span className="ml-1 inline-flex items-center justify-center min-w-[18px] h-[18px] px-1 rounded-full bg-teal-600 text-white text-[10px] font-bold">
              {activeFilterCount}
            </span>
          )}
        </button>

        {activeFilterCount > 0 && (
          <button
            onClick={clearAll}
            className="text-xs text-gray-500 dark:text-slate-400 hover:text-red-600 dark:hover:text-red-400 underline"
          >
            Clear all
          </button>
        )}

        <div className="ml-auto flex items-center gap-2">
          <ColumnsMenu
            order={columnOrder}
            hidden={hiddenCols}
            onToggle={(id) => {
              setHiddenCols((s) => {
                const n = new Set(s);
                n.has(id) ? n.delete(id) : n.add(id);
                return n;
              });
            }}
            onReset={() => {
              setColumnOrder(DEFAULT_ORDER);
              setHiddenCols(new Set(DEFAULT_HIDDEN));
            }}
          />
          <div className="relative">
            <input
              value={search}
              onChange={(e) => { setSearch(e.target.value); setPage(1); }}
              placeholder="Search"
              className="pl-8 pr-3 py-1.5 text-sm rounded-md border border-gray-300 dark:border-slate-700
                         bg-white dark:bg-slate-900 dark:text-slate-100
                         focus:outline-none focus:ring-2 focus:ring-teal-400/40 w-56"
            />
            <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-400 text-sm">⌕</span>
          </div>
        </div>
      </div>

      {/* Advanced filters slide-down */}
      {advOpen && (
        <div className="border-b border-gray-200 dark:border-slate-700 py-3 bg-gray-50/50 dark:bg-slate-900/40 -mx-4 px-4">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3">
            <SelectField
              label="Status"
              value={advFilters.status}
              onChange={(v) => { setAdvFilters({ ...advFilters, status: v }); setPage(1); }}
              options={[{ value: '', label: 'Any status' },
                { value: 'open', label: 'Open' },
                { value: 'in_progress', label: 'In progress' },
                { value: 'waiting', label: 'Waiting' },
                { value: 'resolved', label: 'Resolved' },
                { value: 'closed', label: 'Closed' }]}
            />
            <SelectField
              label="Source"
              value={advFilters.source}
              onChange={(v) => { setAdvFilters({ ...advFilters, source: v }); setPage(1); }}
              options={[{ value: '', label: 'Any source' },
                { value: 'phone', label: 'Phone' },
                { value: 'email', label: 'Email' },
                { value: 'chat', label: 'Chat' },
                { value: 'portal', label: 'Customer portal' },
                { value: 'walk_in', label: 'Walk-in' }]}
            />
            <SelectField
              label="Project"
              value={advFilters.project_id}
              onChange={(v) => { setAdvFilters({ ...advFilters, project_id: v }); setPage(1); }}
              options={[{ value: '', label: 'Any project' },
                ...projects.map((p) => ({ value: p.id, label: p.name }))]}
            />
            <div className="flex flex-col gap-1">
              <span className="text-[11px] uppercase tracking-wider text-gray-500 dark:text-slate-400 font-medium">Flags</span>
              <div className="flex items-center gap-3 pt-1.5">
                <label className="inline-flex items-center gap-1.5 text-sm cursor-pointer">
                  <input
                    type="checkbox"
                    checked={advFilters.escalated}
                    onChange={(e) => { setAdvFilters({ ...advFilters, escalated: e.target.checked }); setPage(1); }}
                    className="rounded border-gray-300 text-teal-600 focus:ring-teal-500"
                  />
                  <span className="text-gray-700 dark:text-slate-300">Escalated only</span>
                </label>
                <label className="inline-flex items-center gap-1.5 text-sm cursor-pointer">
                  <input
                    type="checkbox"
                    checked={advFilters.has_sla_breach}
                    onChange={(e) => { setAdvFilters({ ...advFilters, has_sla_breach: e.target.checked }); setPage(1); }}
                    className="rounded border-gray-300 text-red-600 focus:ring-red-500"
                  />
                  <span className="text-gray-700 dark:text-slate-300">SLA breached</span>
                </label>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Body */}
      {data.length === 0 ? (
        <div className="py-10"><EmptyState title="No tickets match your filters" /></div>
      ) : layout === 'list' ? (
        <ListView
          data={data}
          visibleColumns={visibleColumns}
          sort={sort}
          onHeaderSort={onHeaderSort}
          onHeaderDragStart={onHeaderDragStart}
          onHeaderDragOver={onHeaderDragOver}
          onHeaderDrop={onHeaderDrop}
          setStage={setStage}
          users={users}
          canAssign={canAssign}
          canEditPriority={canEditPriority}
          reload={load}
          onRowContext={onRowContext}
        />
      ) : (
        <GridView
          data={data}
          setStage={setStage}
          users={users}
          canAssign={canAssign}
          canEditPriority={canEditPriority}
          reload={load}
          onRowContext={onRowContext}
        />
      )}

      <ContextMenu at={ctxMenu} onClose={closeCtxMenu} items={ctxItems} />

      {/* Pagination */}
      <div className="flex items-center justify-end gap-2 py-4 text-sm text-gray-600 dark:text-slate-400">
        <button
          disabled={page <= 1}
          onClick={() => setPage((p) => Math.max(1, p - 1))}
          className="px-2 py-1 rounded-md border border-gray-300 dark:border-slate-700 disabled:opacity-50">‹ Prev</button>
        <span className="px-3 py-1 rounded-md bg-gray-100 dark:bg-slate-800">{page}</span>
        <button
          disabled={data.length < PAGE_SIZE}
          onClick={() => setPage((p) => p + 1)}
          className="px-2 py-1 rounded-md border border-gray-300 dark:border-slate-700 disabled:opacity-50">Next ›</button>
        <span className="ml-3">{PAGE_SIZE} per page</span>
      </div>

      <CreateTicketDrawer
        open={drawer}
        onClose={() => setDrawer(false)}
        onCreated={() => load()}
      />

      {/* Floating "Quick Ticket" capture — admins/managers only (engineers
          can't create tickets, the component bails for that role). */}
      {!isEngineer && <QuickTicketButton onCreated={() => load()} />}
    </div>
  );
}

/* ====================================================================== */
/*                              SUB-COMPONENTS                            */
/* ====================================================================== */

function FilterChip({ label, value, options, onChange }) {
  const active = value !== '' && value !== null && value !== undefined;
  return (
    <label className={`inline-flex items-center gap-1 text-sm px-3 py-1.5 rounded-md border transition cursor-pointer
        ${active
          ? 'bg-teal-50 text-teal-700 border-teal-300 dark:bg-teal-500/10 dark:text-teal-300 dark:border-teal-700'
          : 'bg-white text-gray-700 border-gray-300 hover:bg-gray-50 dark:bg-slate-900 dark:text-slate-300 dark:border-slate-700 dark:hover:bg-slate-800'}`}>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="bg-transparent outline-none cursor-pointer pr-1"
      >
        {options.map((o) => (
          <option key={o.value} value={o.value} className="bg-white dark:bg-slate-900 dark:text-slate-200">
            {o.value === '' ? label : o.label}
          </option>
        ))}
      </select>
    </label>
  );
}

function SelectField({ label, value, onChange, options }) {
  return (
    <div className="flex flex-col gap-1">
      <span className="text-[11px] uppercase tracking-wider text-gray-500 dark:text-slate-400 font-medium">{label}</span>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="px-2.5 py-1.5 text-sm rounded-md border border-gray-300 dark:border-slate-700
                   bg-white dark:bg-slate-900 dark:text-slate-100
                   focus:outline-none focus:ring-2 focus:ring-teal-400/40"
      >
        {options.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
      </select>
    </div>
  );
}

/* ----------------------------------------------------------------------- */
function QuickFilterChip({ def, value, onChange, onRemove }) {
  const ref = useRef(null);
  const [open, setOpen] = useState(false);
  usePopoverDismiss(open, ref, () => setOpen(false));
  const active = value !== '' && value !== null && value !== undefined;

  // For text inputs we render a tiny popover; selects/date_ranges use a native
  // <select> for simplicity (matches the rest of the chip row).
  if (def.kind === 'text') {
    return (
      <div className="relative" ref={ref}>
        <button
          onClick={() => setOpen((v) => !v)}
          className={`inline-flex items-center gap-1 text-sm px-3 py-1.5 rounded-md border transition
            ${active
              ? 'bg-teal-50 text-teal-700 border-teal-300 dark:bg-teal-500/10 dark:text-teal-300 dark:border-teal-700'
              : 'bg-white text-gray-700 border-gray-300 hover:bg-gray-50 dark:bg-slate-900 dark:text-slate-300 dark:border-slate-700 dark:hover:bg-slate-800'}`}
        >
          {def.label}{active ? `: ${value}` : ''} <span className="text-gray-400">▾</span>
          <span
            role="button"
            aria-label={`Remove ${def.label}`}
            onClick={(e) => { e.stopPropagation(); onRemove(); }}
            className="ml-1 text-gray-400 hover:text-red-500"
          >×</span>
        </button>
        {open && (
          <div className="absolute left-0 mt-1.5 w-56 z-30 rounded-lg border border-gray-200 dark:border-slate-700 bg-white dark:bg-slate-900 shadow-lg p-2">
            <input
              autoFocus
              value={value}
              onChange={(e) => onChange(e.target.value)}
              placeholder={def.placeholder}
              className="w-full px-2.5 py-1.5 text-sm rounded-md border border-gray-300 dark:border-slate-700
                         bg-white dark:bg-slate-900 dark:text-slate-100
                         focus:outline-none focus:ring-2 focus:ring-teal-400/40"
            />
            <div className="flex justify-between items-center mt-2 px-1">
              <button
                className="text-xs text-gray-500 hover:text-gray-700 dark:text-slate-400 dark:hover:text-slate-200"
                onClick={() => { onChange(''); }}
              >Clear</button>
              <button
                className="text-xs text-teal-600 dark:text-teal-400 font-medium hover:underline"
                onClick={() => setOpen(false)}
              >Done</button>
            </div>
          </div>
        )}
      </div>
    );
  }

  const options = def.kind === 'date_range' ? DATE_RANGE_OPTIONS : (def.options || []);
  return (
    <label className={`inline-flex items-center gap-1 text-sm pl-3 pr-2 py-1.5 rounded-md border transition cursor-pointer
        ${active
          ? 'bg-teal-50 text-teal-700 border-teal-300 dark:bg-teal-500/10 dark:text-teal-300 dark:border-teal-700'
          : 'bg-white text-gray-700 border-gray-300 hover:bg-gray-50 dark:bg-slate-900 dark:text-slate-300 dark:border-slate-700 dark:hover:bg-slate-800'}`}>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="bg-transparent outline-none cursor-pointer pr-1"
      >
        {options.map((o) => (
          <option key={o.value} value={o.value} className="bg-white dark:bg-slate-900 dark:text-slate-200">
            {o.value === '' ? def.label : o.label}
          </option>
        ))}
      </select>
      <span
        role="button"
        aria-label={`Remove ${def.label}`}
        onClick={(e) => { e.preventDefault(); e.stopPropagation(); onRemove(); }}
        className="text-gray-400 hover:text-red-500"
      >×</span>
    </label>
  );
}

/* ----------------------------------------------------------------------- */
function AddQuickFilterButton({ activeIds, onPick }) {
  const ref = useRef(null);
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState('');
  usePopoverDismiss(open, ref, () => { setOpen(false); setQ(''); });

  const items = QUICK_FILTER_CATALOG.filter(
    (f) => !activeIds.includes(f.id) && f.label.toLowerCase().includes(q.toLowerCase())
  );

  return (
    <div className="relative" ref={ref}>
      <button
        onClick={() => setOpen((v) => !v)}
        title="Add a quick filter"
        className="w-8 h-8 inline-flex items-center justify-center rounded-full border border-gray-300 dark:border-slate-700
                   bg-white dark:bg-slate-900 text-gray-500 dark:text-slate-400
                   hover:bg-gray-50 dark:hover:bg-slate-800 hover:text-teal-600 dark:hover:text-teal-400 transition"
      >+</button>
      {open && (
        <div className="absolute left-0 mt-1.5 w-72 z-30 rounded-lg border border-gray-200 dark:border-slate-700 bg-white dark:bg-slate-900 shadow-lg">
          <div className="p-3 border-b border-gray-100 dark:border-slate-800">
            <div className="text-sm font-semibold text-gray-800 dark:text-slate-100 mb-2">Add a quick filter</div>
            <div className="relative">
              <input
                autoFocus
                value={q}
                onChange={(e) => setQ(e.target.value)}
                placeholder="Search"
                className="w-full pl-8 pr-3 py-1.5 text-sm rounded-md border border-gray-300 dark:border-slate-700
                           bg-white dark:bg-slate-900 dark:text-slate-100
                           focus:outline-none focus:ring-2 focus:ring-teal-400/40"
              />
              <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-400 text-sm">⌕</span>
            </div>
          </div>
          <ul className="max-h-72 overflow-y-auto py-1">
            {items.length === 0 && (
              <li className="px-3 py-2 text-xs text-gray-400 dark:text-slate-500">All filters added</li>
            )}
            {items.map((f) => (
              <li key={f.id}>
                <button
                  onClick={() => { onPick(f.id); setOpen(false); setQ(''); }}
                  className="w-full text-left px-3 py-2 hover:bg-gray-50 dark:hover:bg-slate-800/60 flex items-start gap-2"
                >
                  <span className="mt-0.5 text-gray-400 dark:text-slate-500">
                    {f.kind === 'date_range' ? '📅' : f.kind === 'select' ? '⏳' : '#'}
                  </span>
                  <span className="flex-1">
                    <div className="text-sm text-gray-800 dark:text-slate-100">{f.label}</div>
                    <div className="text-[11px] text-gray-500 dark:text-slate-400">{f.desc}</div>
                  </span>
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}

/* ----------------------------------------------------------------------- */
function ColumnsMenu({ order, hidden, onToggle, onReset }) {
  const [open, setOpen] = useState(false);
  const ref = useRef(null);
  usePopoverDismiss(open, ref, () => setOpen(false));
  return (
    <div className="relative" ref={ref}>
      <button
        onClick={() => setOpen((v) => !v)}
        className="px-3 py-1.5 text-sm rounded-md border border-gray-300 dark:border-slate-700
                   bg-white dark:bg-slate-900 text-gray-700 dark:text-slate-300
                   hover:bg-gray-50 dark:hover:bg-slate-800 inline-flex items-center gap-1.5"
      >
        ⚙ Edit columns
      </button>
      {open && (
        <div className="absolute right-0 mt-1.5 w-60 z-30 rounded-lg border border-gray-200 dark:border-slate-700 bg-white dark:bg-slate-900 shadow-lg p-2">
          <div className="px-2 py-1 text-[11px] uppercase tracking-wider text-gray-400 dark:text-slate-500">
            Show columns
          </div>
          <ul className="space-y-0.5">
            {order.map((id) => {
              const c = COL_BY_ID[id];
              if (!c) return null;
              const visible = !hidden.has(id);
              return (
                <li key={id}>
                  <label className="flex items-center gap-2 px-2 py-1.5 text-sm rounded hover:bg-gray-50 dark:hover:bg-slate-800/60 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={visible}
                      onChange={() => onToggle(id)}
                      className="rounded border-gray-300 text-teal-600 focus:ring-teal-500"
                    />
                    <span className="text-gray-700 dark:text-slate-200">{c.label}</span>
                  </label>
                </li>
              );
            })}
          </ul>
          <div className="border-t border-gray-100 dark:border-slate-800 mt-2 pt-2 flex items-center justify-between px-2">
            <span className="text-[11px] text-gray-400 dark:text-slate-500">Drag headers to reorder</span>
            <button
              onClick={() => { onReset(); setOpen(false); }}
              className="text-xs text-teal-600 dark:text-teal-400 hover:underline font-medium"
            >
              Reset
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

/* ----------------------------------------------------------------------- */
function StageChip({ ticket, setStage }) {
  const [stages, setStages] = useState([]);
  useEffect(() => {
    if (!ticket.pipeline_id) { setStages([]); return; }
    pipelinesService.listStages(ticket.pipeline_id).then(setStages).catch(() => setStages([]));
  }, [ticket.pipeline_id]);
  const color = ticket.stage_color || '#6b7280';

  return (
    <div className="inline-flex items-center gap-2">
      <span
        className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-xs font-medium
                   border bg-white dark:bg-slate-900"
        style={{ borderColor: color + '99', color }}
      >
        <span className="w-1.5 h-1.5 rounded-full" style={{ background: color }} />
        {ticket.stage_name || ticket.status}
      </span>
      <select
        value={ticket.pipeline_stage_id || ''}
        onChange={(e) => setStage(ticket, e.target.value)}
        onClick={(e) => e.stopPropagation()}
        className="text-xs px-1.5 py-0.5 rounded border border-gray-200 dark:border-slate-700
                   bg-white dark:bg-slate-900 dark:text-slate-200"
        title="Move stage"
      >
        {stages.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
      </select>
    </div>
  );
}

/* ----------------------------------------------------------------------- */
function ListView({
  data, visibleColumns, sort, onHeaderSort,
  onHeaderDragStart, onHeaderDragOver, onHeaderDrop, setStage,
  users, canAssign, canEditPriority, reload, onRowContext,
}) {
  const navigate = useNavigate();
  const stop = (e) => e.stopPropagation();
  const baseCtx = { stop, setStage, users, canAssign, canEditPriority, reload };

  return (
    <div className="rounded-lg border border-gray-200 dark:border-slate-800 bg-white dark:bg-slate-900 overflow-x-auto">
      <table className="w-full text-sm" style={{ minWidth: visibleColumns.reduce((a, c) => a + (c.minW || 100), 60) }}>
        <thead className="bg-gray-50 dark:bg-slate-800/60 text-xs text-gray-500 dark:text-slate-400 uppercase tracking-wide select-none">
          <tr>
            <th className="w-10 py-2 px-3 text-left">
              <input type="checkbox" onClick={stop} />
            </th>
            {visibleColumns.map((col) => {
              const isSorted = sort.key === col.sortKey;
              return (
                <th
                  key={col.id}
                  draggable
                  onDragStart={onHeaderDragStart(col.id)}
                  onDragOver={onHeaderDragOver}
                  onDrop={onHeaderDrop(col.id)}
                  onClick={() => onHeaderSort(col)}
                  style={{ minWidth: col.minW }}
                  className={`text-left px-3 py-2 cursor-pointer transition relative
                    hover:text-gray-700 dark:hover:text-slate-200
                    ${isSorted ? 'text-teal-700 dark:text-teal-400' : ''}`}
                  title="Click to sort · Drag to reorder"
                >
                  <span className="inline-flex items-center gap-1">
                    <span className="text-gray-300 dark:text-slate-600 cursor-grab text-[10px]" aria-hidden>⋮⋮</span>
                    {col.label}
                    {isSorted && (
                      <span className="text-[10px] font-bold">
                        {sort.dir === 'asc' ? '▲' : '▼'}
                      </span>
                    )}
                  </span>
                </th>
              );
            })}
          </tr>
        </thead>
        <tbody>
          {data.map((t) => (
            <tr
              key={t.id}
              onClick={() => navigate(`/tickets/${t.id}`)}
              onContextMenu={onRowContext?.(t)}
              className="border-t border-gray-100 dark:border-slate-800 hover:bg-gray-50 dark:hover:bg-slate-800/40 cursor-pointer"
            >
              <td className="px-3 py-2" onClick={stop}>
                <input type="checkbox" onClick={stop} />
              </td>
              {visibleColumns.map((col) => (
                <td key={col.id} className="px-3 py-2 align-top">
                  {col.render(t, baseCtx)}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

/* ----------------------------------------------------------------------- */
function GridView({ data, setStage, users, canAssign, canEditPriority, reload, onRowContext }) {
  const navigate = useNavigate();
  const stop = (e) => e.stopPropagation();
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 mt-3">
      {data.map((t) => (
        <div
          key={t.id}
          onClick={() => navigate(`/tickets/${t.id}`)}
          onContextMenu={onRowContext?.(t)}
          className="rounded-lg border border-gray-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-4 shadow-sm
                     cursor-pointer hover:border-brand-300 hover:shadow-md transition"
        >
          <div className="flex items-start justify-between gap-2">
            <Link
              to={`/tickets/${t.id}`}
              onClick={stop}
              className="text-blue-600 dark:text-blue-400 hover:underline font-semibold line-clamp-2"
            >
              {t.subject}
            </Link>
            <span className="text-[11px] font-mono text-gray-400">{t.ticket_no || `#${t.id}`}</span>
          </div>
          <div className="mt-2 flex items-center gap-2 flex-wrap" onClick={stop}>
            <StageChip ticket={t} setStage={setStage} />
            <InlinePriority ticket={t} onChange={reload} readOnly={!canEditPriority} />
            <TicketTypeBadge type={t.ticket_type} />
          </div>
          <div className="mt-3 text-xs text-gray-500 dark:text-slate-400 space-y-0.5">
            <div className="flex items-center gap-1" onClick={stop}>
              <span>Owner:</span>
              <InlineOwner ticket={t} users={users} onChange={reload} readOnly={!canAssign} />
            </div>
            <div>Project: <span className="text-gray-700 dark:text-slate-300">{t.project_name || '—'}</span></div>
            {t.reporter_name && <div>Reporter: {t.reporter_name}</div>}
          </div>
        </div>
      ))}
    </div>
  );
}

/* ====================================================================== */
/*                                 HELPERS                                */
/* ====================================================================== */

const DATE_RANGE_OPTIONS = [
  { value: '',      label: 'Any time' },
  { value: 'today', label: 'Today' },
  { value: '7d',    label: 'Last 7 days' },
  { value: '30d',   label: 'Last 30 days' },
  { value: '90d',   label: 'Last 90 days' },
  { value: 'year',  label: 'Last 365 days' },
];

function dateRangeToParams(range) {
  if (!range) return null;
  const now = new Date();
  const before = now.toISOString();
  let after;
  if (range === 'today') {
    const start = new Date(); start.setHours(0, 0, 0, 0);
    after = start.toISOString();
  } else if (range === '7d')   after = new Date(Date.now() - 7  * 86400_000).toISOString();
  else if (range === '30d')    after = new Date(Date.now() - 30 * 86400_000).toISOString();
  else if (range === '90d')    after = new Date(Date.now() - 90 * 86400_000).toISOString();
  else if (range === 'year')   after = new Date(Date.now() - 365 * 86400_000).toISOString();
  else return null;
  return { after, before };
}

// Translate the local sort state into the backend's named ORDER_BY mode.
//   - For text columns (subject/pipeline/stage/owner/project) ASC ↔ '<key>'  / DESC ↔ '<key>_desc'.
//   - 'priority' default DESC means "urgent first" (the most useful triage order).
//   - 'updated' default DESC means "most recent activity first" (HubSpot-equivalent).
//   - 'sla' default ASC means "most overdue first".
const ASC_MODE = {
  newest:     'oldest',
  subject:    'subject',
  pipeline:   'pipeline',
  stage:      'stage',
  owner:      'owner',
  project:    'project',
  priority:   'priority_asc',
  updated:    'updated_asc',
  sla:        'sla',
  id:         'id_asc',
  close_date: 'close_date',
};
const DESC_MODE = {
  newest:     'newest',
  subject:    'subject_desc',
  pipeline:   'pipeline_desc',
  stage:      'stage_desc',
  owner:      'owner_desc',
  project:    'project_desc',
  priority:   'priority',
  updated:    'updated',
  sla:        'sla_desc',
  id:         'id_desc',
  close_date: 'close_date_desc',
};
function backendSort({ key, dir }) {
  return (dir === 'asc' ? ASC_MODE : DESC_MODE)[key] || 'newest';
}
