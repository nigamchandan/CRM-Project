// ---------------------------------------------------------------------------
// Role / dashboard-kind detection
// ---------------------------------------------------------------------------
// The backend stores a single `role` string on each user
//   (admin | manager | engineer | user).
// This module maps that to a "dashboard kind":
//
//   admin    → AdminDashboard   (full system overview)
//   sales    → SalesDashboard   (personal pipeline + tasks)
//   support  → SupportDashboard (ticket queue + SLA)
//
// Admins/managers can preview a different dashboard via:
//   - URL query param   ?view=sales      (one-shot)
//   - localStorage key  dashboardView    (sticky)
// ---------------------------------------------------------------------------

export const DASHBOARD_KINDS = ['admin', 'sales', 'support'];

const ROLE_TO_KIND = {
  admin:    'admin',
  manager:  'admin',
  engineer: 'support', // site/support engineers land on the SupportDashboard
  user:     'sales',   // default for non-privileged users (sales)
};

export function getDashboardKind(user) {
  if (typeof window !== 'undefined') {
    const params = new URLSearchParams(window.location.search);
    const v = params.get('view');
    if (v && DASHBOARD_KINDS.includes(v)) return v;

    const stored = localStorage.getItem('dashboardView');
    if (stored && DASHBOARD_KINDS.includes(stored)) {
      // Only honour stored preview for admin/manager (security through obscurity is not security,
      // but sales users shouldn't accidentally land on a dashboard that exposes team-wide data).
      if (user?.role === 'admin' || user?.role === 'manager') return stored;
    }
  }
  return ROLE_TO_KIND[user?.role] || 'sales';
}

export function setDashboardView(kind) {
  if (!DASHBOARD_KINDS.includes(kind)) return;
  localStorage.setItem('dashboardView', kind);
}

export function clearDashboardView() {
  localStorage.removeItem('dashboardView');
}

export function canPreviewDashboards(user) {
  return user?.role === 'admin' || user?.role === 'manager';
}
