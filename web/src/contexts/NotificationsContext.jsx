import { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react';
import { request, TOKEN_KEY } from '../api';
import { useAuth } from './AuthContext';
import { useSockets } from './SocketContext';

const NotificationsContext = createContext(null);
const empty = { notifications: [], unreadCount: 0, loading: false, error: '' };
export function NotificationsProvider({ children }) {
  const { currentUser } = useAuth();
  const { notifications: socket } = useSockets();
  const token = currentUser ? localStorage.getItem(TOKEN_KEY) : null;
  const [state, setState] = useState(empty);
  const generation = useRef(0);
  const sequence = useRef(0);
  const refreshRef = useRef(() => Promise.resolve());

  useEffect(() => {
    const session = ++generation.current;
    const isCurrent = () => generation.current === session;
    setState({ ...empty, token, loading: !!token });
    const refresh = async () => {
      if (!token) return;
      const version = ++sequence.current;
      try {
        const result = await request('/notifications');
        if (isCurrent() && version === sequence.current) setState({ token,
          notifications: result.notifications || [], unreadCount: Math.max(0, Number(result.unreadCount) || 0), loading: false, error: '' });
      } catch {
        if (isCurrent() && version === sequence.current) setState((old) => ({ ...old, loading: false, error: 'Không thể tải thông báo. Vui lòng thử lại.' }));
      }
    };
    refreshRef.current = refresh;
    const receive = (notification) => {
      if (!isCurrent() || !notification?.id) return;
      setState((old) => old.notifications.some((entry) => entry.id === notification.id) ? old : {
        ...old, notifications: [notification, ...old.notifications].slice(0, 50), unreadCount: old.unreadCount + (notification.isRead ? 0 : 1),
      });
      void refresh();
    };
    void refresh();
    socket?.on('connect', refresh);
    socket?.on('notification.new', receive);
    socket?.on('notification.read', refresh);
    // Nạp bù thông báo khi nối lại/mở tab; poll dự phòng không tạo thêm socket.
    const visible = () => { if (document.visibilityState === 'visible') void refresh(); };
    document.addEventListener('visibilitychange', visible);
    const timer = token ? setInterval(refresh, 30000) : undefined;
    return () => {
      ++generation.current;
      clearInterval(timer);
      socket?.off('connect', refresh); socket?.off('notification.new', receive); socket?.off('notification.read', refresh);
      document.removeEventListener('visibilitychange', visible);
    };
  }, [token, socket]);

  const refresh = useCallback(() => refreshRef.current(), []);
  async function markRead(notification) {
    if (!notification.isRead) await request(`/notifications/${notification.id}/read`, { method: 'PATCH' });
    await refresh();
  }
  async function markAll() {
    await request('/notifications/read-all', { method: 'PATCH' });
    await refresh();
  }
  return <NotificationsContext.Provider value={{ ...(state.token === token ? state : empty), refresh, markRead, markAll }}>{children}</NotificationsContext.Provider>;
}
export function useNotifications() { return useContext(NotificationsContext); }
