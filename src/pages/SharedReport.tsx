import { Link, useParams } from 'react-router-dom';
import { Printer } from 'lucide-react';
import { useApi } from '../hooks/useApi';
import { ErrorBox, Loading } from '../components/Status';
import { GroupReportView, RecapView } from '../features/reports/ReportViews';
import type { PublicReport } from '../types';

/** Public page behind a share link. It works without an account and shows a frozen snapshot only. */
export default function SharedReport() {
  const { token = '' } = useParams();
  const { data, error, loading } = useApi<PublicReport>(`/api/public/reports/${token}`);

  return (
    <div className="min-h-screen bg-slate-50">
      <header className="bg-navy-900 text-white no-print">
        <div className="mx-auto flex max-w-4xl items-center justify-between px-4 py-3">
          <p className="text-lg font-bold">SplitSync</p>
          <div className="flex items-center gap-2 text-sm">
            <button onClick={() => window.print()} className="inline-flex items-center gap-2 rounded-lg px-3 py-1.5 text-slate-200 hover:bg-white/10"><Printer size={16} /> Print / PDF</button>
            <Link to="/" className="rounded-lg bg-brand-600 px-3 py-1.5 font-medium hover:bg-brand-700">Open SplitSync</Link>
          </div>
        </div>
      </header>
      <main className="mx-auto max-w-4xl space-y-6 p-4 md:p-8">
        {loading && <Loading />}
        {error && (
          <div className="space-y-3">
            <ErrorBox message={error} />
            <p className="text-sm text-slate-500">Ask the person who sent it to create a new link.</p>
          </div>
        )}
        {data && (
          <>
            <p className="text-sm text-slate-500">
              Shared by <b className="text-slate-700">{data.sharedBy}</b> on {new Date(data.createdAt).toLocaleDateString()} · a snapshot, so it does not change · link expires {new Date(data.expiresAt).toLocaleDateString()}
            </p>
            {data.kind === 'monthly' ? <RecapView recap={data.payload} /> : <GroupReportView report={data.payload} />}
          </>
        )}
      </main>
    </div>
  );
}
