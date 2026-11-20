import { useRef, useState } from 'react';
import type { FormEvent } from 'react';
import { api, newKey } from '../../services/api';
import { formatINR, parseRupeesToPaise } from '../../utils/money';
import { computeSplit } from '../../utils/split';
import type { SplitMethod } from '../../utils/split';
import type { ExpenseCategory, Member } from '../../types';
import { expenseCategoryLabels, expenseCategoryList } from './categories';

// Today's date as YYYY-MM-DD in the user's local time
function todayISO(): string {
  const d = new Date();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${d.getFullYear()}-${month}-${day}`;
}

const methodLabels: Record<SplitMethod, string> = {
  equal: 'Equal',
  exact: 'Exact amount',
  percentage: 'Percentage',
  shares: 'Shares',
};

interface Props {
  groupId: string;
  members: Member[];
  myMemberId: string;
  onDone: (saved: boolean) => void;
}

export default function AddExpenseForm({ groupId, members, myMemberId, onDone }: Props) {
  const memberIds = members.map((m) => m.id);
  const key = useRef(newKey()); // one key per form: a double-click or retry cannot save twice
  const [busy, setBusy] = useState(false);

  const [description, setDescription] = useState('');
  const [amountText, setAmountText] = useState('');
  const [paidBy, setPaidBy] = useState(myMemberId);
  const [date, setDate] = useState(todayISO());
  const [category, setCategory] = useState<ExpenseCategory>('other');
  const [notes, setNotes] = useState('');
  // memberId -> is this person sharing the expense? (everyone starts selected)
  const [selected, setSelected] = useState<Record<string, boolean>>(() =>
    Object.fromEntries(memberIds.map((id) => [id, true])),
  );
  const [method, setMethod] = useState<SplitMethod>('equal');
  const [values, setValues] = useState<Record<string, string>>({}); // memberId -> typed value
  const [error, setError] = useState('');

  const nameOf = (id: string) => members.find((m) => m.id === id)?.name ?? 'Unknown';

  // Convert the typed text to paise (null if it is not a valid amount)
  const amountPaise = parseRupeesToPaise(amountText);
  const participantIds = memberIds.filter((id) => selected[id]);

  // Typed text -> number the split engine understands (paise, basis points, or whole shares)
  function toValue(text: string | undefined): number {
    const t = (text ?? '').trim();
    if (method === 'shares') return /^\d+$/.test(t) ? Number(t) : NaN;
    return parseRupeesToPaise(t) ?? NaN; // "33.33" -> 3333 basis points = 33.33%
  }
  const splitInputs = participantIds.map((memberId) => ({
    memberId,
    value: method === 'equal' ? undefined : toValue(values[memberId]),
  }));

  // Live preview: ask the split engine what each person would pay
  const preview =
    amountPaise !== null && amountPaise > 0 && participantIds.length > 0
      ? computeSplit(method, amountPaise, splitInputs)
      : null;

  function toggleParticipant(id: string) {
    setSelected({ ...selected, [id]: !selected[id] });
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();

    if (!description.trim()) {
      setError('Description is required');
      return;
    }
    if (amountPaise === null || amountPaise <= 0) {
      setError('Enter a valid amount above zero (up to 2 decimals)');
      return;
    }
    if (participantIds.length === 0) {
      setError('Select at least one person to share this expense');
      return;
    }

    if (preview && !preview.ok) {
      setError(preview.error);
      return;
    }

    setBusy(true);
    try {
      await api(
        'POST',
        `/api/groups/${groupId}/expenses`,
        { description, amount: amountPaise, paidBy, splitMethod: method, participants: splitInputs, category, date, notes: notes || undefined },
        key.current,
      );
      onDone(true);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not save the expense');
    } finally {
      setBusy(false);
    }
  }

  const inputClass =
    'w-full input !w-auto focus:outline-none focus:ring-2 focus:ring-brand-500';

  return (
    <form onSubmit={handleSubmit} className="card p-6 space-y-4">
      <h2 className="text-lg font-semibold">Add expense</h2>

      <div>
        <label htmlFor="description" className="block text-sm font-medium mb-1">
          Description
        </label>
        <input
          id="description"
          type="text"
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          placeholder="e.g. Dinner at Urban Cafe"
          className={inputClass}
        />
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <label htmlFor="amount" className="block text-sm font-medium mb-1">
            Amount (₹)
          </label>
          <input
            id="amount"
            type="text"
            inputMode="decimal"
            value={amountText}
            onChange={(e) => setAmountText(e.target.value)}
            placeholder="1200"
            className={inputClass}
          />
        </div>
        <div>
          <label htmlFor="paidBy" className="block text-sm font-medium mb-1">
            Paid by
          </label>
          <select id="paidBy" value={paidBy} onChange={(e) => setPaidBy(e.target.value)} className={inputClass}>
            {memberIds.map((id) => (
              <option key={id} value={id}>
                {nameOf(id)}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label htmlFor="date" className="block text-sm font-medium mb-1">
            Date
          </label>
          <input id="date" type="date" value={date} onChange={(e) => setDate(e.target.value)} className={inputClass} />
        </div>
        <div>
          <label htmlFor="category" className="block text-sm font-medium mb-1">
            Category
          </label>
          <select
            id="category"
            value={category}
            onChange={(e) => setCategory(e.target.value as ExpenseCategory)}
            className={inputClass}
          >
            {expenseCategoryList.map((c) => (
              <option key={c} value={c}>
                {expenseCategoryLabels[c]}
              </option>
            ))}
          </select>
        </div>
      </div>

      <div>
        <p className="block text-sm font-medium mb-2">Split between</p>
        <div className="flex flex-wrap gap-2">
          {memberIds.map((id) => (
            <label
              key={id}
              className={`flex items-center gap-2 rounded-lg border px-3 py-1.5 text-sm cursor-pointer ${
                selected[id] ? 'border-brand-500 bg-brand-50' : 'border-slate-300'
              }`}
            >
              <input type="checkbox" checked={selected[id] ?? false} onChange={() => toggleParticipant(id)} />
              {nameOf(id)}
            </label>
          ))}
        </div>
      </div>

      <div className="flex flex-wrap gap-2">
        {(Object.keys(methodLabels) as SplitMethod[]).map((m) => (
          <button
            type="button"
            key={m}
            onClick={() => setMethod(m)}
            className={`rounded-lg border px-3 py-1.5 text-sm ${
              method === m ? 'border-brand-600 bg-brand-600 text-white' : 'border-slate-300'
            }`}
          >
            {methodLabels[m]}
          </button>
        ))}
      </div>

      {method !== 'equal' &&
        participantIds.map((id) => (
          <div key={id} className="flex items-center gap-3 text-sm">
            <span className="w-28">{nameOf(id)}</span>
            <input
              type="text"
              inputMode="decimal"
              value={values[id] ?? ''}
              onChange={(e) => setValues({ ...values, [id]: e.target.value })}
              placeholder={method === 'exact' ? '₹ amount' : method === 'percentage' ? '% of total' : 'shares'}
              className={inputClass}
            />
          </div>
        ))}

      {preview && !preview.ok && <p className="text-sm text-slate-500">{preview.error}</p>}

      {preview && preview.ok && (
        <ul className="rounded-lg bg-slate-50 border border-slate-200 divide-y divide-slate-200 text-sm">
          {participantIds.map((id) => (
            <li key={id} className="flex justify-between px-3 py-2">
              <span>{nameOf(id)}</span>
              <span className="font-medium">{formatINR(preview.amounts[id] ?? 0)}</span>
            </li>
          ))}
        </ul>
      )}

      <div>
        <label htmlFor="notes" className="block text-sm font-medium mb-1">
          Notes (optional)
        </label>
        <input id="notes" type="text" value={notes} onChange={(e) => setNotes(e.target.value)} className={inputClass} />
      </div>

      {error && <p className="text-sm text-owe">{error}</p>}

      <div className="flex gap-2">
        <button type="submit" disabled={busy} className="btn-primary">
          {busy ? 'Saving…' : 'Save expense'}
        </button>
        <button type="button" onClick={() => onDone(false)} className="btn-secondary">
          Cancel
        </button>
      </div>
    </form>
  );
}
