import api from './api';

/**
 * Workload service — admin/manager-only routing tool. Returns each
 * engineer's open ticket load + a derived score. Sorted ascending so
 * row 0 is always the least-loaded option.
 */
export const engineerLoad = (params = {}) =>
  api.get('/workload/engineers', { params }).then((r) => r.data);

/** Single least-loaded engineer for "suggest" UX. */
export const suggest = (params = {}) =>
  api.get('/workload/suggest', { params }).then((r) => r.data);
