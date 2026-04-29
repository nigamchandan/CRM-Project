import api from './api';

export const dashboard        = () => api.get('/reports/dashboard').then(r => r.data);
export const leadsByStatus    = (params)  => api.get('/reports/leads-by-status',    { params }).then(r => r.data);
export const dealsByStage     = (params)  => api.get('/reports/deals-by-stage',     { params }).then(r => r.data);
export const ticketsResolution = (params) => api.get('/reports/tickets-resolution', { params }).then(r => r.data);
export const revenueTrend     = (params)  => api.get('/reports/revenue-trend',      { params }).then(r => r.data);
// Drill-downs (clicking a chart slice).
export const leadsForStatus   = (status, params) => api.get(`/reports/leads-by-status/${encodeURIComponent(status)}`, { params }).then(r => r.data);
export const dealsForStage    = (stageId, params) => api.get(`/reports/deals-by-stage/${stageId}`, { params }).then(r => r.data);
export const recentActivity   = (params) => api.get('/reports/recent-activity', { params }).then(r => r.data);
export const upcomingTasks    = (params) => api.get('/reports/upcoming-tasks', { params }).then(r => r.data);
export const salesFunnel      = () => api.get('/reports/sales-funnel').then(r => r.data);
export const teamPerformance  = (params) => api.get('/reports/team-performance', { params }).then(r => r.data);
export const slaPerformance   = () => api.get('/reports/sla-performance').then(r => r.data);
export const alerts           = () => api.get('/reports/alerts').then(r => r.data);

// Sales dashboard (per-user)
export const myDashboard      = () => api.get('/reports/my-dashboard').then(r => r.data);
export const myPipeline       = (params) => api.get('/reports/my-pipeline', { params }).then(r => r.data);
export const myTasks          = (params) => api.get('/reports/my-tasks', { params }).then(r => r.data);
export const myNextActions    = () => api.get('/reports/my-next-actions').then(r => r.data);
export const myActivity       = (params) => api.get('/reports/my-activity', { params }).then(r => r.data);

// Support dashboard (per-user)
export const myTicketsDashboard = () => api.get('/reports/my-tickets-dashboard').then(r => r.data);
export const myTicketsQueue     = (params) => api.get('/reports/my-tickets-queue', { params }).then(r => r.data);
export const myTicketsActivity  = (params) => api.get('/reports/my-tickets-activity', { params }).then(r => r.data);
