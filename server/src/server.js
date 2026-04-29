require('dotenv').config();
const http = require('http');
const app = require('./app');
const { initSocket } = require('./config/socket');
const { pool } = require('./config/db');
const retentionJob = require('./jobs/retention.job');
const slaJob       = require('./jobs/sla.job');

const PORT = process.env.PORT || 5000;
const server = http.createServer(app);

initSocket(server);

(async () => {
  try {
    await pool.query('SELECT 1');
    console.log('[db] connected to PostgreSQL');
  } catch (err) {
    console.error('[db] connection failed:', err.message);
  }

  retentionJob.start();
  slaJob.start();

  server.listen(PORT, () => {
    console.log(`[server] running on http://localhost:${PORT}`);
  });
})();

process.on('unhandledRejection', (err) => {
  console.error('[unhandledRejection]', err);
});
