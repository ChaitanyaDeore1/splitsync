import { useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { api } from '../services/api';
import { useApi } from '../hooks/useApi';
import { ErrorBox, Loading } from '../components/Status';
import type { InvitePreview } from '../types';

export default function JoinGroup() {
  const { token = '' } = useParams();
  const navigate = useNavigate();
  const { data, error, loading } = useApi<InvitePreview>(`/api/invites/${token}`);
  const [problem, setProblem] = useState('');
  const [busy, setBusy] = useState(false);

  async function accept() {
    setBusy(true);
    try {
      const { groupId } = await api<{ groupId: string }>('POST', `/api/invites/${token}/accept`, {});
      navigate(`/groups/${groupId}`);
    } catch (e) {
      setProblem(e instanceof Error ? e.message : 'Could not join the group');
      setBusy(false);
    }
  }

  if (loading) return <Loading />;
  if (!data) {
    return (
      <div className="max-w-md space-y-3">
        <ErrorBox message={error || 'This invitation link is invalid or has expired.'} />
        <Link to="/groups" className="text-brand-700 text-sm">Go to your groups</Link>
      </div>
    );
  }

  return (
    <div className="max-w-md card p-6 space-y-4">
      <h1 className="text-xl font-bold">Join "{data.groupName}"?</h1>
      <p className="text-slate-600 text-sm">
        {data.invitedBy} invited you.
        {data.claimName && ` You will take the place of "${data.claimName}", so their existing expenses become yours.`}
      </p>
      {problem && <ErrorBox message={problem} />}
      {data.alreadyMember ? (
        <div className="space-y-2">
          <p className="text-sm text-slate-600">You are already in this group. This invitation is still available for someone who is not a member; share the link with them.</p>
          <Link to={`/groups/${data.groupId}`} className="text-brand-700 font-medium">Open the group</Link>
        </div>
      ) : (
        <div className="flex gap-2">
          <button disabled={busy} onClick={() => void accept()} className="btn-primary">Join group</button>
          <button onClick={() => navigate('/groups')} className="btn-secondary">Decline</button>
        </div>
      )}
    </div>
  );
}
