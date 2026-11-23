import React, { useEffect, useMemo, useState } from 'react';
import { Routes, Route, Navigate, NavLink, useLocation, useNavigate } from 'react-router-dom';
import { api, getUser, setUser as persistUser } from './api.js';
import { UserCtx, ToastCtx, useApi } from './hooks.js';
import Icon from './icons.jsx';
import Login from './pages/Login.jsx';
import Queue from './pages/Queue.jsx';
import MemberPage from './pages/MemberPage.jsx';
import Tasks from './pages/Tasks.jsx';
import CarePlans from './pages/CarePlans.jsx';
import Analytics from './pages/Analytics.jsx';
import { initials } from './util.js';

const PAGES = [
  ['/', 'queue', 'Nudge queue', 'Members flagged by the intelligence engine — consent first, then call, capture the outcome, move on.'],
  ['/tasks', 'actions', 'Actions', 'Care coordinator tasks from each call: backlog, today and upcoming.'],
  ['/care-plans', 'care', 'Care plans', 'Every member with a care plan — CURRENT, NEXT and FUTURE needs, write-backs and cadence.'],
  ['/analytics', 'chart', 'Analytics', 'How the nudge operation is performing, from flag to follow-up.'],
];

export default function App() {
  const [user, setUserState] = useState(getUser());
  const [toast, setToast] = useState(null);
  const [theme, setTheme] = useState(() => { try { return localStorage.getItem('ccl.theme') || ''; } catch (e) { return ''; } });
  const [railMin, setRailMin] = useState(false);
  const loc = useLocation(); const nav = useNavigate();
  const setUser = u => { persistUser(u); setUserState(u); };
  useEffect(() => { if (theme) document.documentElement.setAttribute('data-theme', theme); else document.documentElement.removeAttribute('data-theme'); try { localStorage.setItem('ccl.theme', theme); } catch (e) { /* ignore */ } }, [theme]);
  const say = useMemo(() => (msg) => { setToast(msg); setTimeout(() => setToast(null), 2600); }, []);
  const health = useApi(user ? '/health' : null);
  const shift = useApi(user ? `/portal/analytics?nurse_id=${user.user_id}` : null, [loc.pathname]);
  if (!user && loc.pathname !== '/login') return <UserCtx.Provider value={{ user, setUser }}><Navigate to="/login" replace state={{ from: loc.pathname }} /></UserCtx.Provider>;
  const page = PAGES.find(p => p[0] === loc.pathname) || (loc.pathname.startsWith('/member') ? ['/member', 'user', 'Member', 'One member across Member 360, care intelligence and the call.'] : PAGES[0]);
  const dark = theme === 'dark' || (!theme && window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches);
  const done = shift.data ? shift.data.tasks_done : 0, total = shift.data ? shift.data.tasks_done + shift.data.tasks_open : 0;
  const queueN = shift.data && shift.data.worklist ? (shift.data.worklist.find(w => w.list_status === 'today') || {}).n || 0 : 0;
  return (
    <UserCtx.Provider value={{ user, setUser }}><ToastCtx.Provider value={say}>
      {loc.pathname === '/login' ? <Login /> : (
        <div className={'app' + (railMin ? ' rail-min' : '')} id="app">
          <nav className="rail" aria-label="Main">
            <div className="brand"><span className="logo">H</span><div className="brand-t"><b>HICC Workstation</b><small>Care Coordinator</small></div></div>
            <div className="rail-group">Workstation</div>
            {PAGES.map(p => <NavLink key={p[0]} to={p[0]} end className={({ isActive }) => 'nav' + (isActive ? ' on' : '')} title={p[2]}><Icon name={p[1]} /><span>{p[2]}</span>{p[0] === '/' && queueN ? <span className="badge">{queueN}</span> : null}</NavLink>)}
            <div className="rail-sp" />
            <button className="nav" onClick={() => setTheme(dark ? 'light' : 'dark')} title="Switch theme"><Icon name={dark ? 'sun' : 'moon'} /><span>{dark ? 'Light mode' : 'Dark mode'}</span></button>
            <button className="nav" onClick={() => setRailMin(!railMin)} title={railMin ? 'Expand menu' : 'Collapse menu'}><Icon name={railMin ? 'chevr' : 'chev'} /><span>{railMin ? 'Expand menu' : 'Collapse menu'}</span></button>
            <button className="nav" onClick={() => { setUser(null); nav('/login'); }} title="Sign out"><Icon name="x" /><span>Sign out</span></button>
          </nav>
          <div className="main">
            <header className="top">
              <h1>{page[2]}</h1><span className="sub">{page[3]}</span><span className="sp" />
              <div className="shift">Shift · <b>{done}</b> of {total} tasks done<div className="bar"><i style={{ width: (total ? Math.round(done / total * 100) : 0) + '%' }} /></div></div>
              {health.data ? <span className="pill line mono" title={`Rule version ${health.data.rule_version} · as-of ${health.data.as_of}`}>Run {health.data.latest_run && health.data.latest_run.run_id} · {health.data.run_date}</span> : null}
              <div className="me"><span className="av">{initials(user.name)}</span><div><b>{user.name}</b><small>{user.role}</small></div></div>
            </header>
            <div className="body">
              <section className="page" id="page">
                <Routes>
                  <Route path="/" element={<Queue />} />
                  <Route path="/member/:id" element={<MemberPage />} />
                  <Route path="/member/:id/:tab" element={<MemberPage />} />
                  <Route path="/tasks" element={<Tasks />} />
                  <Route path="/care-plans" element={<CarePlans />} />
                  <Route path="/care-plans/:id" element={<CarePlans />} />
                  <Route path="/analytics" element={<Analytics />} />
                  <Route path="*" element={<Navigate to="/" replace />} />
                </Routes>
              </section>
              <span />
            </div>
          </div>
        </div>)}
      {toast ? <div className="toast" role="status">{toast}</div> : null}
    </ToastCtx.Provider></UserCtx.Provider>
  );
}
