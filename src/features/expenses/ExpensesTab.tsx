import { useState } from 'react';
import { Plus } from 'lucide-react';
import { useApi } from '../../hooks/useApi';
import { ErrorBox, Loading } from '../../components/Status';
import { formatINR } from '../../utils/money';
import type { Expense, Member } from '../../types';
import AddExpenseForm from './AddExpenseForm';
import { expenseCategoryLabels } from './categories';

interface Props {
  groupId: string;
  members: Member[];
  myMemberId: string;
  onChanged: () => void;
  highlightId?: string | null;
}

export default function ExpensesTab({ groupId, members, myMemberId, onChanged, highlightId }: Props) {
  const { data, error, loading, reload } = useApi<{ expenses: Expense[] }>(`/api/groups/${groupId}/expenses`);
  const [showForm, setShowForm] = useState(false);
  const nameOf = (id: string) => (id === myMemberId ? 'You' : members.find((m) => m.id === id)?.name ?? 'Unknown');

  if (loading) return <Loading />;
  const expenses = data?.expenses ?? [];

  return (
    <div className="space-y-4">
      {error && <ErrorBox message={error} />}
      {!showForm && (
        <button onClick={() => setShowForm(true)} className="btn-primary">
          <Plus size={18} /> Add expense
        </button>
      )}
      {showForm && (
        <AddExpenseForm
          groupId={groupId}
          members={members}
          myMemberId={myMemberId}
          onDone={(saved) => {
            setShowForm(false);
            if (saved) {
              void reload();
              onChanged();
            }
          }}
        />
      )}

      {expenses.length === 0 && !showForm && !error && (
        <div className="card-empty">
          <p className="font-medium">No expenses yet</p>
          <p className="text-slate-500 text-sm mt-1">Add the first expense to start tracking who owes what.</p>
        </div>
      )}

      {expenses.length > 0 && (
        <ul className="list-card">
          {expenses.map((e) => {
            const share = e.splits.find((s) => s.memberId === myMemberId)?.amount ?? 0;
            return (
              <li key={e.id} className={`px-5 py-3 flex items-center justify-between gap-4 ${e.id === highlightId ? 'bg-brand-50' : ''}`}>
                <div>
                  <p className="font-medium">{e.description}</p>
                  <p className="text-sm text-slate-500">
                    {nameOf(e.paidBy)} paid · {e.date} · {expenseCategoryLabels[e.category]}
                  </p>
                </div>
                <div className="text-right">
                  <p className="font-semibold">{formatINR(e.amount)}</p>
                  <p className="text-xs text-slate-500">Your share {formatINR(share)}</p>
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
