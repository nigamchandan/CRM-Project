import api from './api';

export const list   = (params) => api.get('/deals', { params }).then(r => r.data);
export const board  = ()       => api.get('/deals/board').then(r => r.data);
export const get    = (id)     => api.get(`/deals/${id}`).then(r => r.data);
export const create = (data)   => api.post('/deals', data).then(r => r.data);
export const update = (id, d)  => api.put(`/deals/${id}`, d).then(r => r.data);
export const moveStage = (id, stage_id, position = 0) =>
  api.patch(`/deals/${id}/stage`, { stage_id, position }).then(r => r.data);
export const remove = (id)     => api.delete(`/deals/${id}`).then(r => r.data);

export const stages = {
  list:   ()          => api.get('/pipeline-stages').then(r => r.data),
  create: (d)         => api.post('/pipeline-stages', d).then(r => r.data),
  update: (id, d)     => api.put(`/pipeline-stages/${id}`, d).then(r => r.data),
  remove: (id)        => api.delete(`/pipeline-stages/${id}`).then(r => r.data),
};
