import React, { useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { api } from '../api.js';
import { useApi, useUser, useToast } from '../hooks.js';
import Icon, { Logo } from '../icons.jsx';
import powered from '../assets/powered-by.png';

/** Sign-in screen from the design. The SSO button signs in with the local demo account picked below (POST /api/auth/login). */
export default function Login() {
  const { setUser } = useUser(); const say = useToast(); const nav = useNavigate(); const loc = useLocation();
  const users = useApi('/users');
  const [u, setU] = useState('omar'); const [pin, setPin] = useState('1234'); const [err, setErr] = useState(null); const [busy, setBusy] = useState(false);
  const go = async e => { e && e.preventDefault(); setBusy(true); setErr(null);
    try { const r = await api.post('/auth/login', { username: u.trim(), pin }); setUser(r.user); say(`Signed in as ${r.user.name} · ${r.user.role}`); nav((loc.state && loc.state.from) || '/', { replace: true }); }
    catch (x) { setErr(x.message); } finally { setBusy(false); } };
  return <div className="login" id="login">
    <div className="l"><div className="tx"><h1>Reach the right member<br />before the admission.</h1><p>Your queue brings forward the people whose health is changing, explains why, and gives you everything you need to help them today.</p></div></div>
    <div className="r"><div className="rh"><div><div className="t1">Control Command Center</div><div className="t2">Care Coordinator Portal</div></div><Logo /></div>
      <form id="lf" autoComplete="off" onSubmit={go}><h2>Sign in</h2><p>PureHealth Cloud Account Sign In</p>
        <label className="search"><Icon name="user" /><span className="sr">User</span><input id="em" type="text" placeholder="User ID" value={u} onChange={e => setU(e.target.value)} /></label>
        <div className="accts" role="group" aria-label="Demo accounts">
          {users.loading ? <span className="small muted">Loading care team…</span> : users.error ? <span className="small" style={{ color: 'var(--critical)' }}>Cannot reach the backend on :4000 ({users.error.message})</span>
            : users.data.map(x => <button type="button" key={x.user_id} className="chip lg" aria-pressed={u === x.username} onClick={() => setU(x.username)} title={`${x.role}${x.daily_capacity ? ` · ${x.daily_capacity} calls/day` : ''}`}>{x.name} <span className="c">{x.role}</span></button>)}
        </div>
        <label className="search"><Icon name="lock" /><span className="sr">PIN</span><input id="pin" type="password" placeholder="PIN" value={pin} onChange={e => setPin(e.target.value)} autoComplete="off" /></label>
        {err ? <p className="note n-crit" style={{ margin: '0 0 16px' }}>{err}</p> : null}
        <button className="btn" type="submit" disabled={busy || !u}><Icon name="shield" /> Login with Daman SSO</button>
        <p className="small muted" style={{ margin: '14px 0 0' }}>Local demo sign-in: pick a care-team member, PIN 1234. The user id is sent as x-user on every write.</p>
      </form>
      <div className="pw"><img src={powered} alt="Powered by PureCS, Daman and PURA" /></div></div>
  </div>;
}
