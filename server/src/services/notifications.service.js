const { query } = require('../config/db');
const { emitToUser } = require('../config/socket');

exports.listForUser = async (userId, { unread } = {}) => {
  const params = [userId];
  let where = 'user_id = $1';
  if (unread === 'true') where += ' AND is_read = FALSE';
  const { rows } = await query(
    `SELECT * FROM notifications WHERE ${where} ORDER BY created_at DESC LIMIT 100`, params
  );
  const unreadCount = (await query(
    'SELECT COUNT(*)::int AS c FROM notifications WHERE user_id=$1 AND is_read=FALSE', [userId]
  )).rows[0].c;
  return { data: rows, unreadCount };
};

exports.createAndEmit = async ({ user_id, type, title, message, link = null }) => {
  const { rows } = await query(
    `INSERT INTO notifications (user_id,type,title,message,link)
     VALUES ($1,$2,$3,$4,$5) RETURNING *`,
    [user_id, type, title, message, link]
  );
  const notif = rows[0];
  emitToUser(user_id, 'notification:new', notif);
  return notif;
};

exports.markRead = async (id, userId) => {
  const { rows } = await query(
    `UPDATE notifications SET is_read=TRUE WHERE id=$1 AND user_id=$2 RETURNING *`, [id, userId]
  );
  return rows[0];
};

exports.markAllRead = async (userId) => {
  await query(`UPDATE notifications SET is_read=TRUE WHERE user_id=$1 AND is_read=FALSE`, [userId]);
  return { ok: true };
};

exports.remove = async (id, userId) => {
  await query('DELETE FROM notifications WHERE id=$1 AND user_id=$2', [id, userId]);
};
