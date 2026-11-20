import { z } from 'zod';
import { suggestSettlements } from '../src/utils/settlement.ts';
import { balancesFor, invalid, memberOf } from './queries.js';
import { wrap } from './session.js';

// ---------- month helpers (months are 'YYYY-MM' text) ----------
export const monthSchema = z.string().regex(/^\d{4}-(0[1-9]|1[0-2])$/);
export const currentMonth = () => new Date().toISOString().slice(0, 7);
export function addMonths(month, n) {
  const [y, m] = month.split('-').map(Number);
  return new Date(Date.UTC(y, m - 1 + n, 1)).toISOString().slice(0, 7);
}
const daysIn = (month) => { const [y, m] = month.split('-').map(Number); return new Date(Date.UTC(y, m, 0)).getUTCDate(); };
const monthsBack = (end, count) => Array.from({ length: count }, (_, i) => addMonths(end, i - (count - 1)));

// Sums rows into [{key, spent, count}] sorted biggest first
function groupSum(rows, keyOf, valueOf) {
  const by = new Map();
  for (const r of rows) {
    const k = keyOf(r);
    const cur = by.get(k) ?? { key: k, spent: 0, count: 0 };
    cur.spent += valueOf(r);
    cur.count += 1;
    by.set(k, cur);
  }
  return [...by.values()].filter((x) => x.spent > 0).sort((a, b) => b.spent - a.spent);
}

// Every expense the person paid for or shares, in [from, toExclusive). myShare is what THEY owe for it.
async function personalExpenses(db, userId, from, toExclusive, groupId = null) {
  const { rows } = await db.query(
    `SELECT e.id, e.group_id AS "groupId", g.name AS "groupName", e.description, e.category, e.expense_date AS date,
            e.amount_paise AS amount, (me.id = e.paid_by) AS "paidByMe", COALESCE(s.amount_paise, 0) AS "myShare"
     FROM expenses e
     JOIN expense_groups g ON g.id = e.group_id
     JOIN group_members me ON me.group_id = e.group_id AND me.user_id = $1
     LEFT JOIN expense_splits s ON s.expense_id = e.id AND s.member_id = me.id
     WHERE (me.id = e.paid_by OR s.member_id IS NOT NULL)
       AND e.expense_date >= $2::date AND e.expense_date < $3::date
       AND ($4::uuid IS NULL OR e.group_id = $4)
     ORDER BY e.expense_date`,
    [userId, from, toExclusive, groupId],
  );
  return rows;
}

const cats = (rows, valueOf) => groupSum(rows, (r) => r.category, valueOf).map(({ key, spent, count }) => ({ category: key, spent, count }));

// ---------- personal monthly recap ----------
export async function buildMonthlyRecap(db, user, month) {
  const rows = await personalExpenses(db, user.id, `${month}-01`, `${addMonths(month, 1)}-01`);
  const prevRows = await personalExpenses(db, user.id, `${addMonths(month, -1)}-01`, `${month}-01`);
  const share = rows.reduce((s, r) => s + r.myShare, 0);
  const prevShare = prevRows.reduce((s, r) => s + r.myShare, 0);

  const perDay = new Map();
  for (const r of rows) perDay.set(r.date, (perDay.get(r.date) ?? 0) + r.myShare);
  const daily = Array.from({ length: daysIn(month) }, (_, i) => {
    const date = `${month}-${String(i + 1).padStart(2, '0')}`;
    return { date, spent: perDay.get(date) ?? 0 };
  });
  const topDay = daily.reduce((best, d) => (d.spent > (best?.spent ?? 0) ? d : best), null);
  const top = rows.reduce((best, r) => (r.myShare > (best?.myShare ?? 0) ? r : best), null);

  const { rows: [pay] } = await db.query(
    `SELECT COALESCE(SUM(t.amount_paise) FILTER (WHERE fm.user_id = $1), 0)::bigint AS sent,
            count(*) FILTER (WHERE fm.user_id = $1)::int AS "sentCount",
            COALESCE(SUM(t.amount_paise) FILTER (WHERE tm.user_id = $1), 0)::bigint AS received,
            count(*) FILTER (WHERE tm.user_id = $1)::int AS "receivedCount"
     FROM settlements t JOIN group_members fm ON fm.id = t.from_member JOIN group_members tm ON tm.id = t.to_member
     WHERE (fm.user_id = $1 OR tm.user_id = $1) AND t.status = 'completed'
       AND t.created_at >= $2::date AND t.created_at < $3::date`,
    [user.id, `${month}-01`, `${addMonths(month, 1)}-01`],
  );

  return {
    month,
    person: user.name,
    totals: {
      share,
      paid: rows.reduce((s, r) => s + (r.paidByMe ? r.amount : 0), 0),
      count: rows.length,
      avgExpense: rows.length ? Math.round(share / rows.length) : 0,
      dailyAverage: Math.round(share / daysIn(month)),
    },
    previous: { month: addMonths(month, -1), share: prevShare, changePct: prevShare > 0 ? Math.round(((share - prevShare) / prevShare) * 100) : null },
    categories: cats(rows, (r) => r.myShare),
    groups: groupSum(rows, (r) => r.groupName, (r) => r.myShare).map(({ key, spent, count }) => ({ name: key, spent, count })),
    daily,
    topDay: topDay && { date: topDay.date, spent: topDay.spent },
    topExpense: top && { description: top.description, groupName: top.groupName, date: top.date, share: top.myShare, amount: top.amount },
    payments: pay,
  };
}

