import React, { createContext, useCallback, useContext, useRef, useState } from 'react';
const Ctx = createContext(() => {});
export function ToastProvider({ children }) {
  const [msg, setMsg] = useState(null); const t = useRef(null);
  const say = useCallback(text => { setMsg(text); clearTimeout(t.current); t.current = setTimeout(() => setMsg(null), 4200); }, []);
  return <Ctx.Provider value={say}>{children}{msg && <div className="toast" role="status"><span className="dot">●</span>{msg}</div>}</Ctx.Provider>;
}
export const useToast = () => useContext(Ctx);
