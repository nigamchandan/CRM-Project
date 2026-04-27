const { query } = require('../config/db');

const SELECT_BASE = `
  SELECT p.*,
         l.name AS location_name,
         l.code AS location_code,
         pm.name  AS project_manager_name,
         pm.email AS project_manager_email,
         (SELECT COUNT(*)::int FROM tickets t WHERE t.project_id = p.id)                                    AS ticket_count,
         (SELECT COUNT(*)::int FROM tickets t WHERE t.project_id = p.id AND t.status NOT IN ('resolved','closed')) AS open_ticket_count
    FROM projects p
    LEFT JOIN locations l ON l.id = p.location_id
    LEFT JOIN users     pm ON pm.id = p.project_manager_id
`;

exports.list = async ({ q, location_id, project_manager_id, active } = {}) => {
  const params = [];
  const where = [];
  if (q) {
    params.push(`%${q}%`);
    where.push(`(p.name ILIKE $${params.length} OR p.code ILIKE $${params.length} OR p.customer ILIKE $${params.length})`);
  }
  if (location_id)        { params.push(Number(location_id));        where.push(`p.location_id = $${params.length}`); }
  if (project_manager_id) { params.push(Number(project_manager_id)); where.push(`p.project_manager_id = $${params.length}`); }
  if (active === true)    { where.push('p.is_active = TRUE'); }
  if (active === false)   { where.push('p.is_active = FALSE'); }
  const sql = `${SELECT_BASE} ${where.length ? 'WHERE ' + where.join(' AND ') : ''} ORDER BY p.name ASC`;
  const { rows } = await query(sql, params);
  return rows;
};

exports.get = async (id) => {
  const { rows } = await query(`${SELECT_BASE} WHERE p.id = $1`, [id]);
  return rows[0] || null;
};

exports.create = async ({
  name, code, location_id, project_manager_id,
  customer, customer_email, customer_phone, description, is_active = true,
}) => {
  const { rows } = await query(
    `INSERT INTO projects
        (name,code,location_id,project_manager_id,customer,customer_email,customer_phone,description,is_active)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9) RETURNING id`,
    [name, code || null, location_id || null, project_manager_id || null,
     customer || null, customer_email || null, customer_phone || null, description || null, !!is_active]
  );
  return exports.get(rows[0].id);
};

exports.update = async (id, fields) => {
  const { name, code, location_id, project_manager_id,
          customer, customer_email, customer_phone, description, is_active } = fields;
  const { rows } = await query(
    `UPDATE projects SET
       name               = COALESCE($2, name),
       code               = COALESCE($3, code),
       location_id        = COALESCE($4, location_id),
       project_manager_id = COALESCE($5, project_manager_id),
       customer           = COALESCE($6, customer),
       customer_email     = COALESCE($7, customer_email),
       customer_phone     = COALESCE($8, customer_phone),
       description        = COALESCE($9, description),
       is_active          = COALESCE($10, is_active),
       updated_at         = NOW()
     WHERE id = $1 RETURNING id`,
    [id, name, code, location_id, project_manager_id,
     customer, customer_email, customer_phone, description, is_active]
  );
  if (!rows[0]) return null;
  return exports.get(id);
};

exports.remove = async (id) => {
  await query('DELETE FROM projects WHERE id = $1', [id]);
};
