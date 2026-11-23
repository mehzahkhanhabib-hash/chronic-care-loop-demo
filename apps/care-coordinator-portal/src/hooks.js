import { useCallback, useEffect, useRef, useState, createContext, useContext } from 'react';
import { api } from './api.js';

/** Fetch a JSON endpoint; re-fetches when `path` changes. Returns {data, loading, error, reload}. */
export function useApi(path, deps = []) {
  const [state, set] = useState({ data: null, loading: !!path, error: null });
  const seq = useRef(0);
  const load = useCallback(async (quiet) => {
    if (!path) { set({ data: null, loading: false, error: null }); return; }
    const my = ++seq.current;
    if (!quiet) set(s => ({ ...s, loading: true, error: null }));
    try { const data = await api.get(path); if (my === seq.current) set({ data, loading: false, error: null }); }
    catch (e) { if (my === seq.current) set({ data: null, loading: false, error: e }); }
  }, [path, ...deps]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => { load(); }, [load]);
  return { ...state, reload: () => load(true) };
}

export const UserCtx = createContext({ user: null, setUser: () => {} });
export const useUser = () => useContext(UserCtx);

export const ToastCtx = createContext(() => {});
export const useToast = () => useContext(ToastCtx);
