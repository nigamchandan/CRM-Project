const { query } = require('../config/db');

exports.list = async () => {
  const { rows } = await query('SELECT * FROM pipeline_stages ORDER BY position ASC');
  return rows;
};
exports.create = async ({ name, position = 0, color = '#6b7280' }) => {
  const { rows } = await query(
    `INSERT INTO pipeline_stages (name, position, color) VALUES ($1,$2,$3) RETURNING *`,
    [name, position, color]
  );
  return rows[0];
};
exports.update = async (id, { name, position, color }) => {
  const { rows } = await query(
    `UPDATE pipeline_stages SET
       name = COALESCE($2,name), position = COALESCE($3,position),
       color = COALESCE($4,color), updated_at = NOW()
     WHERE id = $1 RETURNING *`,
    [id, name, position, color]
  );
  return rows[0];
};
exports.remove = async (id) => { await query('DELETE FROM pipeline_stages WHERE id = $1', [id]); };
