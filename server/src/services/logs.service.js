const { query } = require('../config/db');

exports.list = async ({ page = 1, limit = 50, action, entity, entity_id, order = 'desc' } = {}) => {
  const offset = (Number(page) - 1) * Number(limit);
  const params = [];
  let where = '1=1';
  if (action)    { params.push(`%${action}%`); where += ` AND action ILIKE $${params.length}`; }
  if (entity)    { params.push(entity);        where += ` AND entity = $${params.length}`; }
  if (entity_id) { params.push(Number(entity_id)); where += ` AND entity_id = $${params.length}`; }
  const dir = String(order).toLowerCase() === 'asc' ? 'ASC' : 'DESC';
  params.push(Number(limit), offset);
  const { rows } = await query(
    `SELECT l.*, u.name AS user_name, u.email AS user_email
     FROM logs l LEFT JOIN users u ON u.id = l.user_id
     WHERE ${where} ORDER BY l.created_at ${dir}
     LIMIT $${params.length - 1} OFFSET $${params.length}`, params
  );
  const total = await query(
    `SELECT COUNT(*)::int AS c FROM logs WHERE ${where}`, params.slice(0, params.length - 2)
  );
  return { data: rows, total: total.rows[0].c, page: Number(page), limit: Number(limit) };
};
