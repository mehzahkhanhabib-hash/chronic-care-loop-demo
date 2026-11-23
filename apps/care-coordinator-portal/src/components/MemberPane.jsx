import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../api.js';
import { useApi, useUser, useToast, useApp } from '../hooks.js';
import { useCall, liveSecs } from '../callStore.js';
import Icon from '../icons.jsx';
import MemberHead from './MemberHead.jsx';
import CarePlanView from './CarePlanView.jsx';
import MemberTasks from './MemberTasks.jsx';
import Timeline from './Timeline.jsx';
import Intelligence from './Intelligence.jsx';
import { Loading, ErrorBox, Tag, Source, LockBox } from './Bits.jsx';
import { ALERT_TAG, ALERT_TEXT, CLASS_LABEL, CLASS_DOT, CLASS_TAG, GAP_TAG, KIND_LABEL, PRIORITY_TEXT, TIMES, addDays, dxName, first, fmtDay, fmtDM, fmtT, moneyK, relDay } from '../util.js';

const TABS = [['call', 'Call'], ['plan', 'Care Gaps'], ['tasks', 'Tasks'], ['timeline', 'Timeline'], ['intel', 'Intelligence']];
const STEPS = [['why', 'Why we are calling'], ['consent', 'Consent'], ['gaps', 'Actions & care gaps'], ['outcome', 'Outcome']];
const RESP = [['declined', 'Declined everything'], ['callback', 'Callback requested'], ['other', 'Other']];
const SCRIPT = '“To help with your care, may we look at and record your health history and contact you about your care plan? You can say no, and you can change your mind at any time.”';

/**
 * Nudge queue · call workflow for one member (design: header → journey → tabs → step cards).
 * Reads: /members/:id, /care-plan, /timeline and, only after consent (gate G2), /360, /tasks, /appointments.
 * Writes: POST /portal/calls, /consent, /assertions, /outcomes, /appointments, /notes · PATCH /portal/calls/:id.
 */
