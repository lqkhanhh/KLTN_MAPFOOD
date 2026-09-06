import { createContext, useContext, useMemo, useState } from 'react';
import { TOKEN_KEY } from '../api';

export const REFRESH_TOKEN_KEY = 'routebite_refresh_token';
export const USER_KEY = 'routebite_user';
const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [currentUser, setCurrentUserState] = useState(() => {
    try { return JSON.parse(localStorage.getItem(USER_KEY) || 'null'); } catch { return null; }
  });
  function setCurrentUser(user) { setCurrentUserState(user); if (user) localStorage.setItem(USER_KEY, JSON.stringify(user)); else localStorage.removeItem(USER_KEY); }
  function setSession(response) { localStorage.setItem(TOKEN_KEY, response.accessToken); if (response.refreshToken) localStorage.setItem(REFRESH_TOKEN_KEY, response.refreshToken); setCurrentUser(response.user); }
  function logout() { localStorage.removeItem(TOKEN_KEY); localStorage.removeItem(REFRESH_TOKEN_KEY); setCurrentUser(null); }
  const value = useMemo(() => ({ currentUser, setCurrentUser, setSession, logout }), [currentUser]);
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() { const context = useContext(AuthContext); if (!context) throw new Error('useAuth phải được dùng bên trong AuthProvider'); return context; }
