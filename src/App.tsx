import { useEffect, useState } from 'react';
import { Navigate, Route, Routes, useLocation } from 'react-router-dom';
import AppLayout from './layouts/AppLayout';
import Dashboard from './pages/Dashboard';
import GroupDetails from './pages/GroupDetails';
import Friends from './pages/Friends';
import Guide from './pages/Guide';
import Insights from './pages/Insights';
import Notifications from './pages/Notifications';
import Recap from './pages/Recap';
import SharedReport from './pages/SharedReport';
import Groups from './pages/Groups';
import JoinGroup from './pages/JoinGroup';
import Login from './pages/Login';
import Timeline from './pages/Timeline';
import { authApi } from './services/auth';
import { useStore } from './store/useStore';

export default function App() {
  const [status, setStatus] = useState<'loading' | 'out' | 'setup' | 'in'>('loading');
  const signIn = useStore((s) => s.signIn);
  const isPublicReport = useLocation().pathname.startsWith('/r/'); // shared report links need no account

  // Ask the server who is signed in (the session lives in a secure cookie)
  useEffect(() => {
    if (isPublicReport) return;
    authApi
      .me()
      .then(({ user }) => {
        signIn(user);
        setStatus(user.username ? 'in' : 'setup');
      })
      .catch(() => setStatus('out'));
  }, [signIn, isPublicReport]);

  if (isPublicReport) return <Routes><Route path="/r/:token" element={<SharedReport />} /></Routes>;
  if (status === 'loading') return <p className="p-8 text-slate-500" aria-busy="true">Loading…</p>;
  if (status === 'out') {
    return (
      <Login
        onSignedIn={(user) => {
          signIn(user);
          setStatus('in');
        }}
      />
    );
  }
  if (status === 'setup') {
    return (
      <Login
        setupCredentials
        onSignedIn={(user) => {
          signIn(user);
          setStatus('in');
        }}
      />
    );
  }

  return (
    <Routes>
      <Route element={<AppLayout />}>
        <Route path="/" element={<Dashboard />} />
        <Route path="/groups" element={<Groups />} />
        <Route path="/groups/:groupId" element={<GroupDetails />} />
        <Route path="/friends" element={<Friends />} />
        <Route path="/timeline" element={<Timeline />} />
        <Route path="/insights" element={<Insights />} />
        <Route path="/recap" element={<Recap />} />
        <Route path="/notifications" element={<Notifications />} />
        <Route path="/guide" element={<Guide />} />
        <Route path="/join/:token" element={<JoinGroup />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Route>
    </Routes>
  );
}
