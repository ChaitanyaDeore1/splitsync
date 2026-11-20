import type { Paise } from './money';

export type SplitMethod = 'equal' | 'exact' | 'percentage' | 'shares';

export interface SplitInput {
  memberId: string;
  /** exact: paise | percentage: basis points (50% = 5000) | shares: whole number | equal: ignored */
  value?: number;
}

export type SplitResult =
  | { ok: true; amounts: Record<string, Paise> }
  | { ok: false; error: string };

/** Largest-remainder allocation: integer math only, result always sums to total. */
function allocate(total: Paise, weights: number[]): Paise[] {
  const W = weights.reduce((a, b) => a + b, 0);
  const base = weights.map((w) => Math.floor((total * w) / W));
  const rems = weights.map((w, i) => ({ i, r: (total * w) % W }));
  let left = total - base.reduce((a, b) => a + b, 0);
  rems.sort((a, b) => b.r - a.r || a.i - b.i);
  for (const { i } of rems) {
    if (left <= 0) break;
    base[i] = (base[i] ?? 0) + 1;
    left--;
  }
  return base;
}

export function computeSplit(method: SplitMethod, total: Paise, inputs: SplitInput[]): SplitResult {
  if (!Number.isInteger(total) || total <= 0) return { ok: false, error: 'Amount must be greater than zero' };
  if (inputs.length === 0) return { ok: false, error: 'Select at least one participant' };
  const vals = inputs.map((x) => x.value ?? 0);
  let parts: Paise[];

  if (method === 'equal') {
    parts = allocate(total, inputs.map(() => 1));
  } else if (method === 'exact') {
    if (vals.some((v) => !Number.isInteger(v) || v < 0)) return { ok: false, error: 'Invalid amount' };
    const sum = vals.reduce((a, b) => a + b, 0);
    if (sum !== total) return { ok: false, error: `Amounts must add up to the total (off by ${total - sum} paise)` };
    parts = vals;
  } else if (method === 'percentage') {
    if (vals.some((v) => !Number.isInteger(v) || v < 0)) return { ok: false, error: 'Invalid percentage' };
    if (vals.reduce((a, b) => a + b, 0) !== 10000) return { ok: false, error: 'Percentages must add up to 100%' };
    parts = allocate(total, vals);
  } else {
    if (vals.some((v) => !Number.isInteger(v) || v < 0) || vals.every((v) => v === 0))
      return { ok: false, error: 'Shares must be whole numbers with at least one above zero' };
    parts = allocate(total, vals);
  }

  const amounts: Record<string, Paise> = {};
  inputs.forEach((x, i) => (amounts[x.memberId] = parts[i] ?? 0));
  return { ok: true, amounts };
}
