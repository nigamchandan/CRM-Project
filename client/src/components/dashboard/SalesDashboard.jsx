import { useEffect, useMemo, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import * as reportsService from '../../services/reportsService';
import * as nextActionsService from '../../services/nextActionsService';
import { useAuth } from '../../context/AuthContext.jsx';
import { getSocket } from '../../services/socket';
import KpiCard from './KpiCard.jsx';
import MyPipeline from './MyPipeline.jsx';
import TodaysTasks from './TodaysTasks.jsx';
import NextActions from './NextActions.jsx';
import ActivityFeed from './ActivityFeed.jsx';
import LogCallModal from './LogCallModal.jsx';
import { SkeletonCard, SkeletonBlock, SkeletonList } from '../ui/Skeleton.jsx';
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

export default function SalesDashboard({ previewer }) {
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [logCallOpen, setLogCallOpen] = useState(false);

  const [kpis, setKpis]           = useState(null);
  const [pipeline, setPipeline]   = useState([]);
  const [tasks, setTasks]         = useState(null);
  const [nextActions, setNextActions] = useState(null);
  const [activity, setActivity]   = useState([]);

  // Debounce ref so a flurry of socket events doesn't hammer the API
  const refreshTimer = useRef(null);

  const fetchAll = async () => {
    const [k, p, t, n, a] = await Promise.all([
      reportsService.myDashboard(),
      reportsService.myPipeline({ perStage: 4 }),
      reportsService.myTasks({ upcomingDays: 7 }),
      nextActionsService.get('mine'),
      reportsService.myActivity({ limit: 10 }),
    ]);
    setKpis(k); setPipeline(p); setTasks(t); setNextActions(n); setActivity(a);
  };

  const queueRefresh = () => {
    if (refreshTimer.current) clearTimeout(refreshTimer.current);
    refreshTimer.current = setTimeout(() => { fetchAll().catch(() => {}); }, 350);
  };

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try { await fetchAll(); }
      finally { if (!cancelled) setLoading(false); }
    })();
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Live updates via Socket.io
  useEffect(() => {
    const sock = getSocket();
    if (!sock) return;
    const events = [
      'lead:new', 'lead:update', 'lead:delete',
      'deal:new', 'deal:update', 'deal:delete',
      'task:update',
      'activity:new',
    ];
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

  const wonThisPeriod = useMemo(() => {
    if (!kpis) return null;
    return kpis.deals.won_value;
  }, [kpis]);

  const nextActionCount = nextActions?.total ?? 0;

  return (
    <>
      {/* Header / Greeting */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 mb-6">
        <div>
          <div className="flex items-center gap-3 flex-wrap">
            <h1 className="text-2xl md:text-3xl font-bold text-gray-900 dark:text-slate-100 tracking-tight flex items-center gap-2">
              {greeting}, {user?.name?.split(' ')[0] || 'there'}
              <span className="inline-block animate-[wave_1.6s_ease-in-out_infinite] origin-[70%_70%]">👋</span>
            </h1>
            <span className="inline-flex items-center gap-1 text-[11px] font-semibold px-2.5 py-1 rounded-full bg-emerald-100 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-300 uppercase tracking-wider">
              <Icon name="briefcase" className="w-3 h-3" /> Sales View
            </span>
          </div>
          <p className="text-sm text-gray-500 dark:text-slate-400 mt-1">
            {new Date().toLocaleDateString(undefined, { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' })}
          </p>
        </div>

        {/* Quick actions */}
        <div className="flex items-center gap-2 flex-wrap">
          {previewer}
          <button onClick={() => setLogCallOpen(true)} className="btn-secondary" title="Log a call you just made">
            <Icon name="userCircle" className="w-4 h-4" /> Log Call
          </button>
          <Link to="/leads" className="btn-secondary"><Icon name="target" className="w-4 h-4" /> New Lead</Link>
          <Link to="/deals" className="btn-primary"><Icon name="plus" className="w-4 h-4" /> New Deal</Link>
        </div>
      </div>

      {/* Next-action banner — only when there are pending actions */}
      {!loading && nextActionCount > 0 && (
        <a
          href="#next-actions"
          className="mb-6 p-4 rounded-xl border border-amber-200 dark:border-amber-500/20 bg-gradient-to-r from-amber-50 to-rose-50 dark:from-amber-500/10 dark:to-rose-500/10 flex items-start md:items-center gap-3 flex-col md:flex-row hover:shadow-md transition no-underline"
          style={{ display: 'flex' }}
        >
          <span className="w-9 h-9 rounded-full bg-amber-100 dark:bg-amber-500/20 text-amber-700 dark:text-amber-400 flex items-center justify-center text-lg">
            🔥
          </span>
          <div className="text-sm text-amber-900 dark:text-amber-200 flex-1">
            <span className="font-semibold">{nextActionCount} action{nextActionCount === 1 ? '' : 's'}</span> waiting for you
            {nextActions.rules?.length
              ? <> — {nextActions.rules.map((r) => `${r.count} ${r.title.toLowerCase()}`).join(', ')}.</>
              : '.'}
          </div>
          <span className="text-sm font-medium text-amber-800 dark:text-amber-300 whitespace-nowrap">
            Jump to suggestions →
          </span>
        </a>
      )}

      {/* Personal KPIs */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        {loading || !kpis ? (
          <><SkeletonCard /><SkeletonCard /><SkeletonCard /><SkeletonCard /></>
        ) : (
          <>
            <KpiCard
              label="My Leads" icon="target" accent="amber"
              value={kpis.leads.total.toLocaleString()}
              sublabel={`${kpis.leads.active} active · ${kpis.trends.leads.this_period} new this week`}
              trend={kpis.trends.leads.change_pct}
              to="/leads"
              tooltip="Leads assigned to me"
            />
            <KpiCard
              label="My Pipeline" icon="briefcase" accent="brand"
              value={`$${Number(kpis.deals.value).toLocaleString()}`}
              sublabel={`${kpis.deals.count} open deal${kpis.deals.count === 1 ? '' : 's'}`}
              trend={kpis.trends.deals.change_pct}
              to="/deals"
              tooltip="Deals I own"
            />
            <KpiCard
              label="Revenue Won" icon="dollar" accent="emerald"
              value={`$${Number(wonThisPeriod || 0).toLocaleString()}`}
              sublabel="From your closed-won deals"
              to="/deals"
              tooltip="Won deals — your earnings"
            />
            <KpiCard
              label="My Tasks" icon="checkCircle"
              accent={kpis.tasks.overdue > 0 ? 'rose' : 'purple'}
              value={kpis.tasks.pending.toLocaleString()}
              sublabel={kpis.tasks.overdue > 0
                ? `${kpis.tasks.overdue} overdue · needs attention`
                : `${kpis.tasks.total} total assigned`}
              to="/tasks"
              tooltip="Tasks assigned to me"
            />
          </>
        )}
      </div>

      {/* My Pipeline (mini Kanban) — full width */}
      <SectionCard
        title="My Pipeline"
        subtitle="Quick view of your deals by stage. Click a card to see details."
        right={
          <Link to="/deals" className="text-xs font-medium text-brand-600 dark:text-brand-400 hover:underline whitespace-nowrap">
            Open full pipeline →
          </Link>
        }
        className="mb-6"
      >
        {loading ? <SkeletonBlock h={180} /> : <MyPipeline stages={pipeline} />}
      </SectionCard>

      {/* Tasks + Next Actions side-by-side */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-6">
        {/* Today's tasks */}
        <SectionCard
          title="Today's Tasks"
          subtitle="Your follow-ups for today"
          right={
            tasks && (tasks.overdue.length > 0) ? (
              <span className="badge bg-red-50 text-red-700 dark:bg-red-500/10 dark:text-red-400 font-semibold">
                {tasks.overdue.length} overdue
              </span>
            ) : null
          }
          className="lg:col-span-1"
        >
          {loading ? <SkeletonList rows={5} /> : <TodaysTasks data={tasks} onChanged={fetchAll} />}
        </SectionCard>

        {/* Next Actions Engine */}
        <SectionCard
          id="next-actions"
          title="Next Actions"
          subtitle="Smart suggestions based on your activity"
          right={
            nextActionCount > 0 && (
              <span className="badge bg-amber-50 text-amber-700 dark:bg-amber-500/10 dark:text-amber-400 font-semibold">
                {nextActionCount} pending
              </span>
            )
          }
          className="lg:col-span-2"
        >
          {loading ? <SkeletonList rows={6} /> : <NextActions data={nextActions} />}
        </SectionCard>
      </div>

      {/* My recent activity */}
      <SectionCard
        title="My Recent Activity"
        subtitle="Last 10 actions you took"
        right={
          <span className="inline-flex items-center gap-1.5 text-[11px] font-medium text-emerald-600 dark:text-emerald-400">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse"></span>
            Live
          </span>
        }
      >
        {loading ? <SkeletonList rows={6} /> : <ActivityFeed items={activity} />}
      </SectionCard>

      {/* Log call quick-action modal */}
      <LogCallModal
        open={logCallOpen}
        onClose={() => setLogCallOpen(false)}
        onLogged={fetchAll}
      />
    </>
  );
}
