import api from './api';

/**
 * GET /api/logs — paginated list with filters.
 * Returns the full envelope: { data, total, page, limit }
 */
export const list = (params) => api.get('/logs', { params }).then((r) => r.data);

/** GET /api/logs/actions  — distinct action names + counts (last 7 days). */
export const distinctActions = () => api.get('/logs/actions').then((r) => r.data);

/** GET /api/logs/entities — distinct entity types + counts (last 7 days). */
export const distinctEntities = () => api.get('/logs/entities').then((r) => r.data);

/**
 * GET /api/logs/export — downloads a file with the current filter set applied.
 * @param {object} params — same filter params as list()
 * @param {'csv'|'json'} format
 */
export const exportLogs = async (params = {}, format = 'csv') => {
  const res = await api.get('/logs/export', {
    params: { ...params, format },
    responseType: 'blob',
  });
  const blob = new Blob([res.data], {
    type: format === 'json' ? 'application/json' : 'text/csv',
  });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  const stamp = new Date().toISOString().slice(0, 19).replace(/[:T]/g, '-');
  a.href = url;
  a.download = `audit-logs-${stamp}.${format}`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
};

/**
 * POST /api/logs/purge — admin only. Manually trigger cleanup.
 *
 * Note: we send `{}` rather than `null` because express.json() runs in strict
 * mode by default and rejects a top-level `null` body with
 * `Unexpected token 'n', "null" is not valid JSON`.
 */
export const purgeNow = (days = 7) =>
  api.post('/logs/purge', {}, { params: { days } }).then((r) => r.data);

export default { list, distinctActions, distinctEntities, exportLogs, purgeNow };
