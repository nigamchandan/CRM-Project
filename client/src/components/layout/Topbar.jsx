import { useRef, useState } from 'react';
import { useAuth } from '../../context/AuthContext.jsx';
import NotificationBell from '../notifications/NotificationBell.jsx';
import NextActionsButton from '../notifications/NextActionsButton.jsx';
import ThemeToggle from './ThemeToggle.jsx';
import Icon from '../ui/Icon.jsx';
import { useNavigate } from 'react-router-dom';
import usePopoverDismiss from '../../hooks/usePopoverDismiss';

export default function Topbar({ onMenu }) {
  const { user, logout } = useAuth();
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef(null);
  usePopoverDismiss(menuOpen, menuRef, () => setMenuOpen(false));
  const navigate = useNavigate();

  return (
    <header
      className="
        h-14 px-4 md:px-6 flex items-center gap-3 sticky top-0 z-20
        bg-white/80 dark:bg-slate-900/80 backdrop-blur-md
        border-b border-gray-100 dark:border-slate-800
      "
    >
      <button
        className="md:hidden p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-slate-800 text-gray-600 dark:text-slate-300"
        onClick={onMenu}
        aria-label="Open menu"
      >
        <Icon name="menu" className="w-6 h-6" />
      </button>

      <div className="hidden md:flex items-baseline gap-1.5 leading-none">
        <span className="text-xs text-gray-500 dark:text-slate-400">Welcome back,</span>
        <span className="text-sm font-semibold text-gray-900 dark:text-slate-100">
          {user?.name?.split(' ')[0] || 'there'}
        </span>
      </div>

      {/* Search (desktop) */}
      <div className="flex-1 max-w-md mx-auto hidden md:block">
        <div className="relative">
          <Icon name="search" className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 dark:text-slate-500" />
          <input
            type="search"
            placeholder="Search contacts, leads, deals..."
            className="input pl-9 bg-gray-50/80 dark:bg-slate-800/60 border-transparent dark:border-transparent focus:bg-white dark:focus:bg-slate-900"
          />
        </div>
      </div>

      <div className="flex-1 md:hidden" />

      <ThemeToggle />
      <NextActionsButton />
      <NotificationBell />

      <div ref={menuRef} className="relative">
        <button
          onClick={() => setMenuOpen(v => !v)}
          className="flex items-center gap-2 hover:bg-gray-100 dark:hover:bg-slate-800 rounded-lg px-2 py-1.5 transition-colors"
        >
          <div className="w-8 h-8 rounded-full bg-gradient-to-br from-brand-500 to-brand-700 text-white flex items-center justify-center text-sm font-semibold shadow-sm">
            {user?.name?.[0]?.toUpperCase()}
          </div>
          <div className="hidden md:block text-left">
            <div className="text-sm font-medium text-gray-800 dark:text-slate-200 leading-4">{user?.name}</div>
            <div className="text-xs text-gray-500 dark:text-slate-500 capitalize">{user?.role}</div>
          </div>
        </button>

        {menuOpen && (
          <div
            className="absolute right-0 mt-2 w-56 bg-white dark:bg-slate-800 border border-gray-100 dark:border-slate-700 rounded-xl shadow-lg overflow-hidden z-30"
          >
            <div className="px-4 py-3 border-b border-gray-100 dark:border-slate-700">
              <div className="text-sm font-medium text-gray-800 dark:text-slate-100 truncate">{user?.name}</div>
              <div className="text-xs text-gray-500 dark:text-slate-400 truncate">{user?.email}</div>
            </div>
            <button
              className="w-full text-left px-4 py-2.5 text-sm hover:bg-gray-50 dark:hover:bg-slate-700/60 text-gray-700 dark:text-slate-200 flex items-center gap-2"
              onClick={() => { setMenuOpen(false); navigate('/settings'); }}
            >
              <Icon name="cog" className="w-4 h-4" /> Settings
            </button>
            <button
              className="w-full text-left px-4 py-2.5 text-sm text-red-600 hover:bg-red-50 dark:hover:bg-red-500/10 dark:text-red-400 border-t border-gray-100 dark:border-slate-700"
              onClick={async () => { await logout(); navigate('/login'); }}
            >
              Logout
            </button>
          </div>
        )}
      </div>
    </header>
  );
}
