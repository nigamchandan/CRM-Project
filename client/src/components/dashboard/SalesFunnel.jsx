export default function SalesFunnel({ stages = [] }) {
  const max = Math.max(1, ...stages.map(s => s.deal_count || 0));

  if (stages.length === 0) {
    return <p className="text-sm text-gray-500 dark:text-slate-400 text-center py-8">No pipeline data</p>;
  }

  return (
    <div className="space-y-3">
      {stages.map((s) => {
        const pct = Math.max(8, Math.round(((s.deal_count || 0) / max) * 100));
        return (
          <div key={s.id} className="flex items-center gap-3">
            <div className="w-28 text-xs font-medium text-gray-600 dark:text-slate-300 truncate">
              {s.name}
            </div>
            <div className="flex-1 bg-gray-100 dark:bg-slate-800 rounded-full h-7 overflow-hidden relative">
              <div
                className="h-full rounded-full flex items-center px-3 text-[11px] font-semibold text-white transition-all duration-500 shadow-sm"
                style={{
                  width: `${pct}%`,
                  background: `linear-gradient(90deg, ${s.color || '#6366f1'}cc, ${s.color || '#6366f1'})`,
                }}
              >
                {s.deal_count > 0 && <span>{s.deal_count}</span>}
              </div>
            </div>
            <div className="w-24 text-right text-xs font-semibold text-gray-700 dark:text-slate-200 tabular-nums">
              ${Number(s.total_value || 0).toLocaleString()}
            </div>
          </div>
        );
      })}
    </div>
  );
}
