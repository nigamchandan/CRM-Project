import { useEffect, useState } from 'react';
import { useAuth } from '../context/AuthContext.jsx';
import {
  getDashboardKind,
  setDashboardView,
  clearDashboardView,
  canPreviewDashboards,
} from '../utils/role.js';
import AdminDashboard   from '../components/dashboard/AdminDashboard.jsx';
import SalesDashboard   from '../components/dashboard/SalesDashboard.jsx';
import SupportDashboard from '../components/dashboard/SupportDashboard.jsx';

export default function Dashboard() {
  const { user } = useAuth();
  const [kind, setKind] = useState(() => getDashboardKind(user));

  // Recompute whenever the user changes (e.g. after login)
  useEffect(() => { setKind(getDashboardKind(user)); }, [user]);

  const switchTo = (k) => {
    if (k === 'auto') {
      clearDashboardView();
    } else {
      setDashboardView(k);
    }
    setKind(getDashboardKind(user));
  };

  const previewer = canPreviewDashboards(user) ? (
    <DashboardPreviewSwitch active={kind} onChange={switchTo} />
  ) : null;

  switch (kind) {
    case 'support': return <SupportDashboard previewer={previewer} />;
    case 'sales':   return <SalesDashboard   previewer={previewer} />;
    case 'admin':
    default:        return <AdminDashboard   previewer={previewer} />;
  }
}

// Small role-preview pill for admins/managers — lets them see what each dashboard looks like.
function DashboardPreviewSwitch({ active, onChange }) {
  const opts = [
    { id: 'admin',   label: 'Admin'   },
    { id: 'sales',   label: 'Sales'   },
    { id: 'support', label: 'Support' },
  ];
  return (
    <div className="inline-flex items-center gap-1 p-1 rounded-lg bg-gray-100 dark:bg-slate-800 text-xs">
      {opts.map((o) => (
        <button
          key={o.id}
          onClick={() => onChange(o.id)}
          className={`px-3 py-1 rounded-md font-medium transition
            ${active === o.id
              ? 'bg-white dark:bg-slate-700 text-gray-900 dark:text-slate-100 shadow-sm'
              : 'text-gray-500 dark:text-slate-400 hover:text-gray-800 dark:hover:text-slate-200'}`}
        >
          {o.label}
        </button>
      ))}
      <button
        onClick={() => onChange('auto')}
        title="Reset to my role's default dashboard"
        className="px-2 py-1 rounded-md text-gray-400 dark:text-slate-500 hover:text-gray-700 dark:hover:text-slate-200"
      >
        ↺
      </button>
    </div>
  );
}
