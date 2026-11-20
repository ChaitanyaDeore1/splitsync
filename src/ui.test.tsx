import type { ReactElement } from 'react';
import { renderToString } from 'react-dom/server';
import { MemoryRouter } from 'react-router-dom';
import { describe, expect, it } from 'vitest';
import { AreaChart, BarChart, DonutChart } from './components/charts';
import { GroupReportView, RecapView, recapHighlights } from './features/reports/ReportViews';
import Guide from './pages/Guide';
import { addMonths, monthLabel } from './utils/dates';
import { compactINR } from './utils/money';
import type { GroupReport, Recap } from './types';

// React's server renderer puts <!-- --> between adjacent text pieces; remove them so we can read the text
const render = (el: ReactElement) => renderToString(el).replace(/<!-- -->/g, '');

const recap: Recap = {
  month: '2026-10', person: 'Asha Verma',
  totals: { share: 45000, paid: 125000, count: 3, avgExpense: 15000, dailyAverage: 1452 },
  previous: { month: '2026-09', share: 30000, changePct: 50 },
  categories: [{ category: 'rent', spent: 30000, count: 1 }, { category: 'food', spent: 15000, count: 2 }],
  groups: [{ name: 'Flat', spent: 45000, count: 3 }],
  daily: Array.from({ length: 31 }, (_, i) => ({ date: `2026-10-${String(i + 1).padStart(2, '0')}`, spent: i === 0 ? 30000 : 0 })),
  topDay: { date: '2026-10-01', spent: 30000 },
  topExpense: { description: 'Rent', groupName: 'Flat', date: '2026-10-01', share: 30000, amount: 90000 },
  payments: { sent: 0, sentCount: 0, received: 20000, receivedCount: 1 },
};
const group: GroupReport = {
  group: { name: 'Flat', category: 'flatmates', memberCount: 2 }, month: null,
  totals: { spend: 135000, count: 3, average: 45000 },
  categories: [{ category: 'rent', spent: 90000, count: 1 }],
  monthly: [{ month: '2026-09', spent: 15000, count: 1 }, { month: '2026-10', spent: 120000, count: 2 }],
  members: [{ name: 'Asha', paid: 135000, share: 67500, balance: 67500 }, { name: 'Riya', paid: 0, share: 67500, balance: -67500 }],
  topExpenses: [{ description: 'Rent', date: '2026-10-01', amount: 90000, paidBy: 'Asha' }],
  payments: { count: 0, total: 0 }, settleUp: [{ from: 'Riya', to: 'Asha', amount: 67500 }],
};

describe('report views render', () => {
  it('monthly recap shows the story, change and charts', () => {
    const html = render(<RecapView recap={recap} />);
    expect(html).toContain('₹450.00');
    expect(html).toContain('50% vs');
    expect(html).toContain('<svg');
  });
  it('an empty month renders without crashing', () => {
    const empty = { ...recap, totals: { ...recap.totals, share: 0, count: 0 }, categories: [], groups: [], topExpense: null, topDay: null, previous: { ...recap.previous, changePct: null } };
    expect(render(<RecapView recap={empty} />)).toContain('No shared expenses');
  });
  it('writes plain-language highlights', () => {
    const h = recapHighlights(recap).join(' ');
    expect(h).toContain('50% more than');
    expect(h).toContain('"Rent"');
  });
  it('group report shows members and how to settle', () => {
    const html = render(<GroupReportView report={group} />);
    expect(html).toContain('Riya pays Asha');
    expect(html).toContain('owes');
  });
});

describe('charts and helpers', () => {
  it('charts render with empty, zero and normal data', () => {
    expect(render(<BarChart label="x" data={[{ label: 'A', value: 0 }, { label: 'B', value: 0 }]} />)).toContain('<svg');
    expect(render(<BarChart label="x" data={[{ label: 'A', value: 12300 }]} />)).toContain('₹123');
    expect(render(<DonutChart label="x" slices={[]} />)).toContain('Nothing to show');
    expect(render(<AreaChart label="x" points={[{ label: '1', value: 0 }, { label: '2', value: 500 }]} />)).toContain('path');
  });
  it('formats compact amounts and months', () => {
    expect(compactINR(150000)).toBe('₹1.5k');
    expect(compactINR(25000000)).toBe('₹2.5L');
    expect(compactINR(500)).toBe('₹5');
    expect(addMonths('2026-12', 1)).toBe('2027-01');
    expect(addMonths('2026-01', -1)).toBe('2025-12');
    expect(monthLabel('2026-10')).toContain('2026');
  });
});

describe('guide', () => {
  it('renders every section, the FAQ and the glossary', () => {
    const html = render(<MemoryRouter><Guide /></MemoryRouter>);
    for (const t of ['Quick start', 'Shareable reports', 'Notifications', 'Monthly recap', 'Frequently asked questions', 'Glossary', 'Troubleshooting']) expect(html).toContain(t);
  });
});
