import { useEffect, useState } from 'react';
import { Link, NavLink, Outlet, useLocation } from 'react-router-dom';
import { BarChart3, BellRing, BookOpen, CalendarRange, LayoutDashboard, LogOut, Menu, Receipt, UserPlus, Users, X } from 'lucide-react';
import Walkthrough from '../features/tour/Walkthrough';
import NotificationBell from '../features/notifications/NotificationBell';
import { signOut } from '../services/auth';
import { useStore } from '../store/useStore';

const main = [
  { to: '/', label: 'Dashboard', icon: LayoutDashboard },
  { to: '/groups', label: 'Groups', icon: Users },
  { to: '/friends', label: 'Friends', icon: UserPlus },
  { to: '/timeline', label: 'Timeline', icon: Receipt },
];
const reports = [
  { to: '/insights', label: 'Insights', icon: BarChart3 },
  { to: '/recap', label: 'Monthly recap', icon: CalendarRange },
];
const more = [
  { to: '/notifications', label: 'Notifications', icon: BellRing },
  { to: '/guide', label: 'Guide', icon: BookOpen },
];
const bottom = [main[0]!, main[1]!, reports[0]!, reports[1]!];

const Logo = () => (
  <Link to="/" className="flex items-center gap-2.5 text-xl font-bold text-white">
    <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-brand-600">
      <svg viewBox="0 0 32 32" className="h-5 w-5" fill="none" stroke="white" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><path d="M9 21l7-10 7 10" /></svg>
    </span>
    SplitSync
  </Link>
);

function NavItems({ items, onClick }: { items: typeof main; onClick?: () => void }) {
  const unread = useStore((s) => s.unread);
  return (
    <>
      {items.map(({ to, label, icon: Icon }) => (
        <NavLink
          key={to}
          to={to}
          end={to === '/'}
          onClick={onClick}
          className={({ isActive }) =>
            `flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors ${isActive ? 'bg-brand-600 text-white shadow-sm' : 'text-slate-300 hover:bg-white/10 hover:text-white'}`
          }
        >
          <Icon size={18} />
          <span className="flex-1">{label}</span>
          {to === '/notifications' && unread > 0 && <span className="rounded-full bg-owe px-1.5 text-[11px] font-semibold leading-5 text-white">{unread > 9 ? '9+' : unread}</span>}
        </NavLink>
      ))}
    </>
  );
}

export default function AppLayout() {
  const user = useStore((s) => s.user);
  const [drawer, setDrawer] = useState(false);
  const { pathname } = useLocation();
  useEffect(() => { setDrawer(false); window.scrollTo(0, 0); }, [pathname]);
  const initials = (user?.name ?? '?').split(' ').map((p) => p[0]).slice(0, 2).join('').toUpperCase();

  return (
    <div className="min-h-screen md:flex">
      {/* Sidebar: tablet and desktop */}
      <aside className="no-print hidden md:flex md:w-64 md:shrink-0 md:flex-col bg-navy-900 p-4 sticky top-0 h-screen overflow-y-auto">
        <div className="mb-8 px-2 pt-1"><Logo /></div>
        <nav className="space-y-1" aria-label="Main">
          <NavItems items={main} />
          <p className="px-3 pt-5 pb-1 text-[11px] font-semibold uppercase tracking-wider text-slate-500">Reports</p>
          <NavItems items={reports} />
          <p className="px-3 pt-5 pb-1 text-[11px] font-semibold uppercase tracking-wider text-slate-500">Help</p>
          <NavItems items={more} />
        </nav>
        <div className="mt-auto flex items-center gap-3 rounded-xl bg-white/5 p-3">
          <span className="flex h-9 w-9 items-center justify-center rounded-full bg-brand-600 text-sm font-semibold text-white">{initials}</span>
          <p className="min-w-0 flex-1 truncate text-sm text-slate-200">{user?.name}</p>
          <button onClick={() => void signOut()} aria-label="Sign out" title="Sign out" className="rounded-lg p-1.5 text-slate-400 hover:bg-white/10 hover:text-white"><LogOut size={17} /></button>
        </div>
      </aside>

      <div className="flex min-w-0 flex-1 flex-col">
        {/* Top bar */}
        <header className="no-print sticky top-0 z-20 flex items-center justify-between gap-3 border-b border-slate-200 bg-white/90 px-4 py-2.5 backdrop-blur md:justify-end md:px-8">
          <div className="md:hidden rounded-lg bg-navy-900 px-3 py-1.5"><Logo /></div>
          <div className="flex items-center gap-1">
            <NotificationBell />
            <button onClick={() => setDrawer(true)} aria-label="Open menu" className="rounded-lg p-2 text-slate-600 hover:bg-slate-100 md:hidden"><Menu size={20} /></button>
          </div>
        </header>

        <main className="flex-1 p-4 pb-24 md:p-8 md:pb-8"><Outlet /></main>
      </div>

      {/* Phone: full menu drawer and bottom bar */}
      {drawer && (
        <div className="no-print fixed inset-0 z-40 md:hidden" role="dialog" aria-modal="true" aria-label="Menu">
          <div className="absolute inset-0 bg-slate-900/50" onClick={() => setDrawer(false)} />
          <div className="absolute right-0 top-0 flex h-full w-72 flex-col bg-navy-900 p-4 animate-slide-in">
            <div className="mb-6 flex items-center justify-between"><Logo /><button onClick={() => setDrawer(false)} aria-label="Close menu" className="text-slate-300"><X size={22} /></button></div>
            <nav className="space-y-1" aria-label="Menu">
              <NavItems items={[...main, ...reports, ...more]} onClick={() => setDrawer(false)} />
            </nav>
            <button onClick={() => void signOut()} className="mt-auto flex items-center gap-3 rounded-lg px-3 py-2 text-sm text-slate-300 hover:bg-white/10"><LogOut size={18} /> Sign out ({user?.name.split(' ')[0]})</button>
          </div>
        </div>
      )}
      <nav className="no-print fixed inset-x-0 bottom-0 z-20 flex justify-around border-t border-white/10 bg-navy-900 py-2 md:hidden" aria-label="Quick links">
        {bottom.map(({ to, label, icon: Icon }) => (
          <NavLink key={to} to={to} end={to === '/'} className={({ isActive }) => `flex flex-col items-center gap-1 px-2 text-xs ${isActive ? 'text-brand-500' : 'text-slate-400'}`}>
            <Icon size={20} />
            {label === 'Monthly recap' ? 'Recap' : label}
          </NavLink>
        ))}
      </nav>

      <Walkthrough />
    </div>
  );
}
