import { Link } from 'react-router-dom';
import Icon from '../ui/Icon.jsx';

// Renders the unified "next actions" payload from /next-actions:
//   { rules: Rule[], total, top_severity, scope }
//
// `compact` strips the banner & extra spacing for use inside a popover.
export default function NextActions({ data, compact = false, emptyHint = "You're all caught up!", onItemClick }) {
  if (!data) {
    return <p className="text-sm text-gray-500 dark:text-slate-400 text-center py-8">No suggestions yet.</p>;
  }
  const rules = data.rules || [];
  if (rules.length === 0) {
    return (
      <div className={`text-center ${compact ? 'py-6' : 'py-10'}`}>
        <div className={compact ? 'text-3xl mb-1.5' : 'text-4xl mb-2'}>🎉</div>
        <p className="text-sm font-medium text-emerald-600 dark:text-emerald-400">{emptyHint}</p>
        {!compact && (
          <p className="text-xs text-gray-500 dark:text-slate-400 mt-1">
            No leads to chase, no stuck deals, no follow-ups due.
          </p>
        )}
      </div>
    );
  }

  return (
    <div className={compact ? 'space-y-3' : 'space-y-5'}>
      {/* Hero banner — only on full mode */}
      {!compact && (
        <div className="flex items-center gap-3 p-3 rounded-lg bg-gradient-to-r from-amber-50 to-rose-50 dark:from-amber-500/10 dark:to-rose-500/10 border border-amber-100 dark:border-amber-500/20">
          <span className="text-2xl">🔥</span>
          <div className="flex-1">
            <div className="text-sm font-semibold text-gray-900 dark:text-slate-100">
              What should you do next?
            </div>
            <div className="text-xs text-gray-600 dark:text-slate-300">
              {data.total} action{data.total === 1 ? '' : 's'} suggested · {rules.length} categor{rules.length === 1 ? 'y' : 'ies'}
              {data.scope === 'team' ? ' · team scope' : ''}
            </div>
          </div>
        </div>
      )}

      {rules.map((rule) => <RuleGroup key={rule.id} rule={rule} compact={compact} onItemClick={onItemClick} />)}
    </div>
  );
}

const SEVERITY = {
  critical: 'text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-500/10',
  warning:  'text-amber-600 dark:text-amber-400 bg-amber-50 dark:bg-amber-500/10',
  info:     'text-brand-600 dark:text-brand-400 bg-brand-50 dark:bg-brand-500/10',
};

const BADGE_TONE = {
  high:     'bg-red-100 text-red-700 dark:bg-red-500/15 dark:text-red-400',
  medium:   'bg-amber-100 text-amber-700 dark:bg-amber-500/15 dark:text-amber-400',
  low:      'bg-gray-100 text-gray-700 dark:bg-slate-700/50 dark:text-slate-300',
  new:      'bg-blue-100 text-blue-700 dark:bg-blue-500/15 dark:text-blue-400',
  contacted:'bg-purple-100 text-purple-700 dark:bg-purple-500/15 dark:text-purple-400',
};

function RuleGroup({ rule, compact, onItemClick }) {
  const sev = SEVERITY[rule.severity] || SEVERITY.info;
  return (
    <div>
      <div className="flex items-center gap-2 mb-2">
        <span className={`w-7 h-7 rounded-lg flex items-center justify-center ${sev}`}>
          <Icon name={rule.icon || 'spark'} className="w-3.5 h-3.5" />
        </span>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <span className="text-sm font-semibold text-gray-900 dark:text-slate-100 truncate">
              {rule.title}
            </span>
            <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-gray-100 dark:bg-slate-800 text-gray-600 dark:text-slate-300">
              {rule.count}
            </span>
            {rule.severity === 'critical' && (
              <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-red-100 dark:bg-red-500/15 text-red-700 dark:text-red-300 uppercase tracking-wider">
                Urgent
              </span>
            )}
          </div>
          <div className="text-[11px] text-gray-500 dark:text-slate-400 truncate">{rule.description}</div>
        </div>
        <Link
          to={rule.link}
          onClick={onItemClick}
          className="text-[11px] font-medium text-brand-600 dark:text-brand-400 hover:underline whitespace-nowrap"
        >
          View all →
        </Link>
      </div>

      <ul className="space-y-1">
        {rule.items.map((item) => (
          <li key={`${rule.id}-${item.id}`}>
            <Link
              to={item.link || rule.link}
              onClick={onItemClick}
              className={`flex items-start gap-3 ${compact ? 'p-2' : 'p-3'} rounded-lg hover:bg-gray-50 dark:hover:bg-slate-800/40 transition`}
            >
              <Avatar label={String(item.label)} type={rule.type} hint={item.hint} />
              <div className="flex-1 min-w-0">
                <div className="text-sm font-medium text-gray-900 dark:text-slate-100 truncate">
                  {item.label}
                </div>
                <div className="text-[11px] text-gray-500 dark:text-slate-400 truncate">
                  {item.sublabel}
                </div>
              </div>
              {item.badge && (
                <span className={`badge font-semibold capitalize ${BADGE_TONE[item.badge] || 'bg-gray-100 text-gray-700 dark:bg-slate-700/50 dark:text-slate-300'}`}>
                  {item.badge}
                </span>
              )}
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}

function Avatar({ label = '?', type, hint }) {
  // Type-based icon avatar (clearer than initials for non-person items like deals/tickets)
  const ICONS_BY_TYPE = {
    lead:       { icon: 'target',     bg: 'from-amber-500 to-amber-700' },
    deal:       { icon: 'briefcase',  bg: 'from-rose-500 to-rose-700' },
    task:       { icon: 'checkCircle',bg: 'from-brand-500 to-brand-700' },
    ticket:     { icon: 'ticket',     bg: 'from-cyan-500 to-cyan-700' },
    assignment: { icon: 'userCircle', bg: 'from-purple-500 to-purple-700' },
  };
  const conf = ICONS_BY_TYPE[type];
  if (conf) {
    return (
      <div className={`mt-0.5 w-9 h-9 flex-shrink-0 rounded-full bg-gradient-to-br ${conf.bg} text-white flex items-center justify-center shadow-sm relative`}>
        <Icon name={conf.icon} className="w-4 h-4" />
        {hint === 'breached' && (
          <span className="absolute -top-0.5 -right-0.5 w-3 h-3 rounded-full bg-red-500 border-2 border-white dark:border-slate-900 animate-pulse" />
        )}
      </div>
    );
  }
  // Fallback: initials
  const initials = label.split(/\s+/).map((p) => p[0]).slice(0, 2).join('').toUpperCase() || '?';
  return (
    <div className="w-9 h-9 flex-shrink-0 rounded-full bg-gradient-to-br from-brand-500 to-brand-700 text-white text-xs font-semibold flex items-center justify-center shadow-sm">
      {initials}
    </div>
  );
}
