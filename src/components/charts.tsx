import { useState } from 'react';
import { compactINR, formatINR } from '../utils/money';
import type { ExpenseCategory } from '../types';

// Plain SVG charts: no chart library to install, they scale to any width and print cleanly.

export const categoryColors: Record<ExpenseCategory, string> = {
  food: '#f97316',
  groceries: '#22c55e',
  rent: '#8b5cf6',
  utilities: '#0ea5e9',
  travel: '#ec4899',
  stay: '#eab308',
  other: '#94a3b8',
};
export const palette = ['#7c3aed', '#0ea5e9', '#f97316', '#22c55e', '#ec4899', '#eab308', '#14b8a6', '#94a3b8'];

interface Bar {
  label: string;
  value: number;
  tip?: string;
}

/** Vertical bars. The last bar is the highlighted one unless `highlight` says otherwise. */
export function BarChart({ data, highlight, height = 190, color = '#7c3aed', label }: { data: Bar[]; highlight?: number; height?: number; color?: string; label: string }) {
  const [hover, setHover] = useState<number | null>(null);
  const W = 560;
  const padL = 44;
  const padB = 26;
  const padT = 16;
  const max = Math.max(...data.map((d) => d.value), 1);
  const nice = niceCeil(max);
  const inner = height - padB - padT;
  const slot = (W - padL) / Math.max(data.length, 1);
  const bw = Math.min(46, slot * 0.6);
  const hi = highlight ?? data.length - 1;
  const ticks = [0, 0.5, 1];

  return (
    <svg viewBox={`0 0 ${W} ${height}`} className="w-full h-auto" role="img" aria-label={label}>
      {ticks.map((t) => {
        const y = padT + inner - inner * t;
        return (
          <g key={t}>
            <line x1={padL} x2={W} y1={y} y2={y} stroke="#e2e8f0" strokeDasharray={t === 0 ? undefined : '3 4'} />
            <text x={padL - 8} y={y + 4} textAnchor="end" fontSize="11" fill="#94a3b8">{compactINR(nice * t)}</text>
          </g>
        );
      })}
      {data.map((d, i) => {
        const h = (d.value / nice) * inner;
        const x = padL + slot * i + (slot - bw) / 2;
        const y = padT + inner - h;
        const active = hover === i;
        return (
          <g key={d.label + i} onMouseEnter={() => setHover(i)} onMouseLeave={() => setHover(null)} onFocus={() => setHover(i)} onBlur={() => setHover(null)} tabIndex={0}>
            <title>{d.tip ?? `${d.label}: ${formatINR(d.value)}`}</title>
            <rect x={padL + slot * i} y={padT} width={slot} height={inner + padB} fill="transparent" />
            <rect x={x} y={y} width={bw} height={Math.max(h, d.value > 0 ? 2 : 0)} rx="5" fill={color} opacity={i === hi || active ? 1 : 0.45} className="origin-bottom animate-grow-up" style={{ transformBox: 'fill-box' }} />
            {(active || (data.length <= 7 && d.value > 0)) && (
              <text x={x + bw / 2} y={y - 6} textAnchor="middle" fontSize="11" fontWeight="600" fill="#334155">{compactINR(d.value)}</text>
            )}
            <text x={x + bw / 2} y={height - 8} textAnchor="middle" fontSize="11" fill={i === hi ? '#334155' : '#94a3b8'} fontWeight={i === hi ? 600 : 400}>{d.label}</text>
          </g>
        );
      })}
    </svg>
  );
}

