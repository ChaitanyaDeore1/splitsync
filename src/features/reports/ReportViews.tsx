import { ArrowDownRight, ArrowUpRight, CalendarDays, Crown, Receipt, Sparkles, Wallet } from 'lucide-react';
import { AreaChart, BarChart, categoryColors, DonutChart, HBars } from '../../components/charts';
import { Stat } from '../../components/Status';
import { addMonths, dayLabel, monthLabel } from '../../utils/dates';
import { formatINR } from '../../utils/money';
import { expenseCategoryLabels } from '../expenses/categories';
import { categoryLabels } from '../groups/categories';
import type { GroupReport, Recap } from '../../types';

/** Plain-language highlights built from the numbers, so the recap reads like a story. */
export function recapHighlights(r: Recap): string[] {
  const out: string[] = [];
  if (r.totals.count === 0) return ['No shared expenses were recorded this month.'];
  out.push(`You spent ${formatINR(r.totals.share)} across ${r.totals.count} expense${r.totals.count === 1 ? '' : 's'} — about ${formatINR(r.totals.dailyAverage)} a day.`);
  const top = r.categories[0];
  if (top) out.push(`${expenseCategoryLabels[top.category]} took the biggest slice: ${Math.round((top.spent / r.totals.share) * 100)}% of your spending.`);
  if (r.previous.changePct !== null) {
    const p = r.previous.changePct;
    out.push(p === 0 ? `That is the same as ${monthLabel(r.previous.month)}.` : `That is ${Math.abs(p)}% ${p > 0 ? 'more' : 'less'} than ${monthLabel(r.previous.month)}.`);
  }
  if (r.topExpense) out.push(`Your biggest single share was "${r.topExpense.description}" at ${formatINR(r.topExpense.share)}.`);
  if (r.payments.sentCount + r.payments.receivedCount > 0) out.push(`You settled up ${r.payments.sentCount + r.payments.receivedCount} time${r.payments.sentCount + r.payments.receivedCount === 1 ? '' : 's'} this month.`);
  return out;
}

