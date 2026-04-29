import { NavLink } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext.jsx';
import Icon from '../ui/Icon.jsx';
import Logo from '../brand/Logo.jsx';

// Each nav entry can declare:
//   roles:   whitelist (only these roles see it)
//   hideFor: blacklist (everyone except these roles see it)
// Site/support engineers live entirely inside Tickets + Tasks, so the
// sales-side modules (Contacts, Leads, Deals, Reports) are hidden for them.
const NAV = [
  { section: 'Workspace' },
  { to: '/',          label: 'Dashboard',  icon: 'home' },
  { to: '/contacts',  label: 'Contacts',   icon: 'users',      hideFor: ['engineer'] },
  { to: '/leads',     label: 'Leads',      icon: 'target',     hideFor: ['engineer'] },
  { to: '/deals',     label: 'Deals',      icon: 'briefcase',  hideFor: ['engineer'] },

  { section: 'Service' },
  { to: '/tickets',   label: 'Tickets',    icon: 'ticket' },
  { to: '/tasks',     label: 'Tasks',      icon: 'checkCircle' },
  { to: '/reports',   label: 'Reports',    icon: 'chartBar',   hideFor: ['engineer'] },

  { section: 'Manage', roles: ['admin', 'manager'] },
  { to: '/users',     label: 'Users',      icon: 'userCircle', roles: ['admin','manager'] },
  { to: '/settings',  label: 'Settings',   icon: 'cog',        roles: ['admin','manager'] },
  { to: '/logs',      label: 'Audit Logs', icon: 'document',   roles: ['admin','manager'] },
];

export default function Sidebar({ mobileOpen, onClose }) {
  const { user } = useAuth();
  const role = user?.role;

  // Filter nav entries by role. Section headings disappear if all of their
  // following items get filtered out (so engineers don't see an empty
  // "Manage" header).
  const items = filterNav(NAV, role);

  return (
    <>
      {mobileOpen && (
        <div className="fixed inset-0 bg-black/50 z-30 md:hidden backdrop-blur-sm" onClick={onClose} />
      )}
      <aside
        className={`
          fixed md:static z-40 h-screen md:h-auto w-56 flex flex-col
          bg-white dark:bg-[#0f0f1a]
          border-r border-gray-100 dark:border-slate-800/70
          transform transition-transform md:transform-none
          ${mobileOpen ? 'translate-x-0' : '-translate-x-full md:translate-x-0'}
        `}
      >
        {/* Brand header */}
        <div className="h-16 px-4 flex items-center border-b border-gray-100 dark:border-slate-800/70">
          <Logo to="/" variant="inline" size="md" version="v1.1" />
        </div>

        {/* Nav */}
        <nav className="flex-1 px-2.5 py-3 overflow-y-auto">
          {items.map((item, idx) => {
            if (item.section) {
              return (
                <div
                  key={`s-${idx}`}
                  className="px-2.5 pt-3 pb-1.5 text-[10px] font-semibold uppercase tracking-[0.12em] text-gray-400 dark:text-slate-500"
                >
                  {item.section}
                </div>
              );
            }
            return (
              <NavLink
                key={item.to}
                to={item.to}
                end={item.to === '/'}
                onClick={onClose}
                className={({ isActive }) => `group nav-item ${isActive ? 'nav-item--active' : ''}`}
              >
                <Icon name={item.icon} className="w-[18px] h-[18px] flex-shrink-0" />
                <span className="nav-label truncate">{item.label}</span>
              </NavLink>
            );
          })}
        </nav>

        {/* User card at bottom */}
        <div className="p-3 border-t border-gray-100 dark:border-slate-800/70">
          <div className="flex items-center gap-2.5 p-2 rounded-lg
                          hover:bg-gray-50 dark:hover:bg-slate-800/40 transition cursor-default">
            <div className="w-9 h-9 rounded-full bg-brand-gradient-r text-white flex items-center justify-center text-sm font-semibold shrink-0 shadow-inset-top">
              {user?.name?.[0]?.toUpperCase() || 'U'}
            </div>
            <div className="min-w-0 flex-1">
              <div className="text-[13px] font-medium text-gray-900 dark:text-slate-100 truncate tracking-tight">
                {user?.name}
              </div>
              <div className="text-[11px] text-gray-500 dark:text-slate-500 capitalize leading-tight">
                {user?.role}
              </div>
            </div>
          </div>
        </div>
      </aside>
    </>
  );
}

/* ---------- helpers ---------- */

function filterNav(nav, role) {
  // First pass: drop role-restricted items.
  const visibleByRole = nav.filter((item) => {
    if (item.roles && !item.roles.includes(role)) return false;
    if (item.hideFor && item.hideFor.includes(role)) return false;
    return true;
  });

  // Second pass: drop section headers that have no following links.
  const result = [];
  for (let i = 0; i < visibleByRole.length; i++) {
    const item = visibleByRole[i];
    if (item.section) {
      const next = visibleByRole[i + 1];
      if (!next || next.section) continue; // empty section — skip
    }
    result.push(item);
  }
  return result;
}
