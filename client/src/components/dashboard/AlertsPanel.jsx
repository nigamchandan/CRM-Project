import { Link } from 'react-router-dom';
import Icon from '../ui/Icon.jsx';

function timeAgo(date) {
  const diff = Math.floor((Date.now() - new Date(date).getTime()) / 1000);
  if (diff < 60)     return 'just now';
  if (diff < 3600)   return `${Math.floor(diff / 60)}m ago`;
  if (diff < 86400)  return `${Math.floor(diff / 3600)}h ago`;
  if (diff < 604800) return `${Math.floor(diff / 86400)}d ago`;
  return new Date(date).toLocaleDateString();
}

function daysOverdue(due) {
  return Math.floor((Date.now() - new Date(due).getTime()) / (1000 * 60 * 60 * 24));
}

const TABS = [
  { id: 'overdue_tasks',         label: 'Overdue Tasks',     icon: 'checkCircle', accent: 'amber' },
  { id: 'high_priority_tickets', label: 'High Priority',     icon: 'ticket',      accent: 'rose'  },
  { id: 'stuck_deals',           label: 'Stuck Deals',       icon: 'briefcase',   accent: 'brand' },
];

export default function AlertsPanel({ data, activeTab, onTab }) {
  if (!data) {
    return <p className="text-sm text-gray-500 dark:text-slate-400 text-center py-8">No alerts data.</p>;
  }

  const counts = data.counts || {};
  const total = (counts.overdue_tasks || 0) + (counts.high_priority_tickets || 0) + (counts.stuck_deals || 0);

  if (total === 0) {
    return (
      <div className="text-center py-10">
        <div className="text-3xl mb-2">✨</div>
        <p className="text-sm font-medium text-emerald-600 dark:text-emerald-400">All clear!</p>
        <p className="text-xs text-gray-500 dark:text-slate-400 mt-1">No alerts at the moment.</p>
      </div>
    );
  }

  return (
    <div>
      {/* Tabs */}
      <div className="flex flex-wrap gap-2 mb-4">
        {TABS.map((tab) => {
          const count = counts[tab.id] || 0;
          const isActive = activeTab === tab.id;
          const badge = count > 0
            ? (tab.accent === 'rose'
                ? 'bg-rose-100 text-rose-700 dark:bg-rose-500/15 dark:text-rose-400'
                : tab.accent === 'amber'
                  ? 'bg-amber-100 text-amber-700 dark:bg-amber-500/15 dark:text-amber-400'
                  : 'bg-brand-100 text-brand-700 dark:bg-brand-500/15 dark:text-brand-400')
            : 'bg-gray-100 text-gray-500 dark:bg-slate-800 dark:text-slate-500';
          return (
            <button
              key={tab.id}
              onClick={() => onTab(tab.id)}
              className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-medium transition
                ${isActive
                  ? 'bg-white dark:bg-slate-700 text-gray-900 dark:text-slate-100 ring-1 ring-gray-200 dark:ring-slate-600 shadow-sm'
                  : 'text-gray-600 dark:text-slate-400 hover:bg-gray-100 dark:hover:bg-slate-800'}`}
            >
              <Icon name={tab.icon} className="w-3.5 h-3.5" />
              {tab.label}
              <span className={`text-[10px] font-semibold px-1.5 py-0.5 rounded-full ${badge}`}>
                {count}
              </span>
            </button>
          );
        })}
      </div>

      {/* List */}
      {activeTab === 'overdue_tasks' && (
        <List
          items={data.overdue_tasks}
          empty="No overdue tasks 🎉"
          render={(t) => (
            <Link to="/tasks" className="flex items-start gap-3 p-3 rounded-lg hover:bg-gray-50 dark:hover:bg-slate-800/40 transition">
              <span className="mt-0.5 inline-flex items-center justify-center w-7 h-7 rounded-full bg-amber-100 dark:bg-amber-500/15 text-amber-600 dark:text-amber-400 text-xs">!</span>
              <div className="flex-1 min-w-0">
                <div className="text-sm font-medium text-gray-900 dark:text-slate-100 truncate">{t.title}</div>
                <div className="text-[11px] text-red-600 dark:text-red-400 font-medium">
                  Overdue by {daysOverdue(t.due_date)}d {t.assigned_name && <span className="text-gray-400 dark:text-slate-500 font-normal">· {t.assigned_name}</span>}
                </div>
              </div>
            </Link>
          )}
        />
      )}

      {activeTab === 'high_priority_tickets' && (
        <List
          items={data.high_priority_tickets}
          empty="No high-priority tickets 👌"
          render={(t) => (
            <Link to={`/tickets/${t.id}`} className="flex items-start gap-3 p-3 rounded-lg hover:bg-gray-50 dark:hover:bg-slate-800/40 transition">
              <span className="mt-0.5 inline-flex items-center justify-center w-7 h-7 rounded-full bg-rose-100 dark:bg-rose-500/15 text-rose-600 dark:text-rose-400 text-xs">🔥</span>
              <div className="flex-1 min-w-0">
                <div className="text-sm font-medium text-gray-900 dark:text-slate-100 truncate">{t.ticket_no || `#${t.id}`} · {t.subject}</div>
                <div className="text-[11px] text-gray-500 dark:text-slate-400">
                  Opened {timeAgo(t.created_at)} {t.assigned_name ? `· ${t.assigned_name}` : '· unassigned'}
                </div>
              </div>
            </Link>
          )}
        />
      )}

      {activeTab === 'stuck_deals' && (
        <List
          items={data.stuck_deals}
          empty="No stuck deals 👍"
          render={(d) => (
            <Link to="/deals" className="flex items-start gap-3 p-3 rounded-lg hover:bg-gray-50 dark:hover:bg-slate-800/40 transition">
              <span className="mt-0.5 inline-flex items-center justify-center w-7 h-7 rounded-full bg-brand-100 dark:bg-brand-500/15 text-brand-600 dark:text-brand-400 text-xs">💼</span>
              <div className="flex-1 min-w-0">
                <div className="text-sm font-medium text-gray-900 dark:text-slate-100 truncate">{d.title}</div>
                <div className="text-[11px] text-gray-500 dark:text-slate-400">
                  No activity for {Math.floor((Date.now() - new Date(d.updated_at).getTime()) / 86400000)}d
                  {d.stage_name && ` · ${d.stage_name}`}
                  {d.owner_name && ` · ${d.owner_name}`}
                </div>
              </div>
              <div className="text-sm font-semibold text-gray-700 dark:text-slate-200 tabular-nums">
                ${Number(d.value || 0).toLocaleString()}
              </div>
            </Link>
          )}
        />
      )}
    </div>
  );
}

function List({ items, empty, render }) {
  if (!items || items.length === 0) {
    return <p className="text-sm text-gray-500 dark:text-slate-400 text-center py-6">{empty}</p>;
  }
  return <ul className="space-y-1">{items.map((it) => <li key={it.id}>{render(it)}</li>)}</ul>;
}
