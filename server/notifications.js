import { z } from 'zod';
import { formatINR } from '../src/utils/money.ts';
import { wrap } from './session.js';

// Adds one notification for each person. Pass the same db client as the surrounding transaction
// so a notification only exists if the thing it talks about was really saved.
export async function notify(db, userIds, { type, title, body = '', link = null }) {
  const ids = [...new Set(userIds.filter(Boolean))];
  for (const userId of ids)
    await db.query('INSERT INTO notifications (user_id, type, title, body, link) VALUES ($1, $2, $3, $4, $5)', [userId, type, title, body, link]);
}

// Account holders of the given group members (people added by name only have no account)
export async function usersOfMembers(db, memberIds, exceptUserId) {
  const { rows } = await db.query('SELECT DISTINCT user_id FROM group_members WHERE id = ANY($1::uuid[]) AND user_id IS NOT NULL AND user_id <> $2', [memberIds, exceptUserId]);
  return rows.map((r) => r.user_id);
}

const previousMonth = () => {
  const d = new Date();
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() - 1, 1)).toISOString().slice(0, 7);
};

// Once a month, tell the person their recap for last month is ready (only if they had spending in it)
async function ensureRecapNotice(pool, userId) {
  const month = previousMonth();
  const key = `recap:${month}`;
  const { rowCount } = await pool.query('SELECT 1 FROM notifications WHERE user_id = $1 AND dedupe_key = $2', [userId, key]);
  if (rowCount) return;
  const { rows: [r] } = await pool.query(
    `SELECT count(*)::int AS n, COALESCE(SUM(COALESCE(s.amount_paise, 0)), 0)::bigint AS spent
     FROM expenses e JOIN group_members me ON me.group_id = e.group_id AND me.user_id = $1
     LEFT JOIN expense_splits s ON s.expense_id = e.id AND s.member_id = me.id
     WHERE (me.id = e.paid_by OR s.member_id IS NOT NULL)
       AND e.expense_date >= ($2 || '-01')::date AND e.expense_date < (($2 || '-01')::date + interval '1 month')`,
    [userId, month],
  );
  if (!r.n) return;
  await pool.query(
    `INSERT INTO notifications (user_id, type, title, body, link, dedupe_key) VALUES ($1, 'recap', $2, $3, $4, $5) ON CONFLICT DO NOTHING`,
    [userId, 'Your monthly recap is ready', `You spent ${formatINR(r.spent)} across ${r.n} expense${r.n === 1 ? '' : 's'}. Tap to see where it went.`, `/recap?month=${month}`, key],
  );
}

export function notificationRoutes(r, pool) {
  const unreadOf = async (userId) => (await pool.query('SELECT count(*)::int AS n FROM notifications WHERE user_id = $1 AND read_at IS NULL', [userId])).rows[0].n;

  r.get('/notifications', wrap(async (req, res) => {
    await ensureRecapNotice(pool, req.user.id);
    const { rows } = await pool.query(
      `SELECT id, type, title, body, link, (read_at IS NOT NULL) AS read, created_at AS "createdAt"
       FROM notifications WHERE user_id = $1 ORDER BY id DESC LIMIT 50`,
      [req.user.id],
    );
    res.json({ notifications: rows, unread: await unreadOf(req.user.id) });
  }));

  // Cheap call the app makes every 30 seconds. sync=1 (first call after opening the app) also creates the monthly recap notice.
  r.get('/notifications/unread-count', wrap(async (req, res) => {
    if (req.query.sync === '1') await ensureRecapNotice(pool, req.user.id);
    res.json({ unread: await unreadOf(req.user.id) });
  }));

  r.post('/notifications/read-all', wrap(async (req, res) => {
    await pool.query('UPDATE notifications SET read_at = now() WHERE user_id = $1 AND read_at IS NULL', [req.user.id]);
    res.json({ ok: true });
  }));

  r.post('/notifications/:id/read', wrap(async (req, res) => {
    if (!z.string().regex(/^\d{1,15}$/).safeParse(req.params.id).success) return res.status(404).json({ error: 'Notification not found' });
    const { rowCount } = await pool.query('UPDATE notifications SET read_at = COALESCE(read_at, now()) WHERE id = $1 AND user_id = $2', [req.params.id, req.user.id]);
    if (!rowCount) return res.status(404).json({ error: 'Notification not found' });
    res.json({ ok: true });
  }));
}
