const service = require('../services/stages.service');

exports.list = async (req, res, next) => { try { res.json(await service.list()); } catch (e) { next(e); } };
exports.create = async (req, res, next) => { try { res.status(201).json(await service.create(req.body)); } catch (e) { next(e); } };
exports.update = async (req, res, next) => { try { res.json(await service.update(req.params.id, req.body)); } catch (e) { next(e); } };
exports.remove = async (req, res, next) => { try { await service.remove(req.params.id); res.status(204).end(); } catch (e) { next(e); } };
