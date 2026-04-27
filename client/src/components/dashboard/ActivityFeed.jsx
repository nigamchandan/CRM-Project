const ICONS = {
  'lead.create': '🎯', 'lead.update': '🎯', 'lead.assign': '🎯', 'lead.status': '🎯', 'lead.delete': '🗑️',
  'deal.create': '💼', 'deal.update': '💼', 'deal.move_stage': '🔀', 'deal.delete': '🗑️',
  'ticket.create': '🎫', 'ticket.update': '🎫', 'ticket.comment': '💬', 'ticket.status': '🎫', 'ticket.assign': '🎫', 'ticket.delete': '🗑️',
  'task.create': '✅', 'task.update': '✅', 'task.complete': '✔️', 'task.delete': '🗑️',
  'contact.create': '👤', 'contact.update': '👤', 'contact.delete': '🗑️',
  'user.create': '🧑‍💼', 'user.update': '🧑‍💼', 'auth.login': '🔐', 'auth.register': '🆕', 'auth.logout': '🚪',
};

function humanize(action) {
  return action.replace(/\./g, ' ').replace(/_/g, ' ');
}

function timeAgo(date) {
  const diff = Math.floor((Date.now() - new Date(date).getTime()) / 1000);
  if (diff < 60)      return 'just now';
  if (diff < 3600)    return `${Math.floor(diff / 60)}m ago`;
  if (diff < 86400)   return `${Math.floor(diff / 3600)}h ago`;
  if (diff < 604800)  return `${Math.floor(diff / 86400)}d ago`;
  return new Date(date).toLocaleDateString();
}

export default function ActivityFeed({ items = [] }) {
  if (items.length === 0) {
    return (
      <div className="text-center py-10">
        <div className="text-3xl mb-2">🕐</div>
        <p className="text-sm text-gray-500 dark:text-slate-400">No recent activity</p>
      </div>
    );
  }

  return (
    <ol className="relative border-s border-gray-100 dark:border-slate-800 ml-3 space-y-4">
      {items.map((a) => (
        <li key={a.id} className="ms-5">
          <span className="absolute -start-3 flex h-6 w-6 items-center justify-center rounded-full bg-white dark:bg-slate-800 border border-gray-200 dark:border-slate-700 text-xs shadow-sm">
            {ICONS[a.action] || '•'}
          </span>
          <div className="flex items-center justify-between">
            <div className="text-sm text-gray-800 dark:text-slate-200">
              <span className="font-medium text-gray-900 dark:text-slate-100">{a.user_name || 'System'}</span>{' '}
              <span className="text-gray-500 dark:text-slate-400">{humanize(a.action)}</span>
              {a.entity && (
                <span className="text-gray-500 dark:text-slate-400"> on {a.entity}{a.entity_id ? ` #${a.entity_id}` : ''}</span>
              )}
            </div>
            <span className="text-[11px] text-gray-400 dark:text-slate-500 whitespace-nowrap ml-2">
              {timeAgo(a.created_at)}
            </span>
          </div>
        </li>
      ))}
    </ol>
  );
}
