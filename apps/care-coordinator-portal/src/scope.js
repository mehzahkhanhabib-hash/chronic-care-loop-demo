import { useEffect, useState } from 'react';
import { useApi } from './hooks.js';

/** The Studio scope (cohort / campaign handed off from the cohort builder, GET /api/studio/scope).
 *  When it is set, the queue shows those members across every nurse's list; the nurse can switch back to "my list". */
const KEY = 'ccl.portal.scopeOff';
export function useScopedWorklist(user) {
  const sc = useApi('/studio/scope');
  const scope = sc.data ? sc.data.scope : null;
  const sig = scope ? `${scope.kind}:${scope.id}:${scope.set_at}` : '';
  const [off, setOffState] = useState(() => { try { return localStorage.getItem(KEY) || ''; } catch (e) { return ''; } });
  const on = !!scope && off !== sig;
  const setOn = v => { const x = v ? '' : sig; setOffState(x); try { localStorage.setItem(KEY, x); } catch (e) { /* ignore */ } };
  useEffect(() => { const f = () => sc.reload(); window.addEventListener('focus', f); return () => window.removeEventListener('focus', f); }, []); // eslint-disable-line
  const url = sc.loading && !sc.data ? null : on ? '/portal/worklist?scope=active' : `/portal/worklist?nurse_id=${user.user_id}`;
  const wl = useApi(url);
  return { wl, scope, scoped: on, setScoped: setOn };
}

/** Same scope switch as the queue, for pages that list tasks: returns the query string to add (scope=active) when the cohort view is on. */
export function useScopeSwitch() {
  const sc = useApi('/studio/scope');
  const scope = sc.data ? sc.data.scope : null;
  const sig = scope ? `${scope.kind}:${scope.id}:${scope.set_at}` : '';
  const [off, setOffState] = useState(() => { try { return localStorage.getItem(KEY) || ''; } catch (e) { return ''; } });
  const on = !!scope && off !== sig;
  const setOn = v => { const x = v ? '' : sig; setOffState(x); try { localStorage.setItem(KEY, x); } catch (e) { /* ignore */ } };
  return { ready: !(sc.loading && !sc.data), scope, scoped: on, setScoped: setOn };
}
