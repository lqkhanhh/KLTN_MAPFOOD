import { createContext, useContext, useEffect, useState } from 'react';
import { Manager } from 'socket.io-client';
import { API_BASE, TOKEN_KEY } from '../api';
import { useAuth } from './AuthContext';

const SocketContext = createContext({});
export function SocketProvider({ children }) {
  const { currentUser } = useAuth();
  const [revision, setRevision] = useState(0);
  const [connections, setConnections] = useState({});
  const token = currentUser ? localStorage.getItem(TOKEN_KEY) : null;
  useEffect(() => {
    const changed = () => setRevision((value) => value + 1);
    window.addEventListener('routebite:session-changed', changed);
    window.addEventListener('storage', changed);
    return () => { window.removeEventListener('routebite:session-changed', changed); window.removeEventListener('storage', changed); };
  }, []);
  useEffect(() => {
    if (!token) { setConnections({}); return; }
    // Hai namespace dùng chung một Manager/transport; không tạo kết nối mới theo trang.
    const manager = new Manager(new URL(API_BASE).origin, { autoConnect: false });
    const orders = manager.socket('/orders', { auth: { token } });
    const notifications = manager.socket('/notifications', { auth: { token } });
    setConnections({ orders, notifications, token });
    orders.connect(); notifications.connect();
    return () => { orders.disconnect(); notifications.disconnect(); };
  }, [token, revision]);
  return <SocketContext.Provider value={connections.token === token ? connections : {}}>{children}</SocketContext.Provider>;
}
export function useSockets() { return useContext(SocketContext); }