export function RecapView({ recap }: { recap: Recap }) {
  const r = recap;
  const change = r.previous.changePct;
  const empty = r.totals.count === 0;

  return (
    <div className="space-y-6">
      <section className="rounded-3xl bg-gradient-to-br from-navy-900 via-navy-800 to-brand-700 text-white p-6 sm:p-8 shadow-pop">
        <p className="flex items-center gap-2 text-sm text-brand-200"><Sparkles size={16} /> {monthLabel(r.month)} recap</p>
        <p className="text-4xl sm:text-5xl font-bold mt-3 tabular-nums">{formatINR(r.totals.share)}</p>
        <p className="text-slate-300 text-sm mt-1">your share of spending</p>
        {change !== null && !empty && (
          <p className={`inline-flex items-center gap-1 mt-4 rounded-full px-3 py-1 text-sm font-medium ${change > 0 ? 'bg-red-500/20 text-red-100' : 'bg-emerald-500/20 text-emerald-100'}`}>
            {change > 0 ? <ArrowUpRight size={16} /> : <ArrowDownRight size={16} />} {Math.abs(change)}% vs {monthLabel(addMonths(r.month, -1))}
          </p>
        )}
        <ul className="mt-5 space-y-1.5 text-sm text-slate-200">
          {recapHighlights(r).map((h) => <li key={h} className="flex gap-2"><span className="text-brand-200">•</span>{h}</li>)}
        </ul>
      </section>

      {!empty && (
        <>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <Stat label="Expenses" value={String(r.totals.count)} hint={`avg ${formatINR(r.totals.avgExpense)} your share`} />
            <Stat label="You paid upfront" value={formatINR(r.totals.paid)} hint="total of bills you covered" />
            <Stat label="Payments sent" value={formatINR(r.payments.sent)} hint={`${r.payments.sentCount} payment${r.payments.sentCount === 1 ? '' : 's'}`} />
            <Stat label="Payments received" value={formatINR(r.payments.received)} hint={`${r.payments.receivedCount} payment${r.payments.receivedCount === 1 ? '' : 's'}`} tone={r.payments.received ? 'good' : undefined} />
          </div>

          <div className="grid gap-4 lg:grid-cols-2">
            <section className="card p-5">
              <h2 className="section-title">Where it went</h2>
              <DonutChart label="Spending by category" slices={r.categories.map((c) => ({ name: expenseCategoryLabels[c.category], value: c.spent, color: categoryColors[c.category] }))} />
            </section>
            <section className="card p-5">
              <h2 className="section-title">By group</h2>
              <HBars rows={r.groups.map((g) => ({ name: g.name, value: g.spent, sub: `${g.count} expense${g.count === 1 ? '' : 's'}` }))} />
            </section>
          </div>

          <section className="card p-5">
            <h2 className="section-title">Day by day</h2>
            <AreaChart label="Daily spending" points={r.daily.map((d) => ({ label: String(Number(d.date.slice(8))), value: d.spent }))} />
          </section>

          <div className="grid gap-4 sm:grid-cols-2">
            {r.topExpense && (
              <div className="card p-5 flex gap-4">
                <Crown className="text-amber-500 shrink-0" />
                <div>
                  <p className="text-sm text-slate-500">Biggest expense</p>
                  <p className="font-semibold">{r.topExpense.description}</p>
                  <p className="text-sm text-slate-500">{r.topExpense.groupName} · {dayLabel(r.topExpense.date)}</p>
                  <p className="text-sm mt-1">Your share <b>{formatINR(r.topExpense.share)}</b> of {formatINR(r.topExpense.amount)}</p>
                </div>
              </div>
            )}
            {r.topDay && (
              <div className="card p-5 flex gap-4">
                <CalendarDays className="text-brand-600 shrink-0" />
                <div>
                  <p className="text-sm text-slate-500">Priciest day</p>
                  <p className="font-semibold">{dayLabel(r.topDay.date)}</p>
                  <p className="text-sm mt-1">You spent <b>{formatINR(r.topDay.spent)}</b> that day</p>
                </div>
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
}

export function GroupReportView({ report }: { report: GroupReport }) {
  const g = report;
  const title = g.month ? monthLabel(g.month) : 'All time';
  const owedList = g.settleUp;
  return (
    <div className="space-y-6">
      <section className="rounded-3xl bg-gradient-to-br from-navy-900 via-navy-800 to-brand-700 text-white p-6 sm:p-8 shadow-pop">
        <p className="flex items-center gap-2 text-sm text-brand-200"><Receipt size={16} /> {g.group.name} · {categoryLabels[g.group.category]} · {title}</p>
        <p className="text-4xl sm:text-5xl font-bold mt-3 tabular-nums">{formatINR(g.totals.spend)}</p>
        <p className="text-slate-300 text-sm mt-1">total group spending across {g.totals.count} expense{g.totals.count === 1 ? '' : 's'} · {g.group.memberCount} members</p>
      </section>

      <div className="grid gap-4 lg:grid-cols-2">
        <section className="card p-5">
          <h2 className="section-title">By category</h2>
          <DonutChart label="Group spending by category" slices={g.categories.map((c) => ({ name: expenseCategoryLabels[c.category], value: c.spent, color: categoryColors[c.category] }))} />
        </section>
        <section className="card p-5">
          <h2 className="section-title">Last 6 months</h2>
          <BarChart label="Group spending by month" data={g.monthly.map((m) => ({ label: monthLabel(m.month, 'short').split(' ')[0]!, value: m.spent, tip: `${monthLabel(m.month)}: ${formatINR(m.spent)}` }))} />
        </section>
      </div>

      <section className="card p-5">
        <h2 className="section-title">Who paid and who owes</h2>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-slate-500 border-b border-slate-100">
                <th className="py-2 font-medium">Member</th>
                <th className="py-2 font-medium text-right">Paid</th>
                <th className="py-2 font-medium text-right">Share</th>
                <th className="py-2 font-medium text-right">Balance now</th>
              </tr>
            </thead>
            <tbody>
              {g.members.map((m) => (
                <tr key={m.name} className="border-b border-slate-50 last:border-0">
                  <td className="py-2">{m.name}</td>
                  <td className="py-2 text-right tabular-nums">{formatINR(m.paid)}</td>
                  <td className="py-2 text-right tabular-nums">{formatINR(m.share)}</td>
                  <td className={`py-2 text-right tabular-nums font-medium ${m.balance > 0 ? 'text-owed' : m.balance < 0 ? 'text-owe' : 'text-slate-500'}`}>
                    {m.balance === 0 ? 'settled' : m.balance > 0 ? `gets ${formatINR(m.balance)}` : `owes ${formatINR(-m.balance)}`}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <div className="grid gap-4 lg:grid-cols-2">
        <section className="card p-5">
          <h2 className="section-title flex items-center gap-2"><Wallet size={14} /> How to settle up</h2>
          {owedList.length === 0 ? <p className="text-sm text-slate-500">Everyone is settled up.</p> : (
            <ul className="space-y-2 text-sm">
              {owedList.map((t) => <li key={`${t.from}-${t.to}`}>{t.from} pays {t.to} <b>{formatINR(t.amount)}</b></li>)}
            </ul>
          )}
          {g.payments.count > 0 && <p className="text-xs text-slate-500 mt-3">{g.payments.count} payment{g.payments.count === 1 ? '' : 's'} already made, {formatINR(g.payments.total)} in total.</p>}
        </section>
        <section className="card p-5">
          <h2 className="section-title">Biggest expenses</h2>
          {g.topExpenses.length === 0 ? <p className="text-sm text-slate-500">No expenses in this period.</p> : (
            <ul className="space-y-2 text-sm">
              {g.topExpenses.map((e, i) => (
                <li key={`${e.description}-${i}`} className="flex justify-between gap-3">
                  <span className="truncate">{e.description} <span className="text-slate-400">· {e.paidBy} · {dayLabel(e.date)}</span></span>
                  <b className="tabular-nums">{formatINR(e.amount)}</b>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>
    </div>
  );
}
