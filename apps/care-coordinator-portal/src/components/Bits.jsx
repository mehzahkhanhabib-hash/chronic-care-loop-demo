import React from 'react';
import Icon from '../icons.jsx';
import { ALERT_COL, ALERT_TAG, PRIORITY_TEXT } from '../util.js';

export const Loading = ({ what = 'Loading' }) => <div className="empty" role="status"><span className="pulse-dot" /> {what}…</div>;
export const ErrorBox = ({ error, retry }) => <div className="empty err-box" role="alert"><b>Could not load.</b> {error && (error.message || String(error))}{retry ? <div style={{ marginTop: 10 }}><button className="btn btn-sec btn-sm" onClick={retry}>Try again</button></div> : null}</div>;
export const Empty = ({ children }) => <div className="empty">{children}</div>;
export const Tag = ({ cls = 't-neu', children, title, style }) => <span className={'tag ' + cls} title={title} style={style}>{children}</span>;
export const AlertTag = ({ colour, priority }) => (colour ? <Tag cls={ALERT_TAG[colour] || 't-neu'} title={PRIORITY_TEXT[priority] || ''}>{colour}{priority ? ' · ' + priority : ''}</Tag> : null);
export const ConsentTag = ({ status }) => <Tag cls={status === 'granted' ? 't-ok' : status === 'declined' || status === 'withdrawn' ? 't-crit' : 't-dash'}>{status === 'granted' ? 'Consent on file' : status === 'declined' ? 'Consent declined' : status === 'withdrawn' ? 'Consent withdrawn' : 'Consent needed'}</Tag>;
const SRC = { raw_claims: ['Raw claims', 'Raw claims workbook → claims.sqlite'], longitudinal: ['Longitudinal', '250-member longitudinal extract'], rulebook: ['Rulebook', 'CCC Rulebook rule tables'], engine: ['Care intelligence', 'Care intelligence engine output'], operational: ['Portal', 'Recorded in this portal'] };
export const Source = ({ kind }) => <span className="tag t-dash src" title={(SRC[kind] || [])[1]}>{(SRC[kind] || [kind])[0]}</span>;

/** Risk ring from the design. v/max fills the arc; the centre shows `text` (the rulebook score R, not a percentage). */
export function Ring({ v, max = 23, size = 40, colour, text, label }) {
  const col = ALERT_COL[colour] || colour || 'var(--risk-low)', sw = size > 50 ? 5 : 3.5, r = size / 2 - sw / 2 - 1, c = 2 * Math.PI * r, pct = Math.max(0, Math.min(1, (v || 0) / max));
  return <span className="ring" style={{ width: size, height: size }} aria-label={label || `Risk score ${v} of ${max}`} title={label || `Rulebook risk score R = ${v} of ${max}`}>
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}><circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="var(--border-default)" strokeWidth={sw} />
      <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke={col} strokeWidth={sw} strokeLinecap="round" strokeDasharray={`${c * pct} ${c}`} transform={`rotate(-90 ${size / 2} ${size / 2})`} /></svg>
    <span style={{ fontSize: size > 50 ? 16 : 12, color: col }}>{text === undefined ? v : text}</span></span>;
}
export const LockBox = ({ title, sub, children }) => <div className="lockbox"><span className="lk"><Icon name="lock" /></span><div><b>{title}</b><small>{sub || 'Unlocks when consent is logged on a recorded call'}</small></div><span style={{ flex: 1 }} />{children}</div>;
export function Spark({ series, w = 110, h = 26, color = 'var(--accent)' }) {
  if (!series || series.length < 2) return <span style={{ width: w }} />;
  const mn = Math.min(...series), mx = Math.max(...series), rg = mx - mn || 1;
  const pt = (v, i) => `${(i / (series.length - 1)) * (w - 4) + 2},${h - 2 - ((v - mn) / rg) * (h - 4)}`;
  const last = pt(series[series.length - 1], series.length - 1).split(',');
  return <svg className="spark" width={w} height={h} viewBox={`0 0 ${w} ${h}`} aria-hidden="true"><polyline fill="none" stroke={color} strokeWidth="1.6" points={series.map(pt).join(' ')} /><circle cx={last[0]} cy={last[1]} r="2.4" fill={color} /></svg>;
}
export const Tile = ({ n, label, cls = 'neu', k }) => <div className={(k ? 'ktile ' : '') + 'tile ' + cls}><b>{n}</b><span>{label}</span></div>;
/** r3 bar row from the design (label · bar · value). */
export const BarRow = ({ label, v, max, color, right, cols = '180px minmax(0,1fr) 90px' }) => <div className="r3" style={{ gridTemplateColumns: cols, fontSize: 13 }}><b>{label}</b><span className="bar"><i style={{ width: (max ? Math.min(100, (v || 0) / max * 100) : 0) + '%', background: color || 'var(--accent)' }} /></span><span style={{ textAlign: 'right' }}>{right === undefined ? v : right}</span></div>;
