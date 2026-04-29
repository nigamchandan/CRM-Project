/* SlaBadge — at-a-glance SLA status pill.
 *
 *  Logic (matches the prompt):
 *    overdue                                   → "Breached"      red
 *    remaining < 20% of total budget OR < 1h   → "Breaching Soon" orange
 *    remaining < 50% of total budget           → "At Risk"        amber
 *    otherwise                                 → null (no badge)
 *
 *  Used in:
 *    - Tickets list rows
 *    - Ticket detail right column
 *    - Dashboard alerts
 *
 *  Inputs:
 *    - dueAt:       ISO string (sla_due_at)
 *    - createdAt:   ISO string (created_at)        — to derive total budget
 *    - status:      string                          — closed/resolved get no badge
 *    - paused:      boolean (sla_paused_at)         — paused stops the badge
 *    - size:        'sm' | 'md'                     — defaults to 'sm'
 *
 *  Returns null when nothing to show, so the call-site can render conditionally.
 */
import { useEffect, useState } from 'react';
import Icon from '../ui/Icon.jsx';

export function getSlaState({ dueAt, createdAt, status, paused }) {
  if (!dueAt || paused) return { tone: null };
  if (status === 'closed' || status === 'resolved') return { tone: null };

  const due   = new Date(dueAt).getTime();
  const start = createdAt ? new Date(createdAt).getTime() : (due - 24 * 3600 * 1000);
  const now   = Date.now();
  const total = Math.max(1, due - start);
  const remaining = due - now;
  const pct = remaining / total; // 1.0 = full budget, 0 = at deadline, <0 = past

  if (remaining < 0)            return { tone: 'breach',   pct, remaining };
  if (pct < 0.20 || remaining < 60 * 60 * 1000)
                                return { tone: 'soon',     pct, remaining };
  if (pct < 0.50)               return { tone: 'risk',     pct, remaining };
  return { tone: 'safe', pct, remaining };
}

const TONE_STYLES = {
  breach: { cls: 'bg-rose-100 text-rose-700 ring-rose-200 dark:bg-rose-500/15 dark:text-rose-300 dark:ring-rose-500/30',     label: 'Breached',       icon: 'bell' },
  soon:   { cls: 'bg-orange-100 text-orange-700 ring-orange-200 dark:bg-orange-500/15 dark:text-orange-300 dark:ring-orange-500/30', label: 'Breaching Soon', icon: 'clock' },
  risk:   { cls: 'bg-amber-100 text-amber-700 ring-amber-200 dark:bg-amber-500/15 dark:text-amber-300 dark:ring-amber-500/30', label: 'At Risk',        icon: 'clock' },
};

export default function SlaBadge({ dueAt, createdAt, status, paused, size = 'sm', live = false }) {
  // Re-render once a minute when `live` is set (for ticket lists), so a row
  // that's about to flip from "At Risk" → "Breaching Soon" updates without
  // a manual refresh.
  const [, setTick] = useState(0);
  useEffect(() => {
    if (!live) return;
    const id = setInterval(() => setTick((n) => n + 1), 60_000);
    return () => clearInterval(id);
  }, [live]);

  const { tone } = getSlaState({ dueAt, createdAt, status, paused });
  if (!tone || tone === 'safe') return null;

  const style = TONE_STYLES[tone];
  const padding = size === 'md' ? 'px-2.5 py-0.5 text-[11px]' : 'px-2 py-0.5 text-[10px]';

  return (
    <span
      className={`inline-flex items-center gap-1 rounded-full ring-1 font-semibold ${padding} ${style.cls}
                  ${tone === 'breach' ? 'animate-pulse' : ''}`}
      title={`SLA ${style.label.toLowerCase()}`}
    >
      <Icon name={style.icon} className="w-3 h-3" />
      {style.label}
    </span>
  );
}
