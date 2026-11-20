import { useSearchParams } from 'react-router-dom';
import { ChevronLeft, ChevronRight, Download, Printer } from 'lucide-react';
import { useApi } from '../hooks/useApi';
import { ErrorBox, Loading, PageHeader } from '../components/Status';
import { RecapView } from '../features/reports/ReportViews';
import ShareReportButton from '../features/reports/ShareReportButton';
import { addMonths, currentMonth, monthLabel } from '../utils/dates';
import type { Recap as RecapData } from '../types';

export default function Recap() {
  const [params, setParams] = useSearchParams();
  const now = currentMonth();
  const raw = params.get('month');
  const month = raw && /^\d{4}-(0[1-9]|1[0-2])$/.test(raw) && raw <= now ? raw : now;
  const { data, error, loading } = useApi<RecapData>(`/api/recap?month=${month}`);
  const go = (m: string) => setParams({ month: m });
  const last = addMonths(month, 1);
  const csv = `/api/timeline.csv?from=${month}-01&to=${new Date(Date.UTC(Number(month.slice(0, 4)), Number(month.slice(5)), 0)).toISOString().slice(0, 10)}`;

  return (
    <div className="space-y-6 max-w-4xl">
      <PageHeader
        title="Monthly recap"
        subtitle="Your month in numbers: what you spent, where it went and how it compares."
        actions={
          <>
            <a href={csv} className="btn-secondary"><Download size={16} /> CSV</a>
            <button onClick={() => window.print()} className="btn-secondary"><Printer size={16} /> Print / PDF</button>
            <ShareReportButton kind="monthly" month={month} />
          </>
        }
      />

      <div className="flex items-center justify-between rounded-2xl border border-slate-200 bg-white px-2 py-1.5 shadow-card no-print">
        <button onClick={() => go(addMonths(month, -1))} className="btn-ghost" aria-label="Previous month"><ChevronLeft size={18} /></button>
        <div className="flex items-center gap-3">
          <p className="font-semibold">{monthLabel(month)}</p>
          {month !== now && <button onClick={() => go(now)} className="text-xs font-medium text-brand-700">This month</button>}
        </div>
        <button onClick={() => go(last)} disabled={last > now} className="btn-ghost" aria-label="Next month"><ChevronRight size={18} /></button>
      </div>

      {error && <ErrorBox message={error} />}
      {loading ? <Loading /> : data && <RecapView recap={data} />}
    </div>
  );
}
