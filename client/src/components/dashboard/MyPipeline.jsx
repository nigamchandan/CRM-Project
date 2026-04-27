import { Link } from 'react-router-dom';
import Icon from '../ui/Icon.jsx';

function fmtDays(d) {
  if (!d) return '';
  const days = Math.floor((Date.now() - new Date(d).getTime()) / 86400000);
  if (days <= 0) return 'today';
  if (days === 1) return '1d';
  if (days < 30)  return `${days}d`;
  return `${Math.floor(days / 30)}mo`;
}

export default function MyPipeline({ stages = [] }) {
  if (stages.length === 0) {
    return <p className="text-sm text-gray-500 dark:text-slate-400 text-center py-8">No pipeline configured yet.</p>;
  }

  const hasAnyDeals = stages.some((s) => s.deal_count > 0);
  if (!hasAnyDeals) {
    return (
      <div className="text-center py-8">
        <div className="text-3xl mb-2">📦</div>
        <p className="text-sm text-gray-500 dark:text-slate-400">No deals in your pipeline yet.</p>
        <Link to="/deals" className="btn-primary mt-3 !py-1.5 !text-xs"><Icon name="plus" className="w-3.5 h-3.5" /> Add your first deal</Link>
      </div>
    );
  }

  return (
    <div className="-mx-1 px-1 overflow-x-auto">
      <div className="flex gap-3 min-w-max pb-1">
        {stages.map((s) => (
          <div
            key={s.id}
            className="w-64 flex-shrink-0 rounded-xl bg-gray-50 dark:bg-slate-800/40 border border-gray-100 dark:border-slate-800 p-3"
          >
            {/* Column header */}
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2 min-w-0">
                <span
                  className="w-2.5 h-2.5 rounded-full flex-shrink-0"
                  style={{ backgroundColor: s.color || '#6366f1' }}
                />
                <span className="text-xs font-semibold text-gray-700 dark:text-slate-200 uppercase tracking-wider truncate">
                  {s.name}
                </span>
                <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-white dark:bg-slate-700 text-gray-600 dark:text-slate-300">
                  {s.deal_count}
                </span>
              </div>
            </div>

            {/* Total value */}
            <div className="text-[11px] text-gray-500 dark:text-slate-400 mb-3 tabular-nums">
              ${Number(s.total_value || 0).toLocaleString()} total
            </div>

            {/* Cards */}
            <div className="space-y-2">
              {s.deals.length === 0 ? (
                <div className="text-[11px] text-gray-400 dark:text-slate-500 italic text-center py-3 border border-dashed border-gray-200 dark:border-slate-700 rounded-lg">
                  No deals
                </div>
              ) : (
                s.deals.map((d) => (
                  <Link
                    key={d.id}
                    to="/deals"
                    className="block bg-white dark:bg-slate-900 rounded-lg p-2.5 border border-gray-100 dark:border-slate-700 hover:border-brand-300 dark:hover:border-brand-500/40 hover:shadow-sm transition"
                  >
                    <div className="text-sm font-medium text-gray-900 dark:text-slate-100 line-clamp-2 leading-snug">
                      {d.title}
                    </div>
                    {d.contact_name && (
                      <div className="text-[11px] text-gray-500 dark:text-slate-400 mt-1 truncate">
                        {d.contact_name}
                      </div>
                    )}
                    <div className="flex items-center justify-between mt-2">
                      <span className="text-xs font-semibold text-gray-700 dark:text-slate-200 tabular-nums">
                        ${Number(d.value || 0).toLocaleString()}
                      </span>
                      <span className="text-[10px] text-gray-400 dark:text-slate-500">
                        {fmtDays(d.updated_at)}
                      </span>
                    </div>
                  </Link>
                ))
              )}

              {s.deal_count > s.deals.length && (
                <Link
                  to="/deals"
                  className="block text-center text-[11px] font-medium text-brand-600 dark:text-brand-400 py-1 hover:underline"
                >
                  +{s.deal_count - s.deals.length} more →
                </Link>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
