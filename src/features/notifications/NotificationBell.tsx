import { useCallback, useEffect, useRef, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Bell, X } from 'lucide-react';
import { api } from '../../services/api';
import { useStore } from '../../store/useStore';
import { timeAgo } from '../../utils/dates';
import type { AppNotification } from '../../types';
import { NotificationIcon } from './icons';

const POLL_MS = 30_000;

/** Bell with an unread badge. Checks for news every 30 seconds and pops a small toast when something new arrives. */
export default function NotificationBell({ dark = false }: { dark?: boolean }) {
  const unread = useStore((s) => s.unread);
  const setUnread = useStore((s) => s.setUnread);
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const [items, setItems] = useState<AppNotification[] | null>(null);
  const [toast, setToast] = useState<AppNotification | null>(null);
  const last = useRef<number | null>(null);
  const box = useRef<HTMLDivElement>(null);

  const loadList = useCallback(async () => {
    try {
      const out = await api<{ notifications: AppNotification[]; unread: number }>('GET', '/api/notifications');
      setItems(out.notifications);
      setUnread(out.unread);
      return out;
    } catch {
      return null;
    }
  }, [setUnread]);

  useEffect(() => {
    let stop = false;
    let first = true;
    async function tick() {
      if (document.hidden) return;
      try {
        const { unread: n } = await api<{ unread: number }>('GET', `/api/notifications/unread-count${first ? '?sync=1' : ''}`);
        if (stop) return;
        const grew = last.current !== null && n > last.current;
        last.current = n;
        first = false;
        setUnread(n);
        if (grew) {
          const out = await loadList();
          const newest = out?.notifications.find((x) => !x.read);
          if (newest && !stop) setToast(newest);
        }
      } catch {
        /* offline or signed out: try again at the next tick */
      }
    }
    void tick();
    const id = setInterval(() => void tick(), POLL_MS);
    const onVisible = () => { if (!document.hidden) void tick(); };
    document.addEventListener('visibilitychange', onVisible);
    return () => { stop = true; clearInterval(id); document.removeEventListener('visibilitychange', onVisible); };
  }, [loadList, setUnread]);

  useEffect(() => { // keep the badge honest when the Notifications page changes things
    last.current = unread;
  }, [unread]);

  useEffect(() => {
    if (!toast) return;
    const id = setTimeout(() => setToast(null), 6000);
    return () => clearTimeout(id);
  }, [toast]);

  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => { if (!box.current?.contains(e.target as Node)) setOpen(false); };
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setOpen(false); };
    document.addEventListener('mousedown', onDown);
    document.addEventListener('keydown', onKey);
    return () => { document.removeEventListener('mousedown', onDown); document.removeEventListener('keydown', onKey); };
  }, [open]);

  async function openPanel() {
    setOpen((o) => !o);
    if (!open) await loadList();
  }

  async function go(n: AppNotification) {
    setOpen(false);
    setToast(null);
    if (!n.read) {
      setItems((list) => list?.map((x) => (x.id === n.id ? { ...x, read: true } : x)) ?? null);
      setUnread(Math.max(0, useStore.getState().unread - 1));
      void api('POST', `/api/notifications/${n.id}/read`, {}).catch(() => undefined);
    }
    if (n.link) navigate(n.link);
  }

  async function readAll() {
    setItems((list) => list?.map((x) => ({ ...x, read: true })) ?? null);
    setUnread(0);
    await api('POST', '/api/notifications/read-all', {}).catch(() => undefined);
  }

  return (
    <div className="relative no-print" ref={box}>
      <button
        onClick={() => void openPanel()}
        aria-label={unread ? `Notifications, ${unread} unread` : 'Notifications'}
        aria-expanded={open}
        className={`relative rounded-lg p-2 ${dark ? 'text-slate-200 hover:bg-white/10' : 'text-slate-600 hover:bg-slate-100'}`}
      >
        <Bell size={20} />
        {unread > 0 && (
          <span className="absolute -top-0.5 -right-0.5 min-w-[18px] rounded-full bg-owe px-1 text-center text-[11px] font-semibold leading-[18px] text-white">{unread > 9 ? '9+' : unread}</span>
        )}
      </button>

      {open && (
        <div className="absolute right-0 z-30 mt-2 w-[22rem] max-w-[calc(100vw-1.5rem)] overflow-hidden rounded-2xl border border-slate-200 bg-white text-slate-800 shadow-pop animate-slide-in">
          <div className="flex items-center justify-between border-b border-slate-100 px-4 py-3">
            <p className="font-semibold">Notifications</p>
            {unread > 0 && <button onClick={() => void readAll()} className="text-xs font-medium text-brand-700">Mark all read</button>}
          </div>
          <ul className="max-h-96 overflow-y-auto divide-y divide-slate-50">
            {items === null && <li className="px-4 py-6 text-center text-sm text-slate-500">Loading…</li>}
            {items?.length === 0 && <li className="px-4 py-8 text-center text-sm text-slate-500">You are all caught up.</li>}
            {items?.slice(0, 8).map((n) => (
              <li key={n.id}>
                <button onClick={() => void go(n)} className={`flex w-full items-start gap-3 px-4 py-3 text-left hover:bg-slate-50 ${n.read ? '' : 'bg-brand-50/60'}`}>
                  <NotificationIcon type={n.type} />
                  <span className="min-w-0 flex-1">
                    <span className="block text-sm font-medium">{n.title}</span>
                    <span className="block text-xs text-slate-600 line-clamp-2">{n.body}</span>
                    <span className="block text-xs text-slate-400 mt-0.5">{timeAgo(n.createdAt)}</span>
                  </span>
                  {!n.read && <span className="mt-1.5 h-2 w-2 shrink-0 rounded-full bg-brand-600" aria-label="Unread" />}
                </button>
              </li>
            ))}
          </ul>
          <Link to="/notifications" onClick={() => setOpen(false)} className="block border-t border-slate-100 px-4 py-2.5 text-center text-sm font-medium text-brand-700 hover:bg-slate-50">See all notifications</Link>
        </div>
      )}

      {toast && (
        <div role="status" className="fixed right-4 top-16 z-50 w-80 max-w-[calc(100vw-2rem)] animate-slide-in rounded-2xl border border-slate-200 bg-white p-3 text-slate-800 shadow-pop">
          <div className="flex items-start gap-3">
            <NotificationIcon type={toast.type} />
            <button onClick={() => void go(toast)} className="min-w-0 flex-1 text-left">
              <span className="block text-sm font-semibold">{toast.title}</span>
              <span className="block text-xs text-slate-600 line-clamp-2">{toast.body}</span>
            </button>
            <button onClick={() => setToast(null)} aria-label="Dismiss" className="text-slate-400 hover:text-slate-700"><X size={16} /></button>
          </div>
        </div>
      )}
    </div>
  );
}
