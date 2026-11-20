import crypto from 'node:crypto';
import { networkInterfaces } from 'node:os';
import { z } from 'zod';
import { balancesFor, invalid, logActivity, memberOf, withTx } from './queries.js';
import { notify } from './notifications.js';
import { sha, wrap } from './session.js';

const personName = z.string().trim().min(1).max(60);
const createSchema = z.object({
  name: z.string().trim().min(1).max(50),
  category: z.enum(['flatmates', 'travel', 'friends_family']),
  memberNames: z.array(personName).max(30).default([]),
});
const notFound = (res) => res.status(404).json({ error: 'Group not found' });

function lanAddresses() {
  const addresses = Object.entries(networkInterfaces()).flatMap(([name, entries]) => {
    if (/docker|wsl|hyper-v|virtual|loopback/i.test(name)) return [];
    return (entries ?? [])
      .filter(({ family, internal, address }) =>
        family === 'IPv4' && !internal && /^(10\.|192\.168\.|172\.(1[6-9]|2\d|3[01])\.)/.test(address),
      )
      .map(({ address }) => address);
  });
  return [...new Set(addresses)].sort((a, b) => {
    const rank = (ip) => ip.startsWith('192.168.') ? 0 : ip.startsWith('10.') ? 1 : 2;
    return rank(a) - rank(b);
  });
}

