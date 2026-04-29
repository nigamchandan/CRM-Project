import api from './api';

export const list    = (params) => api.get('/tickets', { params }).then(r => r.data);
export const get     = (id)     => api.get(`/tickets/${id}`).then(r => r.data);
export const create  = (data)   => api.post('/tickets', data).then(r => r.data);
export const update  = (id, d)  => api.put(`/tickets/${id}`, d).then(r => r.data);
export const setStatus = (id, status) => api.patch(`/tickets/${id}/status`, { status }).then(r => r.data);
export const setStage  = (id, pipeline_stage_id) => api.patch(`/tickets/${id}/stage`, { pipeline_stage_id }).then(r => r.data);
export const assign  = (id, payload) => api.patch(`/tickets/${id}/assign`,
  typeof payload === 'object' && payload !== null ? payload : { user_id: payload }
).then(r => r.data);
export const escalate = (id) => api.patch(`/tickets/${id}/escalate`).then(r => r.data);
export const remove  = (id)     => api.delete(`/tickets/${id}`).then(r => r.data);

export const listActivity = (id) => api.get(`/tickets/${id}/activity`).then(r => r.data);

export const listComments = (id) => api.get(`/tickets/${id}/comments`).then(r => r.data);
export const addComment = (id, body, files = [], opts = {}) => {
  const fd = new FormData();
  fd.append('body', body);
  if (opts.is_internal) fd.append('is_internal', 'true');
  files.forEach((f) => fd.append('files', f));
  return api.post(`/tickets/${id}/comments`, fd, {
    headers: { 'Content-Type': 'multipart/form-data' },
  }).then(r => r.data);
};
