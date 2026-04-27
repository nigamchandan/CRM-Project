import Icon from '../ui/Icon.jsx';

function fmtHours(h) {
  if (!h || h <= 0) return '—';
  if (h < 1) return `${Math.round(h * 60)}m`;
  if (h < 24) return `${h.toFixed(1)}h`;
  return `${(h / 24).toFixed(1)}d`;
}

function ringColor(pct) {
  if (pct >= 80) return '#10b981'; // emerald
  if (pct >= 50) return '#f59e0b'; // amber
  return '#ef4444';                // red
}

export default function SLAPerformance({ data }) {
  if (!data) {
    return <p className="text-sm text-gray-500 dark:text-slate-400 text-center py-8">No ticket data.</p>;
  }
  const pct = Math.max(0, Math.min(100, data.sla_pct || 0));
  const stroke = ringColor(pct);
  const r = 36, c = 2 * Math.PI * r;
  const dash = (pct / 100) * c;

  return (
    <div className="flex items-center gap-5">
      {/* Circular gauge */}
      <div className="relative w-24 h-24 flex-shrink-0">
        <svg viewBox="0 0 90 90" className="w-full h-full -rotate-90">
          <circle cx="45" cy="45" r={r} stroke="currentColor" className="text-gray-100 dark:text-slate-800" strokeWidth="8" fill="none" />
          <circle
            cx="45" cy="45" r={r}
            stroke={stroke}
            strokeWidth="8"
            strokeLinecap="round"
            fill="none"
            strokeDasharray={`${dash} ${c}`}
            style={{ transition: 'stroke-dasharray .6s ease' }}
          />
        </svg>
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <div className="text-xl font-bold text-gray-900 dark:text-slate-100 tabular-nums leading-none">{pct}%</div>
          <div className="text-[10px] text-gray-500 dark:text-slate-400 mt-0.5">in 24h</div>
        </div>
      </div>

      {/* Metrics */}
      <div className="flex-1 grid grid-cols-2 gap-3">
        <Stat label="Total tickets"        value={data.total} />
        <Stat label="Resolved"              value={data.resolved} accent="emerald" />
        <Stat label="Avg resolution"        value={fmtHours(Number(data.avg_resolution_hours))} />
        <Stat
          label="Open >24h"
          value={data.breached_open}
          accent={data.breached_open > 0 ? 'rose' : 'emerald'}
          icon={data.breached_open > 0 ? 'bell' : 'checkCircle'}
        />
      </div>
    </div>
  );
}

function Stat({ label, value, accent = 'gray', icon }) {
  const colors = {
    gray:    'text-gray-900 dark:text-slate-100',
    emerald: 'text-emerald-600 dark:text-emerald-400',
    rose:    'text-rose-600 dark:text-rose-400',
  };
  return (
    <div>
      <div className={`text-lg font-semibold tabular-nums ${colors[accent] || colors.gray} flex items-center gap-1.5`}>
        {icon && <Icon name={icon} className="w-4 h-4" />}
        {value ?? 0}
      </div>
      <div className="text-[11px] text-gray-500 dark:text-slate-400">{label}</div>
    </div>
  );
}
