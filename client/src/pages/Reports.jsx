import { useEffect, useMemo, useState } from 'react';
import toast from 'react-hot-toast';
import * as reportsService from '../services/reportsService';
import * as teamsService   from '../services/teamsService';
import PageHeader from '../components/ui/PageHeader.jsx';
import Icon from '../components/ui/Icon.jsx';
import {
  BarChart, Bar, LineChart, Line, PieChart, Pie, Cell,
  XAxis, YAxis, Tooltip, Legend, CartesianGrid, ResponsiveContainer,
} from 'recharts';

const COLORS = ['#6366f1', '#8b5cf6', '#f59e0b', '#10b981', '#ef4444', '#14b8a6', '#ec4899'];

/* ----- Date helpers (mirror Logs.jsx so dates round-trip cleanly) ------- */
const localDay = (d) => {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
};
const today  = () => localDay(new Date());
const daysAgo = (n) => localDay(new Date(Date.now() - n * 864e5));
const monthsAgo = (n) => {
  const d = new Date();
  d.setMonth(d.getMonth() - n);
  return localDay(d);
};
function toUtc(ymd, which) {
  if (!ymd || !/^\d{4}-\d{2}-\d{2}$/.test(ymd)) return '';
  const [y, m, d] = ymd.split('-').map(Number);
  const local = which === 'end'
    ? new Date(y, m - 1, d, 23, 59, 59, 999)
    : new Date(y, m - 1, d, 0, 0, 0, 0);
  return local.toISOString();
}

