import { z } from 'zod';
import { logActivity, memberOf, withTx } from './queries.js';
import { notify } from './notifications.js';
import { sha, wrap } from './session.js';

const tokenOk = z.string().regex(/^[a-f0-9]{48}$/);
const gone = (res) => res.status(404).json({ error: 'This invitation link is invalid or has expired.' });

export function inviteRoutes(r, pool) {
  r.get('/invites/:token', wrap(async (req, res) => {
    if (!tokenOk.safeParse(req.params.token).success) return gone(res);
    const { rows: [inv] } = await pool.query(
      `SELECT i.group_id AS "groupId", g.name AS "groupName", u.name AS "invitedBy", m.display_name AS "claimName"
       FROM group_invites i JOIN expense_groups g ON g.id = i.group_id JOIN users u ON u.id = i.invited_by
       LEFT JOIN group_members m ON m.id = i.member_id
       WHERE i.token_hash = $1 AND i.expires_at > now()`,
      [sha(req.params.token)],
    );
    if (!inv) return gone(res);
    res.json({ ...inv, alreadyMember: Boolean(await memberOf(pool, inv.groupId, req.user.id)) });
  }));

  r.post('/invites/:token/accept', wrap(async (req, res) => {
    if (!tokenOk.safeParse(req.params.token).success) return gone(res);
    try {
      const out = await withTx(pool, async (c) => {
        const { rows: [inv] } = await c.query('SELECT id, group_id, member_id FROM group_invites WHERE token_hash = $1 AND expires_at > now() FOR UPDATE', [sha(req.params.token)]);
        if (!inv) return { status: 404, body: { error: 'This invitation link is invalid or has expired.' } };
        if (await memberOf(c, inv.group_id, req.user.id)) return { status: 200, body: { groupId: inv.group_id } };

        if (inv.member_id) { // claim link: attach this account to the person already in the group
          const { rowCount } = await c.query('UPDATE group_members SET user_id = $1 WHERE id = $2 AND user_id IS NULL', [req.user.id, inv.member_id]);
          if (!rowCount) return { status: 409, body: { error: 'This place in the group has already been claimed.' } };
          await c.query('DELETE FROM group_invites WHERE id = $1', [inv.id]); // claim links work once
        } else {
          await c.query('INSERT INTO group_members (group_id, user_id, display_name) VALUES ($1, $2, $3)', [inv.group_id, req.user.id, req.user.name]);
        }
        await logActivity(c, inv.group_id, req.user.id, 'member.joined', null, `${req.user.name} joined the group`);
        const { rows: others } = await c.query('SELECT user_id FROM group_members WHERE group_id = $1 AND user_id IS NOT NULL AND user_id <> $2', [inv.group_id, req.user.id]);
        const { rows: [g] } = await c.query('SELECT name FROM expense_groups WHERE id = $1', [inv.group_id]);
        await notify(c, others.map((o) => o.user_id), { type: 'group', title: `${req.user.name} joined ${g.name}`, body: 'They used an invitation link.', link: `/groups/${inv.group_id}` });
        return { status: 200, body: { groupId: inv.group_id } };
      });
      res.status(out.status).json(out.body);
    } catch (err) {
      if (err.code === '23505') return res.status(409).json({ error: 'Someone with your name is already in this group. Ask for a link made for you instead.' });
      throw err;
    }
  }));
}
