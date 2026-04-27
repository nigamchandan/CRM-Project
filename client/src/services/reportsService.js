import api from './api';

export const dashboard        = () => api.get('/reports/dashboard').then(r => r.data);
export const leadsByStatus    = () => api.get('/reports/leads-by-status').then(r => r.data);
export const dealsByStage     = () => api.get('/reports/deals-by-stage').then(r => r.data);
export const ticketsResolution = () => api.get('/reports/tickets-resolution').then(r => r.data);
export const revenueTrend     = () => api.get('/reports/revenue-trend').then(r => r.data);
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
