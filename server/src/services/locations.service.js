const { query } = require('../config/db');

const SELECT_BASE = `
  SELECT l.*,
         (SELECT COUNT(*)::int FROM users    u WHERE u.location_id = l.id)                AS user_count,
         (SELECT COUNT(*)::int FROM teams    t WHERE t.location_id = l.id AND t.is_active) AS team_count,
         (SELECT COUNT(*)::int FROM projects p WHERE p.location_id = l.id AND p.is_active) AS project_count
    FROM locations l
`;

exports.list = async ({ q, active } = {}) => {
  const params = [];
  const where = [];
  if (q)               { params.push(`%${q}%`);                                where.push(`(l.name ILIKE $${params.length} OR l.code ILIKE $${params.length} OR l.address ILIKE $${params.length})`); }
  if (active === true) { where.push('l.is_active = TRUE'); }
  if (active === false){ where.push('l.is_active = FALSE'); }
  const sql = `${SELECT_BASE} ${where.length ? 'WHERE ' + where.join(' AND ') : ''} ORDER BY l.name ASC`;
  const { rows } = await query(sql, params);
  return rows;
};

exports.get = async (id) => {
  const { rows } = await query(`${SELECT_BASE} WHERE l.id = $1`, [id]);
  return rows[0] || null;
};

exports.create = async ({ name, code, address, timezone = 'Asia/Kolkata', is_active = true }) => {
  const { rows } = await query(
    `INSERT INTO locations (name,code,address,timezone,is_active)
     VALUES ($1,$2,$3,$4,$5) RETURNING *`,
    [name, code || null, address || null, timezone, !!is_active]
  );
  return rows[0];
};

exports.update = async (id, { name, code, address, timezone, is_active }) => {
  const { rows } = await query(
    `UPDATE locations SET
        name      = COALESCE($2,name),
        code      = COALESCE($3,code),
        address   = COALESCE($4,address),
        timezone  = COALESCE($5,timezone),
        is_active = COALESCE($6,is_active),
        updated_at = NOW()
      WHERE id = $1 RETURNING *`,
    [id, name, code, address, timezone, is_active]
  );
  return rows[0] || null;
};

exports.remove = async (id) => {
  await query('DELETE FROM locations WHERE id = $1', [id]);
};
