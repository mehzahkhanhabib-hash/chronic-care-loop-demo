/** Shared API client. In development webpack proxies /api → http://localhost:4000; in production the backend serves the app. */
const BASE = (typeof window !== 'undefined' && window.CCL_API_BASE) || (typeof process !== 'undefined' && process.env && process.env.CCL_API_BASE) || '/api';
let currentUser = null;
try { currentUser = JSON.parse(localStorage.getItem('ccl.user') || 'null'); } catch (e) { currentUser = null; }
export function setUser(u) { currentUser = u; try { if (u) localStorage.setItem('ccl.user', JSON.stringify(u)); else localStorage.removeItem('ccl.user'); } catch (e) { /* ignore */ } }
export function getUser() { return currentUser; }
export class ApiError extends Error { constructor(status, message, body) { super(message); this.status = status; this.body = body; } }
async function call(method, path, body) {
  const res = await fetch(BASE + path, { method, headers: { 'content-type': 'application/json', ...(currentUser ? { 'x-user': currentUser.user_id } : {}) }, body: body === undefined ? undefined : JSON.stringify(body) });
  const text = await res.text();
  let json = null; try { json = text ? JSON.parse(text) : null; } catch (e) { json = { error: text }; }
  if (!res.ok) throw new ApiError(res.status, (json && json.error) || res.statusText, json);
  return json;
}
export const api = {
  get: (path) => call('GET', path),
  post: (path, body) => call('POST', path, body || {}),
  patch: (path, body) => call('PATCH', path, body || {}),
};
export default api;
