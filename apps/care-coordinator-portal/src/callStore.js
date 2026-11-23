/** Per-member call state that survives tab and route changes (the call keeps recording while the nurse looks at Care Gaps or Member 360). */
import { useSyncExternalStore, useCallback } from 'react';
const S = new Map(); const subs = new Set();
const blank = () => ({ st: 'idle', call_id: null, startedAt: 0, secs: 0, saved: false, resp: '', notes: '', cbDate: '', redFlag: false, consentAt: '', consentSecs: 0 });
const get = id => { if (!S.has(id)) S.set(id, blank()); return S.get(id); };
export function setCallState(id, patch) { S.set(id, { ...get(id), ...(typeof patch === 'function' ? patch(get(id)) : patch) }); subs.forEach(f => f()); }
export const liveSecs = c => (c.st === 'live' ? Math.floor((Date.now() - c.startedAt) / 1000) : c.secs);
export function useCall(id) {
  const c = useSyncExternalStore(cb => { subs.add(cb); return () => subs.delete(cb); }, () => get(id));
  const set = useCallback(p => setCallState(id, p), [id]);
  return [c, set];
}
export const anyLive = () => [...S.entries()].filter(([, c]) => c.st === 'live').map(([id]) => id);
