const { query } = require('../config/db');

exports.list = async ({ page = 1, limit = 20, search = '', tag } = {}) => {
  const offset = (Number(page) - 1) * Number(limit);
  const params = [`%${search}%`];
  let where = `(name ILIKE $1 OR email ILIKE $1 OR company ILIKE $1 OR phone ILIKE $1)`;
  if (tag) { params.push(tag); where += ` AND $${params.length} = ANY(tags)`; }
  params.push(Number(limit), offset);
  const { rows } = await query(
    `SELECT * FROM contacts WHERE ${where}
     ORDER BY created_at DESC LIMIT $${params.length - 1} OFFSET $${params.length}`, params
  );
  const countRes = await query(
    `SELECT COUNT(*)::int AS c FROM contacts WHERE ${where}`,
    params.slice(0, params.length - 2)
  );
  return { data: rows, total: countRes.rows[0].c, page: Number(page), limit: Number(limit) };
};

exports.getById = async (id) => {
  const { rows } = await query('SELECT * FROM contacts WHERE id = $1', [id]);
  return rows[0];
};

exports.create = async (body) => {
  const { name, email, phone, company, address, tags = [], owner_id } = body;
  const { rows } = await query(
    `INSERT INTO contacts (name,email,phone,company,address,tags,owner_id)
     VALUES ($1,$2,$3,$4,$5,$6,$7) RETURNING *`,
    [name, email, phone, company, address, tags, owner_id]
  );
  return rows[0];
};

exports.update = async (id, body) => {
  const { name, email, phone, company, address, tags } = body;
  const { rows } = await query(
    `UPDATE contacts SET
       name = COALESCE($2,name),
       email = COALESCE($3,email),
       phone = COALESCE($4,phone),
       company = COALESCE($5,company),
       address = COALESCE($6,address),
       tags = COALESCE($7,tags),
       updated_at = NOW()
     WHERE id = $1 RETURNING *`,
    [id, name, email, phone, company, address, tags]
  );
  return rows[0];
};

exports.remove = async (id) => {
  await query('DELETE FROM contacts WHERE id = $1', [id]);
};
