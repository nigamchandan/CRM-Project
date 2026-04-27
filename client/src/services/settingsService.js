import api from './api';

export const getAll = () => api.get('/settings').then(r => r.data);
export const upsert = (data) => api.put('/settings', data).then(r => r.data);

// SLA policy (configurable per priority)
export const getSla  = ()      => api.get('/settings/sla').then(r => r.data);
export const setSla  = (data)  => api.put('/settings/sla', data).then(r => r.data);

// Email-notification toggles + sender info
export const getEmail = ()     => api.get('/settings/email').then(r => r.data);
export const setEmail = (data) => api.put('/settings/email', data).then(r => r.data);
