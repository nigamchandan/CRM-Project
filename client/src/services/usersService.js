import api from './api';

export const list    = (params) => api.get('/users', { params }).then(r => r.data);
export const create  = (data)   => api.post('/users', data).then(r => r.data);
export const update  = (id, d)  => api.put(`/users/${id}`, d).then(r => r.data);
export const toggleStatus = (id, is_active) => api.patch(`/users/${id}/status`, { is_active }).then(r => r.data);
export const remove  = (id)     => api.delete(`/users/${id}`).then(r => r.data);
