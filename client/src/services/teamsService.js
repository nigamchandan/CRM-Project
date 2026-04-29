import api from './api';

/**
 * Teams service — used by Reports filters and any future team-scoped UI.
 * Returns a flat list of `{ id, name }`.
 */
export const list = (params) =>
  api.get('/teams', { params }).then((r) => r.data?.data ?? r.data ?? []);
