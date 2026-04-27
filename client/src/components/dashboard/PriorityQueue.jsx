import { Link } from 'react-router-dom';
import SlaTimer from './SlaTimer.jsx';
import Icon from '../ui/Icon.jsx';

const PRIO_BADGE = {
  high:   { dot: 'bg-red-500',    label: 'bg-red-50 text-red-700 ring-red-100 dark:bg-red-500/10 dark:text-red-400 dark:ring-red-500/20' },
  medium: { dot: 'bg-amber-500',  label: 'bg-amber-50 text-amber-700 ring-amber-100 dark:bg-amber-500/10 dark:text-amber-400 dark:ring-amber-500/20' },
  low:    { dot: 'bg-gray-400',   label: 'bg-gray-50 text-gray-700 ring-gray-100 dark:bg-slate-800 dark:text-slate-300 dark:ring-slate-700' },
};

const STATUS_BADGE = {
  open:        { label: 'Open',        cls: 'bg-blue-50 text-blue-700 dark:bg-blue-500/10 dark:text-blue-400' },
  in_progress: { label: 'In progress', cls: 'bg-purple-50 text-purple-700 dark:bg-purple-500/10 dark:text-purple-400' },
};

export default function PriorityQueue({ tickets = [], onReply, onAssign, onClose, busyId }) {
  if (tickets.length === 0) {
    return (
      <div className="text-center py-12">
        <div className="text-4xl mb-2">🎉</div>
        <p className="text-sm font-medium text-emerald-600 dark:text-emerald-400">Inbox zero</p>
        <p className="text-xs text-gray-500 dark:text-slate-400 mt-1">No active tickets in your queue.</p>
      </div>
    );
  }

  return (
    <ul className="divide-y divide-gray-100 dark:divide-slate-800 -mx-1">
      {tickets.map((t) => {
        const prio = PRIO_BADGE[t.priority] || PRIO_BADGE.medium;
        const stat = STATUS_BADGE[t.status]  || STATUS_BADGE.open;
        const isBusy = busyId === t.id;
        return (
          <li key={t.id} className="px-1 py-3 hover:bg-gray-50/60 dark:hover:bg-slate-800/40 rounded-lg transition">
            <div className="flex items-start gap-3">
              {/* Priority dot */}
              <span className={`mt-1.5 w-2.5 h-2.5 rounded-full flex-shrink-0 ${prio.dot}`} title={`Priority: ${t.priority}`} />

              {/* Body */}
              <div className="flex-1 min-w-0">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <Link
                      to="/tickets"
                      className="text-sm font-medium text-gray-900 dark:text-slate-100 hover:text-brand-600 dark:hover:text-brand-400 line-clamp-1"
                    >
                      {t.ticket_no || `#${t.id}`} · {t.subject}
                    </Link>
                    <div className="text-[11px] text-gray-500 dark:text-slate-400 mt-0.5 flex items-center gap-2 flex-wrap">
                      {t.contact_name && (
                        <span className="inline-flex items-center gap-1">
                          <Icon name="userCircle" className="w-3 h-3" /> {t.contact_name}
                        </span>
                      )}
                      <span className="text-gray-300 dark:text-slate-600">·</span>
                      <span>opened {timeAgo(t.created_at)}</span>
                      {t.comment_count > 0 && (
                        <>
                          <span className="text-gray-300 dark:text-slate-600">·</span>
                          <span className="inline-flex items-center gap-0.5">💬 {t.comment_count}</span>
                        </>
                      )}
                    </div>
                  </div>

                  {/* SLA + status badges */}
                  <div className="flex flex-col items-end gap-1 flex-shrink-0">
                    <SlaTimer remainingMinutes={t.sla_remaining_minutes} slaStatus={t.sla_status} />
                    <span className={`text-[10px] uppercase font-bold px-2 py-0.5 rounded ${stat.cls}`}>
                      {stat.label}
                    </span>
                  </div>
                </div>

                {/* Action row */}
                <div className="flex items-center gap-2 mt-2 flex-wrap">
                  <span className={`text-[10px] uppercase tracking-wide font-semibold px-2 py-0.5 rounded ring-1 ${prio.label}`}>
                    {t.priority}
                  </span>
                  <div className="ml-auto flex items-center gap-1">
                    <button
                      onClick={() => onReply?.(t)}
                      disabled={isBusy}
                      className="text-xs px-2.5 py-1 rounded-md font-medium text-brand-700 dark:text-brand-300 hover:bg-brand-50 dark:hover:bg-brand-500/10 disabled:opacity-50 transition"
                    >
                      💬 Reply
                    </button>
                    <button
                      onClick={() => onAssign?.(t)}
                      disabled={isBusy}
                      className="text-xs px-2.5 py-1 rounded-md font-medium text-gray-700 dark:text-slate-300 hover:bg-gray-100 dark:hover:bg-slate-800 disabled:opacity-50 transition"
                    >
                      👤 Assign
                    </button>
                    <button
                      onClick={() => onClose?.(t)}
                      disabled={isBusy}
                      className="text-xs px-2.5 py-1 rounded-md font-medium text-emerald-700 dark:text-emerald-400 hover:bg-emerald-50 dark:hover:bg-emerald-500/10 disabled:opacity-50 transition"
                    >
                      ✓ Close
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </li>
        );
      })}
    </ul>
  );
}

function timeAgo(date) {
  const diff = Math.floor((Date.now() - new Date(date).getTime()) / 1000);
  if (diff < 60)     return 'just now';
  if (diff < 3600)   return `${Math.floor(diff / 60)}m ago`;
  if (diff < 86400)  return `${Math.floor(diff / 3600)}h ago`;
  if (diff < 604800) return `${Math.floor(diff / 86400)}d ago`;
  return new Date(date).toLocaleDateString();
}
