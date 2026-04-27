import { Link } from 'react-router-dom';

const ICONS = {
  'ticket.create':  '🎫',
  'ticket.update':  '✏️',
  'ticket.status':  '🔁',
  'ticket.assign':  '👤',
  'ticket.comment': '💬',
  'ticket.delete':  '🗑️',
};

const PRIO_DOT = { high: 'bg-red-500', medium: 'bg-amber-500', low: 'bg-gray-400' };

function humanize(action) {
  return action.replace(/^ticket\./, '').replace(/_/g, ' ');
}

function timeAgo(date) {
  const diff = Math.floor((Date.now() - new Date(date).getTime()) / 1000);
  if (diff < 60)     return 'just now';
  if (diff < 3600)   return `${Math.floor(diff / 60)}m ago`;
  if (diff < 86400)  return `${Math.floor(diff / 3600)}h ago`;
  if (diff < 604800) return `${Math.floor(diff / 86400)}d ago`;
  return new Date(date).toLocaleDateString();
}

export default function TicketActivity({ items = [] }) {
  if (items.length === 0) {
    return (
      <div className="text-center py-10">
        <div className="text-3xl mb-2">📭</div>
        <p className="text-sm text-gray-500 dark:text-slate-400">No ticket activity yet</p>
      </div>
    );
  }

  return (
    <ol className="relative border-s border-gray-100 dark:border-slate-800 ml-3 space-y-4">
      {items.map((a) => (
        <li key={a.id} className="ms-5">
          <span className="absolute -start-3 flex h-6 w-6 items-center justify-center rounded-full bg-white dark:bg-slate-800 border border-gray-200 dark:border-slate-700 text-xs shadow-sm">
            {ICONS[a.action] || '🎫'}
          </span>

          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <div className="text-sm text-gray-800 dark:text-slate-200">
                <span className="font-medium text-gray-900 dark:text-slate-100">{a.user_name || 'System'}</span>{' '}
                <span className="text-gray-500 dark:text-slate-400">{humanize(a.action)}</span>{' '}
                {a.entity_id && (
                  <Link to="/tickets" className="font-medium text-brand-600 dark:text-brand-400 hover:underline">
                    ticket #{a.entity_id}
                  </Link>
                )}
              </div>
              {a.ticket_subject && (
                <div className="text-[11px] text-gray-500 dark:text-slate-400 mt-0.5 flex items-center gap-1.5 truncate">
                  {a.ticket_priority && (
                    <span className={`inline-block w-1.5 h-1.5 rounded-full ${PRIO_DOT[a.ticket_priority] || 'bg-gray-400'}`} />
                  )}
                  <span className="truncate">{a.ticket_subject}</span>
                </div>
              )}
            </div>
            <span className="text-[11px] text-gray-400 dark:text-slate-500 whitespace-nowrap mt-0.5">
              {timeAgo(a.created_at)}
            </span>
          </div>
        </li>
      ))}
    </ol>
  );
}
