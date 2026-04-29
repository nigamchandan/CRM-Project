import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import * as workloadService from '../../services/workloadService';
import Icon from '../ui/Icon.jsx';

/**
 * Compact "who's drowning, who's free" card for managers/admins.
 *
 * Pulls the workload service's engineer-load list and renders the top N rows
 * sorted by load_score. The implicit ranking ("first row = least loaded")
 * is the routing signal — admins triage by scanning top-down.
 *
 * Cap at 6 rows; for the full table the user can drill into /users (a
 * future enhancement could surface a dedicated /workload page).
 */
export default function EngineerLoad({ limit = 6 }) {
  const [rows, setRows]       = useState([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr]         = useState(null);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    workloadService.engineerLoad({ limit })
      .then((r) => { if (!cancelled) { setRows(r || []); setErr(null); } })
      .catch((e) => { if (!cancelled) setErr(e); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [limit]);

  if (err) {
    return <p className="text-sm text-gray-500 dark:text-slate-400 text-center py-6">Couldn't load engineer workload.</p>;
  }
  if (loading) {
    return (
      <ul className="space-y-2">
        {Array.from({ length: 4 }).map((_, i) => (
          <li key={i} className="h-9 rounded-md skeleton" />
        ))}
      </ul>
    );
  }
  if (!rows.length) {
    return <p className="text-sm text-gray-500 dark:text-slate-400 text-center py-6">No engineers configured yet.</p>;
  }

  // Highest-load row drives the bar scale so the bars are comparable, not
  // misleadingly full when everyone is light.
  const max = Math.max(1, ...rows.map((r) => Number(r.load_score) || 0));

  return (
    <ul className="space-y-1.5">
      {rows.map((r, idx) => {
        const score = Number(r.load_score) || 0;
        const pct = Math.min(100, Math.round((score / max) * 100));
        const tone = score === 0
          ? 'bg-emerald-400'
          : r.sla_breached > 0
            ? 'bg-rose-500'
            : r.sla_at_risk > 0
              ? 'bg-amber-500'
              : 'bg-brand-500';
        return (
          <li key={r.id} className="flex items-center gap-3 group">
            <span className="w-5 text-[11px] font-mono text-gray-400 dark:text-slate-500 tabular-nums">
              {idx + 1}.
            </span>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2">
                <Link
                  to="/users"
                  className="text-sm font-medium text-gray-800 dark:text-slate-200 truncate hover:text-brand-600 dark:hover:text-brand-400"
                  title={`${r.name}${r.email ? ` · ${r.email}` : ''}`}
                >
                  {r.name}
                </Link>
                {r.team_name && (
                  <span className="text-[10px] text-gray-400 dark:text-slate-500 truncate">{r.team_name}</span>
                )}
              </div>
              <div className="mt-1 h-1.5 rounded-full bg-gray-100 dark:bg-slate-800 overflow-hidden">
                <div className={`h-full ${tone} transition-all`} style={{ width: `${pct}%` }} />
              </div>
            </div>
            <div className="text-right text-[11px] tabular-nums">
              <div className="font-semibold text-gray-700 dark:text-slate-200">{r.open_total}</div>
              <div className="flex items-center gap-1.5 text-gray-400 dark:text-slate-500">
                {r.sla_breached > 0 && (
                  <span className="text-rose-600 dark:text-rose-400" title={`${r.sla_breached} SLA breached`}>
                    <Icon name="clock" className="w-3 h-3 inline" /> {r.sla_breached}
                  </span>
                )}
                {r.sla_breached === 0 && r.sla_at_risk > 0 && (
                  <span className="text-amber-600 dark:text-amber-400" title={`${r.sla_at_risk} near SLA`}>
                    <Icon name="clock" className="w-3 h-3 inline" /> {r.sla_at_risk}
                  </span>
                )}
                {r.high_priority > 0 && (
                  <span title={`${r.high_priority} high priority`}>{r.high_priority}↑</span>
                )}
              </div>
            </div>
          </li>
        );
      })}
    </ul>
  );
}
