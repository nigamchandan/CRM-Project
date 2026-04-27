const service = require('../services/logs.service');
const retentionJob = require('../jobs/retention.job');

exports.list = async (req, res, next) => {
  try { res.json(await service.list(req.query)); } catch (e) { next(e); }
};

exports.actions = async (_req, res, next) => {
  try { res.json(await service.distinctActions()); } catch (e) { next(e); }
};

exports.entities = async (_req, res, next) => {
  try { res.json(await service.distinctEntities()); } catch (e) { next(e); }
};

/** GET /api/logs/export?format=csv|json&...filters */
exports.export = async (req, res, next) => {
  try {
    const format = String(req.query.format || 'csv').toLowerCase();
    const rows = await service.listAll(req.query);
    const stamp = new Date().toISOString().slice(0, 19).replace(/[:T]/g, '-');

    if (format === 'json') {
      res.setHeader('Content-Type', 'application/json; charset=utf-8');
      res.setHeader('Content-Disposition', `attachment; filename="audit-logs-${stamp}.json"`);
      return res.send(JSON.stringify(rows, null, 2));
    }

    // ---------- CSV ----------
    const cols = [
      'id', 'created_at', 'user_id', 'user_name', 'user_email',
      'action', 'entity', 'entity_id', 'meta', 'meta_resolved',
    ];
    const csvEscape = (v) => {
      if (v === null || v === undefined) return '';
      const s = typeof v === 'object' ? JSON.stringify(v) : String(v);
      return /[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
    };
    const lines = [cols.join(',')];
    for (const r of rows) lines.push(cols.map((c) => csvEscape(r[c])).join(','));
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="audit-logs-${stamp}.csv"`);
    return res.send(lines.join('\n'));
  } catch (e) { next(e); }
};

/** POST /api/logs/purge — admin one-shot cleanup. */
exports.purgeNow = async (req, res, next) => {
  try {
    const days = Number(req.query.days || req.body?.days || retentionJob.RETENTION_DAYS);
    const result = await service.purgeOlderThan(days);
    res.json(result);
  } catch (e) { next(e); }
};
