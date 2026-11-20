/** All money in SplitSync is an integer number of paise (1 INR = 100 paise). */
export type Paise = number;

/** Parse "1,200.5" -> 120050 using string math only. Returns null if invalid. */
export function parseRupeesToPaise(input: string): Paise | null {
  const s = input.replace(/[₹,\s]/g, '');
  const m = /^(\d+)(?:\.(\d{1,2}))?$/.exec(s);
  if (!m) return null;
  const rupees = Number(m[1]);
  const paise = Number((m[2] ?? '').padEnd(2, '0') || '0');
  const total = rupees * 100 + paise;
  return Number.isSafeInteger(total) ? total : null;
}

/** 120050 -> "₹1,200.50" (Indian digit grouping). */
export function formatINR(paise: Paise): string {
  const sign = paise < 0 ? '-' : '';
  const abs = Math.abs(paise);
  const rupees = Math.floor(abs / 100);
  const rem = abs % 100;
  const r = String(rupees);
  const last3 = r.slice(-3);
  const rest = r.slice(0, -3);
  const grouped = rest ? rest.replace(/\B(?=(\d{2})+(?!\d))/g, ',') + ',' + last3 : last3;
  return `${sign}₹${grouped}.${String(rem).padStart(2, '0')}`;
}

/** Short form for chart axes: 1,500 -> "₹1.5k", 250000 -> "₹2.5L" (paise in, as everywhere else). */
export function compactINR(paise: Paise): string {
  const r = Math.abs(paise) / 100;
  const trim = (n: number) => String(Number(n.toFixed(1)));
  if (r >= 1e7) return `₹${trim(r / 1e7)}Cr`;
  if (r >= 1e5) return `₹${trim(r / 1e5)}L`;
  if (r >= 1e3) return `₹${trim(r / 1e3)}k`;
  return `₹${Math.round(r)}`;
}
