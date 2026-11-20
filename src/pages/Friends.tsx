import { useState } from 'react';
import type { FormEvent } from 'react';
import { api } from '../services/api';
import { useApi } from '../hooks/useApi';
import { ErrorBox, Loading } from '../components/Status';
import type { FriendsResponse, FriendUser } from '../types';

const button = 'btn !py-1.5';

export default function Friends() {
  const { data, error, loading, reload } = useApi<FriendsResponse>('/api/friends');
  const [identifier, setIdentifier] = useState('');
  const [found, setFound] = useState<{ id: string; name: string } | null | undefined>(undefined);
  const [message, setMessage] = useState('');
  const [problem, setProblem] = useState('');

  async function run(task: () => Promise<void>) {
    setProblem('');
    try {
      await task();
      await reload();
    } catch (e) {
      setProblem(e instanceof Error ? e.message : 'Something went wrong');
    }
  }

  async function search(e: FormEvent) {
    e.preventDefault();
    setMessage('');
    setProblem('');
    try {
      const { user } = await api<{ user: { id: string; name: string } | null }>('GET', `/api/users/search?q=${encodeURIComponent(identifier)}`);
      setFound(user);
    } catch (err) {
      setFound(undefined);
      setProblem(err instanceof Error ? err.message : 'Search failed');
    }
  }

  const row = (f: FriendUser, actions: React.ReactNode) => (
    <li key={f.id} className="px-5 py-3 flex items-center justify-between gap-3">
      <span>
        {f.name} {(f.username || f.email) && <span className="text-sm text-slate-500">{f.username ? `@${f.username}` : f.email}</span>}
      </span>
      <span className="flex gap-2">{actions}</span>
    </li>
  );
  const post = (path: string) => run(async () => void (await api('POST', path, {})));

  if (loading) return <Loading />;
  const d = data ?? { friends: [], incoming: [], outgoing: [] };

  return (
    <div className="space-y-6 max-w-2xl">
      <h1 className="page-title">Friends</h1>
      {(error || problem) && <ErrorBox message={error || problem} />}

      <form onSubmit={search} className="space-y-2">
        <label htmlFor="friend-identifier" className="block text-sm font-medium">Find a friend by username</label>
        <div className="flex gap-2">
          <input id="friend-identifier" value={identifier} onChange={(e) => setIdentifier(e.target.value)} placeholder="friend's username"
            className="input flex-1" />
          <button className={`${button} bg-brand-600 hover:bg-brand-700 text-white`}>Search</button>
        </div>
        {found === null && <p className="text-sm text-slate-500">No one with that username has joined SplitSync yet. You can invite them with a group link.</p>}
        {found && (
          <div className="flex items-center justify-between bg-white rounded-xl border border-slate-200 px-4 py-3">
            <span>{found.name}</span>
            <button type="button" className={`${button} bg-brand-600 text-white`}
              onClick={() => run(async () => { const r = await api<{ status: string }>('POST', '/api/friends/requests', { userId: found.id }); setMessage(r.status === 'accepted' ? 'You are now friends.' : 'Request sent.'); setFound(undefined); })}>
              Send request
            </button>
          </div>
        )}
        {message && <p className="text-sm text-owed">{message}</p>}
      </form>

      {d.incoming.length > 0 && (
        <section>
          <h2 className="font-semibold mb-2">Requests for you</h2>
          <ul className="list-card">
            {d.incoming.map((f) => row(f, <>
              <button onClick={() => void post(`/api/friends/requests/${f.id}/accept`)} className={`${button} bg-brand-600 text-white`}>Accept</button>
              <button onClick={() => void post(`/api/friends/requests/${f.id}/remove`)} className={`${button} border border-slate-300`}>Decline</button>
            </>))}
          </ul>
        </section>
      )}

      {d.outgoing.length > 0 && (
        <section>
          <h2 className="font-semibold mb-2">Requests you sent</h2>
          <ul className="list-card">
            {d.outgoing.map((f) => row(f, <button onClick={() => void post(`/api/friends/requests/${f.id}/remove`)} className={`${button} border border-slate-300`}>Cancel</button>))}
          </ul>
        </section>
      )}

      <section>
        <h2 className="font-semibold mb-2">Your friends</h2>
        {d.friends.length === 0 ? (
          <p className="text-slate-500">No friends yet. Search by username above to send a request.</p>
        ) : (
          <ul className="list-card">
            {d.friends.map((f) => row(f, <button onClick={() => { if (confirm(`Remove ${f.name} from your friends?`)) void post(`/api/friends/requests/${f.id}/remove`); }} className={`${button} border border-slate-300`}>Remove</button>))}
          </ul>
        )}
      </section>
    </div>
  );
}
