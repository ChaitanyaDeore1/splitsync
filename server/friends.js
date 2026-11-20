import { z } from 'zod';
import { invalid } from './queries.js';
import { notify } from './notifications.js';
import { wrap } from './session.js';

const uuid = z.string().uuid();

export function friendRoutes(r, pool) {
  // Exact username/email lookup only, so nobody can browse or harvest other people's details
  r.get('/users/search', wrap(async (req, res) => {
    const raw = z.string().trim().min(3).max(120).safeParse(req.query.q ?? req.query.email);
    if (!raw.success) return res.status(400).json({ error: 'Enter a username or the full email address of the person you want to find.' });
    const identifier = raw.data.toLowerCase();
    const { rows: [user] } = await pool.query(
      'SELECT id, name FROM users WHERE (lower(username) = $1 OR lower(email) = $1) AND id <> $2',
      [identifier, req.user.id],
    );
    res.json({ user: user ?? null });
  }));

  r.get('/friends', wrap(async (req, res) => {
    const { rows } = await pool.query(
      `SELECT f.id, f.status, (f.requester_id = $1) AS "sentByMe", u.id AS "userId", u.name, u.email, u.username
       FROM friendships f JOIN users u ON u.id = CASE WHEN f.requester_id = $1 THEN f.addressee_id ELSE f.requester_id END
       WHERE f.requester_id = $1 OR f.addressee_id = $1 ORDER BY u.name`,
      [req.user.id],
    );
    const brief = ({ id, userId, name, username }) => ({ id, userId, name, username });
    res.json({
      friends: rows.filter((x) => x.status === 'accepted').map(({ id, userId, name, email, username }) => ({ id, userId, name, email, username })),
      incoming: rows.filter((x) => x.status === 'pending' && !x.sentByMe).map(brief),
      outgoing: rows.filter((x) => x.status === 'pending' && x.sentByMe).map(brief),
    });
  }));

  r.post('/friends/requests', wrap(async (req, res) => {
    const parsed = z.object({ userId: uuid }).safeParse(req.body);
    if (!parsed.success) return invalid(res, parsed);
    const other = parsed.data.userId;
    if (other === req.user.id) return res.status(400).json({ error: 'You cannot add yourself as a friend.' });
    const { rows: [target] } = await pool.query('SELECT id FROM users WHERE id = $1', [other]);
    if (!target) return res.status(404).json({ error: 'User not found' });

    const { rows: [existing] } = await pool.query(
      'SELECT id, status, requester_id FROM friendships WHERE LEAST(requester_id, addressee_id) = LEAST($1::uuid, $2::uuid) AND GREATEST(requester_id, addressee_id) = GREATEST($1::uuid, $2::uuid)',
      [req.user.id, other],
    );
    if (existing?.status === 'accepted') return res.status(409).json({ error: 'You are already friends.' });
    if (existing && existing.requester_id === req.user.id) return res.status(409).json({ error: 'Friend request already sent.' });
    if (existing) { // they already asked you: sending a request back accepts theirs
      await pool.query(`UPDATE friendships SET status = 'accepted' WHERE id = $1`, [existing.id]);
      await notify(pool, [other], { type: 'friend', title: 'Friend request accepted', body: `${req.user.name} is now your friend.`, link: '/friends' });
      return res.json({ status: 'accepted' });
    }
    try {
      await pool.query('INSERT INTO friendships (requester_id, addressee_id) VALUES ($1, $2)', [req.user.id, other]);
    } catch (err) {
      if (err.code === '23505') return res.status(409).json({ error: 'Friend request already exists.' });
      throw err;
    }
    await notify(pool, [other], { type: 'friend', title: 'New friend request', body: `${req.user.name} wants to be your friend.`, link: '/friends' });
    res.status(201).json({ status: 'pending' });
  }));

  r.post('/friends/requests/:id/accept', wrap(async (req, res) => {
    if (!uuid.safeParse(req.params.id).success) return res.status(404).json({ error: 'Request not found' });
    const { rows: [acc] } = await pool.query(
      `UPDATE friendships SET status = 'accepted' WHERE id = $1 AND addressee_id = $2 AND status = 'pending' RETURNING requester_id`,
      [req.params.id, req.user.id],
    );
    if (!acc) return res.status(404).json({ error: 'Request not found' });
    await notify(pool, [acc.requester_id], { type: 'friend', title: 'Friend request accepted', body: `${req.user.name} is now your friend.`, link: '/friends' });
    res.json({ ok: true });
  }));

  // One endpoint for decline, cancel and unfriend: either person in the pair may remove it
  r.post('/friends/requests/:id/remove', wrap(async (req, res) => {
    if (!uuid.safeParse(req.params.id).success) return res.status(404).json({ error: 'Request not found' });
    const { rowCount } = await pool.query('DELETE FROM friendships WHERE id = $1 AND (requester_id = $2 OR addressee_id = $2)', [req.params.id, req.user.id]);
    if (!rowCount) return res.status(404).json({ error: 'Request not found' });
    res.json({ ok: true });
  }));
}
