import { NavLink } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext.jsx';
import Icon from '../ui/Icon.jsx';

const NAV = [
  { to: '/',          label: 'Dashboard',  icon: 'home' },
  { to: '/contacts',  label: 'Contacts',   icon: 'users' },
  { to: '/leads',     label: 'Leads',      icon: 'target' },
  { to: '/deals',     label: 'Deals',      icon: 'briefcase' },
  { to: '/tickets',   label: 'Tickets',    icon: 'ticket' },
  { to: '/tasks',     label: 'Tasks',      icon: 'checkCircle' },
  { to: '/reports',   label: 'Reports',    icon: 'chartBar' },
  { to: '/users',     label: 'Users',      icon: 'userCircle', roles: ['admin','manager'] },
  { to: '/settings',  label: 'Settings',   icon: 'cog',        roles: ['admin'] },
  { to: '/logs',      label: 'Audit Logs', icon: 'document',   roles: ['admin','manager'] },
];

export default function Sidebar({ mobileOpen, onClose }) {
  const { user } = useAuth();
  const links = NAV.filter(n => !n.roles || n.roles.includes(user?.role));

  return (
    <>
      {mobileOpen && (
        <div className="fixed inset-0 bg-black/50 z-30 md:hidden backdrop-blur-sm" onClick={onClose} />
      )}
      <aside
        className={`
          fixed md:static z-40 h-screen md:h-auto w-52 flex flex-col
          bg-white dark:bg-slate-900
          border-r border-gray-100 dark:border-slate-800
          transform transition-transform md:transform-none
          ${mobileOpen ? 'translate-x-0' : '-translate-x-full md:translate-x-0'}
        `}
      >
        <div className="h-14 px-3 flex items-center border-b border-gray-100 dark:border-slate-800">
          <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-brand-500 to-brand-700 text-white flex items-center justify-center text-sm font-bold shadow-md shadow-brand-500/30">
            C
          </div>
          <div className="ml-2 min-w-0">
            <div className="text-[13px] font-semibold text-gray-900 dark:text-slate-100 leading-tight truncate">Modern CRM</div>
            <div className="text-[10px] text-gray-500 dark:text-slate-500 leading-tight">v1.0</div>
          </div>
        </div>

        <nav className="flex-1 px-2 py-2 space-y-0.5 overflow-y-auto">
          <div className="px-2 pt-1 pb-1 text-[10px] font-semibold uppercase tracking-wider text-gray-400 dark:text-slate-500">
            Workspace
          </div>
          {links.map((n) => (
            <NavLink
              key={n.to}
              to={n.to}
              end={n.to === '/'}
              onClick={onClose}
              className={({ isActive }) => `
                group flex items-center gap-2.5 px-2.5 py-1.5 rounded-md text-[13px] transition-colors
                ${isActive
                  ? 'bg-brand-50 text-brand-700 font-medium dark:bg-brand-500/10 dark:text-brand-300'
                  : 'text-gray-700 hover:bg-gray-50 dark:text-slate-400 dark:hover:bg-slate-800/60 dark:hover:text-slate-200'}
              `}
            >
              {({ isActive }) => (
                <>
                  <span className={`relative flex items-center ${isActive ? 'text-brand-600 dark:text-brand-400' : ''}`}>
                    {isActive && (
                      <span className="absolute -left-2.5 top-1/2 -translate-y-1/2 w-1 h-4 rounded-r-full bg-brand-600 dark:bg-brand-400" />
                    )}
                    <Icon name={n.icon} className="w-4 h-4" />
                  </span>
                  <span className="truncate">{n.label}</span>
                </>
              )}
            </NavLink>
          ))}
        </nav>

        <div className="p-2.5 border-t border-gray-100 dark:border-slate-800">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-full bg-gradient-to-br from-brand-500 to-brand-700 text-white flex items-center justify-center text-xs font-semibold shrink-0">
              {user?.name?.[0]?.toUpperCase() || 'U'}
            </div>
            <div className="min-w-0 flex-1">
              <div className="text-[12px] font-medium text-gray-900 dark:text-slate-100 truncate">{user?.name}</div>
              <div className="text-[10px] text-gray-500 dark:text-slate-500 capitalize leading-tight">{user?.role}</div>
            </div>
          </div>
        </div>
      </aside>
    </>
  );
}
