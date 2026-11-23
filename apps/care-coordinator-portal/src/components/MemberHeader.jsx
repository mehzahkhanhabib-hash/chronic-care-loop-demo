import React from 'react';
import { useNavigate } from 'react-router-dom';
import { Ini, AlertPill, TierPill, RiskTag, ConsentPill } from './Bits.jsx';
import { pathwayLabel } from '../util.js';

/** Member header card: identity from the longitudinal extract (pseudonym + mask id), risk/alert from the engine, consent from the portal. */
export default function MemberHeader({ m, consent, children, compact }) {
  const nav = useNavigate(); if (!m) return null;
  const id = m.identity || {}, r = m.risk || {}, al = r.alert || {};
  return <section className="card mh" data-screen-label="Member header" id="mhead">
    <div className="r1"><Ini name={id.display_name} />
      <div style={{ minWidth: 0 }}>
        <div className="nm"><b>{id.display_name}</b><span className="pill line mono" title="Masked member id (shared key of both products)">{id.member_id}</span><span className="pill info">{pathwayLabel(id.pathway)}</span>{r.tier ? <RiskTag r={r.total_risk_score} tier={r.tier} /> : null}<TierPill tier={r.tier} label={r.tier_label} /><AlertPill colour={al.alert_colour} priority={al.contact_priority} />{r.safety_flag ? <span className="pill crit">⚑ Priority clinical review</span> : null}<ConsentPill status={consent} /></div>
        <div className="meta">{id.age} · {id.gender === 'F' ? 'Female' : 'Male'} · speaks {id.language} · {id.nationality} · {id.policy_type} · pseudonym for masked <span className="mono">{id.mask_id}</span>{m.assignment ? ` · nurse ${m.assignment.nurse_name}` : ''}</div>
      </div>
      <div className="acts">{!compact ? <button className="btn" onClick={() => nav(`/member/${id.member_id}/360`)}>Member 360</button> : null}{children}</div>
    </div>
  </section>;
}