/* ----- CSV export utility ----------------------------------------------- */
function downloadCsv(filename, columns, rows) {
  const esc = (v) => {
    if (v === null || v === undefined) return '';
    const s = typeof v === 'object' ? JSON.stringify(v) : String(v);
    return /[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  const lines = [columns.map((c) => c.label).join(',')];
  for (const r of rows) lines.push(columns.map((c) => esc(typeof c.get === 'function' ? c.get(r) : r[c.key])).join(','));
  const blob = new Blob([lines.join('\n')], { type: 'text/csv;charset=utf-8' });
  const url  = URL.createObjectURL(blob);
  const a    = document.createElement('a');
  a.href = url; a.download = filename;
  document.body.appendChild(a); a.click();
  setTimeout(() => { URL.revokeObjectURL(url); a.remove(); }, 100);
}

const QUICK_RANGES = [
  { id: 'all',  label: 'All time' },
  { id: '7d',   label: 'Last 7 days'   },
  { id: '30d',  label: 'Last 30 days'  },
  { id: '90d',  label: 'Last 90 days'  },
  { id: '12m',  label: 'Last 12 months' },
];

/* ====================================================================== */
export default function Reports() {
  const [from, setFrom]     = useState('');
  const [to, setTo]         = useState('');
  const [teamId, setTeamId] = useState('');
  const [quickRange, setQuickRange] = useState('all');

  const [teams, setTeams]   = useState([]);
  const [loading, setLoading] = useState(true);

  const [leads, setLeads] = useState([]);
  const [deals, setDeals] = useState([]);
  const [resolution, setResolution] = useState(null);
  const [trend, setTrend] = useState([]);

  // Drill-down state — only one slice can be expanded at a time.
  const [drill, setDrill] = useState(null); // { kind: 'lead', label, rows } | { kind: 'deal', label, rows }
  const [drillLoading, setDrillLoading] = useState(false);

  /* --- Teams dropdown source --- */
  useEffect(() => {
    teamsService.list().then((r) => setTeams(r || [])).catch(() => {});
  }, []);

  /* --- Build server params --- */
  const apiParams = useMemo(() => ({
    from: toUtc(from, 'start') || undefined,
    to:   toUtc(to,   'end')   || undefined,
    team_id: teamId || undefined,
  }), [from, to, teamId]);

  /* --- Fetch the four primary reports whenever filters change --- */
  useEffect(() => {
    setDrill(null); // any filter change invalidates the open drill-down
    setLoading(true);
    Promise.all([
      reportsService.leadsByStatus(apiParams).catch(() => []),
      reportsService.dealsByStage(apiParams).catch(() => []),
      reportsService.ticketsResolution(apiParams).catch(() => null),
      reportsService.revenueTrend(apiParams).catch(() => []),
    ]).then(([l, d, r, t]) => {
      setLeads(l || []); setDeals(d || []);
      setResolution(r); setTrend(t || []);
    }).finally(() => setLoading(false));
  }, [apiParams]);

  /* --- Quick range chips --- */
  function applyQuick(id) {
    setQuickRange(id);
    if (id === 'all')  { setFrom(''); setTo(''); }
    if (id === '7d')   { setFrom(daysAgo(7));  setTo(today()); }
    if (id === '30d')  { setFrom(daysAgo(30)); setTo(today()); }
    if (id === '90d')  { setFrom(daysAgo(90)); setTo(today()); }
    if (id === '12m')  { setFrom(monthsAgo(12)); setTo(today()); }
  }

  /* --- Drill-down handlers --- */
  async function drillIntoLeadStatus(status) {
    setDrillLoading(true);
    try {
      const rows = await reportsService.leadsForStatus(status, apiParams);
      setDrill({ kind: 'lead', label: status, rows });
    } catch (err) {
      toast.error('Failed to load drill-down');
    } finally { setDrillLoading(false); }
  }
  async function drillIntoDealStage(stage) {
    if (!stage?.id) return;
    setDrillLoading(true);
    try {
      const rows = await reportsService.dealsForStage(stage.id, apiParams);
      setDrill({ kind: 'deal', label: stage.name, rows });
    } catch (err) {
      toast.error('Failed to load drill-down');
    } finally { setDrillLoading(false); }
  }

  /* --- CSV exports per chart --- */
  function exportLeadsCsv() {
    downloadCsv('leads-by-status.csv',
      [{ key: 'status', label: 'Status' }, { key: 'count', label: 'Count' }],
      leads);
  }
  function exportDealsCsv() {
    downloadCsv('deals-by-stage.csv',
      [
        { key: 'name',        label: 'Stage' },
        { key: 'count',       label: 'Count' },
        { key: 'total_value', label: 'Total value' },
      ],
      deals);
  }
  function exportTrendCsv() {
    downloadCsv('revenue-trend.csv',
      [
        { key: 'month',       label: 'Month' },
        { key: 'deals',       label: 'Deals' },
        { key: 'total_value', label: 'Total value' },
      ],
      trend);
  }
  function exportSummaryCsv() {
    if (!resolution) return;
    const rows = [
      { metric: 'Total tickets',           value: resolution.total },
      { metric: 'Open',                    value: resolution.open_count },
      { metric: 'In progress',             value: resolution.in_progress_count },
      { metric: 'Resolved',                value: resolution.resolved_count },
      { metric: 'Closed',                  value: resolution.closed_count },
      { metric: 'Avg resolution (hours)',  value: Number(resolution.avg_resolution_hours).toFixed(2) },
    ];
    downloadCsv('tickets-summary.csv',
      [{ key: 'metric', label: 'Metric' }, { key: 'value', label: 'Value' }], rows);
  }

  const hasFilters = from || to || teamId;

  return (
    <>
      <PageHeader title="Reports & Analytics" subtitle="Insights across your CRM" />

      {/* ---------- Filter bar ---------- */}
      <div className="card p-4 mb-4 space-y-3">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2">
          <select
            className="input"
            value={teamId}
            onChange={(e) => setTeamId(e.target.value)}
          >
            <option value="">All teams</option>
            {teams.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
          </select>
          <input
            type="date"
            className="input"
            value={from}
            onChange={(e) => { setFrom(e.target.value); setQuickRange('custom'); }}
          />
          <input
            type="date"
            className="input"
            value={to}
            onChange={(e) => { setTo(e.target.value); setQuickRange('custom'); }}
          />
          <button className="btn-secondary" onClick={exportSummaryCsv} disabled={!resolution}>
            <Icon name="download" className="w-4 h-4" /> Tickets summary CSV
          </button>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {QUICK_RANGES.map((r) => (
            <button
              key={r.id}
              type="button"
              onClick={() => applyQuick(r.id)}
              className={
                'px-3 py-1.5 rounded-full text-xs font-medium border transition ' +
                (quickRange === r.id
                  ? 'bg-brand-600 text-white border-brand-600'
                  : 'bg-white text-gray-700 border-gray-200 hover:bg-gray-50 dark:bg-slate-900 dark:text-slate-300 dark:border-slate-700 dark:hover:bg-slate-800')
              }
            >
              {r.label}
            </button>
          ))}
          {hasFilters && (
            <button
              type="button"
              className="btn-ghost text-xs ml-auto"
              onClick={() => { setFrom(''); setTo(''); setTeamId(''); setQuickRange('all'); }}
            >
              <Icon name="x" className="w-3.5 h-3.5" /> Clear
            </button>
          )}
        </div>
      </div>

      {/* ---------- KPIs ---------- */}
      {resolution && (
        <div className="grid grid-cols-2 md:grid-cols-5 gap-3 mb-4">
          <div className="card p-4"><div className="text-xs text-gray-500">Total tickets</div><div className="text-xl font-semibold">{resolution.total}</div></div>
          <div className="card p-4"><div className="text-xs text-gray-500">Open</div><div className="text-xl font-semibold text-blue-600">{resolution.open_count}</div></div>
          <div className="card p-4"><div className="text-xs text-gray-500">In progress</div><div className="text-xl font-semibold text-amber-600">{resolution.in_progress_count}</div></div>
          <div className="card p-4"><div className="text-xs text-gray-500">Resolved</div><div className="text-xl font-semibold text-emerald-600">{resolution.resolved_count}</div></div>
          <div className="card p-4"><div className="text-xs text-gray-500">Avg resolution (h)</div><div className="text-xl font-semibold">{Number(resolution.avg_resolution_hours).toFixed(1)}</div></div>
        </div>
      )}

      {/* ---------- Charts ---------- */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <ChartCard
          title="Leads by status"
          hint="Click a slice to list its leads"
          onExport={leads.length ? exportLeadsCsv : null}
        >
          <div style={{ height: 280 }}>
            <ResponsiveContainer>
              <PieChart>
                <Pie
                  data={leads} dataKey="count" nameKey="status" outerRadius={90} label
                  onClick={(slice) => slice?.status && drillIntoLeadStatus(slice.status)}
                  cursor="pointer"
                >
                  {leads.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                </Pie>
                <Legend /><Tooltip />
              </PieChart>
            </ResponsiveContainer>
          </div>
          {drill?.kind === 'lead' && (
            <DrillTable
              kind="lead"
              label={drill.label}
              loading={drillLoading}
              rows={drill.rows}
              onClose={() => setDrill(null)}
            />
          )}
        </ChartCard>

        <ChartCard
          title="Deals by stage (count)"
          hint="Click a bar to list its deals"
          onExport={deals.length ? exportDealsCsv : null}
        >
          <div style={{ height: 280 }}>
            <ResponsiveContainer>
              <BarChart data={deals}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f3f4f6" />
                <XAxis dataKey="name" tick={{ fontSize: 12 }} />
                <YAxis tick={{ fontSize: 12 }} /><Tooltip />
                <Bar
                  dataKey="count" fill="#8b5cf6" radius={[6, 6, 0, 0]}
                  onClick={(d) => drillIntoDealStage(d?.payload || d)}
                  cursor="pointer"
                />
              </BarChart>
            </ResponsiveContainer>
          </div>
          {drill?.kind === 'deal' && (
            <DrillTable
              kind="deal"
              label={drill.label}
              loading={drillLoading}
              rows={drill.rows}
              onClose={() => setDrill(null)}
            />
          )}
        </ChartCard>

        <ChartCard
          title="Revenue trend"
          hint={hasFilters ? 'Range applied' : 'Last 12 months by default'}
          onExport={trend.length ? exportTrendCsv : null}
          className="lg:col-span-2"
        >
          <div style={{ height: 300 }}>
            <ResponsiveContainer>
              <LineChart data={trend}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f3f4f6" />
                <XAxis dataKey="month" tick={{ fontSize: 12 }} />
                <YAxis tick={{ fontSize: 12 }} /><Tooltip />
                <Line type="monotone" dataKey="total_value" stroke="#10b981" strokeWidth={2} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </ChartCard>
      </div>

      {loading && (
        <div className="text-center text-xs text-gray-500 dark:text-slate-400 mt-3">
          Refreshing reports…
        </div>
      )}
    </>
  );
}

/* ====================================================================== */
function ChartCard({ title, hint, onExport, children, className = '' }) {
  return (
    <div className={`card p-5 ${className}`}>
      <div className="flex items-center justify-between gap-3 mb-3">
        <div className="min-w-0">
          <h3 className="font-semibold">{title}</h3>
          {hint && <p className="text-[11px] text-gray-500 dark:text-slate-400">{hint}</p>}
        </div>
        {onExport && (
          <button
            type="button"
            onClick={onExport}
            className="btn-ghost !py-1 !px-2 text-xs"
            title="Download as CSV"
          >
            <Icon name="download" className="w-3.5 h-3.5" /> CSV
          </button>
        )}
      </div>
      {children}
    </div>
  );
}

function DrillTable({ kind, label, loading, rows, onClose }) {
  return (
    <div className="mt-4 border-t border-gray-100 dark:border-slate-800 pt-3">
      <div className="flex items-center justify-between mb-2">
        <div className="text-xs font-semibold uppercase tracking-wider text-gray-500 dark:text-slate-400">
          {kind === 'lead' ? 'Leads' : 'Deals'} in “{label}” {rows ? `· ${rows.length}` : ''}
        </div>
        <button onClick={onClose} className="text-xs text-gray-500 hover:text-gray-800 dark:text-slate-400 dark:hover:text-slate-200">
          Close ✕
        </button>
      </div>
      {loading ? (
        <div className="text-xs text-gray-400 py-4 text-center">Loading…</div>
      ) : rows && rows.length > 0 ? (
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead>
              <tr className="text-left text-gray-500 dark:text-slate-400 border-b border-gray-100 dark:border-slate-800">
                <th className="py-1.5 pr-3">{kind === 'lead' ? 'Lead' : 'Deal'}</th>
                <th className="py-1.5 pr-3">Owner</th>
                <th className="py-1.5 pr-3 text-right">Value</th>
                <th className="py-1.5">Created</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.id} className="border-b border-gray-50 dark:border-slate-900 last:border-0">
                  <td className="py-1.5 pr-3 font-medium text-gray-800 dark:text-slate-200">
                    {kind === 'lead' ? (r.name + (r.company ? ` · ${r.company}` : '')) : r.title}
                  </td>
                  <td className="py-1.5 pr-3 text-gray-500 dark:text-slate-400">{r.owner_name || '—'}</td>
                  <td className="py-1.5 pr-3 text-right tabular-nums">
                    {r.value != null ? `$${Number(r.value).toLocaleString()}` : '—'}
                  </td>
                  <td className="py-1.5 text-gray-500 dark:text-slate-400">
                    {new Date(r.created_at).toLocaleDateString()}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <div className="text-xs text-gray-400 py-4 text-center">No records in this slice.</div>
      )}
    </div>
  );
}
