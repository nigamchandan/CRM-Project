import { useRef, useState } from 'react';
import { useNotifications } from '../../context/NotificationContext.jsx';
import { useNavigate } from 'react-router-dom';
import Icon from '../ui/Icon.jsx';
import usePopoverDismiss from '../../hooks/usePopoverDismiss';

export default function NotificationBell() {
  const { items, unreadCount, markRead, markAllRead } = useNotifications();
  const [open, setOpen] = useState(false);
  const navigate = useNavigate();
  const wrapRef = useRef(null);
  usePopoverDismiss(open, wrapRef, () => setOpen(false));

  return (
    <div ref={wrapRef} className="relative">
      <button
        onClick={() => setOpen(v => !v)}
        className="relative p-2 rounded-lg text-gray-600 hover:bg-gray-100 dark:text-slate-300 dark:hover:bg-slate-800 transition-colors"
        aria-label="Notifications"
      >
        <Icon name="bell" className="w-5 h-5" />
        {unreadCount > 0 && (
          <span className="absolute top-1 right-1 bg-red-500 text-white text-[10px] min-w-[18px] h-[18px] px-1 rounded-full flex items-center justify-center font-semibold ring-2 ring-white dark:ring-slate-900">
            {unreadCount > 9 ? '9+' : unreadCount}
          </span>
        )}
      </button>
      {open && (
        <div
          className="absolute right-0 mt-2 w-80 bg-white dark:bg-slate-800 border border-gray-100 dark:border-slate-700 rounded-xl shadow-lg overflow-hidden z-30"
        >
          <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100 dark:border-slate-700">
            <div className="font-medium text-sm text-gray-900 dark:text-slate-100">Notifications</div>
            <button
              className="text-xs text-brand-600 dark:text-brand-400 hover:underline disabled:opacity-50"
              onClick={markAllRead}
              disabled={unreadCount === 0}
            >
              Mark all read
            </button>
          </div>
          <div className="max-h-96 overflow-y-auto">
            {items.length === 0 && (
              <div className="p-6 text-center text-sm text-gray-500 dark:text-slate-400">No notifications</div>
            )}
            {items.map(n => (
              <button
                key={n.id}
                onClick={() => { markRead(n.id); if (n.link) { setOpen(false); navigate(n.link); } }}
                className={`
                  w-full text-left px-4 py-3 border-b border-gray-50 dark:border-slate-700/60
                  hover:bg-gray-50 dark:hover:bg-slate-700/40
                  ${n.is_read ? '' : 'bg-brand-50/40 dark:bg-brand-500/5'}
                `}
              >
                <div className="text-sm font-medium text-gray-800 dark:text-slate-100">{n.title}</div>
                <div className="text-xs text-gray-600 dark:text-slate-400 line-clamp-2">{n.message}</div>
                <div className="text-[11px] text-gray-400 dark:text-slate-500 mt-1">
                  {new Date(n.created_at).toLocaleString()}
                </div>
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
