import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Routes, Route, Navigate, useLocation, useNavigate } from 'react-router-dom';
import { api, getUser, setUser as persistUser } from './api.js';
import { UserCtx, ToastCtx, AppCtx, useApi } from './hooks.js';
import Icon, { Logo } from './icons.jsx';
import Login from './pages/Login.jsx';
import Queue from './pages/Queue.jsx';
import MemberPage from './pages/MemberPage.jsx';
import Tasks from './pages/Tasks.jsx';
import CarePlans from './pages/CarePlans.jsx';
import Analytics from './pages/Analytics.jsx';
import { Loading } from './components/Bits.jsx';
import { initials } from './util.js';

const embedded = typeof window !== 'undefined' && window.parent !== window;
const pad2 = n => String(n || 0).padStart(2, '0');

/** Shell from the design: brand header with shift stats, 70 px rail, then the routed workspace. */
export default function App() {
  const [user, setUserState] = useState(getUser());
  const [toast, setToast] = useState({ msg: '', on: false });
  const [dark, setDark] = useState(() => { try { return localStorage.getItem('ccl.theme') === 'dark'; } catch (e) { return false; } });
  const [tick, setTick] = useState(0);
  const [autoTried, setAutoTried] = useState(!embedded);
  const loc = useLocation(); const nav = useNavigate(); const timer = useRef(null);
  const setUser = u => { persistUser(u); setUserState(u); };
  useEffect(() => { document.documentElement.dataset.theme = dark ? 'dark' : 'light'; try { localStorage.setItem('ccl.theme', dark ? 'dark' : 'light'); } catch (e) { /* ignore */ } }, [dark]);
  useEffect(() => { if (embedded) document.documentElement.classList.add('emb'); }, []);
  const say = useMemo(() => msg => { setToast({ msg, on: true }); clearTimeout(timer.current); timer.current = setTimeout(() => setToast(t => ({ ...t, on: false })), 2800); }, []);
  const health = useApi('/health');
  const shift = useApi(user ? `/portal/analytics?nurse_id=${user.user_id}` : null, [tick]);
  const today = health.data ? health.data.run_date : '2026-11-20';
  // Embedded in the Care studio (screen 3): sign in as the nurse the member is assigned to, so the frame opens straight on the member.
  useEffect(() => { if (!embedded || user) { setAutoTried(true); return; } (async () => {
    try { let uname = new URLSearchParams(loc.search).get('as') || 'omar'; const mm = loc.pathname.match(/^\/member\/([^/]+)/);
      if (mm && !new URLSearchParams(loc.search).get('as')) { const d = await api.get(`/members/${mm[1]}`); const us = await api.get('/users'); const u = us.find(x => d.assignment && x.user_id === d.assignment.nurse_id); if (u) uname = u.username; }
      const r = await api.post('/auth/login', { username: uname, pin: '1234' }); setUser(r.user); } catch (e) { /* fall back to the sign-in screen */ } finally { setAutoTried(true); } })(); }, []); // eslint-disable-line
  // Embedded in the Care studio: the Studio's nurse picker passes ?as=<username>; switch to that nurse when it changes.
  const asUser = new URLSearchParams(loc.search).get('as');
  useEffect(() => { if (!embedded || !asUser || (user && user.username === asUser)) return;
    api.post('/auth/login', { username: asUser, pin: '1234' }).then(r => setUser(r.user)).catch(() => {}); }, [asUser]); // eslint-disable-line
  const ctx = useMemo(() => ({ today, health: health.data, bump: () => setTick(t => t + 1), embedded }), [today, health.data]);
  if (!user && !autoTried) return <div className="app"><div className="pg"><Loading what="Opening the workstation" /></div></div>;
  if (!user && loc.pathname !== '/login') return <UserCtx.Provider value={{ user, setUser }}><Navigate to="/login" replace state={{ from: loc.pathname }} /></UserCtx.Provider>;
  const A = shift.data || {}, wlToday = ((A.worklist || []).find(w => w.list_status === 'today') || {}).n || 0;
  const mm = loc.pathname.match(/^\/member\/([^/]+)(?:\/([^/]+))?/);
  const view = loc.pathname.startsWith('/tasks') ? 'tasks' : loc.pathname.startsWith('/care-plans') ? 'care' : loc.pathname.startsWith('/analytics') ? 'analytics' : (mm && mm[2] === '360') || (loc.pathname === '/' && /view=360/.test(loc.search)) ? 'm360' : 'queue';
  const go = v => { if (v === 'signout') { setUser(null); nav('/login'); return; }
    if (v === 'queue') nav(mm ? `/member/${mm[1]}` : '/'); else if (v === 'm360') nav(mm ? `/member/${mm[1]}/360` : '/?view=360'); else nav({ tasks: '/tasks', care: '/care-plans', analytics: '/analytics' }[v]); };
  const navBtn = (id, label, icon, badge) => <button className="nav" onClick={() => go(id)} aria-current={view === id ? 'page' : undefined}><Icon name={icon} /><span>{label}</span>{badge ? <span className="badge">{badge}</span> : null}</button>;
  return (
    <UserCtx.Provider value={{ user, setUser }}><ToastCtx.Provider value={say}><AppCtx.Provider value={ctx}>
      {loc.pathname === '/login' ? <Login /> : (
        <div className="app" id="app">
          <header className="top">
            <div className="brand"><Logo /><div><div className="t1">Control Command Center</div><div className="t2">Nurse Workstation</div></div></div>
            <div className="sp" />
            <div className="stats" aria-label="Today" title={`Shift of ${user.name} · run ${health.data && health.data.latest_run ? health.data.latest_run.run_id : ''} · ${today} · rules ${health.data ? health.data.rule_version : ''}`}><span><b>{pad2(A.calls_made)}</b> Calls Today</span><span><b>{pad2(A.reached)}</b> Reached</span><span><b>{pad2(A.consents)}</b> Consented</span></div>
            <button className="iconbtn" onClick={() => setDark(!dark)} aria-label={dark ? 'Light mode' : 'Dark mode'}><Icon name={dark ? 'sun' : 'moon'} /></button>
            <button className="iconbtn" onClick={() => say(wlToday ? `${wlToday} member${wlToday > 1 ? 's' : ''} on your list today · ${A.tasks_open || 0} open tasks` : 'Nothing waiting on your list')} aria-label="Notifications"><Icon name="bell" />{wlToday ? <i className="dot" /> : null}</button>
            <div className="me"><span className="av" aria-hidden="true">{initials(user.name)}</span><div><b>{user.name}</b><span>{user.role}</span></div></div>
          </header>
          <div className="body">
            <nav className="rail" aria-label="Workstation">
              <div className="grp">
                {navBtn('queue', <>Nudge<br />Queue</>, 'queue', wlToday)}
                {navBtn('m360', <>Member<br />360</>, 'm360')}
                {navBtn('tasks', 'Tasks', 'tasks')}
                {navBtn('care', <>Care<br />Plans</>, 'care')}
                {navBtn('analytics', 'Analytics', 'analytics')}
              </div>
              <div className="grp">{navBtn('signout', 'Sign Out', 'signout')}</div>
            </nav>
            <Routes>
              <Route path="/" element={<Queue />} />
              <Route path="/member/:id/:tab?" element={<MemberPage />} />
              <Route path="/tasks" element={<main className="main" id="main"><Tasks /></main>} />
              <Route path="/care-plans/:id?" element={<main className="main" id="main"><CarePlans /></main>} />
              <Route path="/analytics" element={<main className="main" id="main"><Analytics /></main>} />
              <Route path="*" element={<Navigate to="/" replace />} />
            </Routes>
          </div>
        </div>)}
      <div className={'toast' + (toast.on ? ' on' : '')} id="toast" role="status" aria-live="polite"><i /><span>{toast.msg}</span></div>
    </AppCtx.Provider></ToastCtx.Provider></UserCtx.Provider>
  );
}
