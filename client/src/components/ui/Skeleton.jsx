export default function Skeleton({ className = '', width, height }) {
  const style = {};
  if (width) style.width = typeof width === 'number' ? `${width}px` : width;
  if (height) style.height = typeof height === 'number' ? `${height}px` : height;
  return (
    <div
      style={style}
      className={`
        animate-pulse rounded-md
        bg-gradient-to-r from-gray-100 via-gray-200 to-gray-100
        dark:from-slate-800 dark:via-slate-700 dark:to-slate-800
        ${className}
      `}
    />
  );
}

export function SkeletonCard({ className = '' }) {
  return (
    <div className={`card p-5 ${className}`}>
      <div className="flex items-center justify-between">
        <Skeleton className="w-11 h-11 rounded-xl" />
        <Skeleton className="w-12 h-4" />
      </div>
      <Skeleton className="w-24 h-7 mt-4" />
      <Skeleton className="w-20 h-3 mt-2" />
    </div>
  );
}

export function SkeletonBlock({ h = 280, className = '' }) {
  return (
    <div className={`card p-5 ${className}`}>
      <Skeleton className="w-40 h-5 mb-4" />
      <Skeleton style={{ height: h }} className="w-full" />
    </div>
  );
}

export function SkeletonList({ rows = 5 }) {
  return (
    <div className="space-y-3">
      {Array.from({ length: rows }).map((_, i) => (
        <div key={i} className="flex items-center gap-3">
          <Skeleton className="w-9 h-9 rounded-full" />
          <div className="flex-1">
            <Skeleton className="h-3 w-3/4 mb-2" />
            <Skeleton className="h-3 w-1/3" />
          </div>
        </div>
      ))}
    </div>
  );
}