export function groupRoutes(r, pool) {
  r.get('/', wrap(async (req, res) => {
    const { rows: groups } = await pool.query(
      `SELECT g.id, g.name, g.category, g.created_at AS "createdAt",
              (SELECT count(*)::int FROM group_members WHERE group_id = g.id) AS "memberCount"
       FROM expense_groups g JOIN group_members me ON me.group_id = g.id AND me.user_id = $1
       ORDER BY g.created_at DESC`,
      [req.user.id],
    );
    const balances = await balancesFor(pool, groups.map((g) => g.id));
    res.json({
      groups: groups.map((g) => ({
        ...g,
        myBalance: balances.find((b) => b.groupId === g.id && b.userId === req.user.id)?.balance ?? 0,
      })),
    });
  }));

  r.get('/recent-activity', wrap(async (req, res) => {
    const { rows } = await pool.query(
      `SELECT a.id, a.message, a.created_at AS "createdAt", g.name AS "groupName"
       FROM activity a JOIN expense_groups g ON g.id = a.group_id
       WHERE a.group_id IN (SELECT group_id FROM group_members WHERE user_id = $1)
       ORDER BY a.id DESC LIMIT 8`,
      [req.user.id],
    );
    res.json({ activity: rows });
  }));

  r.post('/', wrap(async (req, res) => {
    const parsed = createSchema.safeParse(req.body);
    if (!parsed.success) return invalid(res, parsed);
    const { name, category, memberNames } = parsed.data;

    const seen = new Set([req.user.name.toLowerCase()]);
    for (const n of memberNames) {
      if (seen.has(n.toLowerCase())) return res.status(400).json({ error: `"${n}" appears more than once` });
      seen.add(n.toLowerCase());
    }

    const group = await withTx(pool, async (c) => {
      const { rows: [g] } = await c.query(
        'INSERT INTO expense_groups (name, category, created_by) VALUES ($1, $2, $3) RETURNING id, name, category',
        [name, category, req.user.id],
      );
      await c.query(`INSERT INTO group_members (group_id, user_id, display_name, role) VALUES ($1, $2, $3, 'admin')`, [g.id, req.user.id, req.user.name]);
      for (const n of memberNames) await c.query('INSERT INTO group_members (group_id, display_name) VALUES ($1, $2)', [g.id, n]);
      await logActivity(c, g.id, req.user.id, 'group.created', g.id, `${req.user.name} created the group "${g.name}"`);
      return g;
    });
    res.status(201).json({ group });
  }));

  r.get('/:groupId', wrap(async (req, res) => {
    const me = await memberOf(pool, req.params.groupId, req.user.id);
    if (!me) return notFound(res);
    const { rows: [group] } = await pool.query('SELECT id, name, category, created_at AS "createdAt" FROM expense_groups WHERE id = $1', [req.params.groupId]);
    const { rows: members } = await pool.query(
      'SELECT id, display_name AS name, user_id AS "userId", role FROM group_members WHERE group_id = $1 ORDER BY role, joined_at, display_name',
      [req.params.groupId],
    );
    const balances = await balancesFor(pool, [req.params.groupId]);
    res.json({
      group,
      myMemberId: me.id,
      members: members.map((m) => ({ ...m, balance: balances.find((b) => b.id === m.id)?.balance ?? 0 })),
    });
  }));

  r.post('/:groupId/members', wrap(async (req, res) => {
    const parsed = z.object({ name: personName.optional(), friendId: z.string().uuid().optional() })
      .refine((b) => b.name || b.friendId, 'enter a name or choose a friend').safeParse(req.body);
    if (!parsed.success) return invalid(res, parsed);
    const me = await memberOf(pool, req.params.groupId, req.user.id);
    if (!me) return notFound(res);

    let userId = null;
    let displayName = parsed.data.name;
    if (parsed.data.friendId) { // only accepted friends can be added directly
      const { rows: [friend] } = await pool.query(
        `SELECT u.id, u.name FROM friendships f JOIN users u ON u.id = $2 WHERE f.status = 'accepted'
         AND ((f.requester_id = $1 AND f.addressee_id = $2) OR (f.requester_id = $2 AND f.addressee_id = $1))`,
        [req.user.id, parsed.data.friendId],
      );
      if (!friend) return res.status(400).json({ error: 'You can only add people who are your friends.' });
      userId = friend.id;
      displayName = friend.name;
    }
    try {
      const member = await withTx(pool, async (c) => {
        const { rows: [m] } = await c.query(
          'INSERT INTO group_members (group_id, user_id, display_name) VALUES ($1, $2, $3) RETURNING id, display_name AS name, role',
          [req.params.groupId, userId, displayName],
        );
        await logActivity(c, req.params.groupId, req.user.id, 'member.added', m.id, `${req.user.name} added ${m.name} to the group`);
        if (userId) {
          const { rows: [g] } = await c.query('SELECT name FROM expense_groups WHERE id = $1', [req.params.groupId]);
          await notify(c, [userId], { type: 'group', title: `You were added to ${g.name}`, body: `${req.user.name} added you to the group.`, link: `/groups/${req.params.groupId}` });
        }
        return m;
      });
      res.status(201).json({ member });
    } catch (err) {
      if (err.code === '23505') return res.status(409).json({ error: 'That person is already in this group' });
      throw err;
    }
  }));

  // Invitation link. With memberId it is a claim link for a person already added by name.
  r.post('/:groupId/invites', wrap(async (req, res) => {
    const parsed = z.object({ memberId: z.string().uuid().optional() }).safeParse(req.body ?? {});
    if (!parsed.success) return invalid(res, parsed);
    if (!(await memberOf(pool, req.params.groupId, req.user.id))) return notFound(res);
    if (parsed.data.memberId) {
      const { rows: [m] } = await pool.query('SELECT id FROM group_members WHERE id = $1 AND group_id = $2 AND user_id IS NULL', [parsed.data.memberId, req.params.groupId]);
      if (!m) return res.status(400).json({ error: 'That person already has an account in this group.' });
    }
    const token = crypto.randomBytes(24).toString('hex');
    const { rows: [inv] } = await pool.query(
      `INSERT INTO group_invites (group_id, token_hash, invited_by, member_id, expires_at)
       VALUES ($1, $2, $3, $4, now() + interval '7 days') RETURNING expires_at AS "expiresAt"`,
      [req.params.groupId, sha(token), req.user.id, parsed.data.memberId ?? null],
    );
    const path = `/join/${token}`;
    res.status(201).json({
      path,
      expiresAt: inv.expiresAt,
      networkUrls: lanAddresses().map((address) => `http://${address}:5173${path}`),
    });
  }));

  // Leaving keeps the person's history in the group; it needs a zero balance first
  r.post('/:groupId/leave', wrap(async (req, res) => {
    const me = await memberOf(pool, req.params.groupId, req.user.id);
    if (!me) return notFound(res);
    const mine = (await balancesFor(pool, [req.params.groupId])).find((b) => b.id === me.id)?.balance ?? 0;
    if (mine !== 0) return res.status(409).json({ error: 'Settle your balance before leaving this group.' });
    await withTx(pool, async (c) => {
      if (me.role === 'admin') { // never leave a group without an admin
        await c.query(
          `UPDATE group_members SET role = 'admin' WHERE id = (
             SELECT id FROM group_members WHERE group_id = $1 AND user_id IS NOT NULL AND user_id <> $2 ORDER BY joined_at LIMIT 1)`,
          [req.params.groupId, req.user.id],
        );
      }
      await c.query(`UPDATE group_members SET user_id = NULL, role = 'member' WHERE id = $1`, [me.id]);
      await logActivity(c, req.params.groupId, req.user.id, 'member.left', me.id, `${req.user.name} left the group`);
    });
    res.json({ ok: true });
  }));

  r.get('/:groupId/activity', wrap(async (req, res) => {
    if (!(await memberOf(pool, req.params.groupId, req.user.id))) return notFound(res);
    const { rows } = await pool.query(
      `SELECT a.id, a.action, a.message, a.created_at AS "createdAt", u.name AS "actorName"
       FROM activity a LEFT JOIN users u ON u.id = a.actor_user_id
       WHERE a.group_id = $1 ORDER BY a.id DESC LIMIT 100`,
      [req.params.groupId],
    );
    res.json({ activity: rows });
  }));
}
