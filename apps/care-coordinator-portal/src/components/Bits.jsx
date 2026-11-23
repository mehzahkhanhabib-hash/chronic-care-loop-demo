import React from 'react';
import { ALERT_CLS, PRIORITY_TEXT, TIER_CLS, initials } from '../util.js';
import Icon from '../icons.jsx';

export const Loading = ({ what = 'Loading' }) => <div className="empty" role="status"><span className="pulse-dot" /> {what}…</div>;
export const ErrorBox = ({ error, retry }) => <div className="empty err-box" role="alert"><b>Could not load.</b> {error && (error.message || String(error))}{retry ? <div style={{ marginTop: 10 }}><button className="btn sm" onClick={retry}>Try again</button></div> : null}</div>;
export const Empty = ({ children }) => <div className="empty">{children}</div>;
export const AlertPill = ({ colour, priority }) => colour ? <span className={'pill ' + (ALERT_CLS[colour] || 'line')} title={PRIORITY_TEXT[priority] || ''}>{colour}{priority ? ' · ' + priority : ''}</span> : null;
export const PrioPill = ({ p }) => p ? <span className={'prio' + (p === 'P1' ? ' hi' : '')} title={PRIORITY_TEXT[p]}>{p} · {PRIORITY_TEXT[p]}</span> : null;
export const TierPill = ({ tier, label }) => tier ? <span className={'pill ' + (TIER_CLS[tier] || 'line')}>Tier {tier} · {label}</span> : null;
export const RiskTag = ({ r, tier }) => <span className={'risk ' + (TIER_CLS[tier] || 'ok')} title="Rulebook risk score R = C + M + K + U + A (max 23)">R {r} / 23</span>;
export const ConsentPill = ({ status }) => <span className={'pill ' + (status === 'granted' ? 'ok' : status === 'declined' || status === 'withdrawn' ? 'crit' : 'acc')}>{status === 'granted' ? 'Consent granted' : status === 'declined' ? 'Consent declined' : status === 'withdrawn' ? 'Consent withdrawn' : 'Consent needed'}</span>;
export const Source = ({ kind }) => <span className={'src ' + ({ raw_claims: 'A', longitudinal: 'B', rulebook: 'C', engine: 'C', operational: 'X' }[kind] || 'A')} title={{ raw_claims: 'Raw claims workbook → claims.sqlite', longitudinal: '250-member longitudinal extract', rulebook: 'CCC Rulebook rule tables', engine: 'Care intelligence engine output', operational: 'Recorded in this portal' }[kind]}>{{ raw_claims: 'Raw claims', longitudinal: 'Longitudinal', rulebook: 'Rulebook', engine: 'Engine', operational: 'Portal' }[kind] || kind}</span>;
export const Ini = ({ name, cls = '' }) => <span className={'ini ' + cls}>{initials(name)}</span>;
export const Lock = ({ what, declined }) => <section className="card lockc" data-screen-label="Locked"><div className="lk-i"><Icon name="lock" /></div><div><b>{what || 'Locked'}</b><small>{declined ? 'Consent declined · no access' : 'Unlocks when consent is logged on a recorded call'}</small></div></section>;
export function Spark({ series, w = 120, h = 30, color = 'var(--accent)', target }) {
  if (!series || series.length < 2) return null;
  const vals = series.concat(target != null ? [target] : []); const mn = Math.min(...vals), mx = Math.max(...vals), rg = mx - mn || 1;
  const pt = (v, i) => `${(i / (series.length - 1)) * (w - 4) + 2},${h - 2 - ((v - mn) / rg) * (h - 4)}`;
  return <svg className="spark" width={w} height={h} viewBox={`0 0 ${w} ${h}`} aria-hidden="true">{target != null ? <line x1="0" x2={w} y1={h - 2 - ((target - mn) / rg) * (h - 4)} y2={h - 2 - ((target - mn) / rg) * (h - 4)} stroke="var(--line)" strokeDasharray="3 3" /> : null}<polyline fill="none" stroke={color} strokeWidth="1.8" points={series.map(pt).join(' ')} /><circle cx={pt(series[series.length - 1], series.length - 1).split(',')[0]} cy={pt(series[series.length - 1], series.length - 1).split(',')[1]} r="2.5" fill={color} /></svg>;
}
export const Tile = ({ n, label, cls = '' }) => <div className={'tile ' + cls}><b>{n}</b><span>{label}</span></div>;
export const Bar = ({ label, v, max, color }) => <div className="frow"><span>{label}</span><span className="hbar"><i style={{ width: (max ? Math.min(100, v / max * 100) : 0) + '%', background: color || 'var(--accent)' }} /></span><span className="v">{v}</span></div>;
