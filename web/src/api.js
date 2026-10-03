const config = window.ROUTEBITE_CONFIG || {};
export const API_BASE = config.apiBase || 'http://127.0.0.1:3000/api';
export const TOKEN_KEY = 'routebite_access_token';
const REFRESH_TOKEN_KEY = 'routebite_refresh_token';
let refreshing = null;
function clearSession() {
  localStorage.removeItem(TOKEN_KEY); localStorage.removeItem(REFRESH_TOKEN_KEY); localStorage.removeItem('routebite_user');
  window.dispatchEvent(new Event('routebite:session-changed'));
}
export async function request(path, options = {}) {
  const { method = 'GET', body, token = localStorage.getItem(TOKEN_KEY), authorized = true, retried = false, responseType = 'json' } = options;
  const multipart = body instanceof FormData;
  const response = await fetch(`${API_BASE}${path}`, { method, headers: { ...(body && !multipart ? { 'Content-Type': 'application/json' } : {}), ...(authorized && token ? { Authorization: `Bearer ${token}` } : {}) }, body: body ? multipart ? body : JSON.stringify(body) : undefined });
  const data = response.ok && responseType === 'blob' ? await response.blob() : await response.json().catch(() => null);
  if (response.status === 401 && authorized && !retried && path !== '/auth/refresh') {
    const refreshToken = localStorage.getItem(REFRESH_TOKEN_KEY);
    if (refreshToken) {
      try {
        if (!refreshing) refreshing = request('/auth/refresh', { method: 'POST', body: { refreshToken }, authorized: false, retried: true }).finally(() => { refreshing = null; });
        const refresh = await refreshing;
        if (localStorage.getItem(REFRESH_TOKEN_KEY) !== refreshToken && localStorage.getItem(REFRESH_TOKEN_KEY) !== refresh.refreshToken) throw Object.assign(new Error('Phiên đăng nhập đã thay đổi.'), { status: 401 });
        localStorage.setItem(TOKEN_KEY, refresh.accessToken);
        if (refresh.refreshToken) localStorage.setItem(REFRESH_TOKEN_KEY, refresh.refreshToken);
        if (refresh.user) localStorage.setItem('routebite_user', JSON.stringify(refresh.user));
        window.dispatchEvent(new Event('routebite:session-changed'));
        return request(path, { ...options, token: refresh.accessToken, retried: true });
      } catch (error) {
        if (error.status === 401 && localStorage.getItem(REFRESH_TOKEN_KEY) === refreshToken) clearSession();
        throw error;
      }
    } else if (token === localStorage.getItem(TOKEN_KEY)) {
      clearSession();
    }
  }
  if (!response.ok) throw Object.assign(new Error(data?.message || `Request failed (${response.status})`), { status: response.status });
  return data;
}
