import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useApi } from '../hooks/useApi';
import { BarChart, categoryColors, DonutChart, HBars } from '../components/charts';
import { EmptyState, ErrorBox, Loading, PageHeader, Stat } from '../components/Status';
import { expenseCategoryLabels } from '../features/expenses/categories';
import { dayLabel, monthLabel } from '../utils/dates';
import { formatINR } from '../utils/money';
import type { Analytics, GroupSummary } from '../types';

const weekdays = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

export default function Insights() {
  const [months, setMonths] = useState(6);
  const [group, setGroup] = useState('');
  const groups = useApi<{ groups: GroupSummary[] }>('/api/groups');
  const { data, error, loading } = useApi<Analytics>(`/api/analytics?months=${months}${group ? `&group=${group}` : ''}`);

  return (
    <div className="space-y-6 max-w-5xl">
      <PageHeader
        title="Insights"
        subtitle="Charts of your own share of spending, never the whole group's bills."
        actions={
          <>
            <select aria-label="Group" value={group} onChange={(e) => setGroup(e.target.value)} className="input !w-auto">
              <option value="">All groups</option>
              {groups.data?.groups.map((g) => <option key={g.id} value={g.id}>{g.name}</option>)}
            </select>
            <select aria-label="Time range" value={months} onChange={(e) => setMonths(Number(e.target.value))} className="input !w-auto">
              <option value={3}>Last 3 months</option>
              <option value={6}>Last 6 months</option>
              <option value={12}>Last 12 months</option>
            </select>
          </>
        }
      />
      {error && <ErrorBox message={error} />}
      {loading && <Loading />}
      {data && (data.stats.count === 0 ? (
        <EmptyState title="No spending in this period" text="Add expenses in a group and your charts will appear here.">
          <Link to="/groups" className="btn-primary">Go to Groups</Link>
        </EmptyState>
      ) : (
        <>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <Stat label={`Spent in ${months} months`} value={formatINR(data.stats.total)} />
            <Stat label="Average per month" value={formatINR(data.stats.averagePerMonth)} />
            <Stat label="Expenses" value={String(data.stats.count)} />
            <Stat label="Busiest month" value={data.stats.busiestMonth ? monthLabel(data.stats.busiestMonth.month, 'short') : '—'} hint={data.stats.busiestMonth ? formatINR(data.stats.busiestMonth.spent) : undefined} />
          </div>

          <section className="card p-5">
            <h2 className="section-title">Spending by month</h2>
            <BarChart label="Your spending by month" data={data.trend.map((t) => ({ label: monthLabel(t.month, 'short').split(' ')[0]!, value: t.spent, tip: `${monthLabel(t.month)}: ${formatINR(t.spent)} (${t.count} expenses)` }))} />
            <p className="text-xs text-slate-500 mt-2">Tip: open <Link to="/recap" className="text-brand-700 font-medium">Monthly recap</Link> for a full breakdown of any month.</p>
          </section>

          <div className="grid gap-4 lg:grid-cols-2">
            <section className="card p-5">
              <h2 className="section-title">By category</h2>
              <DonutChart label="Spending by category" slices={data.categories.map((c) => ({ name: expenseCategoryLabels[c.category], value: c.spent, color: categoryColors[c.category] }))} />
            </section>
            <section className="card p-5">
              <h2 className="section-title">By group</h2>
              <HBars rows={data.groups.map((g) => ({ name: g.name, value: g.spent, sub: `${g.count}` }))} />
            </section>
          </div>

          <div className="grid gap-4 lg:grid-cols-2">
            <section className="card p-5">
              <h2 className="section-title">Day of the week</h2>
              <BarChart height={170} label="Spending by day of the week" highlight={data.weekday.reduce((b, d, i, a) => (d.spent > a[b]!.spent ? i : b), 0)} color="#0ea5e9" data={data.weekday.map((d) => ({ label: weekdays[d.day]!, value: d.spent }))} />
            </section>
            <section className="card p-5">
              <h2 className="section-title">Your biggest shares</h2>
              <ul className="space-y-3 text-sm">
                {data.topExpenses.map((e) => (
                  <li key={e.id} className="flex items-center justify-between gap-3">
                    <span className="min-w-0">
                      <Link to={`/groups/${e.groupId}?expense=${e.id}`} className="block truncate font-medium hover:text-brand-700">{e.description}</Link>
                      <span className="text-xs text-slate-500">{e.groupName} · {dayLabel(e.date)}</span>
                    </span>
                    <b className="tabular-nums">{formatINR(e.share)}</b>
                  </li>
                ))}
              </ul>
            </section>
          </div>
        </>
      ))}
    </div>
  );
}
