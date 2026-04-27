import api from './api';

export const list    = (params) => api.get('/contacts', { params }).then(r => r.data);
export const get     = (id)     => api.get(`/contacts/${id}`).then(r => r.data);
export const create  = (data)   => api.post('/contacts', data).then(r => r.data);
export const update  = (id, d)  => api.put(`/contacts/${id}`, d).then(r => r.data);
export const remove  = (id)     => api.delete(`/contacts/${id}`).then(r => r.data);
