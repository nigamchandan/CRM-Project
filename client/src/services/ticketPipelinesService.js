import api from './api';

export const listPipelines    = (params) => api.get('/ticket-pipelines', { params }).then(r => r.data);
export const getDefault       = ()       => api.get('/ticket-pipelines/default').then(r => r.data);
export const getPipeline      = (id)     => api.get(`/ticket-pipelines/${id}`).then(r => r.data);
export const createPipeline   = (data)   => api.post('/ticket-pipelines', data).then(r => r.data);
export const updatePipeline   = (id, d)  => api.put(`/ticket-pipelines/${id}`, d).then(r => r.data);
export const removePipeline   = (id)     => api.delete(`/ticket-pipelines/${id}`).then(r => r.data);

export const listStages       = (pipelineId) =>
  api.get(`/ticket-pipelines/${pipelineId}/stages`).then(r => r.data);
export const createStage      = (pipelineId, data) =>
  api.post(`/ticket-pipelines/${pipelineId}/stages`, data).then(r => r.data);
export const updateStage      = (pipelineId, stageId, data) =>
  api.put(`/ticket-pipelines/${pipelineId}/stages/${stageId}`, data).then(r => r.data);
export const reorderStages    = (pipelineId, orderedIds) =>
  api.post(`/ticket-pipelines/${pipelineId}/stages/reorder`, { orderedIds }).then(r => r.data);
export const removeStage      = (pipelineId, stageId) =>
  api.delete(`/ticket-pipelines/${pipelineId}/stages/${stageId}`).then(r => r.data);
