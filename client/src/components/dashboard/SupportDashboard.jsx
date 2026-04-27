import { useEffect, useMemo, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import toast from 'react-hot-toast';
import * as reportsService from '../../services/reportsService';
import * as ticketsService from '../../services/ticketsService';
import { useAuth } from '../../context/AuthContext.jsx';
import { getSocket } from '../../services/socket';
import useNextActions from '../../hooks/useNextActions';
import KpiCard from './KpiCard.jsx';
import PriorityQueue from './PriorityQueue.jsx';
import TicketActivity from './TicketActivity.jsx';
import TicketReplyModal from './TicketReplyModal.jsx';
import AssignTicketModal from './AssignTicketModal.jsx';
import NextActions from './NextActions.jsx';
import { SkeletonCard, SkeletonList, SkeletonBlock } from '../ui/Skeleton.jsx';
import Icon from '../ui/Icon.jsx';

function SectionCard({ title, subtitle, right, children, className = '', id }) {
  return (
    <div id={id} className={`card p-5 ${className}`}>
      <div className="flex items-start justify-between mb-4 gap-3">
        <div className="min-w-0">
          <h3 className="section-title">{title}</h3>
          {subtitle && <p className="section-sub">{subtitle}</p>}
        </div>
        {right}
      </div>
      {children}
    </div>
  );
}

const FILTERS = [
  { id: 'all',         label: 'All active' },
  { id: 'open',        label: 'Open' },
  { id: 'in_progress', label: 'In progress' },
];

export default function SupportDashboard({ previewer }) {
  const { user } = useAuth();
  const [loading, setLoading]   = useState(true);
  const [filter, setFilter]     = useState('all');
  const [busyId, setBusyId]     = useState(null);

  const [kpis, setKpis]           = useState(null);
  const [queue, setQueue]         = useState([]);
  const [activity, setActivity]   = useState([]);

  const [replyTicket, setReplyTicket]   = useState(null);
  const [assignTicket, setAssignTicket] = useState(null);

  // Personal next actions (the engine bubbles up SLA breaches + silent tickets for support users)
  const { data: nextActions, loading: nextLoading } = useNextActions({ scope: 'mine' });

  const refreshTimer = useRef(null);

  const fetchAll = async (status = filter) => {
    const params = status && status !== 'all' ? { status } : {};
    const [k, q, a] = await Promise.all([
      reportsService.myTicketsDashboard(),
      reportsService.myTicketsQueue({ ...params, limit: 30 }),
      reportsService.myTicketsActivity({ limit: 10 }),
    ]);
    setKpis(k); setQueue(q); setActivity(a);
  };

  const queueRefresh = () => {
    if (refreshTimer.current) clearTimeout(refreshTimer.current);
    refreshTimer.current = setTimeout(() => { fetchAll().catch(() => {}); }, 350);
  };

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try { await fetchAll(filter); }
      finally { if (!cancelled) setLoading(false); }
    })();
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filter]);

  useEffect(() => {
    const sock = getSocket();
    if (!sock) return;
    const events = ['ticket:new', 'ticket:update', 'ticket:delete', 'ticket:comment', 'activity:new'];
    events.forEach((e) => sock.on(e, queueRefresh));
    return () => events.forEach((e) => sock.off(e, queueRefresh));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const greeting = useMemo(() => {
    const h = new Date().getHours();
    if (h < 12) return 'Good morning';
    if (h < 18) return 'Good afternoon';
    return 'Good evening';
  }, []);

  const closeTicket = async (t) => {
    if (!confirm(`Close ticket ${t.ticket_no || `#${t.id}`}?`)) return;
    setBusyId(t.id);
    try {
      await ticketsService.setStatus(t.id, 'closed');
      toast.success(`Ticket ${t.ticket_no || `#${t.id}`} closed`);
      fetchAll();
    } catch (err) {
      toast.error('Could not close ticket');
    } finally { setBusyId(null); }
  };

  const breachCount = kpis?.counts?.sla_breached || 0;
  const slaPct      = kpis?.sla?.pct ?? 100;

  // Visible queue, optionally narrowed by filter chips
  const visibleQueue = useMemo(() => {
    if (filter === 'all') return queue;
    return queue.filter((t) => t.status === filter);
  }, [queue, filter]);

  return (
    <>
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 mb-6">
        <div>
          <div className="flex items-center gap-3 flex-wrap">
            <h1 className="text-2xl md:text-3xl font-bold text-gray-900 dark:text-slate-100 tracking-tight flex items-center gap-2">
              {greeting}, {user?.name?.split(' ')[0] || 'there'}
              <span className="inline-block animate-[wave_1.6s_ease-in-out_infinite] origin-[70%_70%]">👋</span>
            </h1>
            <span className="inline-flex items-center gap-1 text-[11px] font-semibold px-2.5 py-1 rounded-full bg-cyan-100 text-cyan-700 dark:bg-cyan-500/15 dark:text-cyan-300 uppercase tracking-wider">
              <Icon name="ticket" className="w-3 h-3" /> Support View
            </span>
          </div>
          <p className="text-sm text-gray-500 dark:text-slate-400 mt-1">
            {new Date().toLocaleDateString(undefined, { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' })}
          </p>
        </div>

        {/* Quick actions */}
        <div className="flex items-center gap-2 flex-wrap">
          {previewer}
          <Link to="/tickets" className="btn-secondary"><Icon name="ticket" className="w-4 h-4" /> All tickets</Link>
          <Link to="/tickets" className="btn-primary"><Icon name="plus" className="w-4 h-4" /> New ticket</Link>
        </div>
      </div>

      {/* SLA breach banner */}
      {!loading && breachCount > 0 && (
        <div className="mb-6 p-4 rounded-xl border border-red-200 dark:border-red-500/20 bg-red-50 dark:bg-red-500/10 flex items-start md:items-center gap-3 flex-col md:flex-row">
          <span className="w-9 h-9 rounded-full bg-red-100 dark:bg-red-500/20 text-red-700 dark:text-red-400 flex items-center justify-center text-lg">🔴</span>
          <div className="text-sm text-red-900 dark:text-red-200 flex-1">
            <span className="font-semibold">{breachCount} ticket{breachCount === 1 ? '' : 's'} past SLA</span> — these need an immediate response.
          </div>
          <a href="#queue" className="text-sm font-medium text-red-800 dark:text-red-300 hover:underline whitespace-nowrap">
            Review queue →
          </a>
        </div>
      )}

      {/* KPI cards (clickable) */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        {loading || !kpis ? (
          <><SkeletonCard /><SkeletonCard /><SkeletonCard /><SkeletonCard /></>
        ) : (
          <>
            <KpiCard
              label="Open Tickets" icon="ticket" accent="cyan"
              value={kpis.counts.open.toLocaleString()}
              sublabel={`${kpis.counts.in_progress} in progress`}
              to="/tickets?status=open"
              tooltip="Open tickets assigned to me"
            />
            <KpiCard
              label="High Priority" icon="bell"
              accent={kpis.counts.high_open > 0 ? 'rose' : 'amber'}
              value={kpis.counts.high_open.toLocaleString()}
              sublabel={kpis.counts.high_open > 0 ? 'Needs attention now' : 'All clear'}
              to="/tickets?priority=high"
              tooltip="High-priority active tickets"
            />
            <KpiCard
              label="SLA Compliance" icon="checkCircle"
              accent={slaPct >= 90 ? 'emerald' : slaPct >= 70 ? 'amber' : 'rose'}
              value={`${slaPct}%`}
              sublabel={breachCount > 0 ? `${breachCount} breached` : 'On track'}
              tooltip="Active tickets within SLA target"
            />
            <KpiCard
              label="Resolved (7d)" icon="trendingUp" accent="purple"
              value={kpis.counts.resolved_7d.toLocaleString()}
              sublabel={kpis.sla.resolved_30d
                ? `Avg ${kpis.sla.avg_resolution_hours.toFixed(1)}h to resolve (30d)`
                : 'No resolutions yet'}
              to="/tickets?status=resolved"
              tooltip="Tickets you've resolved this week"
            />
          </>
        )}
      </div>

      {/* SLA targets reminder strip */}
      {!loading && kpis && (
        <div className="mb-6 p-3 rounded-xl bg-white dark:bg-slate-900 border border-gray-100 dark:border-slate-800 flex flex-wrap items-center gap-x-6 gap-y-2 text-xs">
          <span className="font-semibold text-gray-700 dark:text-slate-200 uppercase tracking-wider">
            <Icon name="bell" className="w-3.5 h-3.5 inline -mt-0.5 mr-1" />
            SLA targets
          </span>
          <span className="inline-flex items-center gap-1.5 text-gray-600 dark:text-slate-300">
            <span className="w-2 h-2 rounded-full bg-red-500"></span>
            High: <strong className="text-gray-900 dark:text-slate-100">{kpis.sla.target_hours_by_priority.high}h</strong>
          </span>
          <span className="inline-flex items-center gap-1.5 text-gray-600 dark:text-slate-300">
            <span className="w-2 h-2 rounded-full bg-amber-500"></span>
            Medium: <strong className="text-gray-900 dark:text-slate-100">{kpis.sla.target_hours_by_priority.medium}h</strong>
          </span>
          <span className="inline-flex items-center gap-1.5 text-gray-600 dark:text-slate-300">
            <span className="w-2 h-2 rounded-full bg-gray-400"></span>
            Low: <strong className="text-gray-900 dark:text-slate-100">{kpis.sla.target_hours_by_priority.low}h</strong>
          </span>
          <span className="ml-auto text-gray-500 dark:text-slate-400">
            Counted from ticket creation. Hover any timer for details.
          </span>
        </div>
      )}

      {/* Next Actions banner — only when items are pending */}
      {!nextLoading && nextActions?.total > 0 && (
        <SectionCard
          title="Next Actions"
          subtitle="What needs your attention right now"
          right={
            <span className="badge bg-amber-50 text-amber-700 dark:bg-amber-500/10 dark:text-amber-400 font-semibold">
              {nextActions.total} pending
            </span>
          }
          className="mb-6"
        >
          <NextActions data={nextActions} compact />
        </SectionCard>
      )}

      {/* Priority Queue + Activity */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-6">
        <SectionCard
          id="queue"
          title="Priority Queue"
          subtitle="Highest priority + closest to SLA breach first"
          right={
            <div className="inline-flex items-center gap-1 p-1 rounded-lg bg-gray-100 dark:bg-slate-800 text-xs">
              {FILTERS.map((f) => (
                <button
                  key={f.id}
                  onClick={() => setFilter(f.id)}
                  className={`px-2.5 py-1 rounded-md font-medium transition
                    ${filter === f.id
                      ? 'bg-white dark:bg-slate-700 text-gray-900 dark:text-slate-100 shadow-sm'
                      : 'text-gray-500 dark:text-slate-400 hover:text-gray-800 dark:hover:text-slate-200'}`}
                >
                  {f.label}
                </button>
              ))}
            </div>
          }
          className="lg:col-span-2"
        >
          {loading ? (
            <SkeletonList rows={6} />
          ) : (
            <PriorityQueue
              tickets={visibleQueue}
              busyId={busyId}
              onReply={(t) => setReplyTicket(t)}
              onAssign={(t) => setAssignTicket(t)}
              onClose={closeTicket}
            />
          )}
        </SectionCard>

        <SectionCard
          title="Recent Ticket Activity"
          subtitle="Updates on your tickets"
          right={
            <span className="inline-flex items-center gap-1.5 text-[11px] font-medium text-emerald-600 dark:text-emerald-400">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse"></span>
              Live
            </span>
          }
          className="lg:col-span-1"
        >
          {loading ? <SkeletonList rows={6} /> : <TicketActivity items={activity} />}
        </SectionCard>
      </div>

      {/* Modals */}
      <TicketReplyModal
        open={!!replyTicket}
        ticket={replyTicket}
        onClose={() => setReplyTicket(null)}
        onReplied={fetchAll}
      />
      <AssignTicketModal
        open={!!assignTicket}
        ticket={assignTicket}
        onClose={() => setAssignTicket(null)}
        onAssigned={fetchAll}
      />
    </>
  );
}
