import { useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import useNextActions from '../../hooks/useNextActions';
import NextActions from '../dashboard/NextActions.jsx';
import { useAuth } from '../../context/AuthContext.jsx';
import usePopoverDismiss from '../../hooks/usePopoverDismiss';

// Topbar quick-access widget. Shows a fire icon with a count badge; on click,
// opens a popover with the top suggestions and a "Go to dashboard" CTA.
export default function NextActionsButton() {
  const { user } = useAuth();
  const isPriv = user && (user.role === 'admin' || user.role === 'manager');

  // Admins/managers default to team-wide scope (so they see unassigned items too)
  const { data, loading } = useNextActions({ scope: isPriv ? 'team' : 'mine' });
  const [open, setOpen] = useState(false);
  const wrapperRef = useRef(null);
  usePopoverDismiss(open, wrapperRef, () => setOpen(false));

  const total = data?.total || 0;
  const isCritical = data?.top_severity === 'critical';

  // Pulse when there are critical items pending
  const buttonClasses = `
    relative p-2 rounded-lg text-gray-600 dark:text-slate-300
    hover:bg-gray-100 dark:hover:bg-slate-800 transition-colors
    ${isCritical && total > 0 ? 'text-amber-600 dark:text-amber-400' : ''}
  `;

  return (
    <div ref={wrapperRef} className="relative">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className={buttonClasses}
        title="What should you do next?"
        aria-label={`Next actions${total ? ` — ${total} pending` : ''}`}
      >
        <span className={`text-lg leading-none block ${isCritical && total > 0 ? 'animate-pulse' : ''}`}>🔥</span>
        {total > 0 && (
          <span
            className={`
              absolute -top-0.5 -right-0.5 min-w-[18px] h-[18px] px-1
              rounded-full text-[10px] font-bold leading-none
              flex items-center justify-center
              ring-2 ring-white dark:ring-slate-900
              ${isCritical
                ? 'bg-red-500 text-white'
                : 'bg-amber-500 text-white'}
            `}
          >
            {total > 99 ? '99+' : total}
          </span>
        )}
      </button>

      {open && (
        <div
          className="
            absolute right-0 mt-2 w-[380px] max-w-[92vw]
            bg-white dark:bg-slate-900 border border-gray-100 dark:border-slate-700
            rounded-xl shadow-xl overflow-hidden z-30
          "
        >
          {/* Header */}
          <div className="px-4 py-3 border-b border-gray-100 dark:border-slate-800 bg-gradient-to-r from-amber-50 to-rose-50 dark:from-amber-500/10 dark:to-rose-500/10">
            <div className="flex items-center justify-between">
              <div>
                <div className="text-sm font-semibold text-gray-900 dark:text-slate-100 flex items-center gap-1.5">
                  <span>🔥</span> Next Actions
                </div>
                <div className="text-[11px] text-gray-600 dark:text-slate-300">
                  {loading
                    ? 'Loading suggestions…'
                    : total === 0
                      ? 'Nothing urgent — nice work!'
                      : `${total} item${total === 1 ? '' : 's'} need attention${data.scope === 'team' ? ' (team)' : ''}`}
                </div>
              </div>
              <button
                onClick={() => setOpen(false)}
                className="text-gray-400 hover:text-gray-700 dark:hover:text-slate-200 text-lg leading-none"
                aria-label="Close"
              >
                ×
              </button>
            </div>
          </div>

          {/* Body */}
          <div className="p-4 max-h-[60vh] overflow-y-auto">
            {loading && !data ? (
              <PopoverSkeleton />
            ) : (
              <NextActions
                data={data}
                compact
                emptyHint="Inbox zero — nothing pending."
                onItemClick={() => setOpen(false)}
              />
            )}
          </div>

          {/* Footer */}
          <div className="px-4 py-2.5 border-t border-gray-100 dark:border-slate-800 bg-gray-50/60 dark:bg-slate-800/40 flex items-center justify-between">
            <span className="text-[11px] text-gray-500 dark:text-slate-400">
              Refreshes live as work happens.
            </span>
            <Link
              to="/dashboard"
              onClick={() => setOpen(false)}
              className="text-xs font-medium text-brand-600 dark:text-brand-400 hover:underline"
            >
              Go to dashboard →
            </Link>
          </div>
        </div>
      )}
    </div>
  );
}

function PopoverSkeleton() {
  return (
    <div className="space-y-3 animate-pulse">
      {[0, 1, 2].map((i) => (
        <div key={i} className="space-y-2">
          <div className="h-4 w-1/3 bg-gray-100 dark:bg-slate-800 rounded" />
          <div className="h-12 bg-gray-100 dark:bg-slate-800 rounded-lg" />
          <div className="h-12 bg-gray-100 dark:bg-slate-800 rounded-lg" />
        </div>
      ))}
    </div>
  );
}