/** Ring chart with the total in the middle and a legend with percentages. */
export function DonutChart({ slices, centerLabel = 'Total', label }: { slices: { name: string; value: number; color: string }[]; centerLabel?: string; label: string }) {
  const total = slices.reduce((s, x) => s + x.value, 0);
  const R = 52;
  const C = 2 * Math.PI * R;
  let offset = 0;
  if (total === 0) return <p className="text-sm text-slate-500 py-6 text-center">Nothing to show yet.</p>;

  return (
    <div className="flex flex-col sm:flex-row items-center gap-6">
      <svg viewBox="0 0 140 140" className="w-40 h-40 shrink-0 -rotate-90" role="img" aria-label={label}>
        <circle cx="70" cy="70" r={R} fill="none" stroke="#f1f5f9" strokeWidth="18" />
        {slices.map((s) => {
          const len = (s.value / total) * C;
          const el = (
            <circle key={s.name} cx="70" cy="70" r={R} fill="none" stroke={s.color} strokeWidth="18" strokeDasharray={`${Math.max(len - 1.5, 0)} ${C}`} strokeDashoffset={-offset}>
              <title>{`${s.name}: ${formatINR(s.value)}`}</title>
            </circle>
          );
          offset += len;
          return el;
        })}
        <g className="rotate-90 origin-center" style={{ transformBox: 'fill-box' }}>
          <text x="70" y="66" textAnchor="middle" fontSize="9" fill="#94a3b8">{centerLabel}</text>
          <text x="70" y="82" textAnchor="middle" fontSize="13" fontWeight="700" fill="#0f172a">{compactINR(total)}</text>
        </g>
      </svg>
      <ul className="w-full space-y-2 text-sm">
        {slices.map((s) => (
          <li key={s.name} className="flex items-center gap-2">
            <span className="h-2.5 w-2.5 rounded-full shrink-0" style={{ background: s.color }} />
            <span className="flex-1 truncate">{s.name}</span>
            <span className="text-slate-500 tabular-nums">{Math.round((s.value / total) * 100)}%</span>
            <span className="w-24 text-right font-medium tabular-nums">{formatINR(s.value)}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

/** Smooth area chart, used for spending day by day. */
export function AreaChart({ points, label }: { points: { label: string; value: number }[]; label: string }) {
  const [hover, setHover] = useState<number | null>(null);
  const W = 560;
  const H = 150;
  const pad = { l: 44, r: 8, t: 14, b: 22 };
  const max = niceCeil(Math.max(...points.map((p) => p.value), 1));
  const x = (i: number) => pad.l + (i / Math.max(points.length - 1, 1)) * (W - pad.l - pad.r);
  const y = (v: number) => pad.t + (1 - v / max) * (H - pad.t - pad.b);
  const line = points.map((p, i) => `${i ? 'L' : 'M'}${x(i).toFixed(1)},${y(p.value).toFixed(1)}`).join(' ');
  const area = `${line} L${x(points.length - 1).toFixed(1)},${H - pad.b} L${x(0).toFixed(1)},${H - pad.b} Z`;
  const step = Math.max(1, Math.ceil(points.length / 6));
  const h = hover === null ? null : points[hover];

  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="w-full h-auto" role="img" aria-label={label} onMouseLeave={() => setHover(null)}>
      <defs>
        <linearGradient id="areaFill" x1="0" x2="0" y1="0" y2="1">
          <stop offset="0%" stopColor="#7c3aed" stopOpacity="0.25" />
          <stop offset="100%" stopColor="#7c3aed" stopOpacity="0" />
        </linearGradient>
      </defs>
      {[0, 0.5, 1].map((t) => (
        <g key={t}>
          <line x1={pad.l} x2={W - pad.r} y1={y(max * t)} y2={y(max * t)} stroke="#e2e8f0" strokeDasharray={t === 0 ? undefined : '3 4'} />
          <text x={pad.l - 8} y={y(max * t) + 4} textAnchor="end" fontSize="11" fill="#94a3b8">{compactINR(max * t)}</text>
        </g>
      ))}
      <path d={area} fill="url(#areaFill)" />
      <path d={line} fill="none" stroke="#7c3aed" strokeWidth="2" strokeLinejoin="round" />
      {points.map((p, i) => (
        <g key={p.label} onMouseEnter={() => setHover(i)}>
          <rect x={x(i) - 6} y={pad.t} width="12" height={H - pad.t - pad.b} fill="transparent" />
          {i % step === 0 && <text x={x(i)} y={H - 6} textAnchor="middle" fontSize="11" fill="#94a3b8">{p.label}</text>}
          {p.value > 0 && <circle cx={x(i)} cy={y(p.value)} r={hover === i ? 4.5 : 2.5} fill="#7c3aed" />}
        </g>
      ))}
      {h && (
        <text x={Math.min(Math.max(x(hover!), 70), W - 70)} y={pad.t - 3} textAnchor="middle" fontSize="11" fontWeight="600" fill="#334155">
          {h.label}: {formatINR(h.value)}
        </text>
      )}
    </svg>
  );
}

/** Horizontal bars for "who paid vs who owes" style comparisons. */
export function HBars({ rows, color = '#7c3aed' }: { rows: { name: string; value: number; sub?: string }[]; color?: string }) {
  const max = Math.max(...rows.map((r) => r.value), 1);
  return (
    <ul className="space-y-3">
      {rows.map((r) => (
        <li key={r.name}>
          <div className="flex justify-between text-sm mb-1">
            <span className="truncate pr-2">{r.name}{r.sub && <span className="text-slate-400"> · {r.sub}</span>}</span>
            <span className="font-medium tabular-nums">{formatINR(r.value)}</span>
          </div>
          <div className="h-2 rounded-full bg-slate-100">
            <div className="h-2 rounded-full" style={{ width: `${(r.value / max) * 100}%`, background: color }} />
          </div>
        </li>
      ))}
    </ul>
  );
}

// 12,300 -> 15,000 so axis labels land on friendly numbers
function niceCeil(v: number) {
  const p = 10 ** Math.floor(Math.log10(v));
  const f = v / p;
  return (f <= 1 ? 1 : f <= 2 ? 2 : f <= 5 ? 5 : 10) * p;
}
