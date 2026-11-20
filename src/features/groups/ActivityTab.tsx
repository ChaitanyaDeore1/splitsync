import { useApi } from '../../hooks/useApi';
import { ErrorBox, Loading } from '../../components/Status';
import type { ActivityItem } from '../../types';

export default function ActivityTab({ groupId }: { groupId: string }) {
  const { data, error, loading } = useApi<{ activity: ActivityItem[] }>(`/api/groups/${groupId}/activity`);
  if (loading) return <Loading />;
  if (error) return <ErrorBox message={error} />;
  if (!data?.activity.length) return <p className="text-slate-500">No activity yet.</p>;

  return (
    <ul className="list-card">
      {data.activity.map((a) => (
        <li key={a.id} className="px-5 py-3">
          <p>{a.message}</p>
          <p className="text-xs text-slate-500">{new Date(a.createdAt).toLocaleString()}</p>
        </li>
      ))}
    </ul>
  );
}
