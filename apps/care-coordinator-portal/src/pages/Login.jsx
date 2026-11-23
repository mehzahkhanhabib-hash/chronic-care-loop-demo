import React, { useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { api } from '../api.js';
import { useApi, useUser } from '../hooks.js';
import { initials } from '../util.js';
import { Loading, ErrorBox } from '../components/Bits.jsx';

export default function Login() {
  const { setUser } = useUser(); const nav = useNavigate(); const loc = useLocation();
  const users = useApi('/users');
  const [u, setU] = useState('omar'); const [pin, setPin] = useState('1234'); const [err, setErr] = useState(null); const [busy, setBusy] = useState(false);
  const go = async (e) => { e && e.preventDefault(); setBusy(true); setErr(null);
    try { const r = await api.post('/auth/login', { username: u, pin }); setUser(r.user); nav((loc.state && loc.state.from) || '/', { replace: true }); }
    catch (x) { setErr(x.message); } finally { setBusy(false); } };
  return <div className="login"><form className="card" onSubmit={go}>
    <div className="brand" style={{ padding: 0, marginBottom: 14 }}><span className="logo">H</span><div className="brand-t"><b style={{ color: 'var(--ink)' }}>HICC Workstation</b><small>Care Coordinator Portal · local demo sign-in</small></div></div>
    <p className="muted" style={{ fontSize: 12 }}>Pick a care-team member. Demo PIN for everyone is <b className="mono">1234</b>. The user id is sent as <span className="mono">x-user</span> on every write so the audit trail shows who did what.</p>
    {users.loading ? <Loading what="Loading care team" /> : users.error ? <ErrorBox error={users.error} retry={users.reload} /> : (
      <div className="users">{users.data.map(x => <button type="button" key={x.user_id} className={'u' + (u === x.username ? ' on' : '')} onClick={() => setU(x.username)}><span className="av">{initials(x.name)}</span><span><b>{x.name}</b><small>{x.role}{x.daily_capacity ? ` · ${x.daily_capacity} calls/day` : ''}</small></span></button>)}</div>)}
    <label className="fld">PIN<input id="pin" type="password" value={pin} onChange={e => setPin(e.target.value)} autoComplete="off" /></label>
    {err ? <p className="note-warn" style={{ marginTop: 8 }}>{err}</p> : null}
    <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', marginTop: 14 }}><button className="btn pri" type="submit" disabled={busy || !u}>Sign in</button></div>
  </form></div>;
}
