import type { Paise } from './money';

export interface ExpenseRecord {
  paidBy: string;
  amount: Paise;
  /** memberId -> paise owed; must sum to amount */
  splits: Record<string, Paise>;
}
export interface SettlementRecord {
  from: string;
  to: string;
  amount: Paise;
}
export interface Transfer {
  from: string;
  to: string;
  amount: Paise;
}

/** Net balance per member: positive = is owed money, negative = owes money. Sums to zero. */
export function computeBalances(
  memberIds: string[],
  expenses: ExpenseRecord[],
  settlements: SettlementRecord[],
): Record<string, Paise> {
  const bal: Record<string, Paise> = {};
  memberIds.forEach((id) => (bal[id] = 0));
  for (const e of expenses) {
    bal[e.paidBy] = (bal[e.paidBy] ?? 0) + e.amount;
    for (const [id, owed] of Object.entries(e.splits)) bal[id] = (bal[id] ?? 0) - owed;
  }
  for (const s of settlements) {
    bal[s.from] = (bal[s.from] ?? 0) + s.amount;
    bal[s.to] = (bal[s.to] ?? 0) - s.amount;
  }
  return bal;
}

/** Greedy matching of largest debtor with largest creditor: at most (n - 1) transfers. */
export function suggestSettlements(balances: Record<string, Paise>): Transfer[] {
  const cr = Object.entries(balances).filter(([, v]) => v > 0).map(([id, v]) => ({ id, v }));
  const db = Object.entries(balances).filter(([, v]) => v < 0).map(([id, v]) => ({ id, v: -v }));
  const out: Transfer[] = [];
  while (cr.length && db.length) {
    cr.sort((a, b) => b.v - a.v || a.id.localeCompare(b.id));
    db.sort((a, b) => b.v - a.v || a.id.localeCompare(b.id));
    const c = cr[0]!;
    const d = db[0]!;
    const amt = Math.min(c.v, d.v);
    out.push({ from: d.id, to: c.id, amount: amt });
    c.v -= amt;
    d.v -= amt;
    if (c.v === 0) cr.shift();
    if (d.v === 0) db.shift();
  }
  return out;
}
