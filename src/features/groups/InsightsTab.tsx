import { useState } from 'react';
import { Printer } from 'lucide-react';
import { useApi } from '../../hooks/useApi';
import { ErrorBox, Loading } from '../../components/Status';
import { GroupReportView } from '../reports/ReportViews';
import ShareReportButton from '../reports/ShareReportButton';
import { currentMonth } from '../../utils/dates';
import type { GroupReport } from '../../types';

export default function InsightsTab({ groupId }: { groupId: string }) {
  const [month, setMonth] = useState('');
  const { data, error, loading } = useApi<GroupReport>(`/api/groups/${groupId}/report${month ? `?month=${month}` : ''}`);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3 no-print">
        <div className="flex items-center gap-2">
          <label htmlFor="rep-month" className="text-sm text-slate-600">Period</label>
          <input id="rep-month" type="month" max={currentMonth()} value={month} onChange={(e) => setMonth(e.target.value)} className="input !w-auto" />
          {month && <button onClick={() => setMonth('')} className="text-sm font-medium text-brand-700">All time</button>}
        </div>
        <div className="flex gap-2">
          <button onClick={() => window.print()} className="btn-secondary"><Printer size={16} /> Print / PDF</button>
          <ShareReportButton kind="group" groupId={groupId} month={month || null} label="Share report" />
        </div>
      </div>
      {error && <ErrorBox message={error} />}
      {loading ? <Loading /> : data && <GroupReportView report={data} />}
    </div>
  );
}
