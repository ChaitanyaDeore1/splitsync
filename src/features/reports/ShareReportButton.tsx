import { useState } from 'react';
import { Check, Copy, Link2, Share2, Trash2, X } from 'lucide-react';
import { api } from '../../services/api';
import { useApi } from '../../hooks/useApi';
import { ErrorBox } from '../../components/Status';
import { timeAgo } from '../../utils/dates';
import type { SharedReportItem } from '../../types';

interface Props {
  kind: 'monthly' | 'group';
  month?: string | null;
  groupId?: string;
  label?: string;
}

/** Button + dialog: freeze the report as a link anyone can open, copy it or send it, and turn old links off. */
export default function ShareReportButton({ kind, month, groupId, label = 'Share' }: Props) {
  const [open, setOpen] = useState(false);
  const [days, setDays] = useState(30);
  const [link, setLink] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [copied, setCopied] = useState(false);
  const shares = useApi<{ shares: SharedReportItem[] }>('/api/reports/shares');

  async function create() {
    setBusy(true);
    setError('');
    try {
      const out = await api<{ path: string }>('POST', '/api/reports/share', { kind, month: month ?? undefined, groupId, days });
      setLink(`${window.location.origin}${out.path}`);
      setCopied(false);
      void shares.reload();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not create the link');
    } finally {
      setBusy(false);
    }
  }

  async function copy() {
    try {
      await navigator.clipboard.writeText(link);
      setCopied(true);
    } catch {
      setError('Could not copy automatically. Select the link and copy it by hand.');
    }
  }

  async function revoke(id: string) {
    try {
      await api('POST', `/api/reports/shares/${id}/revoke`, {});
      await shares.reload();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not turn this link off');
    }
  }

  const canNativeShare = typeof navigator !== 'undefined' && 'share' in navigator;
  const active = (shares.data?.shares ?? []).filter((s) => s.active && s.kind === kind);

  return (
    <>
      <button onClick={() => { setOpen(true); setLink(''); setError(''); }} className="btn-secondary"><Share2 size={16} /> {label}</button>
      {open && (
        <div className="fixed inset-0 z-40 flex items-end sm:items-center justify-center bg-slate-900/50 p-0 sm:p-4 no-print" role="dialog" aria-modal="true" aria-label="Share report" onClick={() => setOpen(false)}>
          <div className="w-full sm:max-w-md max-h-[90vh] overflow-y-auto rounded-t-3xl sm:rounded-2xl bg-white p-5 shadow-pop animate-slide-in" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-start justify-between gap-3">
              <div>
                <h2 className="text-lg font-semibold">Share this report</h2>
                <p className="text-sm text-slate-500 mt-1">Creates a read-only link with a snapshot of the numbers as they are now. Nobody needs an account to open it.</p>
              </div>
              <button onClick={() => setOpen(false)} aria-label="Close" className="text-slate-400 hover:text-slate-700"><X size={20} /></button>
            </div>

            {!link ? (
              <div className="mt-4 space-y-4">
                <div>
                  <label htmlFor="expiry" className="label">Link works for</label>
                  <select id="expiry" value={days} onChange={(e) => setDays(Number(e.target.value))} className="input">
                    <option value={1}>1 day</option>
                    <option value={7}>7 days</option>
                    <option value={30}>30 days</option>
                    <option value={90}>90 days</option>
                  </select>
                </div>
                <p className="rounded-lg bg-amber-50 text-amber-800 text-xs px-3 py-2">
                  {kind === 'monthly' ? 'This shows your personal spending, categories and groups names. Only share it with people you trust.' : 'This shows member names, what each person paid and who owes whom.'}
                </p>
                {error && <ErrorBox message={error} />}
                <button onClick={() => void create()} disabled={busy} className="btn-primary w-full"><Link2 size={16} /> {busy ? 'Creating…' : 'Create link'}</button>
              </div>
            ) : (
              <div className="mt-4 space-y-3">
                <input readOnly value={link} onFocus={(e) => e.target.select()} aria-label="Report link" className="input font-mono text-xs" />
                <div className="flex gap-2">
                  <button onClick={() => void copy()} className="btn-primary flex-1">{copied ? <><Check size={16} /> Copied</> : <><Copy size={16} /> Copy link</>}</button>
                  {canNativeShare && <button onClick={() => void navigator.share({ title: 'SplitSync report', url: link }).catch(() => undefined)} className="btn-secondary"><Share2 size={16} /> Send</button>}
                </div>
                {error && <ErrorBox message={error} />}
                <p className="text-xs text-slate-500">You can turn this link off below at any time.</p>
              </div>
            )}

            {active.length > 0 && (
              <div className="mt-5 border-t border-slate-100 pt-4">
                <h3 className="text-sm font-semibold mb-2">Active links</h3>
                <ul className="space-y-2">
                  {active.map((s) => (
                    <li key={s.id} className="flex items-center justify-between gap-3 text-sm">
                      <span className="min-w-0">
                        <span className="block truncate">{s.title}</span>
                        <span className="text-xs text-slate-500">{s.views} view{s.views === 1 ? '' : 's'} · made {timeAgo(s.createdAt)} · expires {new Date(s.expiresAt).toLocaleDateString()}</span>
                      </span>
                      <button onClick={() => void revoke(s.id)} className="btn-ghost text-owe shrink-0 !px-2" aria-label={`Turn off link ${s.title}`}><Trash2 size={16} /> Turn off</button>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        </div>
      )}
    </>
  );
}
