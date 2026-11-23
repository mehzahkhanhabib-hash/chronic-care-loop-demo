import React, { useEffect, useState } from 'react';
import { Routes, Route, NavLink, Navigate, useLocation } from 'react-router-dom';
import api from './api';
import { ToastProvider } from './components/Toast';
import Builder from './screens/Builder';
import Intelligence from './screens/Intelligence';
import Portal from './screens/Portal';

function Logo() { return <svg viewBox="0 0 32 32" width="32" height="32" aria-hidden="true"><circle cx="16" cy="16" r="11" fill="none" stroke="#3F6C9F" strokeWidth="3" strokeDasharray="52 17" strokeLinecap="round" /><circle cx="27" cy="16" r="3.2" fill="#3F6C9F" /></svg>; }

export default function App() {
  const [health, setHealth] = useState(null);
  const [counts, setCounts] = useState({ cohorts: null, members: null, today: null });
  const loc = useLocation();
  const refresh = () => {
    api.get('/health').then(setHealth).catch(() => setHealth({ ok: false }));
    Promise.all([api.get('/cohorts'), api.get('/intelligence/kpis'), api.get('/portal/worklist?status=today')])
      .then(([c, k, w]) => setCounts({ cohorts: c.cohorts.length, members: k.care_plans, today: w.count, kpis: k })).catch(() => {});
  };
  useEffect(() => { refresh(); }, [loc.pathname]); // eslint-disable-line react-hooks/exhaustive-deps
  const role = loc.pathname.startsWith('/portal') ? { name: 'Nurse view', team: 'HICC care team', ini: 'CP' } : loc.pathname.startsWith('/intelligence') ? { name: 'Dr. Rana Khalil', team: 'Clinical lead', ini: 'RK' } : { name: 'Layla Mansoor', team: 'Population health', ini: 'LM' };
  const portalUrl = window.location.port === '3000' ? 'http://localhost:3001/' : '/portal/';
  return (
    <ToastProvider>
      <div className="app">
        <nav className="topnav" aria-label="Chronic Care Loop artefacts">
          <b>CHRONIC CARE LOOP</b>
          <span className="lnk" style={{ color: '#fff' }}>Chronic Care Studio</span>
          <a href={portalUrl} target="_blank" rel="noreferrer">Care Coordinator Portal ↗</a>
          <a href={(window.location.port === '3000' ? 'http://localhost:4000' : '') + '/api/health'} target="_blank" rel="noreferrer">API</a>
          <span className="right">{health ? (health.ok ? `run ${health.latest_run?.run_id ?? '—'} · as-of ${health.as_of} · today ${health.run_date} · rules ${health.rule_version}` : 'backend offline · start it with npm run dev') : 'connecting…'}</span>
        </nav>
        <header className="hdr">
          <div className="hdr-in">
            <div className="brand"><Logo /><div><div className="t">Chronic Care Loop</div><div className="s">Daman · HICC care team</div></div></div>
            <nav className="wsnav" aria-label="Workspaces">
              <NavLink to="/builder" className={({ isActive }) => 'ws' + (isActive ? ' on' : '')}><span className="n">1</span>Cohorts<span className="c">{counts.cohorts ?? ''}</span></NavLink>
              <span className="ws-arrow">→</span>
              <NavLink to="/intelligence" className={({ isActive }) => 'ws' + (isActive ? ' on' : '')}><span className="n">2</span>Care intelligence<span className="c">{counts.members ?? ''}</span></NavLink>
              <span className="ws-arrow">→</span>
              <NavLink to="/portal" className={({ isActive }) => 'ws' + (isActive ? ' on' : '')}><span className="n">3</span>Care portal<span className="c">{counts.today ?? ''}</span></NavLink>
              <span className="wb" title="Nurse outcomes are written back and re-scored on the next run">↩ {counts.kpis ? `${counts.kpis.reported_not_in_claims} reported · ${counts.kpis.consented} consented` : 'write-back loop'}</span>
            </nav>
            <div className="user"><div><div className="nm">{role.name}</div><div className="rl">{role.team}</div></div><span className="avatar sm">{role.ini}</span></div>
          </div>
        </header>
        <main className="page">
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
      </div>
    </ToastProvider>
  );
}
