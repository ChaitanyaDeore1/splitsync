import { z } from 'zod';
import { dateString, invalid } from './queries.js';
import { wrap } from './session.js';

const filters = z.object({
  group: z.string().uuid().optional(),
  category: z.enum(['food', 'groceries', 'rent', 'utilities', 'travel', 'stay', 'other']).optional(),
  type: z.enum(['paid', 'share', 'settlement']).optional(), // paid by me | only my share | payments
  from: dateString.optional(),
  to: dateString.optional(),
  q: z.string().trim().max(100).optional(),
});

async function load(pool, userId, f) {
  const wantExpenses = f.type !== 'settlement';
  const wantSettlements = (!f.type || f.type === 'settlement') && !f.category && !f.q;
  const like = f.q ? f.q.replace(/[\\%_]/g, '\\$&') : null;

  const expenses = wantExpenses
    ? (await pool.query(
        `SELECT e.id, e.group_id AS "groupId", g.name AS "groupName", e.description, e.category, e.expense_date AS date,
                e.amount_paise AS amount, e.notes, e.split_method AS "splitMethod",
                (me.id = e.paid_by) AS "paidByMe", payer.display_name AS "payerName", COALESCE(s.amount_paise, 0) AS "myShare"
         FROM expenses e
         JOIN expense_groups g ON g.id = e.group_id
         JOIN group_members me ON me.group_id = e.group_id AND me.user_id = $1
         JOIN group_members payer ON payer.id = e.paid_by
         LEFT JOIN expense_splits s ON s.expense_id = e.id AND s.member_id = me.id
         WHERE (me.id = e.paid_by OR s.member_id IS NOT NULL)
           AND ($2::uuid IS NULL OR e.group_id = $2) AND ($3::text IS NULL OR e.category = $3)
           AND ($4::date IS NULL OR e.expense_date >= $4) AND ($5::date IS NULL OR e.expense_date <= $5)
           AND ($6::text IS NULL OR e.description ILIKE '%' || $6 || '%')
         ORDER BY e.expense_date DESC, e.created_at DESC LIMIT 1000`,
        [userId, f.group ?? null, f.category ?? null, f.from ?? null, f.to ?? null, like],
      )).rows.filter((e) => f.type !== 'paid' || e.paidByMe).filter((e) => f.type !== 'share' || !e.paidByMe).map((e) => ({ kind: 'expense', ...e }))
    : [];

  const settlements = wantSettlements
    ? (await pool.query(
        `SELECT t.id, t.group_id AS "groupId", g.name AS "groupName", t.amount_paise AS amount,
                to_char(t.created_at AT TIME ZONE 'UTC', 'YYYY-MM-DD') AS date,
                (fm.user_id = $1) AS "iPaid", fm.display_name AS "fromName", tm.display_name AS "toName"
         FROM settlements t
         JOIN expense_groups g ON g.id = t.group_id
         JOIN group_members fm ON fm.id = t.from_member JOIN group_members tm ON tm.id = t.to_member
         WHERE (fm.user_id = $1 OR tm.user_id = $1) AND t.status = 'completed'
           AND ($2::uuid IS NULL OR t.group_id = $2)
           AND ($3::date IS NULL OR t.created_at >= $3) AND ($4::date IS NULL OR t.created_at < $4::date + 1)
         ORDER BY t.created_at DESC LIMIT 1000`,
        [userId, f.group ?? null, f.from ?? null, f.to ?? null],
      )).rows.map((s) => ({ kind: 'settlement', ...s }))
    : [];

  const items = [...expenses, ...settlements].sort((a, b) => b.date.localeCompare(a.date));

  // Personal spending is the user's SHARE of expenses, never the group total
  const sums = (len) => {
    const by = {};
    for (const e of expenses) by[e.date.slice(0, len)] = (by[e.date.slice(0, len)] ?? 0) + e.myShare;
    return Object.entries(by).sort(([a], [b]) => b.localeCompare(a)).map(([period, spent]) => ({ period, spent }));
  };
  const summary = {
    totalShare: expenses.reduce((s, e) => s + e.myShare, 0),
    totalPaid: expenses.reduce((s, e) => s + (e.paidByMe ? e.amount : 0), 0),
    byMonth: sums(7),
    byYear: sums(4),
  };
  return { items, summary };
}

const rupees = (p) => `${Math.trunc(p / 100)}.${String(p % 100).padStart(2, '0')}`;
// Quote every field and neutralise spreadsheet formulas (CSV injection)
const cell = (v) => `"${/^[=+\-@\t\r]/.test(String(v)) ? "'" : ''}${String(v).replaceAll('"', '""')}"`;

export function timelineRoutes(r, pool) {
  r.get('/timeline', wrap(async (req, res) => {
    const f = filters.safeParse(req.query);
    if (!f.success) return invalid(res, f);
    res.json(await load(pool, req.user.id, f.data));
  }));

  r.get('/timeline.csv', wrap(async (req, res) => {
    const f = filters.safeParse(req.query);
    if (!f.success) return invalid(res, f);
    const { items } = await load(pool, req.user.id, f.data);
    const rows = [['Date', 'Type', 'Group', 'Description', 'Total (INR)', 'Paid by', 'Your share (INR)']];
    for (const i of items) {
      rows.push(i.kind === 'expense'
        ? [i.date, 'Expense', i.groupName, i.description, rupees(i.amount), i.paidByMe ? 'You' : i.payerName, rupees(i.myShare)]
        : [i.date, 'Payment', i.groupName, i.iPaid ? `You paid ${i.toName}` : `${i.fromName} paid you`, rupees(i.amount), '', '']);
    }
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', 'attachment; filename="splitsync-timeline.csv"');
    res.send(rows.map((row) => row.map(cell).join(',')).join('\r\n'));
  }));
}
