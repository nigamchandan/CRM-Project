import api from './api';

export const list    = (params) => api.get('/leads', { params }).then(r => r.data);
export const get     = (id)     => api.get(`/leads/${id}`).then(r => r.data);
export const create  = (data)   => api.post('/leads', data).then(r => r.data);
export const update  = (id, d)  => api.put(`/leads/${id}`, d).then(r => r.data);
export const setStatus = (id, status) => api.patch(`/leads/${id}/status`, { status }).then(r => r.data);
export const assign    = (id, user_id) => api.patch(`/leads/${id}/assign`, { user_id }).then(r => r.data);
export const remove  = (id)     => api.delete(`/leads/${id}`).then(r => r.data);
