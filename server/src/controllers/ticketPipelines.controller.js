const service = require('../services/ticketPipelines.service');

const parseBool = (v) => (v === undefined ? undefined : v === 'true' || v === true);

/* -------- pipelines -------- */

exports.list = async (req, res, next) => {
  try { res.json(await service.listPipelines({ active: parseBool(req.query.active) })); }
  catch (e) { next(e); }
};

exports.get = async (req, res, next) => {
  try {
    const row = await service.getPipeline(req.params.id);
    if (!row) return res.status(404).json({ message: 'Pipeline not found' });
    const stages = await service.listStages({ pipeline_id: row.id });
    res.json({ ...row, stages });
  } catch (e) { next(e); }
};

exports.getDefault = async (req, res, next) => {
  try {
    const row = await service.getDefaultPipeline();
    if (!row) return res.status(404).json({ message: 'No default pipeline configured' });
    const stages = await service.listStages({ pipeline_id: row.id });
    res.json({ ...row, stages });
  } catch (e) { next(e); }
};

exports.create = async (req, res, next) => {
  try { res.status(201).json(await service.createPipeline(req.body || {})); }
  catch (e) { next(e); }
};

exports.update = async (req, res, next) => {
  try {
    const row = await service.updatePipeline(req.params.id, req.body || {});
    if (!row) return res.status(404).json({ message: 'Pipeline not found' });
    res.json(row);
  } catch (e) { next(e); }
};

exports.remove = async (req, res, next) => {
  try { await service.removePipeline(req.params.id); res.status(204).end(); }
  catch (e) { next(e); }
};

/* -------- stages -------- */

exports.listStages = async (req, res, next) => {
  try {
    res.json(await service.listStages({
      pipeline_id: req.params.pipelineId || req.query.pipeline_id,
    }));
  } catch (e) { next(e); }
};

exports.createStage = async (req, res, next) => {
  try {
    const body = { ...(req.body || {}) };
    if (req.params.pipelineId) body.pipeline_id = req.params.pipelineId;
    res.status(201).json(await service.createStage(body));
  } catch (e) { next(e); }
};

exports.updateStage = async (req, res, next) => {
  try {
    const row = await service.updateStage(req.params.stageId || req.params.id, req.body || {});
    if (!row) return res.status(404).json({ message: 'Stage not found' });
    res.json(row);
  } catch (e) { next(e); }
};

exports.reorderStages = async (req, res, next) => {
  try {
    const orderedIds = (req.body && req.body.orderedIds) || [];
    res.json(await service.reorderStages(req.params.pipelineId, orderedIds));
  } catch (e) { next(e); }
};

exports.removeStage = async (req, res, next) => {
  try { await service.removeStage(req.params.stageId || req.params.id); res.status(204).end(); }
  catch (e) { next(e); }
};