// ---------- personal analytics over several months ----------
async function buildAnalytics(db, userId, months, groupId) {
  const end = currentMonth();
  const list = monthsBack(end, months);
  const rows = await personalExpenses(db, userId, `${list[0]}-01`, `${addMonths(end, 1)}-01`, groupId);
  const trend = list.map((m) => {
    const inMonth = rows.filter((r) => r.date.startsWith(m));
    return { month: m, spent: inMonth.reduce((s, r) => s + r.myShare, 0), paid: inMonth.reduce((s, r) => s + (r.paidByMe ? r.amount : 0), 0), count: inMonth.length };
  });
  const weekday = Array.from({ length: 7 }, (_, i) => ({ day: i, spent: 0 })); // 0 = Sunday
  for (const r of rows) weekday[new Date(`${r.date}T00:00:00Z`).getUTCDay()].spent += r.myShare;
  const total = trend.reduce((s, t) => s + t.spent, 0);
  const best = trend.reduce((b, t) => (t.spent > (b?.spent ?? 0) ? t : b), null);
  return {
    months,
    trend,
    categories: cats(rows, (r) => r.myShare),
    groups: groupSum(rows, (r) => r.groupName, (r) => r.myShare).map(({ key, spent, count }) => ({ name: key, spent, count })),
    weekday,
    topExpenses: [...rows].sort((a, b) => b.myShare - a.myShare).slice(0, 5).filter((r) => r.myShare > 0)
      .map((r) => ({ id: r.id, groupId: r.groupId, description: r.description, groupName: r.groupName, date: r.date, share: r.myShare })),
    stats: {
      total,
      count: rows.length,
      averagePerMonth: Math.round(total / months),
      busiestMonth: best && best.spent > 0 ? { month: best.month, spent: best.spent } : null,
    },
  };
}

