import React from 'react';

export function Loading({ what = 'Loading' }) { return <div className="state"><span className="spin" />{what}…</div>; }
export function ErrorBox({ error, retry, what }) {
  if (!error) return null;
  const msg = error.status === 404 ? 'Not found' : (error.message || String(error));
  return <div className="state err"><b>Could not load{what ? ' ' + what : ''}.</b><span>{msg}{error.status ? ` (HTTP ${error.status})` : ''}</span>{retry && <button className="btn ghost sm" onClick={retry}>Retry</button>}</div>;
}
export function Empty({ children }) { return <div className="state">{children}</div>; }
export function Chip({ kind, children, title }) { return <span className={'chip ' + (kind || '')} title={title}>{children}</span>; }
export function Avatar({ text, size = 'md', soft }) { return <span className={`avatar ${size}${soft ? ' soft' : ''}`}>{text}</span>; }
export function Bar({ value, max, thin, dark, color }) {
  const w = max ? Math.max(0, Math.min(100, 100 * (value || 0) / max)) : 0;
  return <span className={`bar${thin ? ' thin' : ''}${dark ? ' dark' : ''}`} style={{ display: 'block' }}><span style={{ width: w + '%', background: color }} /></span>;
}
export function Card({ children, dark, tight, style, className }) { return <section className={`card${dark ? ' dark' : ''}${tight ? ' tight' : ''}${className ? ' ' + className : ''}`} style={style}>{children}</section>; }
export function Section({ title, aside, children, style }) {
  return <Card style={style}>{(title || aside) && <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 10, flexWrap: 'wrap', marginBottom: 12 }}><span className="sect-t">{title}</span>{aside && <span className="sm mut">{aside}</span>}</div>}{children}</Card>;
}
export function KV({ items }) { return <dl className="kv" style={{ margin: 0 }}>{items.filter(([, v]) => v !== undefined).map(([k, v]) => <React.Fragment key={k}><dt>{k}</dt><dd>{v ?? '—'}</dd></React.Fragment>)}</dl>; }
