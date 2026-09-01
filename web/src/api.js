const config = window.ROUTEBITE_CONFIG || {};
export const API_BASE = config.apiBase || 'http://127.0.0.1:3000/api';
export const GOOGLE_CLIENT_ID = config.googleClientId || '';
export const TOKEN_KEY = 'routebite_access_token';
export async function request(path, options = {}) {
  const { method = 'GET', body, token = localStorage.getItem(TOKEN_KEY), authorized = true } = options;
  const response = await fetch(`${API_BASE}${path}`, { method, headers: { ...(body ? { 'Content-Type': 'application/json' } : {}), ...(authorized && token ? { Authorization: `Bearer ${token}` } : {}) }, body: body ? JSON.stringify(body) : undefined });
  const data = await response.json().catch(() => null);
  if (!response.ok) throw new Error(data?.message || `Request failed (${response.status})`);
  return data;
}
