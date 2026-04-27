import api from './api';

export const list   = (params) => api.get('/projects', { params }).then(r => r.data);
export const get    = (id)     => api.get(`/projects/${id}`).then(r => r.data);
export const create = (data)   => api.post('/projects', data).then(r => r.data);
export const update = (id, d)  => api.put(`/projects/${id}`, d).then(r => r.data);
export const remove = (id)     => api.delete(`/projects/${id}`).then(r => r.data);
