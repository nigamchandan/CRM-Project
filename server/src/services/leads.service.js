const { query } = require('../config/db');

const BASE = `
  SELECT l.*, u.name AS assigned_name, u.email AS assigned_email
  FROM leads l
  LEFT JOIN users u ON u.id = l.assigned_to
`;

exports.list = async ({ page = 1, limit = 20, status, search = '', assigned_to } = {}) => {
  const offset = (Number(page) - 1) * Number(limit);
  const params = [`%${search}%`];
  let where = `(l.name ILIKE $1 OR l.email ILIKE $1 OR l.company ILIKE $1)`;
  if (status) { params.push(status); where += ` AND l.status = $${params.length}`; }
  if (assigned_to) { params.push(assigned_to); where += ` AND l.assigned_to = $${params.length}`; }
  params.push(Number(limit), offset);
  const { rows } = await query(
    `${BASE} WHERE ${where} ORDER BY l.created_at DESC LIMIT $${params.length - 1} OFFSET $${params.length}`, params
  );
  const total = await query(
    `SELECT COUNT(*)::int AS c FROM leads l WHERE ${where}`, params.slice(0, params.length - 2)
  );
  return { data: rows, total: total.rows[0].c, page: Number(page), limit: Number(limit) };
};

exports.getById = async (id) => {
  const { rows } = await query(`${BASE} WHERE l.id = $1`, [id]);
  return rows[0];
};

exports.create = async (body) => {
  const { name, email, phone, company, source, status = 'new', value = 0, assigned_to, notes } = body;
  const { rows } = await query(
    `INSERT INTO leads (name,email,phone,company,source,status,value,assigned_to,notes)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9) RETURNING *`,
    [name, email, phone, company, source, status, value, assigned_to, notes]
  );
  return rows[0];
};

exports.update = async (id, body) => {
  const { name, email, phone, company, source, status, value, assigned_to, notes } = body;
  const { rows } = await query(
    `UPDATE leads SET
       name=COALESCE($2,name), email=COALESCE($3,email), phone=COALESCE($4,phone),
       company=COALESCE($5,company), source=COALESCE($6,source), status=COALESCE($7,status),
       value=COALESCE($8,value), assigned_to=COALESCE($9,assigned_to), notes=COALESCE($10,notes),
       updated_at=NOW()
     WHERE id=$1 RETURNING *`,
    [id, name, email, phone, company, source, status, value, assigned_to, notes]
  );
  return rows[0];
};

exports.assign = async (id, user_id) => {
  const { rows } = await query(
    `UPDATE leads SET assigned_to=$2, updated_at=NOW() WHERE id=$1 RETURNING *`, [id, user_id]
  );
  return rows[0];
};

exports.setStatus = async (id, status) => {
  const { rows } = await query(
    `UPDATE leads SET status=$2, updated_at=NOW() WHERE id=$1 RETURNING *`, [id, status]
  );
  return rows[0];
};

exports.remove = async (id) => { await query('DELETE FROM leads WHERE id = $1', [id]); };
