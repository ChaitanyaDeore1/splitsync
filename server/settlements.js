import { z } from 'zod';
import { formatINR } from '../src/utils/money.ts';
import { suggestSettlements } from '../src/utils/settlement.ts';
import { balancesFor, idempotent, invalid, logActivity, memberOf } from './queries.js';
import { notify, usersOfMembers } from './notifications.js';
import { wrap } from './session.js';

const bodySchema = z.object({
  fromMember: z.string().uuid(),
  toMember: z.string().uuid(),
  amount: z.number().int().positive().max(100_000_000_000),
});
const notFound = (res) => res.status(404).json({ error: 'Group not found' });

export function settlementRoutes(r, pool) {
  r.get('/:groupId/settlements', wrap(async (req, res) => {
    if (!(await memberOf(pool, req.params.groupId, req.user.id))) return notFound(res);
    const { rows } = await pool.query(
      `SELECT id, from_member AS "fromMember", to_member AS "toMember", amount_paise AS amount, status, created_at AS "createdAt"
       FROM settlements WHERE group_id = $1 ORDER BY created_at DESC`,
      [req.params.groupId],
    );
    res.json({ settlements: rows });
  }));

  // The fewest payments that settle everyone, worked out from the saved records
  r.get('/:groupId/suggestions', wrap(async (req, res) => {
    if (!(await memberOf(pool, req.params.groupId, req.user.id))) return notFound(res);
    const balances = await balancesFor(pool, [req.params.groupId]);
    const transfers = suggestSettlements(Object.fromEntries(balances.map((b) => [b.id, b.balance])));
    res.json({ suggestions: transfers.map((t) => ({ fromMember: t.from, toMember: t.to, amount: t.amount })) });
  }));

  r.post('/:groupId/settlements', wrap(async (req, res) => {
    const parsed = bodySchema.safeParse(req.body);
    if (!parsed.success) return invalid(res, parsed);
    const { fromMember, toMember, amount } = parsed.data;
    const groupId = req.params.groupId;
    const me = await memberOf(pool, groupId, req.user.id);
    if (!me) return notFound(res);
    if (fromMember === toMember) return res.status(400).json({ error: 'Payer and receiver must be different people' });
    if (me.id !== fromMember && me.id !== toMember && me.role !== 'admin')
      return res.status(403).json({ error: 'Only the payer, the receiver or a group admin can record this payment' });

    const { rows: people } = await pool.query('SELECT id, display_name AS name FROM group_members WHERE group_id = $1 AND id = ANY($2::uuid[])', [groupId, [fromMember, toMember]]);
    if (people.length !== 2) return res.status(400).json({ error: 'Both people must be members of this group' });
    const nameOf = (id) => people.find((p) => p.id === id).name;

    const out = await idempotent(pool, req, async (c) => {
      // Locking the group row makes simultaneous payments run one after another
      await c.query('SELECT id FROM expense_groups WHERE id = $1 FOR UPDATE', [groupId]);
      const balances = await balancesFor(c, [groupId]);
      const from = balances.find((b) => b.id === fromMember).balance;
      const to = balances.find((b) => b.id === toMember).balance;
      if (from + amount > 0 || to - amount < 0)
        return { status: 422, body: { error: 'This payment is more than what is owed. It may already be settled.' } };

      const { rows: [s] } = await c.query(
        `INSERT INTO settlements (group_id, from_member, to_member, amount_paise, created_by) VALUES ($1, $2, $3, $4, $5) RETURNING id`,
        [groupId, fromMember, toMember, amount, req.user.id],
      );
      await logActivity(c, groupId, req.user.id, 'settlement.recorded', s.id, `${nameOf(fromMember)} paid ${nameOf(toMember)} ${formatINR(amount)}`);
      const { rows: [g] } = await c.query('SELECT name FROM expense_groups WHERE id = $1', [groupId]);
      await notify(c, await usersOfMembers(c, [fromMember, toMember], req.user.id), {
        type: 'settlement', title: `Payment recorded in ${g.name}`, link: `/groups/${groupId}`,
        body: `${nameOf(fromMember)} paid ${nameOf(toMember)} ${formatINR(amount)}.`,
      });
      return { status: 201, body: { settlement: { id: s.id } } };
    });
    res.status(out.status).json(out.body);
  }));
}
