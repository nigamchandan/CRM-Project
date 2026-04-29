/* SlaCountdown — full-fidelity, live-ticking SLA display for the ticket
 * detail right rail.
 *
 *  Visual layers (top-to-bottom):
 *    1. Status banner    — color-coded ribbon with the headline state
 *                          (Healthy / At Risk / Breaching Soon / Breached).
 *    2. Big countdown    — HH:MM:SS, auto-flips to days when > 99h.
 *    3. Progress bar     — fills from 100% (just created) to 0% (deadline)
 *                          with a green→amber→red gradient.
 *    4. Deadline footer  — absolute timestamp + "X minutes overdue".
 *
 *  Re-renders every second when remaining time is < 1h (so the seconds tick),
 *  every 30s otherwise — saves render churn for tickets with days left.
 */
import { useEffect, useMemo, useState } from 'react';
import Icon from '../ui/Icon.jsx';
import { getSlaState } from './SlaBadge.jsx';

export default function SlaCountdown({ ticket }) {
  const dueAt    = ticket?.sla_due_at;
  const startAt  = ticket?.created_at;
  const status   = ticket?.status;
  const paused   = !!ticket?.sla_paused_at;

  const [now, setNow] = useState(() => Date.now());
  const remainingApprox = dueAt ? new Date(dueAt).getTime() - now : 0;
  const interval = Math.abs(remainingApprox) < 3600 * 1000 ? 1000 : 30_000;

  useEffect(() => {
    if (!dueAt) return;
    const id = setInterval(() => setNow(Date.now()), interval);
    return () => clearInterval(id);
  }, [dueAt, interval]);

  const state = useMemo(
    () => getSlaState({ dueAt, createdAt: startAt, status, paused }),
    [dueAt, startAt, status, paused, now] // eslint-disable-line react-hooks/exhaustive-deps
  );

  if (!dueAt) {
    return (
      <div className="text-xs text-gray-500 dark:text-slate-400 text-center py-4">
        No SLA target set for this ticket.
      </div>
    );
  }

  if (status === 'closed' || status === 'resolved') {
    return (
      <div className="rounded-lg border border-emerald-200 dark:border-emerald-500/30
                      bg-emerald-50 dark:bg-emerald-500/10 px-3 py-2.5">
        <div className="flex items-center gap-2 text-sm font-semibold text-emerald-700 dark:text-emerald-300">
          <Icon name="checkCircle" className="w-4 h-4" /> Resolved within SLA
        </div>
        <div className="text-[11px] text-emerald-700/80 dark:text-emerald-300/80 mt-0.5">
          SLA was set for {fmtDateTime(dueAt)}.
        </div>
      </div>
    );
  }

  if (paused) {
    return (
      <div className="rounded-lg border border-slate-200 dark:border-slate-700 px-3 py-2.5">
        <div className="flex items-center gap-2 text-sm font-semibold text-slate-700 dark:text-slate-200">
          <Icon name="clock" className="w-4 h-4" /> SLA paused
        </div>
        <div className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">
          Timer resumes when the ticket leaves the paused stage.
        </div>
      </div>
    );
  }

  const remaining = new Date(dueAt).getTime() - now;
  const tone = state.tone || 'safe';

  const TONE = {
    safe:   { fill: 'bg-emerald-500',   text: 'text-emerald-600 dark:text-emerald-300',   bg: 'bg-emerald-50 dark:bg-emerald-500/10',  border: 'border-emerald-200 dark:border-emerald-500/30',  label: 'Healthy', icon: 'checkCircle' },
    risk:   { fill: 'bg-amber-500',     text: 'text-amber-600 dark:text-amber-300',       bg: 'bg-amber-50 dark:bg-amber-500/10',      border: 'border-amber-200 dark:border-amber-500/30',      label: 'At Risk', icon: 'clock' },
    soon:   { fill: 'bg-orange-500',    text: 'text-orange-600 dark:text-orange-300',     bg: 'bg-orange-50 dark:bg-orange-500/10',    border: 'border-orange-200 dark:border-orange-500/30',    label: 'Breaching Soon', icon: 'bell' },
    breach: { fill: 'bg-rose-500',      text: 'text-rose-600 dark:text-rose-300',         bg: 'bg-rose-50 dark:bg-rose-500/10',        border: 'border-rose-200 dark:border-rose-500/40',        label: 'Breached', icon: 'bell' },
  };
  const t = TONE[tone];
  const pctFilled = Math.max(0, Math.min(100, (state.pct || 0) * 100));

  return (
    <div className={`rounded-xl border-2 ${t.border} ${t.bg} p-3.5`}>
      {/* Status row */}
      <div className="flex items-start justify-between gap-3">
        <div>
          <div className={`inline-flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-wider ${t.text}`}>
            <Icon name={t.icon} className={`w-3.5 h-3.5 ${tone === 'breach' ? 'animate-pulse' : ''}`} />
            {t.label}
          </div>
          <div className="text-[11px] text-gray-500 dark:text-slate-400 mt-0.5">
            Due {fmtDateTime(dueAt)}
          </div>
        </div>
        <div className="text-right">
          <div className="text-[10px] uppercase tracking-wider font-semibold text-gray-500 dark:text-slate-400">
            {remaining < 0 ? 'Overdue' : 'Remaining'}
          </div>
          <div className={`mt-0.5 font-mono text-xl font-semibold tabular-nums tracking-tight ${t.text}`}>
            {formatDuration(Math.abs(remaining))}
          </div>
        </div>
      </div>

      {/* Progress bar */}
      <div className="mt-3 h-2 rounded-full bg-white/60 dark:bg-slate-900/40 overflow-hidden">
        <div
          className={`h-full ${t.fill} transition-all duration-700`}
          style={{ width: `${remaining < 0 ? 100 : pctFilled}%` }}
        />
      </div>
      <div className="flex items-center justify-between mt-1.5 text-[10px] uppercase tracking-wider text-gray-500 dark:text-slate-500">
        <span>Created {fmtDateTime(startAt)}</span>
        <span>{remaining < 0 ? `Overdue by ${humanMinutes(-remaining)}` : `${Math.round(pctFilled)}% time left`}</span>
      </div>
    </div>
  );
}

function pad(n) { return String(n).padStart(2, '0'); }

function formatDuration(ms) {
  const total = Math.floor(ms / 1000);
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = total % 60;
  if (h >= 100) {
    const d  = Math.floor(h / 24);
    const hr = h % 24;
    return `${d}d ${pad(hr)}h`;
  }
  return `${pad(h)}:${pad(m)}:${pad(s)}`;
}

function humanMinutes(ms) {
  const m = Math.round(ms / 60000);
  if (m < 60) return `${m} min`;
  const h = Math.floor(m / 60);
  const rem = m % 60;
  if (h < 24) return `${h}h ${rem}m`;
  const d = Math.floor(h / 24);
  return `${d}d ${h % 24}h`;
}

function fmtDateTime(d) {
  if (!d) return '—';
  return new Date(d).toLocaleString(undefined, {
    day: '2-digit', month: 'short',
    hour: '2-digit', minute: '2-digit',
  });
}
