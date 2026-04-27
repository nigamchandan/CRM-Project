import api from './api';
export const list = (params) => api.get('/logs', { params }).then(r => r.data);
