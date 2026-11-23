import React from 'react';
import { useNavigate } from 'react-router-dom';
import Icon from '../icons.jsx';
import { Ring, Tag, AlertTag, ConsentTag } from './Bits.jsx';
import { ALERT_COL, PRIORITY_TEXT, first, fmtT, genderWord, pathwayLabel, titleCase } from '../util.js';
import lady from '../assets/figure-female.png';

/** Member header from the design. Identity: longitudinal extract + crosswalk (pseudonym, always with the masked id). Risk ring, tier, alert: care intelligence. Consent: portal events. */
export default function MemberHead({ M, mode, call, secs, busy, onCall, onEnd, onNoAnswer, children }) {
  const nav = useNavigate();
  const id = M.identity || {}, r = M.risk || {}, al = r.alert || {}, wl = M.worklist, consent = M.consent_status;
  const col = ALERT_COL[al.alert_colour] || 'var(--risk-low)';
  const live = call && call.st === 'live', ended = call && call.st === 'ended', blocked = consent === 'declined' || consent === 'withdrawn';
  return <section className="mh" aria-label="Member">
    <div className="figure" aria-hidden="true">{id.gender === 'F' ? <img src={lady} alt="" /> : <Icon name="man" />}</div>
    <div className="id">
      <h1>{id.display_name}</h1>
      <div className="sub"><span title="Masked member id · the shared key of the Studio and the Portal">{id.member_id}</span><span>{titleCase(id.policy_type)} plan</span><Tag cls="t-neu" title="The source files carry no names: this is a deterministic pseudonym for the masked id">Pseudonym</Tag>
        <ConsentTag status={consent} />{wl && wl.campaign_id ? <Tag cls="t-acc">From Care studio · {wl.campaign_id}</Tag> : null}{r.safety_flag ? <Tag cls="t-crit">⚑ Priority clinical review</Tag> : null}</div>
      <div className="facts">
        <div>Age<b>{id.age}</b></div><div>Gender<b>{genderWord(id.gender)}</b></div><div>Nationality<b>{titleCase(id.nationality)}</b></div>
        <div>Language<b>{id.language}</b></div><div>Diagnostic<b>{pathwayLabel(id.pathway)}</b></div>{M.assignment ? <div>Nurse<b>{M.assignment.nurse_name}</b></div> : null}
      </div>
      {mode !== '360' && call && call.st !== 'idle' ? <div className={'oncall' + (ended ? ' ended' : '')} role="status"><span className="st"><i />{live ? 'On call · recording' : 'Call ended · recorded'}</span><span className="tm" id="tm">{fmtT(secs || 0)}</span><span className="sp" />
        {live ? <button className="btn btn-dng" onClick={onEnd} disabled={busy}><Icon name="hang" /> End call</button> : <button className="btn btn-sec" onClick={onCall} disabled={busy || blocked}><Icon name="phone" /> Call again</button>}</div> : null}
      {children}
    </div>
    <div className="side">
      <div className="riskhd"><Ring v={r.total_risk_score} colour={al.alert_colour} size={64} /><span className="lbl" style={{ color: col }}>{r.tier_label ? `${r.tier_label} risk` : '—'}<small>R {r.total_risk_score} / 23 · Tier {r.tier}</small></span></div>
      <div className="row" style={{ justifyContent: 'flex-end' }}><AlertTag colour={al.alert_colour} priority={al.contact_priority} />{al.contact_priority ? <span className="small muted">{PRIORITY_TEXT[al.contact_priority]}</span> : null}</div>
      <div className="acts">{mode === '360'
        ? <button className="btn btn-pri" onClick={() => nav(`/member/${id.member_id}`)}><Icon name="phone" /> Open Call Workflow</button>
        : <><button className="btn btn-sec" onClick={() => nav(`/member/${id.member_id}/360`)}>Member 360</button>
          {call && call.st === 'idle' ? <button className="btn btn-pri" onClick={onCall} disabled={busy || blocked}><Icon name="phone" /> Call {first(id.display_name)}</button> : null}</>}</div>
      {mode !== '360' && call && call.st === 'idle' && !blocked ? <button className="link u" style={{ alignSelf: 'flex-end' }} onClick={onNoAnswer} disabled={busy} title="The member did not pick up: applies the retry rule (3 attempts, P1 escalates)">No answer? Log a missed call</button> : null}
    </div>
  </section>;
}
