import { useEffect, useState } from 'react';

// Live countdown chip — recomputes every 30s.
// `slaStatus` is the server-computed status hint, but we trust `remainingMinutes` which we tick down locally.
export default function SlaTimer({ remainingMinutes, slaStatus, size = 'sm' }) {
  const [mins, setMins] = useState(remainingMinutes ?? 0);

  useEffect(() => { setMins(remainingMinutes ?? 0); }, [remainingMinutes]);

  // Tick once a minute (cheap)
  useEffect(() => {
    const id = setInterval(() => setMins((m) => m - 1), 60_000);
    return () => clearInterval(id);
  }, []);

  const breached = mins < 0;
  const status = breached
    ? 'breached'
    : mins < 60
      ? 'critical'
      : slaStatus || 'healthy';

  const palette = {
    breached: 'bg-red-100 text-red-700 border-red-200 dark:bg-red-500/15 dark:text-red-300 dark:border-red-500/30',
    critical: 'bg-amber-100 text-amber-700 border-amber-200 dark:bg-amber-500/15 dark:text-amber-300 dark:border-amber-500/30',
    warning:  'bg-yellow-50 text-yellow-700 border-yellow-200 dark:bg-yellow-500/10 dark:text-yellow-300 dark:border-yellow-500/30',
    healthy:  'bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-500/10 dark:text-emerald-300 dark:border-emerald-500/30',
  };

  const fmt = () => {
    const abs = Math.abs(mins);
    if (abs >= 1440) return `${Math.floor(abs / 1440)}d ${Math.floor((abs % 1440) / 60)}h`;
    if (abs >= 60)   return `${Math.floor(abs / 60)}h ${abs % 60}m`;
    return `${abs}m`;
  };

  const label = breached ? `Breached ${fmt()} ago` : `${fmt()} left`;
  const dot   = breached ? '🔴' : status === 'critical' ? '🟠' : status === 'warning' ? '🟡' : '🟢';

  const sizeCls = size === 'lg' ? 'text-sm px-3 py-1.5' : 'text-[11px] px-2 py-0.5';

  return (
    <span
      className={`inline-flex items-center gap-1.5 font-semibold rounded-full border tabular-nums ${palette[status]} ${sizeCls}`}
      title={breached ? 'SLA breached' : 'Time remaining to respond'}
    >
      <span aria-hidden>{dot}</span>{label}
    </span>
  );
}
