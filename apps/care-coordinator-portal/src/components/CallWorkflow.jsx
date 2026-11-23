import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../api.js';
import { useApi, useUser, useToast } from '../hooks.js';
import MemberHeader from './MemberHeader.jsx';
import { Loading, ErrorBox, Source } from './Bits.jsx';
import Icon from '../icons.jsx';
import { ALERT_CLS, ALERT_TEXT, CLASS_LABEL, classCls, first, fmtDay, relDay, num, PRIORITY_TEXT } from '../util.js';

/**
 * The call: member header → why we're calling → consent (G2) → review → actions → outcome.
 * Everything below the consent card is not rendered until consent_status === 'granted' (rulebook gate G2).
 * Writes: POST /portal/calls, /portal/consent, /portal/assertions, /portal/outcomes, /portal/notes, /portal/appointments, PATCH /portal/calls/:id
 */
export default function CallWorkflow({ memberId, onChanged }) {
  const { user } = useUser(); const say = useToast(); const nav = useNavigate();
  const m = useApi(`/members/${memberId}`);
  const plan = useApi(`/members/${memberId}/care-plan`);
  const health = useApi('/health');
  const m360 = useApi(m.data && m.data.consent_status === 'granted' ? `/members/${memberId}/360` : null, [m.data && m.data.consent_status]);
  const timeline = useApi(`/members/${memberId}/timeline`);
  const [call, setCall] = useState({ st: 'idle', call_id: null, secs: 0 });
  const [consentTick, setConsentTick] = useState(false); const [redFlag, setRedFlag] = useState(false);
  const [reviewed, setReviewed] = useState({}); const [noteFor, setNoteFor] = useState(null); const [noteTxt, setNoteTxt] = useState('');
  const [notes, setNotes] = useState(''); const [resp, setResp] = useState(''); const [saved, setSaved] = useState(false); const [busy, setBusy] = useState(false); const [cbDate, setCbDate] = useState('');
  useEffect(() => { setCall({ st: 'idle', call_id: null, secs: 0 }); setConsentTick(false); setReviewed({}); setNotes(''); setResp(''); setSaved(false); setRedFlag(false); }, [memberId]);
  useEffect(() => { if (call.st !== 'live') return; const t = setInterval(() => setCall(c => ({ ...c, secs: c.secs + 1 })), 1000); return () => clearInterval(t); }, [call.st]);
  if (m.loading && !m.data) return <Loading what="Loading member" />;
  if (m.error) return <ErrorBox error={m.error} retry={m.reload} />;
  const M = m.data, id = M.identity, risk = M.risk || {}, al = risk.alert || {}, consent = M.consent_status, today = health.data ? health.data.run_date : '2026-11-20';
  const granted = consent === 'granted', declined = consent === 'declined' || consent === 'withdrawn', pending = !granted && !declined;
  const needs = plan.data ? plan.data.needs : [], current = plan.data ? plan.data.current : [], top = current[0];
  const refresh = () => { m.reload(); plan.reload(); timeline.reload(); onChanged && onChanged(); };
  const run = async (fn, msg) => { setBusy(true); try { const r = await fn(); if (msg) say(msg); refresh(); return r; } catch (e) { say('Not saved: ' + e.message); } finally { setBusy(false); } };
  const fmtT = s => `${String(Math.floor(s / 60)).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`;
  // ── call control ──
  const startCall = () => run(async () => { const r = await api.post('/portal/calls', { member_id: memberId, reached: true, red_flag: redFlag, nurse_id: user.user_id }); setCall({ st: 'live', call_id: r.call_id, secs: 0 }); return r; }, 'Call started · recording');
  const noAnswer = () => run(() => api.post('/portal/calls', { member_id: memberId, reached: false, result: 'no_answer', nurse_id: user.user_id }), 'Not reached · retry rule applied');
  const endCall = () => run(async () => { if (call.call_id) await api.patch(`/portal/calls/${call.call_id}`, { stage: 'outcome' }); setCall(c => ({ ...c, st: 'ended' })); }, 'Call ended');
  const live = call.st === 'live';
  const callUI = live ? <div className="live"><span className="pulse" /><span className="mono">{fmtT(call.secs)}</span> · recorded call<button className="btn sm dang" onClick={endCall} disabled={busy}>End call</button></div>
    : <>{al.alert_colour === 'RED' || risk.safety_flag ? <label className="chip-ck" title="Red-flag symptoms on the call stop the script and escalate the same day"><input type="checkbox" checked={redFlag} onChange={e => setRedFlag(e.target.checked)} /> Red-flag symptoms</label> : null}
      <button className="btn" onClick={noAnswer} disabled={busy || declined}>No answer</button><button className="btn pri" onClick={startCall} disabled={busy || declined}><Icon name="phone" />{call.st === 'ended' ? 'Call again' : 'Call ' + first(id.display_name)}</button></>;
  // ── journey ──
  const agreed = needs.filter(n => n.last_outcome && n.last_outcome.outcome === 'agreed').length, decided = needs.filter(n => n.last_outcome).length;
  const steps = [['1', 'Contact', call.st === 'live' ? 'On the call' : call.st === 'ended' ? 'Call ended' : M.worklist ? M.worklist.list_status : 'Not yet', call.st !== 'idle' ? 'done' : 'cur'],
    ['2', 'Consent', granted ? 'Granted' : declined ? 'Declined' : 'Needed to review', granted ? 'done' : declined ? 'bad' : call.st !== 'idle' ? 'cur' : ''],
    ['3', 'Review', !granted ? 'After consent' : `${Object.keys(reviewed).length} confirmed`, !granted ? '' : Object.keys(reviewed).length ? 'done' : 'cur'],
    ['4', 'Actions', !granted ? 'After consent' : decided ? `${decided} decided · ${agreed} agreed` : 'Choose', !granted ? '' : decided ? 'done' : ''],
    ['5', 'Outcome', saved ? 'Saved' : 'Open', saved ? 'done' : '']];
  const journey = <div className="journey" role="list">{steps.map((s, i) => <div key={s[0]} className={'js ' + s[3]} role="listitem"><div className="m"><span className="c">{s[3] === 'done' ? '✓' : s[0]}</span>{i < 4 ? <span className="ln" /> : null}</div><div><div className="l">{s[1]}</div><div className="s">{s[2]}</div></div></div>)}</div>;
  // ── why we're calling (visible before consent) ──
  const why = <section className={'card why ' + (al.alert_colour === 'RED' ? '' : al.alert_colour === 'AMBER' ? 'high' : 'mod')} data-screen-label="Why now" id="whynow">
    <span className="eyebrow">Why we’re calling · {al.alert_colour} · {al.contact_priority} · {PRIORITY_TEXT[al.contact_priority]}</span>
    <h3>{top ? top.need : M.worklist ? M.worklist.current_needs : 'No open need'}</h3>
    <p className="d">{top ? <>Rulebook trigger <b className="mono">{top.trigger_code}</b> · {CLASS_LABEL[top.need_class]} · evidence: <span className="mono">{top.evidence}</span></> : 'This member has no CURRENT care need right now.'}</p>
    <div className="facts">
      <span className={'fact ' + (ALERT_CLS[al.alert_colour] === 'crit' ? 'crit' : ALERT_CLS[al.alert_colour] === 'high' ? 'high' : '')}><b className="num">{al.alert_colour}</b><span>{ALERT_TEXT[al.alert_colour]} · {al.reasons}</span></span>
      <span className="fact"><b className="num">R {risk.total_risk_score} / 23</b><span>Tier {risk.tier} · {risk.tier_label}</span></span>
      {M.worklist ? <span className="fact"><b className="num">{relDay(M.worklist.due_by, today)}</b><span>Contact due · {M.worklist.list_status}</span></span> : null}
      <span className="fact"><b className="num">{current.length}</b><span>CURRENT needs · {needs.filter(n => n.slot === 'NEXT').length} next</span></span>
    </div>
    {(al.alert_colour === 'RED' || risk.safety_flag) ? <div className="pwmatch"><div className="red-guard"><Icon name="warn" />RED: {al.reasons}. Same-day clinician review · the script stops here if the member reports red-flag symptoms (rule_alert RED).</div></div> : null}
    {current.length > 1 ? <div className="also" style={{ marginTop: 10, display: 'flex', gap: 6, flexWrap: 'wrap', alignItems: 'center', fontSize: 11 }}><span className="muted">Also current</span>{current.slice(1).map(n => <span key={n.need_id} className={'pill ' + classCls(n.need_class)}>{n.need}</span>)}</div> : null}
    <div className="foot">Source: care intelligence engine (longitudinal extract + CCC Rulebook) · run {risk.run_id} · rule version {risk.rule_version}</div>
  </section>;
  // ── consent ──
  const grant = () => run(() => api.post('/portal/consent', { member_id: memberId, consent_status: 'granted', call_id: call.call_id, nurse_id: user.user_id, duration_seconds: call.secs }), 'Consent logged');
  const decline = () => run(() => api.post('/portal/consent', { member_id: memberId, consent_status: 'declined', call_id: call.call_id, nurse_id: user.user_id }), 'Consent declined · outreach closed');
  const withdraw = () => run(() => api.post('/portal/consent', { member_id: memberId, consent_status: 'withdrawn', call_id: call.call_id, nurse_id: user.user_id }), 'Consent withdrawn');
  const consentCard = pending ? <section className="card" data-screen-label="Consent" id="consent" style={{ borderTop: '3px solid var(--accent)' }}><div className="card-h"><h3>Consent</h3><span className="r">Verbal · recorded call</span></div><div className="card-b" style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
      <button className={'perm' + (consentTick ? ' on' : '')} onClick={() => setConsentTick(!consentTick)} disabled={!live} aria-pressed={consentTick}><span className="tg" /><span><b>Consent</b><small>Look at and record health history; contact about care. Nothing below this card is shown until it is logged (gate G2).</small></span></button>
      {!live ? <p className="note-warn">Recorded call only · start the call first.</p> : null}
      <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}><button className="btn" onClick={decline} disabled={!live || busy}>Declined</button><button className="btn pri" onClick={grant} disabled={!live || !consentTick || busy}>Log consent</button></div></div></section>
    : declined ? <section className="card"><div className="card-b"><h3 style={{ fontSize: 14, marginBottom: 6 }}>Consent {consent}</h3><p className="muted">No further contact for 90 days; open outreach was cancelled. Member 360 and the care plan are not rendered.</p><div style={{ marginTop: 10 }}><button className="btn sm" onClick={grant} disabled={!live || busy}>Member now consents (recorded call)</button></div></div></section> : null;
  // ── review (after consent) ──
  const confirm = (key, label) => run(() => api.post('/portal/assertions', { member_id: memberId, call_id: call.call_id, assertion_text: `Confirmed with the member: ${label}`, nurse_id: user.user_id }).then(() => setReviewed(r => ({ ...r, [key]: 'ok' }))), 'Confirmed · recorded as member assertion');
  const saveNote = (key, label, need_id) => run(() => api.post('/portal/assertions', { member_id: memberId, call_id: call.call_id, need_id, assertion_text: `${label}: member says ${noteTxt}`, nurse_id: user.user_id }).then(() => { setReviewed(r => ({ ...r, [key]: 'note' })); setNoteFor(null); setNoteTxt(''); }), 'Member assertion recorded');
  const X = m360.data;
  const reviewRows = [];
  if (X) {
    (X.conditions || []).filter(c => c.is_chronic_marker).slice(0, 6).forEach(c => reviewRows.push({ key: 'dx:' + c.diagnosis_id, group: 'Diagnoses · raw claims', label: `${c.diagnosis_id} · ${(c.group4 || c.group3 || '').replace(/^[A-Z0-9.]+ - [A-Z0-9.]+ /, '')}`, detail: `${c.claim_count} claims · first ${fmtDay(c.first_date)} · last ${fmtDay(c.last_date)}`, src: 'raw_claims' }));
    (X.labs || []).filter(l => l.key).slice(0, 5).forEach(l => reviewRows.push({ key: 'lab:' + l.code, group: 'Latest results · raw claims', label: `${l.name} ${l.last.value} ${l.unit || ''}`, detail: `${fmtDay(l.last.date)} · claim ${l.last.claim_id} · ${l.n} results`, src: 'raw_claims' }));
    (X.medications || []).slice(0, 5).forEach(x => reviewRows.push({ key: 'rx:' + x.generic_name, group: 'Medicines · raw claims', label: x.generic_name, detail: `${x.fills} fills · last ${fmtDay(x.last_fill)}${x.dosage_form ? ' · ' + x.dosage_form : ''}`, src: 'raw_claims' }));
  }
  current.forEach(n => reviewRows.push({ key: 'need:' + n.need_id, need_id: n.need_id, group: 'Open needs · care intelligence', label: `${n.need} (${n.trigger_code})`, detail: n.evidence, src: 'longitudinal' }));
  const groups = [...new Set(reviewRows.map(r => r.group))];
  const nRev = Object.keys(reviewed).length;
  const review = granted ? <section className="card" data-screen-label="Member profile" id="profile" style={{ overflow: 'hidden' }}>
    <div className="prof-top"><div className="r"><b style={{ fontSize: 14 }}>Review for this call · {id.pathway === 'T2D·HTN' ? 'diabetes and hypertension' : id.pathway === 'T2D' ? 'diabetes' : 'hypertension'}</b><span className={'pill ' + (nRev ? 'ok' : 'mod')} style={{ marginLeft: 'auto' }}>{nRev ? `${nRev} confirmed` : `${reviewRows.length} to review`}</span></div>
      <div className="hbar" style={{ margin: '10px 0', background: 'var(--surface)' }}><i style={{ width: (reviewRows.length ? Math.round(nRev / reviewRows.length * 100) : 0) + '%', background: 'var(--ok)' }} /></div>
      <div className="r"><span style={{ fontSize: 11.5, color: 'var(--ink-2)', flex: 1 }}>History comes from raw claims; open needs from the longitudinal extract and the rulebook. "Correct" and "Member says" are saved as member assertions: they never close a care gap (only claims do).</span></div></div>
    {m360.loading ? <Loading what="Loading raw claims" /> : groups.map(g => <div key={g} className="prof-sec"><h4>{g}</h4>{reviewRows.filter(r => r.group === g).map(r => <div key={r.key}>
      <div className={'rv-row ' + (reviewed[r.key] || '')}><span className="pd">{reviewed[r.key] === 'ok' ? '✓' : reviewed[r.key] === 'note' ? '≈' : ''}</span><div className="tx"><b>{r.label}</b><small>{r.detail}</small></div>
        <div className="rvseg"><Source kind={r.src} /><button className={'rv ok' + (reviewed[r.key] === 'ok' ? ' on' : '')} onClick={() => confirm(r.key, r.label)} disabled={busy}>✓ Correct</button><button className={'rv' + (reviewed[r.key] === 'note' ? ' on' : '')} onClick={() => { setNoteFor(noteFor === r.key ? null : r.key); setNoteTxt(''); }}>✎ Member says</button></div></div>
      {noteFor === r.key ? <div style={{ display: 'flex', gap: 8, padding: '4px 0 10px 28px' }}><input value={noteTxt} onChange={e => setNoteTxt(e.target.value)} placeholder="What the member said, in their words" /><button className="btn sm pri" onClick={() => saveNote(r.key, r.label, r.need_id)} disabled={!noteTxt || busy}>Save</button></div> : null}
    </div>)}</div>)}
  </section> : null;
  // ── actions (CURRENT needs → next best action) ──
  const outcome = (n, o) => run(() => api.post('/portal/outcomes', { need_id: n.need_id, action_id: n.action && n.action.status === 'open' ? n.action.action_id : undefined, outcome: o, call_id: call.call_id, nurse_id: user.user_id }), { agreed: 'Agreed · check-it-happened follow-up created', done: 'Done · gap Reported, verify in claims', declined: 'Declined · held 90 days, next need promoted', carried: 'Carried · stays CURRENT' }[o]);
  const book = async (n) => { const d = window.prompt ? null : null; const date = cbDate || today; await run(() => api.post('/portal/appointments', { member_id: memberId, need_id: n.need_id, action_id: n.action && n.action.action_id, appointment_type: n.trigger_code, scheduled_date: date, nurse_id: user.user_id }), 'Appointment booked · gap Scheduled'); };
  const actionsCard = granted && !declined ? <section className="card" data-screen-label="Actions" id="nba"><div className="card-h"><h3>Care plan actions to agree with {first(id.display_name)}</h3><span className="r">{plan.loading ? 'Loading' : `${current.length} CURRENT · one next-best action each (rulebook §3)`}</span></div><div className="card-b"><div className="act2-list">
    {current.map((n, i) => { const o = n.last_outcome && n.last_outcome.outcome; const on = o === 'agreed'; return <div key={n.need_id} className={'act2' + (on ? ' on' : '') + (n.status !== 'open' ? ' closed' : '')}>
      <span className="no" aria-hidden="true">{on ? '✓' : i + 1}</span>
      <div className="bd"><div className="tt"><b>{n.next_best_action}</b>{i === 0 ? <span className="pill acc">Best fit</span> : null}<span className={'pill ' + classCls(n.need_class)}>{CLASS_LABEL[n.need_class]}</span><span className="pill line">{n.gap_state}</span></div>
        <div className="for">For <b>{n.need}</b> ({n.trigger_code}) · <span className="mono">{n.evidence}</span></div>
        <div className="meta2"><span title="Who does it"><Icon name="user" />{n.action_owner}</span><span title="Done when (verified in claims)"><Icon name="check" />{n.done_when}</span><span title="Due"><Icon name="clock" />{relDay(n.due_date, today)}</span>{n.action ? <span className="mono">action #{n.action.action_id} · {n.action.status}</span> : null}</div>
        {o ? <div className="nd-act" style={{ marginTop: 6 }}>Recorded: {o}{n.last_outcome.note ? ' · ' + n.last_outcome.note : ''} · {n.last_outcome.recorded_at}</div> : null}
        {n.assertions && n.assertions.length ? <div className="muted" style={{ fontSize: 11, marginTop: 4 }}>Member said: {n.assertions.map(a => a.assertion_text).join(' · ')}</div> : null}
      </div>
      <div className="btns"><button className={'agree' + (on ? ' on' : '')} onClick={() => outcome(n, 'agreed')} disabled={busy || on}>{on ? '✓ Agreed' : 'Member agrees'}</button>
        <button className="btn sm" onClick={() => outcome(n, 'done')} disabled={busy}>Already done</button><button className="btn sm" onClick={() => outcome(n, 'declined')} disabled={busy}>Declined</button><button className="btn sm ghost" onClick={() => outcome(n, 'carried')} disabled={busy}>Carry</button>
        <div style={{ display: 'flex', gap: 4 }}><input type="date" value={cbDate} min={today} onChange={e => setCbDate(e.target.value)} aria-label="Booking date" style={{ padding: '4px 6px', fontSize: 11 }} /><button className="btn sm" onClick={() => book(n)} disabled={busy || !cbDate}>Book</button></div></div>
    </div>; })}
    {!plan.loading && !current.length ? <p className="muted">No CURRENT need. {needs.filter(n => n.slot === 'NEXT').length ? 'NEXT needs are promoted by the engine when a CURRENT one closes.' : 'The care plan is empty for this member.'}</p> : null}
  </div>{needs.filter(n => n.slot === 'NEXT').length ? <div className="act2-foot muted" style={{ marginTop: 10, fontSize: 11.5 }}>Next in line: {needs.filter(n => n.slot === 'NEXT').map(n => n.need).join(' · ')}. Each becomes an action when it reaches CURRENT.</div> : null}</div></section> : null;
  // ── outcome ──
  const R2 = [['declined', 'Declined everything'], ['callback', 'Callback requested'], ['other', 'Other']];
  const save = () => run(async () => {
    if (call.call_id) await api.patch(`/portal/calls/${call.call_id}`, { stage: 'closed', notes, response: agreed ? `Actions agreed · ${agreed}` : resp });
    if (notes) await api.post('/portal/notes', { member_id: memberId, call_id: call.call_id, text: notes, nurse_id: user.user_id });
    if (resp === 'callback' && !agreed) await api.post('/portal/appointments', { member_id: memberId, appointment_type: 'callback', scheduled_date: cbDate || today, nurse_id: user.user_id });
    setSaved(true); setCall(c => ({ ...c, st: 'ended' }));
  }, 'Outcome saved · follow-ups are in Actions');
  const followups = (timeline.data || []).filter(e => e.type === 'action').slice(0, 6);
  const outcomeCard = granted ? <section className="card" data-screen-label="Outcome" id="outcome"><div className="card-h"><h3>Outcome</h3><span className="r">{saved ? 'Saved' : 'Closes the call · follow-ups already created by each decision'}</span></div>
    <div className="card-b oc2">
      <div className="oc-l">Member’s response</div>
      {agreed ? <div className="resp-auto"><span className="ck">✓</span><div><b>Actions agreed · {agreed}</b><small>Set from the actions marked agreed. Each agreed action has a “check it happened” follow-up.</small></div></div>
        : <div className="chips">{R2.map(([k, l]) => <button key={k} className={'chip' + (resp === k ? ' on' : '')} onClick={() => setResp(k)} disabled={saved}>{l}</button>)}{resp === 'callback' ? <input type="date" value={cbDate} min={today} onChange={e => setCbDate(e.target.value)} style={{ width: 160 }} /> : null}</div>}
      {followups.length ? <><div className="oc-l" style={{ marginTop: 18 }}>Next steps created by this call · care coordinator tasks</div><div className="ot-list">{followups.map(f => <div key={f.ref} className="ot"><div className="ot-h"><span className="kchip k-checkin">Follow-up</span><b>{f.text.replace(/^New action: /, '')}</b></div></div>)}</div></> : null}
      <label className="oc-l" htmlFor="ocnotes" style={{ marginTop: 18, display: 'block' }}>Notes <span className="opt">· optional</span></label>
      <textarea id="ocnotes" rows={2} value={notes} onChange={e => setNotes(e.target.value)} placeholder="What the member said, in their words" disabled={saved} />
      <div style={{ marginTop: 10 }}><button className="btn sm ghost" onClick={withdraw} disabled={busy || saved}>Member withdraws consent</button></div>
    </div>
    <div className="oc-foot"><span className="msg">{saved ? 'Saved. The tasks are in Actions.' : live ? 'Call in progress. Finish the call, then save.' : 'Ready when you are.'}</span><button className="btn pri" onClick={save} disabled={saved || busy}>Save outcome</button></div></section> : null;
  return <div className="work-in">
    <MemberHeader m={M} consent={consent}>{callUI}</MemberHeader>
    <div className="card" style={{ padding: '0 24px 18px' }}>{journey}</div>
    {pending || declined ? <div className="cols2">{why}{consentCard}</div> : why}
    {review}{actionsCard}{outcomeCard}
    {!granted ? <section className="card lockc"><div className="lk-i"><Icon name="lock" /></div><div><b>Member 360, review, actions and care gaps</b><small>Not rendered until consent is logged on a recorded call (rulebook G2) · <button className="btn sm ghost" onClick={() => nav(`/member/${memberId}/intel`)}>intelligence summary</button></small></div></section> : null}
  </div>;
}
