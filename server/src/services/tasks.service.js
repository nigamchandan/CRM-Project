const { query } = require('../config/db');

const BASE = `
  SELECT t.*, u.name AS assigned_name, c.name AS creator_name
  FROM tasks t
  LEFT JOIN users u ON u.id = t.assigned_to
  LEFT JOIN users c ON c.id = t.created_by
`;

/**
 * Row-level scoping for tasks.
 *   admin / manager → all tasks (managers oversee assignment)
 *   engineer / user → only tasks they're assigned to OR created themselves
 *
 * Returns the SQL fragment to AND into a WHERE clause; pushes any params.
 */
function roleScopeWhere(currentUser, params) {
  if (!currentUser) return '';
  const role = currentUser.role;
  if (role === 'admin' || role === 'manager') return '';
  params.push(Number(currentUser.id));
  const me = `$${params.length}`;
  return ` AND (t.assigned_to = ${me} OR t.created_by = ${me})`;
}
exports.roleScopeWhere = roleScopeWhere;

exports.list = async ({ page = 1, limit = 50, status, mine, currentUserId, currentUser } = {}) => {
  const offset = (Number(page) - 1) * Number(limit);
  const params = [];
  let where = '1=1';
  if (status) { params.push(status); where += ` AND t.status = $${params.length}`; }
  if (mine === 'true' && currentUserId) { params.push(currentUserId); where += ` AND t.assigned_to = $${params.length}`; }
  where += roleScopeWhere(currentUser, params);
  params.push(Number(limit), offset);
  const { rows } = await query(
    `${BASE} WHERE ${where} ORDER BY t.due_date NULLS LAST, t.created_at DESC
     LIMIT $${params.length - 1} OFFSET $${params.length}`, params
  );
  return { data: rows, page: Number(page), limit: Number(limit) };
};

exports.getById = async (id, currentUser = null) => {
  const params = [id];
  const scope  = roleScopeWhere(currentUser, params);
  const { rows } = await query(`${BASE} WHERE t.id = $1${scope}`, params);
  return rows[0];
};

exports.create = async (body) => {
  const { title, description, due_date, priority = 'medium', status = 'pending', assigned_to, created_by, related_type, related_id } = body;
  const { rows } = await query(
    `INSERT INTO tasks (title,description,due_date,priority,status,assigned_to,created_by,related_type,related_id)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9) RETURNING *`,
    [title, description, due_date, priority, status, assigned_to, created_by, related_type, related_id]
  );
  return rows[0];
};

exports.update = async (id, body) => {
  const { title, description, due_date, priority, status, assigned_to } = body;
  const { rows } = await query(
    `UPDATE tasks SET
       title=COALESCE($2,title), description=COALESCE($3,description),
       due_date=COALESCE($4,due_date), priority=COALESCE($5,priority),
       status=COALESCE($6,status), assigned_to=COALESCE($7,assigned_to),
       updated_at=NOW() WHERE id=$1 RETURNING *`,
    [id, title, description, due_date, priority, status, assigned_to]
  );
  return rows[0];
};

exports.complete = async (id, completed = true) => {
  const { rows } = await query(
    `UPDATE tasks SET status=$2, completed_at = CASE WHEN $2='completed' THEN NOW() ELSE NULL END,
     updated_at=NOW() WHERE id=$1 RETURNING *`,
    [id, completed ? 'completed' : 'pending']
  );
  return rows[0];
};

exports.remove = async (id) => { await query('DELETE FROM tasks WHERE id = $1', [id]); };
