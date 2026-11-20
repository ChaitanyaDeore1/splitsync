import { Link } from 'react-router-dom';
import { ArrowRight, BookOpen, CalendarRange, Plus } from 'lucide-react';
import { useStore } from '../store/useStore';
import { useApi } from '../hooks/useApi';
import { BarChart } from '../components/charts';
import { EmptyState, ErrorBox, Loading, PageHeader, Stat } from '../components/Status';
import { addMonths, currentMonth, monthLabel, timeAgo } from '../utils/dates';
import { formatINR } from '../utils/money';
import type { Analytics, GroupSummary, RecentActivity } from '../types';

export default function Dashboard() {
  const user = useStore((s) => s.user);
  const openTour = useStore((s) => s.openTour);
  const groups = useApi<{ groups: GroupSummary[] }>('/api/groups');
  const recent = useApi<{ activity: RecentActivity[] }>('/api/groups/recent-activity');
  const analytics = useApi<Analytics>('/api/analytics?months=6');

  if (groups.loading || recent.loading) return <Loading />;
  const list = groups.data?.groups ?? [];
  const youOwe = list.reduce((sum, g) => sum + (g.myBalance < 0 ? -g.myBalance : 0), 0);
  const youAreOwed = list.reduce((sum, g) => sum + (g.myBalance > 0 ? g.myBalance : 0), 0);
  const net = youAreOwed - youOwe;
  const trend = analytics.data?.trend ?? [];
  const thisMonth = trend[trend.length - 1];
  const lastMonth = trend[trend.length - 2];
  const hour = new Date().getHours();
  const greeting = hour < 12 ? 'Good morning' : hour < 18 ? 'Good afternoon' : 'Good evening';

  return (
    <div className="space-y-6 max-w-5xl">
      <PageHeader
        title={`${greeting}, ${user?.name.split(' ')[0] ?? 'there'}`}
        subtitle="Here is where your shared money stands."
        actions={<Link to="/groups" className="btn-primary"><Plus size={16} /> New group</Link>}
      />

      {(groups.error || recent.error) && <ErrorBox message={groups.error || recent.error} />}

      <div className="grid gap-4 sm:grid-cols-3">
        <Stat label="You owe" value={formatINR(youOwe)} tone={youOwe ? 'bad' : undefined} />
        <Stat label="You are owed" value={formatINR(youAreOwed)} tone={youAreOwed ? 'good' : undefined} />
        <Stat label="Net balance" value={formatINR(net)} tone={net < 0 ? 'bad' : net > 0 ? 'good' : undefined} hint={net === 0 ? 'All square' : net > 0 ? 'Overall, you are owed' : 'Overall, you owe'} />
      </div>

      {list.length === 0 ? (
        <EmptyState title="Start by creating a group" text="A group is a flat, a trip or a friend circle. Add expenses and SplitSync works out who owes whom.">
          <div className="flex justify-center gap-2">
            <Link to="/groups" className="btn-primary">Create a group</Link>
            <Link to="/guide" className="btn-secondary"><BookOpen size={16} /> Read the guide</Link>
          </div>
        </EmptyState>
      ) : (
        <>
          <div className="grid gap-4 lg:grid-cols-5">
            <section className="card p-5 lg:col-span-3">
              <div className="flex items-center justify-between">
                <h2 className="section-title !mb-0">Your spending, last 6 months</h2>
                <Link to="/insights" className="flex items-center gap-1 text-sm font-medium text-brand-700">Insights <ArrowRight size={14} /></Link>
              </div>
              <div className="mt-3">
                {analytics.data ? (
                  <BarChart height={170} label="Your spending by month" data={trend.map((t) => ({ label: monthLabel(t.month, 'short').split(' ')[0]!, value: t.spent, tip: `${monthLabel(t.month)}: ${formatINR(t.spent)}` }))} />
                ) : <p className="py-10 text-center text-sm text-slate-500">{analytics.error || 'Loading chart…'}</p>}
              </div>
            </section>

            <section className="card flex flex-col justify-between bg-gradient-to-br from-navy-900 to-brand-700 p-5 text-white lg:col-span-2">
              <div>
                <p className="flex items-center gap-2 text-sm text-brand-200"><CalendarRange size={16} /> {monthLabel(currentMonth())}</p>
                <p className="mt-3 text-3xl font-bold tabular-nums">{formatINR(thisMonth?.spent ?? 0)}</p>
                <p className="text-sm text-slate-300">spent so far this month</p>
                {lastMonth && lastMonth.spent > 0 && (
                  <p className="mt-3 text-sm text-slate-200">{monthLabel(addMonths(currentMonth(), -1))}: {formatINR(lastMonth.spent)}</p>
                )}
              </div>
              <div className="mt-5 flex flex-wrap gap-2">
                <Link to="/recap" className="btn bg-white text-navy-900 hover:bg-slate-100">Open recap</Link>
                <Link to={`/recap?month=${addMonths(currentMonth(), -1)}`} className="btn border border-white/30 text-white hover:bg-white/10">Last month</Link>
              </div>
            </section>
          </div>

          <section>
            <h2 className="section-title">Recent activity</h2>
            {recent.data?.activity.length ? (
              <ul className="list-card">
                {recent.data.activity.map((a) => (
                  <li key={a.id} className="px-5 py-3">
                    <p className="text-sm">{a.message}</p>
                    <p className="text-xs text-slate-500">{a.groupName} · {timeAgo(a.createdAt)}</p>
                  </li>
                ))}
              </ul>
            ) : <p className="text-sm text-slate-500">Nothing yet.</p>}
          </section>
        </>
      )}

      <button onClick={openTour} className="text-sm font-medium text-brand-700">Take the tour again</button>
    </div>
  );
}
