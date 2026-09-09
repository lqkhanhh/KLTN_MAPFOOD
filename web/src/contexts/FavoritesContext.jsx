import { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { request, TOKEN_KEY } from '../api';
import { useAuth } from './AuthContext';

const FavoritesContext = createContext(null);
export function FavoritesProvider({ children }) {
  const { currentUser } = useAuth();
  // Đổi tài khoản sẽ bỏ toàn bộ trạng thái cũ, kể cả yêu cầu còn đang chờ.
  return <AccountFavorites key={currentUser?.id || 'guest'} user={currentUser}>{children}</AccountFavorites>;
}
function AccountFavorites({ user, children }) {
  const navigate = useNavigate();
  const [favorites, setFavorites] = useState([]);
  const [loading, setLoading] = useState(!!user);
  const [ready, setReady] = useState(!user);
  const [error, setError] = useState('');
  const [pending, setPending] = useState(new Set());
  const locks = useRef(new Set());
  const alive = useRef(true);
  const loadingRef = useRef(false);
  const reload = useCallback(async () => {
    if (!user || loadingRef.current || locks.current.size) return;
    loadingRef.current = true;
    setLoading(true); setError('');
    try {
      const rows = await request('/favorites');
      if (!Array.isArray(rows)) throw new Error();
      if (alive.current) { setFavorites(rows); setReady(true); }
    } catch {
      if (alive.current) setError('Không thể tải quán đã lưu. Vui lòng thử lại.');
    } finally {
      loadingRef.current = false;
      if (alive.current) setLoading(false);
    }
  }, [user?.id]);
  useEffect(() => { alive.current = true; reload(); return () => { alive.current = false; }; }, [reload]);

  async function toggle(restaurant) {
    if (!user || !localStorage.getItem(TOKEN_KEY)) { navigate('/login', { state: { from: '/my-favorites' } }); return; }
    if (!ready || loadingRef.current || locks.current.has(restaurant.id)) return;
    const saved = favorites.some((entry) => entry.id === restaurant.id);
    locks.current.add(restaurant.id); setPending(new Set(locks.current)); setError('');
    setFavorites((rows) => saved ? rows.filter((entry) => entry.id !== restaurant.id) : [restaurant, ...rows]);
    try {
      await request(`/favorites/${encodeURIComponent(restaurant.id)}`, { method: saved ? 'DELETE' : 'POST' });
    } catch {
      if (alive.current) {
        // Chỉ hoàn tác quán vừa lỗi, không ghi đè thao tác thành công ở quán khác.
        setFavorites((rows) => saved ? [restaurant, ...rows.filter((entry) => entry.id !== restaurant.id)] : rows.filter((entry) => entry.id !== restaurant.id));
        setError('Không thể cập nhật quán đã lưu. Thay đổi vừa rồi đã được hoàn tác.');
      }
    } finally {
      locks.current.delete(restaurant.id);
      if (alive.current) setPending(new Set(locks.current));
    }
  }
  return <FavoritesContext.Provider value={{ favorites, loading, ready, error, pending, reload, toggle }}>
    {error && <aside className="rb-favorites-feedback" role="alert">{error} <button type="button" disabled={loading || pending.size > 0} onClick={reload}>Thử lại</button></aside>}
    {children}
  </FavoritesContext.Provider>;
}
export function useFavorites() { return useContext(FavoritesContext); }
