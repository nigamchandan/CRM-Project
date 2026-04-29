import { useEffect, useRef, useState } from 'react';
import { useAuth } from '../../context/AuthContext.jsx';
import NotificationBell from '../notifications/NotificationBell.jsx';
import NextActionsButton from '../notifications/NextActionsButton.jsx';
import ThemeToggle from './ThemeToggle.jsx';
import Icon from '../ui/Icon.jsx';
import { useNavigate } from 'react-router-dom';
import usePopoverDismiss from '../../hooks/usePopoverDismiss';
import { usePalette } from '../../context/PaletteContext.jsx';

export default function Topbar({ onMenu }) {
  const { user, logout } = useAuth();
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef(null);
  usePopoverDismiss(menuOpen, menuRef, () => setMenuOpen(false));
  const navigate = useNavigate();
  const { openPalette } = usePalette();
  // Show the platform-correct shortcut hint (⌘ on macOS, Ctrl elsewhere).
  const [isMac, setIsMac] = useState(false);
  useEffect(() => {
    if (typeof navigator === 'undefined') return;
    setIsMac(/Mac|iPhone|iPad|iPod/.test(navigator.platform || navigator.userAgent || ''));
  }, []);

  return (
    <header
      className="h-16 px-4 flex items-center gap-3 sticky top-0 z-20
                 glass border-b border-gray-100 dark:border-slate-800/70"
    >
      <button
        className="md:hidden p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-slate-800 text-gray-600 dark:text-slate-300"
        onClick={onMenu}
        aria-label="Open menu"
      >
        <Icon name="menu" className="w-6 h-6" />
      </button>

      {/* Welcome (desktop) */}
      <div className="hidden md:flex items-baseline gap-1.5 leading-none">
        <span className="text-[13px] text-gray-500 dark:text-slate-400">Welcome back,</span>
        <span className="text-[14px] font-semibold text-gray-900 dark:text-slate-100 tracking-tight">
          {user?.name?.split(' ')[0] || 'there'}
        </span>
      </div>

      {/* Search (desktop) — clicking anywhere on the bar opens the global
          command palette (Cmd/Ctrl-K).  We render it as a button so it never
          steals focus or fights the palette's own input. */}
      <div className="flex-1 max-w-md mx-auto hidden md:block">
        <button
          type="button"
          onClick={openPalette}
          aria-label="Open search"
          className="group w-full flex items-center gap-2 pl-3.5 pr-2 py-2 rounded-full
                     bg-gray-100/70 dark:bg-slate-800/60
                     border border-transparent
                     text-gray-500 dark:text-slate-400
                     hover:bg-white dark:hover:bg-slate-900
                     hover:border-brand-200 dark:hover:border-brand-500/40
                     transition"
        >
          <Icon name="search" className="w-[18px] h-[18px] text-gray-400 dark:text-slate-500" />
          <span className="flex-1 text-left text-sm truncate">
            Search contacts, leads, deals, tickets…
          </span>
          <kbd className="hidden lg:inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded
                          text-[10px] font-medium text-gray-400 dark:text-slate-500
                          bg-white dark:bg-slate-900/80 border border-gray-200 dark:border-slate-700">
            <span className="text-[11px]">{isMac ? '⌘' : 'Ctrl'}</span>K
          </kbd>
        </button>
      </div>

      <div className="flex-1 md:hidden" />

      <ThemeToggle />
      <NextActionsButton />
      <NotificationBell />

      {/* Avatar + dropdown */}
      <div ref={menuRef} className="relative">
        <button
          onClick={() => setMenuOpen(v => !v)}
          className="flex items-center gap-2.5 px-1.5 py-1 rounded-xl
                     hover:bg-gray-100 dark:hover:bg-slate-800/60 transition"
        >
          <div className="w-8 h-8 rounded-full bg-brand-gradient-r text-white flex items-center justify-center text-sm font-semibold shadow-glow-sm">
            {user?.name?.[0]?.toUpperCase()}
          </div>
          <div className="hidden md:block text-left pr-1.5">
            <div className="text-[13px] font-medium text-gray-800 dark:text-slate-200 leading-4 tracking-tight">{user?.name}</div>
            <div className="text-[11px] text-gray-500 dark:text-slate-500 capitalize leading-4">{user?.role}</div>
          </div>
        </button>

        {menuOpen && (
          <div
            className="absolute right-0 mt-2 w-60 z-30 overflow-hidden
                       rounded-xl border border-gray-100 dark:border-slate-700/80
                       bg-white dark:bg-[#1a1a28] shadow-card-hover
                       animate-slide-up"
          >
            <div className="px-4 py-3.5 border-b border-gray-100 dark:border-slate-700/80
                            bg-gradient-to-br from-brand-50/50 to-transparent
                            dark:from-brand-500/10 dark:to-transparent">
              <div className="text-[13px] font-medium text-gray-900 dark:text-slate-100 truncate">{user?.name}</div>
              <div className="text-[11px] text-gray-500 dark:text-slate-400 truncate">{user?.email}</div>
            </div>
            <div className="py-1">
              <DropdownItem icon="userCircle" label="My profile" onClick={() => { setMenuOpen(false); navigate('/profile'); }} />
              <DropdownItem icon="cog"        label="Settings"   onClick={() => { setMenuOpen(false); navigate('/settings'); }} />
            </div>
            <button
              className="w-full text-left px-4 py-2.5 text-[13px] font-medium
                         text-red-600 dark:text-red-400
                         hover:bg-red-50 dark:hover:bg-red-500/10
                         border-t border-gray-100 dark:border-slate-700/80
                         flex items-center gap-2.5 transition"
              onClick={async () => { await logout(); navigate('/login'); }}
            >
              <Icon name="logout" className="w-[16px] h-[16px]" /> Sign out
            </button>
          </div>
        )}
      </div>
    </header>
  );
}

function DropdownItem({ icon, label, onClick }) {
  return (
    <button
      onClick={onClick}
      className="w-full text-left px-4 py-2.5 text-[13px] font-medium
                 text-gray-700 dark:text-slate-200
                 hover:bg-gray-50 dark:hover:bg-slate-700/40
                 hover:text-gray-900 dark:hover:text-slate-100
                 flex items-center gap-2.5 transition"
    >
      <Icon name={icon} className="w-[16px] h-[16px] text-gray-400 dark:text-slate-500" />
      {label}
    </button>
  );
}
