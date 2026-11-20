import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { BellOff, CheckCheck } from 'lucide-react';
import { api } from '../services/api';
import { useApi } from '../hooks/useApi';
import { useStore } from '../store/useStore';
import { EmptyState, ErrorBox, Loading, PageHeader } from '../components/Status';
import { NotificationIcon } from '../features/notifications/icons';
import { timeAgo } from '../utils/dates';
import type { AppNotification } from '../types';

export default function Notifications() {
  const { data, error, loading, reload } = useApi<{ notifications: AppNotification[]; unread: number }>('/api/notifications');
  const setUnread = useStore((s) => s.setUnread);
  const navigate = useNavigate();
  const [filter, setFilter] = useState<'all' | 'unread'>('all');

  if (loading) return <Loading />;
  const all = data?.notifications ?? [];
  const list = filter === 'unread' ? all.filter((n) => !n.read) : all;

  async function open(n: AppNotification) {
    if (!n.read) {
      await api('POST', `/api/notifications/${n.id}/read`, {}).catch(() => undefined);
      setUnread(Math.max(0, (data?.unread ?? 1) - 1));
    }
    if (n.link) navigate(n.link);
    else void reload();
  }

  async function readAll() {
    await api('POST', '/api/notifications/read-all', {}).catch(() => undefined);
    setUnread(0);
    await reload();
  }

  return (
    <div className="space-y-6 max-w-3xl">
      <PageHeader
        title="Notifications"
        subtitle="New expenses, payments, friend requests and your monthly recap."
        actions={<button onClick={() => void readAll()} disabled={!data?.unread} className="btn-secondary"><CheckCheck size={16} /> Mark all read</button>}
      />
      {error && <ErrorBox message={error} />}

      <div className="flex gap-2" role="tablist" aria-label="Filter notifications">
        {(['all', 'unread'] as const).map((f) => (
          <button key={f} role="tab" aria-selected={filter === f} onClick={() => setFilter(f)} className={`rounded-full px-3.5 py-1.5 text-sm font-medium ${filter === f ? 'bg-brand-600 text-white' : 'bg-white border border-slate-200 text-slate-600 hover:bg-slate-50'}`}>
            {f === 'all' ? 'All' : `Unread${data?.unread ? ` (${data.unread})` : ''}`}
          </button>
        ))}
      </div>

      {list.length === 0 ? (
        <EmptyState title={filter === 'unread' ? 'No unread notifications' : 'Nothing here yet'} text="When someone adds an expense, records a payment or sends a friend request, you will see it here.">
          <BellOff className="mx-auto text-slate-300" />
        </EmptyState>
      ) : (
        <ul className="list-card">
          {list.map((n) => (
            <li key={n.id}>
              <button onClick={() => void open(n)} className={`flex w-full items-start gap-4 px-5 py-4 text-left hover:bg-slate-50 ${n.read ? '' : 'bg-brand-50/60'}`}>
                <NotificationIcon type={n.type} />
                <span className="min-w-0 flex-1">
                  <span className="block font-medium">{n.title}</span>
                  <span className="block text-sm text-slate-600">{n.body}</span>
                  <span className="block text-xs text-slate-400 mt-1">{timeAgo(n.createdAt)}</span>
                </span>
                {!n.read && <span className="mt-2 h-2.5 w-2.5 shrink-0 rounded-full bg-brand-600" aria-label="Unread" />}
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
