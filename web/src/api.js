const config = window.ROUTEBITE_CONFIG || {};
export const API_BASE = config.apiBase || 'http://127.0.0.1:3000/api';
export const GOOGLE_CLIENT_ID = config.googleClientId || '';
export const TOKEN_KEY = 'routebite_access_token';
const REFRESH_TOKEN_KEY = 'routebite_refresh_token';
export async function request(path, options = {}) {
  const { method = 'GET', body, token = localStorage.getItem(TOKEN_KEY), authorized = true, retried = false } = options;
  const response = await fetch(`${API_BASE}${path}`, { method, headers: { ...(body ? { 'Content-Type': 'application/json' } : {}), ...(authorized && token ? { Authorization: `Bearer ${token}` } : {}) }, body: body ? JSON.stringify(body) : undefined });
  const data = await response.json().catch(() => null);
  if (response.status === 401 && authorized && !retried && path !== '/auth/refresh') {
    const refreshToken = localStorage.getItem(REFRESH_TOKEN_KEY);
    if (refreshToken) {
      try {
        const refresh = await request('/auth/refresh', { method: 'POST', body: { refreshToken }, authorized: false, retried: true });
        localStorage.setItem(TOKEN_KEY, refresh.accessToken);
        if (refresh.refreshToken) localStorage.setItem(REFRESH_TOKEN_KEY, refresh.refreshToken);
        if (refresh.user) localStorage.setItem('routebite_user', JSON.stringify(refresh.user));
        return request(path, { ...options, token: refresh.accessToken, retried: true });
      } catch { localStorage.removeItem(TOKEN_KEY); localStorage.removeItem(REFRESH_TOKEN_KEY); localStorage.removeItem('routebite_user'); }
    }
  }
  if (!response.ok) throw new Error(data?.message || `Request failed (${response.status})`);
  return data;
}
