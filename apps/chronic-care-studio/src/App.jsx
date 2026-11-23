import React, { useEffect, useState } from 'react';
import { Routes, Route, NavLink, Navigate, useLocation } from 'react-router-dom';
import api from './api';
import { ToastProvider } from './components/Toast';
import Logo from './components/Logo';
import Builder from './screens/Builder';
import Intelligence from './screens/Intelligence';
import Portal from './screens/Portal';
import HowItWorks from './components/HowItWorks';

const Arrow = () => <span className="ws-arrow" aria-hidden="true"><svg viewBox="0 0 14 14" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"><path d="M5.25 3.5L8.75 7l-3.5 3.5" /></svg></span>;

export default function App() {
  const [health, setHealth] = useState(null);
  const [counts, setCounts] = useState({ cohorts: null, members: null, today: null, kpis: null });
  const loc = useLocation();
  // How it works: opens when the Studio starts (once per browser session), and from the ? button
  const [guide, setGuide] = useState(() => { try { return sessionStorage.getItem('ccl.studio.guide') !== 'seen'; } catch (e) { return true; } });
  const closeGuide = () => { setGuide(false); try { sessionStorage.setItem('ccl.studio.guide', 'seen'); } catch (e) { /* ignore */ } };
  const refresh = () => {
    api.get('/health').then(setHealth).catch(() => setHealth({ ok: false }));
    api.get('/studio/scope').then(sc => { const q = sc.scope ? 'scope=active' : '';
      return Promise.all([api.get('/cohorts'), api.get('/intelligence/kpis' + (q ? '?' + q : '')), api.get('/portal/worklist?status=today' + (q ? '&' + q : ''))])
        .then(([c, k, w]) => setCounts({ cohorts: c.cohorts.length, members: k.evaluated, today: w.count, kpis: k, scope: sc.scope })); }).catch(() => {});
  };
  useEffect(() => { refresh(); }, [loc.pathname]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => { const f = () => refresh(); window.addEventListener('ccl:scope', f); return () => window.removeEventListener('ccl:scope', f); }, []); // eslint-disable-line react-hooks/exhaustive-deps
  const [nurse, setNurse] = useState(null);   // screen 3: the nurse the embedded portal is signed in as
  useEffect(() => { const f = e => setNurse(e.detail); window.addEventListener('ccl:nurse', f); return () => window.removeEventListener('ccl:nurse', f); }, []);
  const onPortal = loc.pathname.startsWith('/portal');
  const role = onPortal ? (nurse ? { name: nurse.name, team: `${nurse.role} · ${nurse.languages.replace(',', ', ')}`, ini: nurse.name.split(' ').map(w => w[0]).join('').slice(0, 2) } : { name: 'Care team', team: 'Nurse workstation', ini: 'CT' }) : loc.pathname.startsWith('/intelligence') ? { name: 'Dr. Rana K.', team: 'Clinical lead · DoH rules', ini: 'DR' } : { name: 'Layla M.', team: 'Population health', ini: 'LM' };
  const offline = health && !health.ok;
  return (
    <ToastProvider>
      <div className="app">
        <header className="hdr">
          <div className="hdr-in">
            <div className="brand"><Logo /><div className="txt"><div className="t">Control Command Center</div><div className="s">Chronic Care Studio</div></div></div>
            <nav className="wsnav" aria-label="Workspaces">
              <div className="pillbar">
                <NavLink to="/builder" className={({ isActive }) => 'ws' + (isActive ? ' on' : '')}><span className="n">1</span>Cohorts<span className="c">{counts.cohorts === null ? '' : `${counts.cohorts} saved`}</span></NavLink>
                <Arrow />
                <NavLink to="/intelligence" className={({ isActive }) => 'ws' + (isActive ? ' on' : '')}><span className="n">2</span>Care intelligence<span className="c">{counts.members === null ? '' : `${counts.members} scored`}</span></NavLink>
                <Arrow />
                <NavLink to="/portal" className={({ isActive }) => 'ws' + (isActive ? ' on' : '')}><span className="n">3</span>Care portal<span className="c">{counts.today === null ? '' : `${counts.today} to call`}</span></NavLink>
              </div>
            </nav>
            <span className="wb" title={health && health.ok ? `Run ${health.latest_run?.run_id ?? '—'} · as-of ${health.as_of} · today ${health.run_date} · rules ${health.rule_version}` : 'Backend status'}>↩ {offline ? 'backend offline · npm run dev' : counts.kpis ? `${counts.kpis.reported_not_in_claims} reported · ${counts.kpis.consented} consented` : 'write-back loop'}</span>
            <button className="hiw-help" onClick={() => setGuide(true)} aria-label="How it works" title="How it works">?</button>
            <div className="user"><span className="avatar">{role.ini}</span><div className="rn"><div className="nm">{role.name}</div><div className="rl">{role.team}</div></div></div>
          </div>
        </header>
        <main className={'page' + (onPortal ? ' bleed' : '')}>
          <Routes>
            <Route path="/" element={<Navigate to="/builder" replace />} />
            <Route path="/builder/*" element={<Builder onChanged={refresh} />} />
            <Route path="/intelligence" element={<Intelligence onChanged={refresh} />} />
            <Route path="/intelligence/:memberId" element={<Intelligence onChanged={refresh} />} />
            <Route path="/portal" element={<Portal />} />
            <Route path="/portal/:memberId" element={<Portal />} />
            <Route path="*" element={<Navigate to="/builder" replace />} />
          </Routes>
        </main>
        <HowItWorks open={guide} onClose={closeGuide} counts={counts} />
      </div>
    </ToastProvider>
  );
}
