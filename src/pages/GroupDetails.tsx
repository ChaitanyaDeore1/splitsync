import { useState } from 'react';
import { Link, useParams, useSearchParams } from 'react-router-dom';
import { ArrowLeft } from 'lucide-react';
import { useApi } from '../hooks/useApi';
import { ErrorBox, Loading } from '../components/Status';
import { formatINR } from '../utils/money';
import type { GroupDetail } from '../types';
import { categoryLabels } from '../features/groups/categories';
import InsightsTab from '../features/groups/InsightsTab';
import ActivityTab from '../features/groups/ActivityTab';
import MembersTab from '../features/groups/MembersTab';
import ExpensesTab from '../features/expenses/ExpensesTab';
import BalancesTab from '../features/settlements/BalancesTab';

const tabs = ['Expenses', 'Balances', 'Insights', 'Activity', 'Members'] as const;
type Tab = (typeof tabs)[number];

export default function GroupDetails() {
  const { groupId = '' } = useParams();
  const highlightId = useSearchParams()[0].get('expense');
  const { data, error, loading, reload } = useApi<GroupDetail>(`/api/groups/${groupId}`);
  const [tab, setTab] = useState<Tab>('Expenses');

  if (loading) return <Loading />;
  if (!data) {
    return (
      <div className="space-y-3">
        <ErrorBox message={error || 'Group not found'} />
        <Link to="/groups" className="text-brand-700 text-sm">Back to groups</Link>
      </div>
    );
  }

  const { group, members, myMemberId } = data;
  const mine = members.find((m) => m.id === myMemberId)?.balance ?? 0;

  return (
    <div className="space-y-6 max-w-4xl">
      <Link to="/groups" className="flex items-center gap-1 text-sm text-slate-500 hover:text-slate-800">
        <ArrowLeft size={16} /> Groups
      </Link>

      <div>
        <h1 className="page-title">{group.name}</h1>
        <p className="text-slate-500 text-sm">{categoryLabels[group.category]} · {members.length} members</p>
        <p className="mt-2 font-medium">
          {mine === 0 && <span className="text-slate-500">All settled up</span>}
          {mine > 0 && <span className="text-owed">You are owed {formatINR(mine)}</span>}
          {mine < 0 && <span className="text-owe">You owe {formatINR(-mine)}</span>}
        </p>
      </div>

      <div className="flex gap-1 border-b border-slate-200 overflow-x-auto">
        {tabs.map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`px-4 py-2 text-sm font-medium whitespace-nowrap border-b-2 ${
              tab === t ? 'border-brand-600 text-brand-700' : 'border-transparent text-slate-500 hover:text-slate-800'
            }`}
          >
            {t}
          </button>
        ))}
      </div>

      {tab === 'Expenses' && <ExpensesTab highlightId={highlightId} groupId={groupId} members={members} myMemberId={myMemberId} onChanged={() => void reload()} />}
      {tab === 'Balances' && <BalancesTab groupId={groupId} members={members} onChanged={() => void reload()} />}
      {tab === 'Insights' && <InsightsTab groupId={groupId} />}
      {tab === 'Activity' && <ActivityTab groupId={groupId} />}
      {tab === 'Members' && <MembersTab groupId={groupId} members={members} onChanged={() => void reload()} />}
    </div>
  );
}
