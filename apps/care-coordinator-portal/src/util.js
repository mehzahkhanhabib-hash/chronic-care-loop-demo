/** Formatting and rulebook display helpers (no clinical logic lives here: colours, tiers and priorities come from the API). */
export const ALERT_CLS = { RED: 'crit', AMBER: 'high', YELLOW: 'mod', GREEN: 'ok' };
export const ALERT_TEXT = { RED: 'Same-day clinician · script stops', AMBER: 'Clinician review within 72 h', YELLOW: 'Next touchpoint', GREEN: 'Routine cadence' };
export const CLASS_LABEL = { safety: 'Safety', acute: 'Acute event', unctl: 'Uncontrolled', barrier: 'Barrier', gap: 'Verified gap', goal: 'Patient goal' };
export const CLASS_CLS = { safety: 'crit', acute: 'crit', unctl: 'high', barrier: 'mod', gap: 'info', goal: 'ok' };
export const GAP_STATES = ['Potential', 'Verified', 'Scheduled', 'Reported', 'Closed'];
export const TIER_CLS = { 4: 'crit', 3: 'high', 2: 'mod', 1: 'ok' };
export const KIND_LABEL = { nba: 'Care plan', call: 'Call', follow_up: 'Follow-up', retry: 'Retry', escalation: 'Escalation', nudge: 'Digital nudge', booking: 'Booking', verify: 'Verify' };
export const KIND_CLS = { nba: 'k-nba', call: 'k-callback', follow_up: 'k-checkin', retry: 'k-retry', escalation: 'k-retry', nudge: 'k-callback', booking: 'k-agreed', verify: 'k-checkin' };
export const PRIORITY_TEXT = { P1: 'Same day', P2: 'Next working day', P3: 'Within 3 working days', P4: 'Digital nudge' };

export const initials = n => (n || '?').split(/\s+/).map(x => x[0]).join('').slice(0, 2).toUpperCase();
export const first = n => (n || '').split(' ')[0];
export const esc = v => (v === null || v === undefined ? '' : String(v));
export const num = (v, d = 0) => (v === null || v === undefined || v === '' ? '—' : Number(v).toLocaleString('en-GB', { maximumFractionDigits: d, minimumFractionDigits: 0 }));
export const money = v => (v === null || v === undefined ? '—' : 'AED ' + Math.round(Number(v)).toLocaleString('en-GB'));
export const moneyK = v => (v === null || v === undefined ? '—' : 'AED ' + (Number(v) >= 1000 ? (Number(v) / 1000).toFixed(1) + 'k' : Math.round(Number(v))));
export const fmtDay = iso => { if (!iso) return '—'; const d = new Date(iso.slice(0, 10) + 'T00:00:00'); return isNaN(d) ? iso : d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' }); };
export const fmtDT = ts => (ts ? ts.replace('T', ' ').slice(0, 16) : '—');
export const relDay = (iso, today) => { if (!iso) return '—'; const d = Math.round((Date.parse(iso.slice(0, 10)) - Date.parse(today)) / 86400000); if (isNaN(d)) return iso; return d === 0 ? 'Today' : d === 1 ? 'Tomorrow' : d === -1 ? 'Yesterday' : d > 1 ? `In ${d} days` : `${-d} days overdue`; };
export const pathwayLabel = p => (p === 'T2D·HTN' ? 'DM + HTN' : p === 'T2D' ? 'Diabetes' : p === 'HTN' ? 'Hypertension' : p || '—');
export const titleCase = s => (s || '').toLowerCase().replace(/(^|\s)\S/g, c => c.toUpperCase());
export const classCls = c => CLASS_CLS[c] || 'line';
export const labFlag = (code, v) => { // only for colouring against commonly used targets shown on the card; the value itself is from raw claims
  if (v === null || v === undefined) return '';
  if (code === '4548-4' || code === '17856-6') return v >= 8 ? 'crit' : v >= 7 ? 'high' : 'ok';
  if (code === '8480-6') return v >= 160 ? 'crit' : v >= 140 ? 'high' : 'ok';
  if (code === '8462-4') return v >= 100 ? 'crit' : v >= 90 ? 'high' : 'ok';
  if (['33914-3', '62238-1', '69405-9', '48642-3', '48643-1'].includes(code)) return v < 30 ? 'crit' : v < 60 ? 'high' : 'ok';
  return '';
};
