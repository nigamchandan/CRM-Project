import { Link } from 'react-router-dom';

function initials(name = '?') {
  return name.split(/\s+/).map((p) => p[0]).slice(0, 2).join('').toUpperCase();
}

function avatarBg(id) {
  const colors = [
    'from-brand-500 to-brand-700',
    'from-emerald-500 to-emerald-700',
    'from-amber-500 to-amber-700',
    'from-rose-500 to-rose-700',
    'from-cyan-500 to-cyan-700',
    'from-purple-500 to-purple-700',
  ];
  return colors[id % colors.length];
}

function MedalBadge({ rank }) {
  if (rank > 3) return null;
  const styles = {
    1: 'bg-amber-100 text-amber-700 dark:bg-amber-500/20 dark:text-amber-300',
    2: 'bg-gray-200 text-gray-700 dark:bg-slate-600/40 dark:text-slate-200',
    3: 'bg-orange-100 text-orange-700 dark:bg-orange-500/15 dark:text-orange-300',
  };
  const labels = { 1: '🥇', 2: '🥈', 3: '🥉' };
  return (
    <span className={`absolute -top-1 -right-1 w-5 h-5 rounded-full ring-2 ring-white dark:ring-slate-900 flex items-center justify-center text-[10px] ${styles[rank]}`}>
      {labels[rank]}
    </span>
  );
}

export default function TeamPerformance({ items = [] }) {
  if (items.length === 0) {
    return <p className="text-sm text-gray-500 dark:text-slate-400 text-center py-8">No team data yet.</p>;
  }

  return (
    <ul className="space-y-3">
      {items.map((u, i) => {
        const rank = i + 1;
        const won = Number(u.won_value || 0);
        const total = Number(u.deals_value || 0);
        const winRate = total ? Math.round((won / total) * 100) : 0;
        return (
          <li key={u.id} className="flex items-center gap-3">
            <div className="relative">
              <div className={`w-10 h-10 rounded-full bg-gradient-to-br ${avatarBg(u.id)} text-white text-sm font-semibold flex items-center justify-center shadow-sm`}>
                {initials(u.name)}
              </div>
              <MedalBadge rank={rank} />
            </div>

            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2">
                <Link
                  to={`/users`}
                  className="text-sm font-medium text-gray-900 dark:text-slate-100 truncate hover:underline"
                >
                  {u.name}
                </Link>
                <span className="text-[10px] uppercase tracking-wide font-semibold px-1.5 py-0.5 rounded bg-gray-100 text-gray-600 dark:bg-slate-800 dark:text-slate-400">
                  {u.role}
                </span>
              </div>
              <div className="text-[11px] text-gray-500 dark:text-slate-400 flex items-center gap-3 mt-0.5">
                <span>${won.toLocaleString()} won</span>
                <span className="text-gray-300 dark:text-slate-600">·</span>
                <span>{u.converted_count} leads</span>
                <span className="text-gray-300 dark:text-slate-600">·</span>
                <span>{u.tickets_resolved} tickets</span>
              </div>
            </div>

            <div className="text-right">
              <div className="text-sm font-semibold text-gray-900 dark:text-slate-100 tabular-nums">
                ${total.toLocaleString()}
              </div>
              <div className="text-[10px] text-gray-500 dark:text-slate-400">{winRate}% win rate</div>
            </div>
          </li>
        );
      })}
    </ul>
  );
}
