import { useState } from 'react';
import { api, newKey } from '../../services/api';
import { useApi } from '../../hooks/useApi';
import { ErrorBox, Loading } from '../../components/Status';
import { formatINR } from '../../utils/money';
import type { Member, Settlement, Suggestion } from '../../types';

export default function BalancesTab({ groupId, members, onChanged }: { groupId: string; members: Member[]; onChanged: () => void }) {
  const suggestions = useApi<{ suggestions: Suggestion[] }>(`/api/groups/${groupId}/suggestions`);
  const history = useApi<{ settlements: Settlement[] }>(`/api/groups/${groupId}/settlements`);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const nameOf = (id: string) => members.find((m) => m.id === id)?.name ?? 'Unknown';

  async function pay(t: Suggestion) {
    setBusy(true);
    setError('');
    try {
      await api('POST', `/api/groups/${groupId}/settlements`, t, newKey());
      onChanged();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not record this payment');
    } finally {
      await Promise.all([suggestions.reload(), history.reload()]);
      setBusy(false);
    }
  }

  if (suggestions.loading || history.loading) return <Loading />;
  const done = history.data?.settlements ?? [];

  return (
    <div className="space-y-6">
      <section>
        <h2 className="font-semibold mb-2">Balances</h2>
        <ul className="list-card">
          {members.map((m) => (
            <li key={m.id} className="px-5 py-3 flex justify-between">
              <span>{m.name}</span>
              {m.balance === 0 && <span className="text-slate-500">settled</span>}
              {m.balance > 0 && <span className="text-owed font-medium">gets {formatINR(m.balance)}</span>}
              {m.balance < 0 && <span className="text-owe font-medium">owes {formatINR(-m.balance)}</span>}
            </li>
          ))}
        </ul>
      </section>

      <section>
        <h2 className="font-semibold mb-2">Suggested payments</h2>
        {suggestions.error && <ErrorBox message={suggestions.error} />}
        {suggestions.data?.suggestions.length === 0 ? (
          <p className="text-slate-500">Everyone is settled up.</p>
        ) : (
          <ul className="list-card">
            {suggestions.data?.suggestions.map((t) => (
              <li key={`${t.fromMember}-${t.toMember}`} className="px-5 py-3 flex items-center justify-between gap-3">
                <span>{nameOf(t.fromMember)} pays {nameOf(t.toMember)} <b>{formatINR(t.amount)}</b></span>
                <button disabled={busy} onClick={() => void pay(t)} className="btn-primary !py-1.5">
                  Mark as paid
                </button>
              </li>
            ))}
          </ul>
        )}
        {error && <div className="mt-2"><ErrorBox message={error} /></div>}
      </section>

      {done.length > 0 && (
        <section>
          <h2 className="font-semibold mb-2">Payment history</h2>
          <ul className="list-card text-sm">
            {done.map((s) => (
              <li key={s.id} className="px-5 py-3 flex justify-between">
                <span>{nameOf(s.fromMember)} paid {nameOf(s.toMember)} · {new Date(s.createdAt).toLocaleDateString()}</span>
                <span className="font-medium">{formatINR(s.amount)}</span>
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}
