/**
 * Audit-log retention job.
 *
 * Deletes rows from `logs` older than LOG_RETENTION_DAYS (default 7).
 * Schedule: daily at 03:15 server time + a one-shot run on boot so a long-
 * stopped server catches up immediately.
 */
const cron = require('node-cron');
const { query } = require('../config/db');

const RETENTION_DAYS = Number(process.env.LOG_RETENTION_DAYS || 7);
const SCHEDULE = process.env.LOG_RETENTION_CRON || '15 3 * * *'; // every day 03:15

async function purgeOldLogs() {
  try {
    const r = await query(
      `DELETE FROM logs WHERE created_at < NOW() - ($1::int || ' days')::interval`,
      [RETENTION_DAYS]
    );
    if (r.rowCount > 0) {
      console.log(`[retention] purged ${r.rowCount} log row(s) older than ${RETENTION_DAYS} day(s)`);
    } else {
      console.log(`[retention] no logs older than ${RETENTION_DAYS} day(s)`);
    }
    return r.rowCount;
  } catch (err) {
    console.error('[retention] purge failed:', err.message);
    return 0;
  }
}

function start() {
  if (!cron.validate(SCHEDULE)) {
    console.error(`[retention] invalid cron expression "${SCHEDULE}" — job not scheduled`);
    return;
  }
  cron.schedule(SCHEDULE, purgeOldLogs, { timezone: process.env.TZ || 'UTC' });
  console.log(`[retention] scheduled: "${SCHEDULE}" (${RETENTION_DAYS}d retention)`);

  // One-shot catch-up on boot, deferred so it doesn't slow startup.
  setTimeout(purgeOldLogs, 30_000);
}

module.exports = { start, purgeOldLogs, RETENTION_DAYS };
