const STATUS_COLORS = {
  new:         'bg-blue-100 text-blue-700 dark:bg-blue-500/10 dark:text-blue-400',
  contacted:   'bg-purple-100 text-purple-700 dark:bg-purple-500/10 dark:text-purple-400',
  qualified:   'bg-amber-100 text-amber-700 dark:bg-amber-500/10 dark:text-amber-400',
  converted:   'bg-emerald-100 text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-400',
  lost:        'bg-red-100 text-red-700 dark:bg-red-500/10 dark:text-red-400',
  open:        'bg-blue-100 text-blue-700 dark:bg-blue-500/10 dark:text-blue-400',
  in_progress: 'bg-amber-100 text-amber-700 dark:bg-amber-500/10 dark:text-amber-400',
  resolved:    'bg-emerald-100 text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-400',
  closed:      'bg-gray-100 text-gray-700 dark:bg-slate-700/40 dark:text-slate-300',
  pending:     'bg-gray-100 text-gray-700 dark:bg-slate-700/40 dark:text-slate-300',
  completed:   'bg-emerald-100 text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-400',
  low:         'bg-gray-100 text-gray-700 dark:bg-slate-700/40 dark:text-slate-300',
  medium:      'bg-amber-100 text-amber-700 dark:bg-amber-500/10 dark:text-amber-400',
  high:        'bg-red-100 text-red-700 dark:bg-red-500/10 dark:text-red-400',
};

export default function Badge({ value, className = '' }) {
  const key = String(value || '').toLowerCase();
  const color = STATUS_COLORS[key] || 'bg-gray-100 text-gray-700 dark:bg-slate-700/40 dark:text-slate-300';
  return <span className={`badge ${color} ${className}`}>{String(value).replace('_',' ')}</span>;
}