export default function MemberPane({ memberId, tab, wl }) {
  const { user } = useUser(); const say = useToast(); const nav = useNavigate(); const { today, bump } = useApp();
  const m = useApi(`/members/${memberId}`);
  const plan = useApi(`/members/${memberId}/care-plan`);
  const timeline = useApi(`/members/${memberId}/timeline`);
  const [call, setCall] = useCall(memberId);
  const [, force] = useState(0);
  const [busy, setBusy] = useState(false);
  const [open, setOpen] = useState({}); const [gopen, setGopen] = useState({}); const [gnote, setGnote] = useState({}); const [fu, setFu] = useState({});
  const [says, setSays] = useState(null); const [saysTxt, setSaysTxt] = useState(''); const [other, setOther] = useState({}); const [hist, setHist] = useState(false); const [reviewed, setReviewed] = useState({});
  const granted = !!(m.data && m.data.consent_status === 'granted');
  const m360 = useApi(granted ? `/members/${memberId}/360` : null, [granted]);
  const tasks = useApi(granted ? `/members/${memberId}/tasks` : null, [granted]);
  const appts = useApi(granted ? `/members/${memberId}/appointments` : null, [granted]);
  useEffect(() => { if (call.st !== 'live') return undefined; const t = setInterval(() => force(x => x + 1), 1000); return () => clearInterval(t); }, [call.st]);
  if (m.loading && !m.data) return <div className="scroll"><Loading what="Loading member" /></div>;
  if (m.error) return <div className="scroll"><ErrorBox error={m.error} retry={m.reload} /></div>;

  const M = m.data, id = M.identity, risk = M.risk || {}, al = risk.alert || {}, consent = M.consent_status;
  const declined = consent === 'declined' || consent === 'withdrawn', pending = !granted && !declined;
  const live = call.st === 'live', secs = liveSecs(call), name1 = first(id.display_name);
  const needs = plan.data ? plan.data.needs : [], current = needs.filter(n => n.slot === 'CURRENT' && n.status === 'open'), top = current[0];
  const openNeeds = needs.filter(n => n.status === 'open');
  const decided = current.filter(n => n.last_outcome && n.last_outcome.outcome !== 'carried'), agreedN = current.filter(n => n.last_outcome && n.last_outcome.outcome === 'agreed').length, togo = current.length - decided.length;
  const refresh = () => { m.reload(); plan.reload(); timeline.reload(); tasks.reload(); appts.reload(); wl && wl.reload(); bump(); };
  const run = async (fn, msg) => { setBusy(true); try { const r = await fn(); if (msg) say(msg); refresh(); return r; } catch (e) { say('Not saved: ' + e.message); return null; } finally { setBusy(false); } };
  const scrollTo = k => requestAnimationFrame(() => { const el = document.getElementById('s-' + k); if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' }); });

  // ── call control ──
  const startCall = () => run(async () => { const r = await api.post('/portal/calls', { member_id: memberId, reached: true, red_flag: call.redFlag, nurse_id: user.user_id }); setCall({ st: 'live', call_id: r.call_id, startedAt: Date.now(), secs: 0, saved: false }); scrollTo(pending ? 'consent' : 'gaps'); return r; }, 'Call started · recording');
  const noAnswer = () => run(() => api.post('/portal/calls', { member_id: memberId, reached: false, result: 'no_answer', nurse_id: user.user_id }), 'Not reached · retry rule applied');
  const endCall = () => run(async () => { if (call.call_id) await api.patch(`/portal/calls/${call.call_id}`, { stage: 'outcome' }); setCall({ st: 'ended', secs }); scrollTo('outcome'); }, 'Call ended');
  // ── consent (G2) ──
  const consentPost = (status, msg) => run(async () => { await api.post('/portal/consent', { member_id: memberId, consent_status: status, call_id: call.call_id, nurse_id: user.user_id, duration_seconds: secs }); setCall({ consentAt: new Date().toTimeString().slice(0, 5), consentSecs: secs, resp: status === 'granted' ? '' : 'declined' }); scrollTo(status === 'granted' ? 'gaps' : 'outcome'); }, msg);
  // ── gaps / actions ──
  const assertion = (n, text, msg) => run(() => api.post('/portal/assertions', { member_id: memberId, call_id: call.call_id, need_id: n ? n.need_id : undefined, assertion_text: text, nurse_id: user.user_id }), msg);
  const outcome = (n, o) => run(() => api.post('/portal/outcomes', { need_id: n.need_id, action_id: n.action && n.action.status === 'open' ? n.action.action_id : undefined, outcome: o, note: gnote[n.need_id] || undefined, call_id: call.call_id, nurse_id: user.user_id }),
    { agreed: 'Agreed · “check it happened” follow-up created', done: 'Done · gap Reported, verify in claims', declined: 'Declined · held 90 days, next need promoted', carried: 'Carried · stays CURRENT' }[o]);
  const book = (n, d, t) => run(() => api.post('/portal/appointments', { member_id: memberId, need_id: n.need_id, action_id: n.action && n.action.action_id, appointment_type: n.trigger_code, scheduled_date: d, scheduled_time: t, nurse_id: user.user_id }), `Booked for ${fmtDM(d)} · ${t} · gap Scheduled`);
  const followUp = n => { const f = fu[n.need_id] || {}; if (!f.date) { say('Pick a follow-up date'); return null; } return run(() => api.post('/portal/appointments', { member_id: memberId, need_id: n.need_id, appointment_type: f.type || 'Follow-up call', scheduled_date: f.date, scheduled_time: f.time || '16:30', nurse_id: user.user_id }), `${f.type || 'Follow-up call'} scheduled for ${fmtDM(f.date)}`); };
  // ── outcome ──
  const save = () => run(async () => {
    if (call.call_id) await api.patch(`/portal/calls/${call.call_id}`, { stage: 'closed', notes: call.notes, response: agreedN ? `Actions agreed · ${agreedN}` : call.resp });
    if (call.notes) await api.post('/portal/notes', { member_id: memberId, call_id: call.call_id, text: call.notes, nurse_id: user.user_id });
    if (call.resp === 'callback' && !agreedN) await api.post('/portal/appointments', { member_id: memberId, appointment_type: 'callback', scheduled_date: call.cbDate || addDays(today, 1), nurse_id: user.user_id });
    setCall({ saved: true, st: 'ended' });
  }, `Outcome saved for ${name1} · follow-ups are in Tasks`);
  const nextMember = () => { const L = wl && wl.data ? wl.data.items.filter(i => i.list_status === 'today' && i.member_id !== memberId) : []; const i = wl && wl.data ? wl.data.items.findIndex(x => x.member_id === memberId) : -1; const nx = (wl && wl.data ? wl.data.items.slice(i + 1).find(x => x.list_status === 'today') : null) || L[0]; if (nx) nav(`/member/${nx.member_id}`); else say('No more members on today’s list'); };

  // ── journey ──
  const done = { why: !pending, consent: !pending, gaps: granted && togo === 0, outcome: call.saved };
  const cur = call.saved ? null : pending ? 'consent' : declined ? 'outcome' : togo > 0 ? 'gaps' : 'outcome';
  const isOpen = k => open[k] !== false;
  const cardCls = k => 'card ' + (cur === k ? 'cur ' : '') + (done[k] ? 'done ' : '') + (isOpen(k) ? '' : 'closed');
  const hd = (k, n, title, sum) => <button className="hd" onClick={() => setOpen(o => ({ ...o, [k]: !isOpen(k) }))} aria-expanded={isOpen(k)}><span className="n">{done[k] ? <Icon name="tick" /> : n}</span><h3>{title}</h3><span className="sum">{!isOpen(k) ? sum || '' : ''}</span><span className="chev"><Icon name="chev" /></span></button>;
  const X = m360.data, l12 = X && X.utilisation ? X.utilisation.last_12m || {} : {};
  const a1c = X ? (X.labs || []).find(l => l.code === '4548-4' || l.code === '17856-6') : null, sbp = X ? (X.labs || []).find(l => l.code === '8480-6') : null;
  const med1 = X ? (X.medications || []).find(x => !/^missing drug$/i.test(x.generic_name || '')) : null;
  const lastCall = (timeline.data || []).find(e => e.type === 'call');

  const head = <MemberHead M={M} mode="call" call={call} secs={secs} busy={busy} onCall={startCall} onEnd={endCall} onNoAnswer={noAnswer} />;
  const journey = <nav className="journey" aria-label="Call progress">{STEPS.map(([k, l], i) => <React.Fragment key={k}>{i ? <span className={'jl' + (done[STEPS[i - 1][0]] ? ' done' : '')} /> : null}
    <button className={'js ' + (done[k] ? 'done' : cur === k ? 'cur' : '') + (!granted && k === 'gaps' ? ' lock' : '')} onClick={() => { if (tab !== 'call') nav(`/member/${memberId}`); setOpen(o => ({ ...o, [k]: true })); scrollTo(k === 'gaps' && !granted ? 'consent' : k); }} aria-current={cur === k ? 'step' : undefined}><span className="n">{done[k] ? <Icon name="tick" /> : i + 1}</span>{l}</button></React.Fragment>)}</nav>;
  const tabs = <div className="tabs" role="tablist">{TABS.map(([k, l]) => { const lk = k !== 'call' && !granted;
    return <button key={k} className="tab" role="tab" aria-selected={tab === k} disabled={lk} title={lk ? 'Unlocks with consent' : undefined} onClick={() => nav(`/member/${memberId}${k === 'call' ? '' : '/' + k}`)}>{lk ? <Icon name="lock" /> : null}{l}</button>; })}</div>;

  // ── step 1 · why we are calling (the only clinical line shown before consent) ──
  const why = <section id="s-why" className={cardCls('why')}>{hd('why', 1, 'Why we are calling', top ? top.need : '')}
    <div className="bd">
      <div><div className="ov">{al.alert_colour} · {al.contact_priority} · {PRIORITY_TEXT[al.contact_priority]} · {ALERT_TEXT[al.alert_colour]}</div>
        <div className="why">{top ? top.need : M.worklist && M.worklist.current_needs ? M.worklist.current_needs : 'No open care need'}</div>
        <div className="ov">{top ? <>Rulebook trigger <b>{top.trigger_code}</b> · {CLASS_LABEL[top.need_class]} · {top.evidence}.</> : plan.loading ? 'Loading the care plan…' : 'This member has no CURRENT care need right now.'}</div></div>
      {granted && X ? <><div className="mini">
        <div className={l12.admissions_12m > 0 || l12.ed_visits_12m > 1 ? 'crit' : 'info'}><b>{l12.admissions_12m || 0} adm · {l12.ed_visits_12m || 0} ER</b><span>Last 12 months</span></div>
        {a1c ? <div className={a1c.last.value >= 8 ? 'crit' : 'info'}><b>HbA1c {a1c.last.value}%{a1c.points.length > 1 && a1c.last.value > a1c.points[a1c.points.length - 2].value ? ' ↑' : ''}</b><span>{fmtDay(a1c.last.date)}</span></div> : null}
        {sbp ? <div className={sbp.last.value >= 140 ? 'warn' : 'info'}><b>SBP {sbp.last.value}</b><span>{fmtDay(sbp.last.date)}</span></div> : null}
        <div className="info"><b>{moneyK(l12.payable_12m)}</b><span>Claims · 12 months</span></div></div>
        <div className="okline"><Icon name="tick" /> Consent on file · Verbal · recorded call{call.consentAt ? ` · ${call.consentAt}` : ''} <Source kind="raw_claims" /></div></> : null}
      {al.alert_colour === 'RED' || risk.safety_flag ? <><span className="note n-crit"><Icon name="x" /> RED · {al.reasons}. Same-day clinician review; the script stops if the member reports red-flag symptoms.</span>
        {call.st === 'idle' ? <label className="ck"><input type="checkbox" checked={call.redFlag} onChange={e => setCall({ redFlag: e.target.checked })} /> Red-flag symptoms reported · escalate to the clinical lead when the call starts</label> : call.redFlag ? <span className="note n-warn">Escalation raised for the clinical lead on this call</span> : null}</> : null}
      <div className="row"><span className="ov" style={{ marginRight: 6 }}>Open Care Gaps</span>{openNeeds.filter(n => !top || n.need_id !== top.need_id).slice(0, 5).map(n => <Tag key={n.need_id} cls={n.slot === 'CURRENT' ? 't-crit' : 't-warn'}>{n.need}</Tag>)}{openNeeds.length <= 1 ? <span className="small muted">None besides the main reason</span> : null}</div>
      {granted ? null : declined ? <div className="lockline"><Icon name="lock" /> Member declined · health history stays hidden</div> : <div className="lockline"><Icon name="lock" /> Health history, labs and medicines stay hidden until the member gives consent</div>}
      <div className="small muted">Source: care intelligence engine (longitudinal extract + CCC Rulebook) · run {risk.run_id} · rules {risk.rule_version} · R {risk.total_risk_score}/23 · tier {risk.tier}</div>
    </div></section>;

  // ── step 2 · consent ──
  const consentCard = <section id="s-consent" className={cardCls('consent')}>{hd('consent', 2, 'Consent', granted ? 'Consent logged · verbal · recorded call' : declined ? 'Member declined consent' : '')}
    <div className="bd">{granted
      ? <div className="row" style={{ justifyContent: 'space-between' }}><span className="okline" style={{ color: 'var(--text-primary)', fontWeight: 500 }}><span style={{ color: 'var(--success)' }}><Icon name="tick" /></span> Consent logged{call.consentAt ? ` at ${call.consentAt}` : ''} · Verbal · recorded call{call.consentAt ? ` · ${fmtT(call.consentSecs)}` : ''} · by {user.name} · {user.user_id}</span><button className="link red" onClick={() => consentPost('withdrawn', 'Consent withdrawn · profile locked again')} disabled={busy}>Member withdrew consent</button></div>
      : declined ? <div className="row" style={{ justifyContent: 'space-between' }}><span className="note n-crit"><Icon name="x" /> {consent === 'withdrawn' ? 'Consent withdrawn' : 'Declined on the recorded call'} · profile stays locked; open outreach was cancelled (90-day hold)</span><button className="link" onClick={() => consentPost('granted', 'Consent logged · profile, labs and care gaps unlocked')} disabled={!live || busy} title={live ? '' : 'Start a recorded call first'}>Member now consents</button></div>
        : <><div className="script"><b>Read to the member</b><p>{SCRIPT}</p></div>
          <div className="lockline" style={{ color: 'var(--text-primary)' }}><Icon name="lock" /> Unlocks: Member 360 (raw claims history, labs, medicines), the care gaps and the care plan for this programme</div>
          {live ? <span className="note n-ok"><Icon name="phone" /> Call is recording · consent will be logged against it</span> : <span className="note n-warn"><Icon name="phone" /> Start the call first. Consent only counts on a recorded call.</span>}
          <div className="choice"><button className="btn btn-ok" onClick={() => consentPost('granted', 'Consent logged · profile, labs and care gaps unlocked')} disabled={!live || busy}><Icon name="tick" /> Consent Given</button><button className="btn btn-dng-o" onClick={() => consentPost('declined', 'Consent declined · outreach closed')} disabled={!live || busy}><Icon name="x" /> Declined</button></div></>}
    </div></section>;

  // ── step 3 · care gaps & plan (not rendered before consent) ──
  const apptFor = n => (appts.data || []).filter(a => a.need_id === n.need_id);
  const gapRow = n => {
    const isCur = n.slot === 'CURRENT' && n.status === 'open', confirmed = isCur && n.gap_state !== 'Potential', o = n.last_outcome && n.last_outcome.outcome, agreed = isCur && o === 'agreed';
    const isO = confirmed && gopen[n.need_id] !== false, bk = apptFor(n), f = fu[n.need_id] || {}, ot = other[n.need_id];
    const slots = [1, 2, 3].map((d, i) => ({ d: addDays(today, d), t: ['10:00', '16:30', '10:30'][i] }));
    let right;
    if (n.status === 'done') right = <><span className="conf"><Icon name="tick" /> Done · {n.gap_state}</span><Tag cls="t-acc">Verify in claims</Tag></>;
    else if (n.status === 'declined') right = <span className="dec">Declined by member · held until {fmtDay(n.hold_until)}</span>;
    else if (!isCur) right = <Tag cls="t-neu" title="Becomes an action when it reaches Current">{n.slot === 'NEXT' ? 'Next' : 'Future'} · rank {n.rank}</Tag>;
    else if (confirmed) right = <><span className="conf"><Icon name="tick" /> {agreed ? 'Agreed' : 'Confirmed'}</span><Tag cls={GAP_TAG[n.gap_state]}>{n.gap_state}</Tag><button className="round" style={{ border: 0, background: 'none' }} onClick={() => setGopen(g => ({ ...g, [n.need_id]: !isO }))} aria-label={isO ? 'Collapse' : 'Expand'}><span style={{ display: 'block', transform: `rotate(${isO ? 0 : 180}deg)` }}><Icon name="chev" /></span></button></>;
    else right = <><button className="btn btn-pri btn-xs" disabled={busy} onClick={() => assertion(n, `Confirmed with the member: ${n.need}`, 'Care gap confirmed · recorded as a member assertion (Verified)')}>Confirm</button><button className="btn btn-sec btn-xs" disabled={busy} onClick={() => outcome(n, 'declined')}>Decline</button></>;
    return <div key={n.need_id} className={'gap' + (isO ? ' open' : '') + (n.status !== 'open' ? ' done' : '')} id={'g-' + n.trigger_code}>
      <div className="gh"><span className={'dot ' + (CLASS_DOT[n.need_class] || '')} /><div className="gt"><b>{n.need}</b>{top && n.need_id === top.need_id ? <Tag cls="t-crit">Main reason</Tag> : <Tag cls={CLASS_TAG[n.need_class]}>{CLASS_LABEL[n.need_class]}</Tag>}
        <small>{n.trigger_code} · {n.evidence}{(n.assertions || []).length ? ` · Member said: ${n.assertions.map(a => a.assertion_text).join(' · ')}` : ''}</small>
        {isCur && !confirmed ? (says === n.need_id ? <span className="row" style={{ marginTop: 6 }}><input className="inp" style={{ height: 32, flex: 1 }} value={saysTxt} onChange={e => setSaysTxt(e.target.value)} placeholder="What the member said, in their words" /><button className="btn btn-pri btn-xs" disabled={!saysTxt || busy} onClick={() => assertion(n, `${n.need}: member says ${saysTxt}`, 'Member assertion recorded · the gap stays open until claims show it').then(() => { setSays(null); setSaysTxt(''); })}>Save</button><button className="btn btn-ghost btn-xs" onClick={() => setSays(null)}>Cancel</button></span>
          : <button className="link u" onClick={() => { setSays(n.need_id); setSaysTxt(''); }}>Not a gap?</button>) : null}</div><div className="gb">{right}</div></div>
      {isO ? <div className="plan">
        <div className="pbox"><div className="pl">Care plan for this gap · next best action (rulebook §3)</div>
          <div className="pact" style={{ flexWrap: 'wrap' }}><div className="pt"><b>{n.next_best_action}</b><small>{n.action_owner} · done when: {n.done_when} · due {relDay(n.due_date, today)}{n.action ? ` · action #${n.action.action_id}` : ''}</small></div>
            {agreed ? <button className="btn btn-ok agreed-btn" disabled><Icon name="tick" /> Agreed</button> : <button className="btn btn-line btn-xs" disabled={busy} onClick={() => outcome(n, 'agreed')}>Member agrees</button>}
            <button className="btn btn-sec btn-xs" disabled={busy} onClick={() => outcome(n, 'done')} title="The nurse reports it done: the gap moves to Reported and a “verify in claims” follow-up is created. Only claims close a gap.">Already done</button>
            <button className="btn btn-ghost btn-xs" disabled={busy} onClick={() => outcome(n, 'carried')}>Carry</button>
            {agreed ? <div className="slots" style={{ flexBasis: '100%' }}><div className="sl">Select appointment date time{bk.length ? <> · <b style={{ color: 'var(--success)' }}>Booked {bk.map(a => `${fmtDM(a.scheduled_date)}${a.scheduled_time ? ' · ' + a.scheduled_time : ''}`).join(', ')}</b></> : null}</div>
              <div className="row" style={{ gap: 12 }}>{slots.map(s => <button key={s.d} className="slot" disabled={busy} onClick={() => book(n, s.d, s.t)} aria-pressed={bk.some(a => a.scheduled_date === s.d && a.scheduled_time === s.t)}><b>{fmtDM(s.d)}</b><span>{s.t}</span></button>)}
                {ot ? <><input className="inp" type="date" style={{ width: 160, height: 36 }} value={ot.d || ''} min={today} onChange={e => setOther(x => ({ ...x, [n.need_id]: { ...ot, d: e.target.value } }))} aria-label="Other date" /><select className="inp" style={{ width: 110, height: 36 }} value={ot.t || '16:30'} onChange={e => setOther(x => ({ ...x, [n.need_id]: { ...ot, t: e.target.value } }))}>{TIMES.map(t => <option key={t}>{t}</option>)}</select><button className="btn btn-acc btn-sm" disabled={!ot.d || busy} onClick={() => book(n, ot.d, ot.t || '16:30')}>Book</button></>
                  : <button className="link" onClick={() => setOther(x => ({ ...x, [n.need_id]: { d: '', t: '16:30' } }))}>Other Dates <Icon name="right" /></button>}</div></div> : null}
          </div></div>
        <div className="pbox fu">
          <label htmlFor={'gn-' + n.need_id}>Note <span>(Optional)</span></label><input className="inp" id={'gn-' + n.need_id} value={gnote[n.need_id] || ''} onChange={e => setGnote(g => ({ ...g, [n.need_id]: e.target.value }))} placeholder="Saved with the member’s decision on this gap, e.g. prefers an Arabic-speaking GP" />
          <span className="fl"><Icon name="cal" /> Follow-up</span>
          <div className="ctl"><select className="inp" value={f.type || 'Follow-up call'} onChange={e => setFu(x => ({ ...x, [n.need_id]: { ...f, type: e.target.value } }))}>{['Follow-up call', 'Check-in call', 'SMS check-in'].map(t => <option key={t}>{t}</option>)}</select>
            <input className="inp" type="date" value={f.date || ''} min={today} onChange={e => setFu(x => ({ ...x, [n.need_id]: { ...f, date: e.target.value } }))} aria-label="Follow-up date" />
            <select className="inp" value={f.time || '16:30'} onChange={e => setFu(x => ({ ...x, [n.need_id]: { ...f, time: e.target.value } }))} aria-label="Follow-up time">{TIMES.map(t => <option key={t}>{t}</option>)}</select>
            <button className="btn btn-sec btn-sm" disabled={busy || !f.date} onClick={() => followUp(n)}>Schedule</button></div>
        </div></div> : null}
    </div>;
  };
  // history rows the nurse can read back to the member: raw claims only
  const histRows = [];
  if (X) {
    (X.conditions || []).filter(c => c.is_chronic_marker).slice(0, 6).forEach(c => histRows.push({ key: 'dx:' + c.diagnosis_id, label: `${c.diagnosis_id} · ${dxName(c)}`, detail: `${c.claim_count} claims · first ${fmtDay(c.first_date)} · last ${fmtDay(c.last_date)}` }));
    (X.labs || []).filter(l => l.key).slice(0, 5).forEach(l => histRows.push({ key: 'lab:' + l.code, label: `${l.name} ${l.last.value} ${l.unit || ''}`, detail: `${fmtDay(l.last.date)} · claim ${l.last.claim_id} · ${l.n} results` }));
    (X.medications || []).filter(x => !/^missing drug$/i.test(x.generic_name || '')).slice(0, 5).forEach(x => histRows.push({ key: 'rx:' + x.generic_name, label: x.generic_name, detail: `${x.fills} fill${x.fills === 1 ? '' : 's'} · last ${fmtDay(x.last_fill)}${x.dosage_form ? ' · ' + x.dosage_form : ''}` }));
  }
  const pct = current.length ? Math.round(decided.length / current.length * 100) : 100;
  const gapsCard = !granted ? <section className="card locked"><div className="hd"><span className="lk"><Icon name="lock" /></span><div><h3>Profile · actions · care gaps</h3><p>{declined ? 'Locked · the member declined consent' : 'Unlocks when consent is logged on a recorded call'} · not rendered before consent (rulebook G2)</p></div></div></section>
    : <section id="s-gaps" className={cardCls('gaps')}>{hd('gaps', 3, <>Care gaps &amp; plan · {top ? top.need : 'no current need'}</>, `${agreedN} of ${current.length} actions agreed`)}
      <div className="bd">
        <div className="lbl2" style={{ margin: 0 }}>At a glance <Source kind="raw_claims" /></div>
        {m360.loading && !X ? <Loading what="Loading raw claims" /> : m360.error ? <ErrorBox error={m360.error} retry={m360.reload} /> : X ? <div className="glance">
          <div><b>Conditions</b>{(X.conditions || []).filter(c => c.is_chronic_marker).slice(0, 4).map(dxName).join(' · ') || 'No chronic codes on claims'}</div>
          <div><b>Hospital use · 12 mo</b>{l12.admissions_12m || 0} admissions · {l12.ed_visits_12m || 0} ER visits · claims {moneyK(l12.payable_12m)}</div>
          <div><b>Last contact</b>{lastCall ? `${lastCall.text} · ${(lastCall.at || '').slice(0, 16)}` : 'No prior contact recorded in the portal'}</div>
          <div><b>Medicines</b>{(X.medications || []).length} on pharmacy claims{med1 ? ` · latest: ${med1.generic_name} (${fmtDay(med1.last_fill)})` : ''}</div>
          <div><b>{a1c ? 'Latest HbA1c' : sbp ? 'Latest BP' : 'Labs'}</b>{a1c ? `${a1c.last.value} % · ${fmtDay(a1c.last.date)}` : sbp ? `${sbp.last.value} mmHg systolic · ${fmtDay(sbp.last.date)}` : `${(X.labs || []).length} tests on claims`}</div>
        </div> : null}
        {histRows.length ? <div><button className="link" onClick={() => setHist(!hist)}>{hist ? 'Hide' : 'Review'} history with the member · {Object.keys(reviewed).length} of {histRows.length} confirmed <Icon name="right" /></button>
          {hist ? <div className="tlist" style={{ marginTop: 10 }}>{histRows.map(r => <div key={r.key} className={'task' + (reviewed[r.key] ? ' done' : '')} style={{ padding: '8px 14px' }}><span className="tk">{reviewed[r.key] ? <Icon name="tick" /> : null}</span><div className="tb"><b style={{ textDecoration: 'none', color: 'var(--text-primary)' }}>{r.label}</b><small>{r.detail} <Source kind="raw_claims" /></small></div>
            <div className="tr"><button className="btn btn-sec btn-xs" disabled={busy} onClick={() => assertion(null, `Confirmed with the member: ${r.label}`, 'Confirmed · recorded as a member assertion').then(() => setReviewed(v => ({ ...v, [r.key]: 'ok' })))}>Correct</button>
              <button className="btn btn-ghost btn-xs" onClick={() => { setSays(r.key); setSaysTxt(''); }}>Member says</button></div>
            {says === r.key ? <div className="bkf" style={{ paddingLeft: 36 }}><input className="inp" style={{ flex: 1, width: 'auto' }} value={saysTxt} onChange={e => setSaysTxt(e.target.value)} placeholder="What the member said, in their words" /><button className="btn btn-pri btn-sm" disabled={!saysTxt || busy} onClick={() => assertion(null, `${r.label}: member says ${saysTxt}`, 'Member assertion recorded').then(() => { setReviewed(v => ({ ...v, [r.key]: 'note' })); setSays(null); })}>Save</button><button className="btn btn-ghost btn-sm" onClick={() => setSays(null)}>Cancel</button></div> : null}</div>)}</div> : null}</div> : null}
        <div className="gcount" style={{ marginTop: 6 }}>Care gaps <b>{String(openNeeds.length).padStart(2, '0')}</b> <span className="small muted" style={{ fontWeight: 500 }}>safety → acute → uncontrolled → barrier → gap → goal · the first three are CURRENT</span></div>
        <div className="gbar"><span className="tr"><i style={{ width: Math.max(4, pct) + '%' }} /></span><span>{togo} to go · confirm to open its care plan · {agreedN} of {current.length} actions agreed</span></div>
        {plan.loading && !plan.data ? <Loading what="Loading care plan" /> : needs.length ? <div className="gl">{needs.map(gapRow)}</div> : <div className="empty">No care needs: no trigger fired for this member in a live campaign.</div>}
      </div></section>;

  // ── step 4 · outcome ──
  const fups = (tasks.data || []).filter(t => t.status === 'open' && (t.parent_action_id || ['follow_up', 'retry', 'escalation'].includes(t.action_kind)));
  const r = agreedN ? 'agreed' : call.resp;
  const can = !call.saved && call.st === 'ended' && !busy && !(r === 'other' && !call.notes.trim());
  const msg = call.saved ? <span className="okline"><Icon name="tick" /> Saved · {fups.length} follow-up task{fups.length === 1 ? '' : 's'} in Tasks</span>
    : live ? <span className="warnline">Call in progress. End the call, then save.</span>
      : call.st === 'idle' ? <span className="small muted">Start the call first. Outcomes are saved against a recorded call.</span>
        : r === 'other' && !call.notes.trim() ? <span className="small muted">Add a note to explain “Other”.</span> : <span className="small muted">Saving closes the call; each decision above is already written back to care intelligence.</span>;
  const hint = { declined: 'No follow-up is created. The member is not contacted about this again for 90 days.', callback: 'A callback is booked for the date below.', other: 'Add a short note so the next nurse has context.' };
  const outcomeCard = <section id="s-outcome" className={cardCls('outcome')}>{hd('outcome', granted ? 4 : 3, 'Outcome', r === 'agreed' ? `Actions agreed · ${agreedN}` : (RESP.find(x => x[0] === r) || [])[1] || '')}
    <div className="bd" style={{ paddingTop: 4 }}>
      {call.saved ? <div className="resp-ok" style={{ borderColor: 'var(--border-accent)', background: 'var(--info-soft)' }}><span className="ck" style={{ background: 'var(--accent)' }}><Icon name="tick" /></span><div style={{ flex: 1 }}><b style={{ color: 'var(--info)' }}>Outcome saved for {name1}</b><small>{fups.length} follow-up task{fups.length === 1 ? '' : 's'} in Tasks · written back to care intelligence</small></div><button className="btn btn-sec btn-sm" onClick={() => nav('/tasks')}>View tasks</button><button className="btn btn-pri btn-sm" onClick={nextMember}>Next member <Icon name="right" /></button></div> : null}
      <div><div className="lbl2">Member’s response</div>
        {r === 'agreed' ? <div className="resp-ok"><span className="ck"><Icon name="tick" /></span><div><b>Actions agreed · {agreedN}</b><small>Set from the actions marked agreed. Each has a “check it happened” follow-up.</small></div></div>
          : declined ? <span className="note n-crit"><Icon name="x" /> Consent {consent} · outreach closed for 90 days</span>
            : <div className="seg" role="group" aria-label="Member's response">{RESP.map(([k, l]) => <button key={k} className="pill" aria-pressed={r === k} disabled={call.saved} onClick={() => setCall({ resp: call.resp === k ? '' : k })}>{l}</button>)}
              {r === 'callback' ? <input className="inp" type="date" style={{ height: 32, width: 160 }} value={call.cbDate} min={today} onChange={e => setCall({ cbDate: e.target.value })} aria-label="Callback date" /> : null}</div>}</div>
      {r && hint[r] && !declined ? <div className="small" style={{ color: 'var(--text-secondary)', marginTop: -4 }}>{hint[r]}</div> : null}
      {granted ? <div><div className="lbl2">Next steps · tasks for the care coordinator</div>
        {fups.length ? <div className="nsteps">{fups.slice(0, 8).map(x => <div key={x.task_id} className="task ag" style={{ padding: '10px 14px' }}><span className="tk" /><div className="tb"><b>{x.title}</b><small><span className="agc y">From this member’s decisions</span> {KIND_LABEL[x.task_kind] || x.task_kind}{x.trigger_code ? ` · ${x.trigger_code}` : ''}</small></div><span className="when">{relDay(x.due_date, today)}</span></div>)}</div>
          : <div className="small muted">Tasks appear here as you agree, complete or decline actions.</div>}</div> : null}
      <label className="small" style={{ display: 'block' }}><b>Notes</b> · optional<textarea className="ta" id="notes" placeholder="What the member said, in their words" disabled={call.saved} value={call.notes} onChange={e => setCall({ notes: e.target.value })} /></label>
      <hr className="hr" />
      <div className="save">{msg}{call.saved ? null : <button className="btn btn-pri" onClick={save} disabled={!can}>Save Outcome</button>}</div>
    </div></section>;

  let body;
  if (tab === 'plan') body = <CarePlanView memberId={memberId} consent={consent} plan={plan} onChanged={refresh}><button className="btn btn-pri btn-sm" onClick={() => nav(`/member/${memberId}`)}><Icon name="phone" /> Open Call Workflow</button></CarePlanView>;
  else if (tab === 'tasks') body = granted ? <MemberTasks memberId={memberId} name={name1} needs={needs} tasks={tasks} assignment={M.assignment} onChanged={refresh} /> : <LockBox title="Tasks are unlocked only when the member gives consent" />;
  else if (tab === 'timeline') body = granted ? <Timeline memberId={memberId} granted={granted} timeline={timeline} m360={m360} /> : <LockBox title="The timeline is unlocked only when the member gives consent" />;
  else if (tab === 'intel') body = granted ? <Intelligence memberId={memberId} /> : <LockBox title="Rule inputs and evidence are unlocked only when the member gives consent" sub="Before consent the workstation shows only the header, why we are calling and the consent step (rulebook G2)" />;
  else body = <div className="stack">{why}{consentCard}{gapsCard}{outcomeCard}</div>;
  return <div className="scroll">{head}{journey}{tabs}{body}</div>;
}
