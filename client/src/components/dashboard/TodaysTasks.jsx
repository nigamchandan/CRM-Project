import { Link } from 'react-router-dom';
import * as tasksService from '../../services/tasksService';
import toast from 'react-hot-toast';

const PRIORITY = {
  high:   'bg-red-50 text-red-700 border-red-200 dark:bg-red-500/10 dark:text-red-400 dark:border-red-500/20',
  medium: 'bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-500/10 dark:text-amber-400 dark:border-amber-500/20',
  low:    'bg-gray-50 text-gray-700 border-gray-200 dark:bg-slate-800 dark:text-slate-300 dark:border-slate-700',
};

export default function TodaysTasks({ data, onChanged }) {
  if (!data) {
    return <p className="text-sm text-gray-500 dark:text-slate-400 text-center py-8">No task data.</p>;
  }
  const total = data.overdue.length + data.today.length + data.upcoming.length;
  if (total === 0) {
    return (
      <div className="text-center py-10">
        <div className="text-3xl mb-2">🎉</div>
        <p className="text-sm font-medium text-emerald-600 dark:text-emerald-400">No tasks today</p>
        <p className="text-xs text-gray-500 dark:text-slate-400 mt-1">Take a breather, or add a follow-up.</p>
      </div>
    );
  }

  const handleComplete = async (t) => {
    try {
      await tasksService.complete(t.id);
      toast.success(`Marked "${t.title}" complete`);
      onChanged?.();
    } catch (err) {
      toast.error('Could not complete task');
    }
  };

  const Section = ({ title, count, tone, items }) => {
    if (items.length === 0) return null;
    const toneCls = {
      red:   'text-red-700 dark:text-red-400',
      amber: 'text-amber-700 dark:text-amber-400',
      gray:  'text-gray-600 dark:text-slate-400',
    }[tone];
    return (
      <div className="mb-3 last:mb-0">
        <div className={`text-[11px] font-bold uppercase tracking-wider mb-2 ${toneCls}`}>
          {title} <span className="ml-1 text-gray-400 dark:text-slate-500">· {count}</span>
        </div>
        <ul className="space-y-1.5">
          {items.map((t) => (
            <li key={t.id} className="flex items-start gap-3 group">
              <button
                onClick={() => handleComplete(t)}
                title="Mark complete"
                className="mt-0.5 w-5 h-5 rounded-full border-2 border-gray-300 dark:border-slate-600 hover:border-emerald-500 dark:hover:border-emerald-400 hover:bg-emerald-50 dark:hover:bg-emerald-500/20 flex items-center justify-center transition flex-shrink-0"
              >
                <span className="opacity-0 group-hover:opacity-100 text-emerald-600 dark:text-emerald-400 text-xs">✓</span>
              </button>
              <div className="flex-1 min-w-0">
                <div className="text-sm font-medium text-gray-900 dark:text-slate-100 truncate">{t.title}</div>
                {t.due_date && (
                  <div className="text-[11px] text-gray-500 dark:text-slate-400">
                    {new Date(t.due_date).toLocaleString(undefined, { hour: 'numeric', minute: '2-digit', month: 'short', day: 'numeric' })}
                  </div>
                )}
              </div>
              <div className={`mt-0.5 text-[10px] uppercase tracking-wide px-2 py-0.5 rounded border font-semibold ${PRIORITY[t.priority] || PRIORITY.low}`}>
                {t.priority}
              </div>
            </li>
          ))}
        </ul>
      </div>
    );
  };

  return (
    <div>
      <Section title="Overdue"  count={data.overdue.length}  tone="red"   items={data.overdue} />
      <Section title="Today"    count={data.today.length}    tone="amber" items={data.today} />
      <Section title="Upcoming" count={data.upcoming.length} tone="gray"  items={data.upcoming} />

      <div className="mt-4 pt-3 border-t border-gray-100 dark:border-slate-800">
        <Link to="/tasks" className="text-xs font-medium text-brand-600 dark:text-brand-400 hover:underline">
          Manage all tasks →
        </Link>
      </div>
    </div>
  );
}
