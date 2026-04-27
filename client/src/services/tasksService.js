import api from './api';

export const list    = (params) => api.get('/tasks', { params }).then(r => r.data);
export const create  = (data)   => api.post('/tasks', data).then(r => r.data);
export const update  = (id, d)  => api.put(`/tasks/${id}`, d).then(r => r.data);
export const complete = (id, completed = true) => api.patch(`/tasks/${id}/complete`, { completed }).then(r => r.data);
export const remove  = (id)     => api.delete(`/tasks/${id}`).then(r => r.data);