// ---------- group report (live view, and the snapshot that gets shared) ----------
export async function buildGroupReport(db, groupId, month = null) {
  const { rows: [group] } = await db.query(
    `SELECT g.id, g.name, g.category, (SELECT count(*)::int FROM group_members WHERE group_id = g.id) AS "memberCount" FROM expense_groups g WHERE g.id = $1`,
    [groupId],
  );
  const from = month ? `${month}-01` : '1970-01-01';
  const to = month ? `${addMonths(month, 1)}-01` : '9999-01-01';
  const { rows: expenses } = await db.query(
    `SELECT e.id, e.description, e.category, e.expense_date AS date, e.amount_paise AS amount, e.paid_by AS "paidBy"
     FROM expenses e WHERE e.group_id = $1 AND e.expense_date >= $2::date AND e.expense_date < $3::date ORDER BY e.expense_date DESC`,
    [groupId, from, to],
  );
  const { rows: shares } = await db.query(
    `SELECT s.member_id AS "memberId", SUM(s.amount_paise)::bigint AS share
     FROM expense_splits s JOIN expenses e ON e.id = s.expense_id
     WHERE e.group_id = $1 AND e.expense_date >= $2::date AND e.expense_date < $3::date GROUP BY s.member_id`,
    [groupId, from, to],
  );
  const { rows: members } = await db.query('SELECT id, display_name AS name FROM group_members WHERE group_id = $1 ORDER BY display_name', [groupId]);
  const balances = await balancesFor(db, [groupId]);
  const nameOf = Object.fromEntries(members.map((m) => [m.id, m.name]));

  const end = month ?? currentMonth();
  const monthly = monthsBack(end, 6).map((m) => ({ month: m, spent: 0, count: 0 }));
  const { rows: monthRows } = await db.query(
    `SELECT to_char(expense_date, 'YYYY-MM') AS month, SUM(amount_paise)::bigint AS spent, count(*)::int AS count
     FROM expenses WHERE group_id = $1 AND expense_date >= $2::date AND expense_date < $3::date GROUP BY 1`,
    [groupId, `${monthly[0].month}-01`, `${addMonths(end, 1)}-01`],
  );
  for (const m of monthly) Object.assign(m, monthRows.find((r) => r.month === m.month) ?? {});

  const { rows: [pay] } = await db.query(
    `SELECT count(*)::int AS count, COALESCE(SUM(amount_paise), 0)::bigint AS total FROM settlements
     WHERE group_id = $1 AND status = 'completed' AND created_at >= $2::date AND created_at < $3::date`,
    [groupId, from, to],
  );

  return {
    group: { name: group.name, category: group.category, memberCount: group.memberCount },
    month,
    totals: { spend: expenses.reduce((s, e) => s + e.amount, 0), count: expenses.length, average: expenses.length ? Math.round(expenses.reduce((s, e) => s + e.amount, 0) / expenses.length) : 0 },
    categories: cats(expenses, (e) => e.amount),
    monthly,
    members: members.map((m) => ({
      name: m.name,
      paid: expenses.reduce((s, e) => s + (e.paidBy === m.id ? e.amount : 0), 0),
      share: shares.find((s) => s.memberId === m.id)?.share ?? 0,
      balance: balances.find((b) => b.id === m.id)?.balance ?? 0, // always the current balance, even for a month report
    })),
    topExpenses: [...expenses].sort((a, b) => b.amount - a.amount).slice(0, 5).map((e) => ({ description: e.description, date: e.date, amount: e.amount, paidBy: nameOf[e.paidBy] ?? 'Unknown' })),
    payments: pay,
    settleUp: suggestSettlements(Object.fromEntries(balances.map((b) => [b.id, b.balance]))).map((t) => ({ from: nameOf[t.from], to: nameOf[t.to], amount: t.amount })),
  };
}

export function analyticsRoutes(r, pool) {
  r.get('/analytics', wrap(async (req, res) => {
    const q = z.object({ months: z.coerce.number().int().min(3).max(12).default(6), group: z.string().uuid().optional() }).safeParse(req.query);
    if (!q.success) return invalid(res, q);
    if (q.data.group && !(await memberOf(pool, q.data.group, req.user.id))) return res.status(404).json({ error: 'Group not found' });
    res.json(await buildAnalytics(pool, req.user.id, q.data.months, q.data.group ?? null));
  }));

  r.get('/recap', wrap(async (req, res) => {
    const month = monthSchema.safeParse(req.query.month ?? currentMonth());
    if (!month.success) return res.status(400).json({ error: 'Choose a month like 2026-10.' });
    res.json(await buildMonthlyRecap(pool, req.user, month.data));
  }));
}

export function groupReportRoutes(r, pool) {
  r.get('/:groupId/report', wrap(async (req, res) => {
    if (!(await memberOf(pool, req.params.groupId, req.user.id))) return res.status(404).json({ error: 'Group not found' });
    const month = req.query.month === undefined || req.query.month === '' ? null : monthSchema.safeParse(req.query.month);
    if (month && !month.success) return res.status(400).json({ error: 'Choose a month like 2026-10.' });
    res.json(await buildGroupReport(pool, req.params.groupId, month?.data ?? null));
  }));
}
