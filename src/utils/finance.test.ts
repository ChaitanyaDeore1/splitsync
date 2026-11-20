import { describe, it, expect } from 'vitest';
import { parseRupeesToPaise, formatINR } from './money';
import { computeSplit } from './split';
import { computeBalances, suggestSettlements } from './settlement';

const sum = (o: Record<string, number>) => Object.values(o).reduce((a, b) => a + b, 0);

describe('money', () => {
  it('parses without floats', () => {
    expect(parseRupeesToPaise('1,200')).toBe(120000);
    expect(parseRupeesToPaise('0.1')).toBe(10);
    expect(parseRupeesToPaise('19.99')).toBe(1999);
    expect(parseRupeesToPaise('1.234')).toBeNull();
    expect(parseRupeesToPaise('abc')).toBeNull();
  });
  it('formats Indian grouping', () => {
    expect(formatINR(120000)).toBe('₹1,200.00');
    expect(formatINR(12345678)).toBe('₹1,23,456.78');
    expect(formatINR(-50)).toBe('-₹0.50');
  });
});

describe('split', () => {
  const ids = ['a', 'b', 'c'];
  it('equal split keeps every paisa', () => {
    const r = computeSplit('equal', 10000, ids.map((memberId) => ({ memberId })));
    expect(r.ok && sum(r.amounts)).toBe(10000);
  });
  it('percentage and shares sum exactly', () => {
    const p = computeSplit('percentage', 100001, [
      { memberId: 'a', value: 3333 }, { memberId: 'b', value: 3333 }, { memberId: 'c', value: 3334 },
    ]);
    expect(p.ok && sum(p.amounts)).toBe(100001);
    const s = computeSplit('shares', 99999, [
      { memberId: 'a', value: 1 }, { memberId: 'b', value: 2 }, { memberId: 'c', value: 4 },
    ]);
    expect(s.ok && sum(s.amounts)).toBe(99999);
  });
  it('rejects bad exact and percentage totals', () => {
    expect(computeSplit('exact', 1000, [{ memberId: 'a', value: 400 }, { memberId: 'b', value: 500 }]).ok).toBe(false);
    expect(computeSplit('percentage', 1000, [{ memberId: 'a', value: 5000 }]).ok).toBe(false);
  });
});

describe('settlement', () => {
  it('balances sum to zero and settle in <= n-1 transfers', () => {
    const ids = ['aarav', 'riya', 'kabir', 'meera'];
    const eq = (paidBy: string, amount: number) => {
      const r = computeSplit('equal', amount, ids.map((memberId) => ({ memberId })));
      if (!r.ok) throw new Error(r.error);
      return { paidBy, amount, splits: r.amounts };
    };
    const bal = computeBalances(ids, [eq('aarav', 120000), eq('riya', 60000), eq('kabir', 150001)], []);
    expect(sum(bal)).toBe(0);
    const t = suggestSettlements(bal);
    expect(t.length).toBeLessThanOrEqual(ids.length - 1);
    t.forEach((x) => { bal[x.from]! += x.amount; bal[x.to]! -= x.amount; });
    expect(Object.values(bal).every((v) => v === 0)).toBe(true);
  });
});
