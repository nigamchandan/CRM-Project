import { Link } from 'react-router-dom';
import Icon from '../ui/Icon.jsx';

const ACCENTS = {
  brand: {
    bg: 'bg-brand-50 dark:bg-brand-500/10',
    text: 'text-brand-600 dark:text-brand-400',
    ring: 'ring-brand-500/10 dark:ring-brand-500/20',
  },
  purple: {
    bg: 'bg-purple-50 dark:bg-purple-500/10',
    text: 'text-purple-600 dark:text-purple-400',
    ring: 'ring-purple-500/10 dark:ring-purple-500/20',
  },
  amber: {
    bg: 'bg-amber-50 dark:bg-amber-500/10',
    text: 'text-amber-600 dark:text-amber-400',
    ring: 'ring-amber-500/10 dark:ring-amber-500/20',
  },
  emerald: {
    bg: 'bg-emerald-50 dark:bg-emerald-500/10',
    text: 'text-emerald-600 dark:text-emerald-400',
    ring: 'ring-emerald-500/10 dark:ring-emerald-500/20',
  },
  rose: {
    bg: 'bg-rose-50 dark:bg-rose-500/10',
    text: 'text-rose-600 dark:text-rose-400',
    ring: 'ring-rose-500/10 dark:ring-rose-500/20',
  },
  cyan: {
    bg: 'bg-cyan-50 dark:bg-cyan-500/10',
    text: 'text-cyan-600 dark:text-cyan-400',
    ring: 'ring-cyan-500/10 dark:ring-cyan-500/20',
  },
};

export default function KpiCard({
  label, value, icon = 'chartBar', sublabel, trend, accent = 'brand',
  to, // optional react-router path (e.g. '/leads?status=new') — makes the card clickable
  tooltip,
}) {
  const a = ACCENTS[accent] || ACCENTS.brand;

  const renderTrend = () => {
    if (trend == null) return null;
    const up = trend > 0, flat = trend === 0;
    const cls = flat
      ? 'text-gray-500 bg-gray-100 dark:text-slate-400 dark:bg-slate-800'
      : up
        ? 'text-emerald-700 bg-emerald-50 dark:text-emerald-400 dark:bg-emerald-500/10'
        : 'text-red-700 bg-red-50 dark:text-red-400 dark:bg-red-500/10';
    const arrow = flat ? '→' : up ? '↑' : '↓';
    return (
      <span className={`inline-flex items-center gap-1 text-[11px] font-semibold px-2 py-0.5 rounded-full ${cls}`}>
        {arrow} {Math.abs(trend)}%
      </span>
    );
  };

  const inner = (
    <>
      <div className="flex items-start justify-between">
        <div className={`w-11 h-11 rounded-xl ${a.bg} ${a.text} ring-1 ${a.ring} flex items-center justify-center`}>
          <Icon name={icon} className="w-5 h-5" strokeWidth={2} />
        </div>
        {renderTrend()}
      </div>
      <div className="mt-4 text-2xl font-bold text-gray-900 dark:text-slate-100 tracking-tight">{value}</div>
      <div className="text-sm font-medium text-gray-500 dark:text-slate-400 mt-0.5">{label}</div>
      {sublabel && (
        <div className="text-xs text-gray-400 dark:text-slate-500 mt-1">{sublabel}</div>
      )}
      {to && (
        <div className="mt-3 text-[11px] font-medium text-brand-600 dark:text-brand-400 opacity-0 group-hover:opacity-100 transition-opacity">
          View details →
        </div>
      )}
    </>
  );

  const baseClass =
    'card p-5 group transition-all duration-200 hover:shadow-md hover:-translate-y-0.5';

  if (to) {
    return (
      <Link to={to} title={tooltip || `View ${label}`} className={`${baseClass} block focus:outline-none focus:ring-2 focus:ring-brand-500/40 rounded-xl`}>
        {inner}
      </Link>
    );
  }
  return <div className={baseClass} title={tooltip}>{inner}</div>;
}
