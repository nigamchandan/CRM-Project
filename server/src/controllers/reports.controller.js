const service = require('../services/reports.service');

exports.dashboard = async (req, res, next) => { try { res.json(await service.dashboard()); } catch (e) { next(e); } };
exports.leadsByStatus = async (req, res, next) => { try { res.json(await service.leadsByStatus()); } catch (e) { next(e); } };
exports.dealsByStage = async (req, res, next) => { try { res.json(await service.dealsByStage()); } catch (e) { next(e); } };
exports.ticketsResolution = async (req, res, next) => { try { res.json(await service.ticketsResolution()); } catch (e) { next(e); } };
exports.revenueTrend = async (req, res, next) => { try { res.json(await service.revenueTrend()); } catch (e) { next(e); } };
exports.recentActivity = async (req, res, next) => { try { res.json(await service.recentActivity(req.query)); } catch (e) { next(e); } };
exports.upcomingTasks = async (req, res, next) => { try { res.json(await service.upcomingTasks(req.query)); } catch (e) { next(e); } };
exports.salesFunnel = async (req, res, next) => { try { res.json(await service.salesFunnel()); } catch (e) { next(e); } };
exports.teamPerformance = async (req, res, next) => { try { res.json(await service.teamPerformance(req.query)); } catch (e) { next(e); } };
exports.slaPerformance  = async (req, res, next) => { try { res.json(await service.slaPerformance());  } catch (e) { next(e); } };
exports.alerts          = async (req, res, next) => { try { res.json(await service.alerts());          } catch (e) { next(e); } };

// Sales (per-user) endpoints — all scoped to req.user.id
exports.myDashboard    = async (req, res, next) => { try { res.json(await service.myDashboard(req.user.id));                } catch (e) { next(e); } };
exports.myPipeline     = async (req, res, next) => { try { res.json(await service.myPipeline(req.user.id, req.query));      } catch (e) { next(e); } };
exports.myTasks        = async (req, res, next) => { try { res.json(await service.myTasks(req.user.id, req.query));         } catch (e) { next(e); } };
exports.myNextActions  = async (req, res, next) => { try { res.json(await service.myNextActions(req.user.id));              } catch (e) { next(e); } };
exports.myActivity     = async (req, res, next) => { try { res.json(await service.myActivity(req.user.id, req.query));      } catch (e) { next(e); } };

// Support (per-user) endpoints
exports.myTicketsDashboard = async (req, res, next) => { try { res.json(await service.myTicketsDashboard(req.user.id));            } catch (e) { next(e); } };
exports.myTicketsQueue     = async (req, res, next) => { try { res.json(await service.myTicketsQueue(req.user.id, req.query));     } catch (e) { next(e); } };
exports.myTicketsActivity  = async (req, res, next) => { try { res.json(await service.myTicketsActivity(req.user.id, req.query));  } catch (e) { next(e); } };
