import { useCallback, useEffect, useRef, useState } from 'react';
import api from '../api';

/** useApi('/intelligence/kpis') → { data, loading, error, reload }. Pass null to skip. */
export function useApi(path, deps = []) {
  const [state, set] = useState({ data: null, loading: !!path, error: null });
  const tick = useRef(0);
  const load = useCallback(() => {
    if (!path) { set({ data: null, loading: false, error: null }); return; }
    const my = ++tick.current;
    set(s => ({ ...s, loading: true, error: null }));
    api.get(path).then(d => { if (my === tick.current) set({ data: d, loading: false, error: null }); })
      .catch(e => { if (my === tick.current) set({ data: null, loading: false, error: e }); });
  }, [path, ...deps]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => { load(); }, [load]);
  return { ...state, reload: load };
}

/** Debounced POST: value → result (used for live cohort estimates). */
export function useDebouncedPost(path, body, ms = 300) {
  const [state, set] = useState({ data: null, loading: true, error: null });
  const key = JSON.stringify(body);
  useEffect(() => {
    let dead = false;
    set(s => ({ ...s, loading: true }));
    const t = setTimeout(() => {
      api.post(path, body).then(d => { if (!dead) set({ data: d, loading: false, error: null }); }).catch(e => { if (!dead) set(s => ({ data: s.data, loading: false, error: e })); });
    }, ms);
    return () => { dead = true; clearTimeout(t); };
  }, [path, key, ms]); // eslint-disable-line react-hooks/exhaustive-deps
  return state;
}
