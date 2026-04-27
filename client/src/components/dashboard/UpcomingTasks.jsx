import { Link } from 'react-router-dom';

const PRIORITY_COLORS = {
  high:   'bg-red-50 text-red-700 border-red-200 dark:bg-red-500/10 dark:text-red-400 dark:border-red-500/20',
  medium: 'bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-500/10 dark:text-amber-400 dark:border-amber-500/20',
  low:    'bg-gray-50 text-gray-700 border-gray-200 dark:bg-slate-800 dark:text-slate-300 dark:border-slate-700',
};

function dueLabel(due) {
  if (!due) return { text: 'No due date', cls: 'text-gray-400 dark:text-slate-500' };
  const d = new Date(due);
  const days = Math.ceil((d.getTime() - Date.now()) / (1000 * 60 * 60 * 24));
  if (days < 0)  return { text: `Overdue by ${Math.abs(days)}d`, cls: 'text-red-600 dark:text-red-400 font-medium' };
  if (days === 0) return { text: 'Due today', cls: 'text-amber-600 dark:text-amber-400 font-medium' };
  if (days === 1) return { text: 'Due tomorrow', cls: 'text-amber-600 dark:text-amber-400' };
  if (days < 7)   return { text: `Due in ${days}d`, cls: 'text-gray-600 dark:text-slate-300' };
  return { text: d.toLocaleDateString(), cls: 'text-gray-500 dark:text-slate-400' };
}

export default function UpcomingTasks({ items = [] }) {
  if (items.length === 0) {
    return (
      <div className="text-center py-10">
        <div className="text-3xl mb-2">🎉</div>
        <p className="text-sm text-gray-500 dark:text-slate-400">No upcoming tasks</p>
      </div>
    );
  }
  return (
    <ul className="space-y-3">
      {items.map((t) => {
        const d = dueLabel(t.due_date);
        return (
          <li key={t.id} className="flex items-start gap-3">
            <div className={`mt-0.5 text-[10px] uppercase tracking-wide px-2 py-0.5 rounded border font-semibold ${PRIORITY_COLORS[t.priority] || PRIORITY_COLORS.low}`}>
              {t.priority}
            </div>
            <div className="flex-1 min-w-0">
              <div className="text-sm font-medium text-gray-900 dark:text-slate-100 truncate">{t.title}</div>
              <div className="flex items-center gap-2 mt-0.5">
                <span className={`text-xs ${d.cls}`}>{d.text}</span>
                {t.assigned_name && (
                  <span className="text-xs text-gray-400 dark:text-slate-500">· {t.assigned_name}</span>
                )}
              </div>
            </div>
          </li>
        );
      })}
      <li className="pt-2 border-t border-gray-100 dark:border-slate-800">
        <Link to="/tasks" className="text-xs font-medium text-brand-600 dark:text-brand-400 hover:underline">
          View all tasks →
        </Link>
      </li>
    </ul>
  );
}
