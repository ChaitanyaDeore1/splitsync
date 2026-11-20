import { useState } from 'react';
import { Link } from 'react-router-dom';
import { Plus } from 'lucide-react';
import { useApi } from '../hooks/useApi';
import { ErrorBox, Loading } from '../components/Status';
import { formatINR } from '../utils/money';
import type { GroupCategory, GroupSummary } from '../types';
import CreateGroupForm from '../features/groups/CreateGroupForm';
import { categoryLabels, categoryList } from '../features/groups/categories';

export default function Groups() {
  const { data, error, loading, reload } = useApi<{ groups: GroupSummary[] }>('/api/groups');
  const groups = data?.groups ?? [];

  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState<'all' | GroupCategory>('all');
  const [showForm, setShowForm] = useState(false);

  if (loading) return <Loading />;

  // Keep only groups that match the search text and the selected category
  const visibleGroups = groups.filter((g) => {
    const matchesSearch = g.name.toLowerCase().includes(search.trim().toLowerCase());
    const matchesCategory = filter === 'all' || g.category === filter;
    return matchesSearch && matchesCategory;
  });

  return (
    <div className="space-y-6 max-w-4xl">
      <div className="flex items-center justify-between">
        <h1 className="page-title">Groups</h1>
        {!showForm && (
          <button
            onClick={() => setShowForm(true)}
            className="btn-primary"
          >
            <Plus size={18} /> New group
          </button>
        )}
      </div>

      {error && <ErrorBox message={error} />}
      {showForm && (
        <CreateGroupForm
          onDone={(created) => {
            setShowForm(false);
            if (created) void reload();
          }}
        />
      )}

      {groups.length > 0 && (
        <div className="flex gap-3">
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search groups"
            className="input flex-1"
          />
          <select
            value={filter}
            onChange={(e) => setFilter(e.target.value as 'all' | GroupCategory)}
            className="input !w-auto"
          >
            <option value="all">All categories</option>
            {categoryList.map((c) => (
              <option key={c} value={c}>
                {categoryLabels[c]}
              </option>
            ))}
          </select>
        </div>
      )}

      {groups.length === 0 && !showForm && (
        <div className="card-empty">
          <p className="font-medium">No groups yet</p>
          <p className="text-slate-500 text-sm mt-1">Create your first group to start splitting expenses.</p>
        </div>
      )}

      {groups.length > 0 && visibleGroups.length === 0 && (
        <p className="text-slate-500">No groups match your search.</p>
      )}

      <div className="grid gap-4 sm:grid-cols-2">
        {visibleGroups.map((g) => {
          const mine = g.myBalance;
          return (
            <Link
              key={g.id}
              to={`/groups/${g.id}`}
              className="card p-5 transition hover:border-brand-500 hover:shadow-md"
            >
              <p className="font-semibold">{g.name}</p>
              <p className="text-sm text-slate-500">
                {categoryLabels[g.category]} · {g.memberCount} members
              </p>
              <p className="mt-3 text-sm font-medium">
                {mine === 0 && <span className="text-slate-500">All settled up</span>}
                {mine > 0 && <span className="text-owed">You are owed {formatINR(mine)}</span>}
                {mine < 0 && <span className="text-owe">You owe {formatINR(-mine)}</span>}
              </p>
            </Link>
          );
        })}
      </div>
    </div>
  );
}
