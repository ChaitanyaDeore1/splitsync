import { useState } from 'react';
import type { FormEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../../services/api';
import { useApi } from '../../hooks/useApi';
import type { FriendsResponse, Member } from '../../types';
import { ErrorBox } from '../../components/Status';

const input = 'input flex-1';
const primary = 'btn-primary';

export default function MembersTab({ groupId, members, onChanged }: { groupId: string; members: Member[]; onChanged: () => void }) {
  const navigate = useNavigate();
  const friends = useApi<FriendsResponse>('/api/friends');
  const [name, setName] = useState('');
  const [friendId, setFriendId] = useState('');
  const [link, setLink] = useState('');
  const [otherLinks, setOtherLinks] = useState<string[]>([]);
  const [lanShareable, setLanShareable] = useState(false);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  const addable = (friends.data?.friends ?? []).filter((f) => !members.some((m) => m.userId === f.userId));

  async function run(task: () => Promise<void>) {
    setBusy(true);
    setError('');
    try {
      await task();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Something went wrong');
    } finally {
      setBusy(false);
    }
  }

  const addByName = (e: FormEvent) => {
    e.preventDefault();
    void run(async () => { await api('POST', `/api/groups/${groupId}/members`, { name }); setName(''); onChanged(); });
  };
  const addFriend = (e: FormEvent) => {
    e.preventDefault();
    void run(async () => { await api('POST', `/api/groups/${groupId}/members`, { friendId }); setFriendId(''); onChanged(); });
  };
  const makeLink = (memberId?: string) =>
    run(async () => {
      const r = await api<{ path: string; networkUrls?: string[] }>('POST', `/api/groups/${groupId}/invites`, { memberId });
      const localDev = window.location.port === '5173' && ['localhost', '127.0.0.1', '::1'].includes(window.location.hostname);
      const links = localDev ? r.networkUrls ?? [] : [];
      setLink(links[0] ?? new URL(r.path, window.location.origin).href);
      setOtherLinks(links.slice(1));
      setLanShareable(links.length > 0);
    });
  const leave = () => {
    if (!confirm('Leave this group? Your past expenses stay in the group.')) return;
    void run(async () => { await api('POST', `/api/groups/${groupId}/leave`, {}); navigate('/groups'); });
  };

  return (
    <div className="space-y-6">
      <ul className="list-card">
        {members.map((m) => (
          <li key={m.id} className="px-5 py-3 flex items-center gap-3">
            <span className="h-8 w-8 rounded-full bg-brand-100 text-brand-700 flex items-center justify-center font-semibold">{m.name.charAt(0).toUpperCase()}</span>
            <span>{m.name}</span>
            {m.role === 'admin' && <span className="text-xs text-slate-500">admin</span>}
            {!m.userId && (
              <>
                <span className="text-xs text-slate-400">no account yet</span>
                <button onClick={() => void makeLink(m.id)} className="ml-auto text-xs text-brand-700">Invite {m.name.split(' ')[0]}</button>
              </>
            )}
          </li>
        ))}
      </ul>

      {link && (
        <div className="rounded-xl bg-brand-50 border border-brand-100 p-4 text-sm space-y-2">
          <p>Share this link. It expires in 7 days.</p>
          {window.location.port === '5173' && ['localhost', '127.0.0.1', '::1'].includes(window.location.hostname) && (
            <p className="text-slate-600">
              {lanShareable
                ? 'Open it on a phone connected to the same Wi-Fi. The other person should sign in with their own SplitSync account.'
                : 'No network address was found, so this link only works on this computer. Connect both devices to the same Wi-Fi and restart the app.'}
            </p>
          )}
          <div className="flex gap-2">
            <input readOnly value={link} aria-label="Invitation link" onFocus={(e) => e.target.select()} className="input flex-1 !py-1.5" />
            <button onClick={() => void navigator.clipboard?.writeText(link)} className="btn-secondary !py-1.5">Copy</button>
          </div>
          {otherLinks.length > 0 && (
            <details className="text-xs text-slate-600">
              <summary className="cursor-pointer">Other network addresses</summary>
              <ul className="mt-1 space-y-1">
                {otherLinks.map((url) => <li key={url} className="break-all">{url}</li>)}
              </ul>
            </details>
          )}
        </div>
      )}

      <form onSubmit={addByName}>
        <label htmlFor="member-name" className="block text-sm font-medium mb-1">Add someone by name</label>
        <div className="flex gap-2">
          <input id="member-name" value={name} onChange={(e) => setName(e.target.value)} placeholder="Name" className={input} />
          <button disabled={busy} className={primary}>Add</button>
        </div>
      </form>

      {addable.length > 0 && (
        <form onSubmit={addFriend}>
          <label htmlFor="friend" className="block text-sm font-medium mb-1">Add a friend</label>
          <div className="flex gap-2">
            <select id="friend" value={friendId} onChange={(e) => setFriendId(e.target.value)} className={input}>
              <option value="">Choose a friend</option>
              {addable.map((f) => <option key={f.userId} value={f.userId}>{f.name}</option>)}
            </select>
            <button disabled={busy || !friendId} className={primary}>Add</button>
          </div>
        </form>
      )}

      <div className="flex flex-wrap gap-2">
        <button disabled={busy} onClick={() => void makeLink()} className="btn-secondary">Create invitation link</button>
        <button disabled={busy} onClick={leave} className="btn-secondary text-owe">Leave group</button>
      </div>
      {error && <ErrorBox message={error} />}
    </div>
  );
}
