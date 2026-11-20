import { z } from 'zod';
import { formatINR } from '../src/utils/money.ts';
import { computeSplit } from '../src/utils/split.ts';
import { dateString, idempotent, invalid, logActivity, memberOf } from './queries.js';
import { notify, usersOfMembers } from './notifications.js';
import { wrap } from './session.js';

const MAX_PAISE = 100_000_000_000;

const bodySchema = z.object({
  description: z.string().trim().min(1).max(100),
  amount: z.number().int().positive().max(MAX_PAISE), // paise
  paidBy: z.string().uuid(),
  splitMethod: z.enum(['equal', 'exact', 'percentage', 'shares']),
  participants: z.array(z.object({ memberId: z.string().uuid(), value: z.number().int().min(0).max(MAX_PAISE).optional() })).min(1).max(100),
  category: z.enum(['food', 'groceries', 'rent', 'utilities', 'travel', 'stay', 'other']),
  date: dateString,
  notes: z.string().trim().max(500).optional(),
});

export function expenseRoutes(r, pool) {
  r.get('/:groupId/expenses', wrap(async (req, res) => {
    if (!(await memberOf(pool, req.params.groupId, req.user.id))) return res.status(404).json({ error: 'Group not found' });
    const { rows } = await pool.query(
      `SELECT e.id, e.description, e.amount_paise AS amount, e.paid_by AS "paidBy", e.split_method AS "splitMethod",
              e.category, e.expense_date AS date, e.notes, e.created_at AS "createdAt",
              COALESCE(json_agg(json_build_object('memberId', s.member_id, 'amount', s.amount_paise) ORDER BY s.member_id)
                       FILTER (WHERE s.member_id IS NOT NULL), '[]') AS splits
       FROM expenses e LEFT JOIN expense_splits s ON s.expense_id = e.id
       WHERE e.group_id = $1 GROUP BY e.id ORDER BY e.expense_date DESC, e.created_at DESC`,
      [req.params.groupId],
    );
    res.json({ expenses: rows });
  }));

  r.post('/:groupId/expenses', wrap(async (req, res) => {
    const parsed = bodySchema.safeParse(req.body);
    if (!parsed.success) return invalid(res, parsed);
    const b = parsed.data;
    const groupId = req.params.groupId;
    if (!(await memberOf(pool, groupId, req.user.id))) return res.status(404).json({ error: 'Group not found' });

    const ids = b.participants.map((p) => p.memberId);
    if (new Set(ids).size !== ids.length) return res.status(400).json({ error: 'A participant is listed twice' });

    // The server, not the browser, works out who owes what
    const split = computeSplit(b.splitMethod, b.amount, b.participants);
    if (!split.ok) return res.status(422).json({ error: split.error });

    const everyone = [...new Set([b.paidBy, ...ids])];
    const { rows } = await pool.query('SELECT id FROM group_members WHERE group_id = $1 AND id = ANY($2::uuid[])', [groupId, everyone]);
    if (rows.length !== everyone.length) return res.status(400).json({ error: 'The payer and every participant must be members of this group' });

    const out = await idempotent(pool, req, async (c) => {
      const { rows: [e] } = await c.query(
        `INSERT INTO expenses (group_id, description, amount_paise, paid_by, split_method, category, expense_date, notes, created_by)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9) RETURNING id`,
        [groupId, b.description, b.amount, b.paidBy, b.splitMethod, b.category, b.date, b.notes ?? null, req.user.id],
      );
      for (const [memberId, amount] of Object.entries(split.amounts))
        await c.query('INSERT INTO expense_splits (expense_id, group_id, member_id, amount_paise) VALUES ($1, $2, $3, $4)', [e.id, groupId, memberId, amount]);
      await logActivity(c, groupId, req.user.id, 'expense.created', e.id, `${req.user.name} added "${b.description}" (${formatINR(b.amount)})`);
      const { rows: [g] } = await c.query('SELECT name FROM expense_groups WHERE id = $1', [groupId]);
      for (const userId of await usersOfMembers(c, everyone, req.user.id)) {
        const mine = await c.query('SELECT s.amount_paise AS share FROM expense_splits s JOIN group_members m ON m.id = s.member_id WHERE s.expense_id = $1 AND m.user_id = $2', [e.id, userId]);
        const share = mine.rows[0]?.share;
        await notify(c, [userId], {
          type: 'expense', title: `New expense in ${g.name}`, link: `/groups/${groupId}?expense=${e.id}`,
          body: `${req.user.name} added "${b.description}" (${formatINR(b.amount)}).${share ? ` Your share is ${formatINR(share)}.` : ''}`,
        });
      }
      return { status: 201, body: { expense: { id: e.id, splits: split.amounts } } };
    });
    res.status(out.status).json(out.body);
  }));
}
