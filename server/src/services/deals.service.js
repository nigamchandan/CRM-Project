const { query } = require('../config/db');

const BASE = `
  SELECT d.*, s.name AS stage_name, s.color AS stage_color,
         u.name AS owner_name, c.name AS contact_name
  FROM deals d
  LEFT JOIN pipeline_stages s ON s.id = d.stage_id
  LEFT JOIN users u ON u.id = d.owner_id
  LEFT JOIN contacts c ON c.id = d.contact_id
`;

exports.list = async ({ page = 1, limit = 50, search = '', stage_id } = {}) => {
  const offset = (Number(page) - 1) * Number(limit);
  const params = [`%${search}%`];
  let where = `(d.title ILIKE $1)`;
  if (stage_id) { params.push(stage_id); where += ` AND d.stage_id = $${params.length}`; }
  params.push(Number(limit), offset);
  const { rows } = await query(
    `${BASE} WHERE ${where} ORDER BY d.position ASC, d.created_at DESC
     LIMIT $${params.length - 1} OFFSET $${params.length}`, params
  );
  return { data: rows, page: Number(page), limit: Number(limit) };
};

exports.board = async () => {
  const stages = (await query('SELECT * FROM pipeline_stages ORDER BY position ASC')).rows;
  const deals = (await query(`${BASE} ORDER BY d.position ASC, d.created_at DESC`)).rows;
  const columns = stages.map(s => ({ ...s, deals: deals.filter(d => d.stage_id === s.id) }));
  return { columns };
};

exports.getById = async (id) => {
  const { rows } = await query(`${BASE} WHERE d.id = $1`, [id]);
  return rows[0];
};

exports.create = async (body) => {
  const { title, value = 0, currency = 'USD', stage_id, contact_id, owner_id, expected_close_date, notes, position = 0 } = body;
  const { rows } = await query(
    `INSERT INTO deals (title,value,currency,stage_id,contact_id,owner_id,expected_close_date,notes,position)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9) RETURNING *`,
    [title, value, currency, stage_id, contact_id, owner_id, expected_close_date, notes, position]
  );
  return rows[0];
};

exports.update = async (id, body) => {
  const { title, value, currency, stage_id, contact_id, owner_id, expected_close_date, notes, position } = body;
  const { rows } = await query(
    `UPDATE deals SET
       title=COALESCE($2,title), value=COALESCE($3,value), currency=COALESCE($4,currency),
       stage_id=COALESCE($5,stage_id), contact_id=COALESCE($6,contact_id),
       owner_id=COALESCE($7,owner_id), expected_close_date=COALESCE($8,expected_close_date),
       notes=COALESCE($9,notes), position=COALESCE($10,position), updated_at=NOW()
     WHERE id=$1 RETURNING *`,
    [id, title, value, currency, stage_id, contact_id, owner_id, expected_close_date, notes, position]
  );
  return rows[0];
};

exports.moveStage = async (id, stage_id, position = 0) => {
  const { rows } = await query(
    `UPDATE deals SET stage_id=$2, position=$3, updated_at=NOW() WHERE id=$1 RETURNING *`,
    [id, stage_id, position]
  );
  return rows[0];
};

exports.remove = async (id) => { await query('DELETE FROM deals WHERE id = $1', [id]); };
