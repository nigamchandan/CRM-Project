export default function EmptyState({ title = 'Nothing here yet', subtitle, action }) {
  return (
    <div className="text-center py-14">
      <div className="text-4xl mb-3 opacity-80">📭</div>
      <h3 className="text-gray-800 dark:text-slate-100 font-medium">{title}</h3>
      {subtitle && <p className="text-gray-500 dark:text-slate-400 text-sm mt-1">{subtitle}</p>}
      {action && <div className="mt-4">{action}</div>}
    </div>
  );
}
