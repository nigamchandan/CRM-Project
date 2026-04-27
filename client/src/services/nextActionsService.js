import api from './api';

// Get next-action suggestions for the current user.
//   scope: 'mine' (default) | 'team' (admin/manager only)
export const get = (scope = 'mine') =>
  api.get('/next-actions', { params: { scope } }).then((r) => r.data);
