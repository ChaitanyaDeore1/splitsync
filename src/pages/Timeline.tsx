import { useState } from 'react';
import type { FormEvent } from 'react';
import { Link } from 'react-router-dom';
import { Download } from 'lucide-react';
import { useApi } from '../hooks/useApi';
import { ErrorBox, Loading } from '../components/Status';
import { formatINR } from '../utils/money';
import { expenseCategoryLabels, expenseCategoryList } from '../features/expenses/categories';
import type { GroupSummary, TimelineResponse } from '../types';

const field = 'input !w-auto text-sm';

export default function Timeline() {
  const groups = useApi<{ groups: GroupSummary[] }>('/api/groups');
  const [filters, setFilters] = useState({ group: '', category: '', type: '', from: '', to: '' });
  const [search, setSearch] = useState('');
  const [q, setQ] = useState('');

  const params = new URLSearchParams();
  Object.entries({ ...filters, q }).forEach(([k, v]) => v && params.set(k, v));
  const qs = params.toString();
  const { data, error, loading } = useApi<TimelineResponse>(`/api/timeline?${qs}`);

  const set = (k: keyof typeof filters) => (e: { target: { value: string } }) => setFilters({ ...filters, [k]: e.target.value });
  const applySearch = (e: FormEvent) => { e.preventDefault(); setQ(search.trim()); };

  return (
    <div className="space-y-6 max-w-4xl">
      <div className="flex items-center justify-between gap-3">
        <h1 className="page-title">My timeline</h1>
        <a href={`/api/timeline.csv?${qs}`} className="btn-secondary">
          <Download size={16} /> Export CSV
        </a>
      </div>

      <div className="flex flex-wrap gap-2">
        <select aria-label="Group" value={filters.group} onChange={set('group')} className={field}>
          <option value="">All groups</option>
          {groups.data?.groups.map((g) => <option key={g.id} value={g.id}>{g.name}</option>)}
        </select>
        <select aria-label="Category" value={filters.category} onChange={set('category')} className={field}>
          <option value="">All categories</option>
          {expenseCategoryList.map((c) => <option key={c} value={c}>{expenseCategoryLabels[c]}</option>)}
        </select>
        <select aria-label="Type" value={filters.type} onChange={set('type')} className={field}>
          <option value="">Everything</option>
          <option value="paid">Expenses I paid</option>
          <option value="share">Expenses I only share</option>
          <option value="settlement">Payments</option>
        </select>
        <input aria-label="From date" type="date" value={filters.from} onChange={set('from')} className={field} />
        <input aria-label="To date" type="date" value={filters.to} onChange={set('to')} className={field} />
        <form onSubmit={applySearch} className="flex gap-2">
          <input aria-label="Search expenses" value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search expenses" className={field} />
          <button className="btn-primary">Search</button>
        </form>
      </div>

      {error && <ErrorBox message={error} />}
      {loading && <Loading />}
      {data && (
        <>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="card p-5">
              <p className="text-sm text-slate-500">Your spending (your share only)</p>
              <p className="text-2xl font-bold mt-1">{formatINR(data.summary.totalShare)}</p>
            </div>
            <div className="card p-5">
              <p className="text-sm text-slate-500">Total of expenses you paid</p>
              <p className="text-2xl font-bold mt-1">{formatINR(data.summary.totalPaid)}</p>
            </div>
          </div>

          {data.summary.byMonth.length > 0 && (
            <div className="grid gap-4 sm:grid-cols-2 text-sm">
              {[['By month', data.summary.byMonth], ['By year', data.summary.byYear]].map(([title, rows]) => (
                <div key={title as string} className="card p-4">
                  <p className="font-medium mb-2">{title as string}</p>
                  {(rows as { period: string; spent: number }[]).map((r) => (
                    <p key={r.period} className="flex justify-between py-0.5"><span>{r.period}</span><span>{formatINR(r.spent)}</span></p>
                  ))}
                </div>
              ))}
            </div>
          )}

          {data.items.length === 0 ? (
            <div className="card-empty text-slate-500">Nothing matches these filters.</div>
          ) : (
            <ul className="list-card">
              {data.items.map((i) =>
                i.kind === 'expense' ? (
                  <li key={i.id} className="px-5 py-3">
                    <div className="flex items-start justify-between gap-4">
                      <div>
                        <p className="font-medium">{i.description}</p>
                        <p className="text-sm text-slate-500">
                          <Link to={`/groups/${i.groupId}?expense=${i.id}`} className="text-brand-700">{i.groupName}</Link> · {i.date} · {i.paidByMe ? 'You paid' : `${i.payerName} paid`}
                        </p>
                      </div>
                      <div className="text-right">
                        <p className="font-semibold">Your share {formatINR(i.myShare)}</p>
                        <p className="text-xs text-slate-500">Total {formatINR(i.amount)}</p>
                      </div>
                    </div>
                    <details className="text-sm text-slate-600 mt-1">
                      <summary className="cursor-pointer text-slate-500">Details</summary>
                      <p>{expenseCategoryLabels[i.category]} · split {i.splitMethod}{i.notes ? ` · ${i.notes}` : ''}</p>
                    </details>
                  </li>
                ) : (
                  <li key={i.id} className="px-5 py-3 flex items-center justify-between gap-4">
                    <div>
                      <p className="font-medium">{i.iPaid ? `You paid ${i.toName}` : `${i.fromName} paid you`}</p>
                      <p className="text-sm text-slate-500"><Link to={`/groups/${i.groupId}`} className="text-brand-700">{i.groupName}</Link> · {i.date} · payment</p>
                    </div>
                    <p className={`font-semibold ${i.iPaid ? 'text-owe' : 'text-owed'}`}>{formatINR(i.amount)}</p>
                  </li>
                ),
              )}
            </ul>
          )}
        </>
      )}
    </div>
  );
}
