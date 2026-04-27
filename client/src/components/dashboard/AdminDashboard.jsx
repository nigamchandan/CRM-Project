import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  XAxis, YAxis, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell, Legend, CartesianGrid, Area, AreaChart,
} from 'recharts';
import * as reportsService from '../../services/reportsService';
import { useAuth } from '../../context/AuthContext.jsx';
import { useTheme } from '../../context/ThemeContext.jsx';
import useNextActions from '../../hooks/useNextActions';
import KpiCard from './KpiCard.jsx';
import ActivityFeed from './ActivityFeed.jsx';
import UpcomingTasks from './UpcomingTasks.jsx';
import SalesFunnel from './SalesFunnel.jsx';
import TeamPerformance from './TeamPerformance.jsx';
import SLAPerformance from './SLAPerformance.jsx';
import AlertsPanel from './AlertsPanel.jsx';
import NextActions from './NextActions.jsx';
import { SkeletonCard, SkeletonBlock, SkeletonList } from '../ui/Skeleton.jsx';
import Icon from '../ui/Icon.jsx';

const PIE_COLORS = ['#6366f1', '#8b5cf6', '#f59e0b', '#10b981', '#ef4444', '#14b8a6', '#ec4899'];

function SectionCard({ title, subtitle, right, children, className = '' }) {
  return (
    <div className={`card p-5 ${className}`}>
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

export default function AdminDashboard({ previewer }) {
  const { user } = useAuth();
  const { isDark } = useTheme();
  const [loading, setLoading] = useState(true);

  // Cross-team next actions (admins/managers can see unassigned items)
  const { data: nextActions, loading: nextLoading } = useNextActions({ scope: 'team' });

  // Existing data
  const [stats, setStats]       = useState(null);
  const [leads, setLeads]       = useState([]);
  const [trend, setTrend]       = useState([]);
  const [activity, setActivity] = useState([]);
  const [tasks, setTasks]       = useState([]);
  const [funnel, setFunnel]     = useState([]);

  // New: admin-only data
  const [team, setTeam]         = useState([]);
  const [sla, setSla]           = useState(null);
  const [alerts, setAlerts]     = useState(null);
  const [alertTab, setAlertTab] = useState('overdue_tasks');

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const [s, l, t, a, u, f, tp, sl, al] = await Promise.all([
          reportsService.dashboard(),
          reportsService.leadsByStatus(),
          reportsService.revenueTrend(),
          reportsService.recentActivity({ limit: 8 }),
          reportsService.upcomingTasks({ limit: 6 }),
          reportsService.salesFunnel(),
          reportsService.teamPerformance({ limit: 5 }),
          reportsService.slaPerformance(),
          reportsService.alerts(),
        ]);
        if (cancelled) return;
        setStats(s); setLeads(l); setTrend(t);
        setActivity(a); setTasks(u); setFunnel(f);
        setTeam(tp); setSla(sl); setAlerts(al);
      } finally { if (!cancelled) setLoading(false); }
    })();
    return () => { cancelled = true; };
  }, []);

  const greeting = useMemo(() => {
    const h = new Date().getHours();
    if (h < 12) return 'Good morning';
    if (h < 18) return 'Good afternoon';
    return 'Good evening';
  }, []);

  // Theme-aware chart colors
  const chartTheme = useMemo(() => ({
    grid:          isDark ? '#1e293b' : '#f1f5f9',
    axis:          isDark ? '#64748b' : '#94a3b8',
    tooltipBg:     isDark ? '#1e293b' : '#ffffff',
    tooltipBorder: isDark ? '#334155' : '#e5e7eb',
    tooltipText:   isDark ? '#e2e8f0' : '#0f172a',
  }), [isDark]);

  const tooltipStyle = {
    backgroundColor: chartTheme.tooltipBg,
    border: `1px solid ${chartTheme.tooltipBorder}`,
    borderRadius: 10,
    fontSize: 12,
    color: chartTheme.tooltipText,
    boxShadow: '0 4px 12px rgba(0,0,0,0.08)',
  };

  // Highest-impact alert count for the header banner
  const alertCount = alerts?.counts
    ? (alerts.counts.overdue_tasks || 0) + (alerts.counts.high_priority_tickets || 0) + (alerts.counts.stuck_deals || 0)
    : 0;

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
            <span className="inline-flex items-center gap-1 text-[11px] font-semibold px-2.5 py-1 rounded-full bg-brand-100 text-brand-700 dark:bg-brand-500/15 dark:text-brand-300 uppercase tracking-wider">
              <Icon name="spark" className="w-3 h-3" /> Admin View
            </span>
          </div>
          <p className="text-sm text-gray-500 dark:text-slate-400 mt-1">
            {new Date().toLocaleDateString(undefined, { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' })}
          </p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          {previewer}
          <Link to="/leads" className="btn-secondary">
            <Icon name="target" className="w-4 h-4" /> New Lead
          </Link>
          <Link to="/deals" className="btn-primary">
            <Icon name="plus" className="w-4 h-4" /> Add Deal
          </Link>
        </div>
      </div>

      {/* Alert banner */}
      {!loading && alertCount > 0 && (
        <div className="mb-6 p-4 rounded-xl border border-amber-200 dark:border-amber-500/20 bg-amber-50 dark:bg-amber-500/10 flex items-start md:items-center gap-3 flex-col md:flex-row">
          <div className="flex items-center gap-3 flex-1 min-w-0">
            <span className="w-9 h-9 rounded-full bg-amber-100 dark:bg-amber-500/20 text-amber-700 dark:text-amber-400 flex items-center justify-center">
              <Icon name="bell" className="w-5 h-5" />
            </span>
            <div className="text-sm text-amber-900 dark:text-amber-200">
              <span className="font-semibold">{alertCount} item{alertCount === 1 ? '' : 's'}</span> need your attention —
              {' '}{alerts.counts.overdue_tasks} overdue task{alerts.counts.overdue_tasks === 1 ? '' : 's'},
              {' '}{alerts.counts.high_priority_tickets} high-priority ticket{alerts.counts.high_priority_tickets === 1 ? '' : 's'},
              {' '}{alerts.counts.stuck_deals} stuck deal{alerts.counts.stuck_deals === 1 ? '' : 's'}.
            </div>
          </div>
          <a href="#alerts" className="text-sm font-medium text-amber-800 dark:text-amber-300 hover:underline whitespace-nowrap">
            Review now →
          </a>
        </div>
      )}

      {/* Primary KPI cards (clickable) */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        {loading || !stats ? (
          <><SkeletonCard /><SkeletonCard /><SkeletonCard /><SkeletonCard /></>
        ) : (
          <>
            <KpiCard
              label="Total Leads" icon="target" accent="amber"
              value={stats.leads.toLocaleString()}
              sublabel={`${stats.trends.leads.this_period} this week`}
              trend={stats.trends.leads.change_pct}
              to="/leads"
              tooltip="View all leads"
            />
            <KpiCard
              label="Deals Value" icon="briefcase" accent="brand"
              value={`$${Number(stats.deals.value).toLocaleString()}`}
              sublabel={`${stats.deals.count} active deals`}
              trend={stats.trends.deals.change_pct}
              to="/deals"
              tooltip="View pipeline"
            />
            <KpiCard
              label="Revenue Won" icon="trendingUp" accent="emerald"
              value={`$${Number(stats.deals.won_value).toLocaleString()}`}
              sublabel="Closed / Won stage"
              to="/deals"
              tooltip="View won deals"
            />
            <KpiCard
              label="Open Tickets" icon="ticket" accent="rose"
              value={stats.tickets.open.toLocaleString()}
              sublabel={`${stats.tickets.total} total tickets`}
              trend={stats.trends.tickets.change_pct}
              to="/tickets?status=open"
              tooltip="View open tickets"
            />
          </>
        )}
      </div>

      {/* Secondary stats — compact strip */}
      {!loading && stats && (
        <div className="card p-5 mb-6">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-y-4 divide-x divide-gray-100 dark:divide-slate-800">
            <SecondaryStat to="/contacts" icon="users"      accent="purple"  label="Contacts"      value={stats.contacts} />
            <SecondaryStat to="/users"    icon="userCircle" accent="cyan"    label="Active Users"  value={stats.users} />
            <SecondaryStat to="/tasks"    icon="checkCircle" accent="amber"  label="Pending Tasks" value={stats.tasks.pending} sub={`${stats.tasks.total} total`} />
            <SecondaryStat to="/deals"    icon="chartBar"   accent="brand"   label="Active Deals"  value={stats.deals.count} />
          </div>
        </div>
      )}

      {/* Charts row */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 mb-6">
        <SectionCard
          className="lg:col-span-2"
          title="Revenue Trend"
          subtitle="Deal value over the last 12 months"
          right={
            <span className="text-[11px] font-medium px-2 py-1 rounded-full bg-emerald-50 text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-400">
              Last 12 months
            </span>
          }
        >
          {loading ? <SkeletonBlock h={280} className="!p-0 !shadow-none !border-0" /> : (
            <div style={{ height: 280 }}>
              <ResponsiveContainer>
                <AreaChart data={trend} margin={{ top: 10, right: 10, left: -10, bottom: 0 }}>
                  <defs>
                    <linearGradient id="revGrad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="#6366f1" stopOpacity={isDark ? 0.55 : 0.4} />
                      <stop offset="100%" stopColor="#6366f1" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke={chartTheme.grid} vertical={false} />
                  <XAxis dataKey="month" tick={{ fontSize: 12, fill: chartTheme.axis }} axisLine={false} tickLine={false} />
                  <YAxis tick={{ fontSize: 12, fill: chartTheme.axis }} axisLine={false} tickLine={false} />
                  <Tooltip
                    contentStyle={tooltipStyle}
                    cursor={{ stroke: chartTheme.grid }}
                    formatter={(v) => [`$${Number(v).toLocaleString()}`, 'Revenue']}
                  />
                  <Area type="monotone" dataKey="total_value" stroke="#6366f1" strokeWidth={2.5} fill="url(#revGrad)" />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          )}
        </SectionCard>

        <SectionCard title="Leads by Status" subtitle="Distribution of current leads">
          {loading ? <SkeletonBlock h={280} className="!p-0 !shadow-none !border-0" /> : (
            <div style={{ height: 280 }}>
              <ResponsiveContainer>
                <PieChart>
                  <Pie
                    data={leads}
                    dataKey="count"
                    nameKey="status"
                    innerRadius={50}
                    outerRadius={84}
                    paddingAngle={3}
                    stroke={isDark ? '#0f172a' : '#ffffff'}
                    strokeWidth={2}
                  >
                    {leads.map((_, i) => <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />)}
                  </Pie>
                  <Legend iconSize={8} wrapperStyle={{ fontSize: 12, color: chartTheme.axis }} />
                  <Tooltip contentStyle={tooltipStyle} />
                </PieChart>
              </ResponsiveContainer>
            </div>
          )}
        </SectionCard>
      </div>

      {/* Team performance + SLA performance */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 mb-6">
        <SectionCard
          title="Team Performance"
          subtitle="Top contributors by deals, leads & tickets"
          className="lg:col-span-2"
          right={<Link to="/users" className="text-xs font-medium text-brand-600 dark:text-brand-400 hover:underline">View all →</Link>}
        >
          {loading ? <SkeletonList rows={5} /> : <TeamPerformance items={team} />}
        </SectionCard>

        <SectionCard
          title="Ticket SLA"
          subtitle="Target: resolve within 24h"
          right={<Link to="/tickets" className="text-xs font-medium text-brand-600 dark:text-brand-400 hover:underline">Tickets →</Link>}
        >
          {loading ? <SkeletonBlock h={140} className="!p-0 !shadow-none !border-0" /> : <SLAPerformance data={sla} />}
        </SectionCard>
      </div>

      {/* Alerts panel + Next actions (team) */}
      <div id="alerts" className="grid grid-cols-1 lg:grid-cols-3 gap-4 mb-6">
        <SectionCard
          title="Needs Attention"
          subtitle="Items that may be slipping through the cracks"
          right={
            <span className="text-[11px] font-medium px-2 py-1 rounded-full bg-amber-50 text-amber-700 dark:bg-amber-500/10 dark:text-amber-400">
              Live
            </span>
          }
          className="lg:col-span-2"
        >
          {loading ? <SkeletonList rows={4} /> : (
            <AlertsPanel data={alerts} activeTab={alertTab} onTab={setAlertTab} />
          )}
        </SectionCard>

        <SectionCard
          title="Next Actions"
          subtitle="Smart suggestions for the team"
          right={
            nextActions?.total > 0 && (
              <span className="badge bg-amber-50 text-amber-700 dark:bg-amber-500/10 dark:text-amber-400 font-semibold">
                {nextActions.total} pending
              </span>
            )
          }
        >
          {nextLoading ? <SkeletonList rows={5} /> : <NextActions data={nextActions} compact />}
        </SectionCard>
      </div>

      {/* Funnel + Tasks */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 mb-6">
        <SectionCard title="Sales Funnel" subtitle="Deals distribution across stages" className="lg:col-span-2">
          {loading ? <SkeletonList rows={5} /> : <SalesFunnel stages={funnel} />}
        </SectionCard>

        <SectionCard
          title="Upcoming Tasks"
          subtitle="Your team's next actions"
          right={<Link to="/tasks" className="text-xs font-medium text-brand-600 dark:text-brand-400 hover:underline">All tasks →</Link>}
        >
          {loading ? <SkeletonList rows={5} /> : <UpcomingTasks items={tasks} />}
        </SectionCard>
      </div>

      <SectionCard title="Recent Activity" subtitle="Latest changes across your CRM">
        {loading ? <SkeletonList rows={6} /> : <ActivityFeed items={activity} />}
      </SectionCard>

      <style>{`
        @keyframes wave {
          0%, 60%, 100% { transform: rotate(0deg); }
          10%, 30% { transform: rotate(14deg); }
          20%      { transform: rotate(-8deg); }
          40%      { transform: rotate(-4deg); }
          50%      { transform: rotate(10deg); }
        }
      `}</style>
    </>
  );
}

function SecondaryStat({ icon, label, value, sub, accent = 'brand', to }) {
  const colors = {
    brand:   'text-brand-600 dark:text-brand-400 bg-brand-50 dark:bg-brand-500/10',
    purple:  'text-purple-600 dark:text-purple-400 bg-purple-50 dark:bg-purple-500/10',
    amber:   'text-amber-600 dark:text-amber-400 bg-amber-50 dark:bg-amber-500/10',
    cyan:    'text-cyan-600 dark:text-cyan-400 bg-cyan-50 dark:bg-cyan-500/10',
  };

  const inner = (
    <>
      <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${colors[accent]}`}>
        <Icon name={icon} className="w-5 h-5" strokeWidth={2} />
      </div>
      <div className="min-w-0">
        <div className="text-xl font-bold text-gray-900 dark:text-slate-100 leading-tight tabular-nums">{value}</div>
        <div className="text-xs text-gray-500 dark:text-slate-400">{label}</div>
        {sub && <div className="text-[10px] text-gray-400 dark:text-slate-500">{sub}</div>}
      </div>
    </>
  );

  const baseCls = 'px-5 first:pl-0 flex items-center gap-3 rounded-md transition-colors';
  if (to) {
    return <Link to={to} className={`${baseCls} hover:bg-gray-50 dark:hover:bg-slate-800/40 -mx-1 px-6`}>{inner}</Link>;
  }
  return <div className={baseCls}>{inner}</div>;
}
