require('dotenv').config();
const fs = require('fs');
const path = require('path');
const { pool } = require('../config/db');

(async () => {
  try {
    const sql = fs.readFileSync(path.join(__dirname, 'schema.sql'), 'utf8');
    await pool.query(sql);
    console.log('[migrate] schema applied');
    process.exit(0);
  } catch (err) {
    console.error('[migrate] failed:', err);
    process.exit(1);
  }
})();
