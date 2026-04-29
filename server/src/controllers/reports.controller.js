const service = require('../services/reports.service');

exports.dashboard = async (req, res, next) => { try { res.json(await service.dashboard()); } catch (e) { next(e); } };
// Filter params (from / to / team_id) flow through unchanged so the
// service is the single place that owns the SQL.
exports.leadsByStatus     = async (req, res, next) => { try { res.json(await service.leadsByStatus(req.query));     } catch (e) { next(e); } };
exports.dealsByStage      = async (req, res, next) => { try { res.json(await service.dealsByStage(req.query));      } catch (e) { next(e); } };
exports.ticketsResolution = async (req, res, next) => { try { res.json(await service.ticketsResolution(req.query)); } catch (e) { next(e); } };
exports.revenueTrend      = async (req, res, next) => { try { res.json(await service.revenueTrend(req.query));      } catch (e) { next(e); } };

// Drill-downs — caller supplies the slice (status/stage_id) plus the
// same filter set; we return up to 50 underlying rows.
exports.leadsForStatus = async (req, res, next) => {
  try { res.json(await service.leadsForStatus(req.params.status, req.query)); }
  catch (e) { next(e); }
};
exports.dealsForStage = async (req, res, next) => {
  try { res.json(await service.dealsForStage(req.params.stageId, req.query)); }
  catch (e) { next(e); }
};
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
