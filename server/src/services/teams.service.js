const { query } = require('../config/db');

const SELECT_BASE = `
  SELECT t.*,
         l.name AS location_name,
         l.code AS location_code,
         (SELECT COUNT(*)::int FROM users u WHERE u.team_id = t.id)                  AS member_count,
         (SELECT COUNT(*)::int FROM users u WHERE u.team_id = t.id AND u.role='engineer') AS engineer_count,
         (SELECT COUNT(*)::int FROM users u WHERE u.team_id = t.id AND u.role='manager')  AS manager_count
    FROM teams t
    LEFT JOIN locations l ON l.id = t.location_id
`;

exports.list = async ({ q, location_id, active } = {}) => {
  const params = [];
  const where = [];
  if (q)               { params.push(`%${q}%`);  where.push(`(t.name ILIKE $${params.length} OR t.description ILIKE $${params.length})`); }
  if (location_id)     { params.push(Number(location_id)); where.push(`t.location_id = $${params.length}`); }
  if (active === true) { where.push('t.is_active = TRUE'); }
  if (active === false){ where.push('t.is_active = FALSE'); }
  const sql = `${SELECT_BASE} ${where.length ? 'WHERE ' + where.join(' AND ') : ''} ORDER BY l.name NULLS LAST, t.name ASC`;
  const { rows } = await query(sql, params);
  return rows;
};

exports.get = async (id) => {
  const { rows } = await query(`${SELECT_BASE} WHERE t.id = $1`, [id]);
  return rows[0] || null;
};

exports.members = async (id) => {
  const { rows } = await query(
    `SELECT id,name,email,role,is_active FROM users WHERE team_id = $1 ORDER BY role,name`, [id]
  );
  return rows;
};

exports.create = async ({ name, location_id, description, is_active = true }) => {
  const { rows } = await query(
    `INSERT INTO teams (name,location_id,description,is_active)
     VALUES ($1,$2,$3,$4) RETURNING *`,
    [name, location_id || null, description || null, !!is_active]
  );
  return exports.get(rows[0].id);
};

exports.update = async (id, { name, location_id, description, is_active }) => {
  const { rows } = await query(
    `UPDATE teams SET
       name        = COALESCE($2,name),
       location_id = COALESCE($3,location_id),
       description = COALESCE($4,description),
       is_active   = COALESCE($5,is_active),
       updated_at  = NOW()
     WHERE id = $1 RETURNING id`,
    [id, name, location_id, description, is_active]
  );
  if (!rows[0]) return null;
  return exports.get(id);
};

exports.remove = async (id) => {
  await query('DELETE FROM teams WHERE id = $1', [id]);
};
