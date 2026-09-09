import { createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from 'react';
import { request } from '../api';
import { useAuth } from './AuthContext';
import { useSockets } from './SocketContext';
export interface Conversation { orderId: string; orderCode: string; restaurantName: string; customerName: string; unreadCount: number; lastMessage: { content: string; createdAt: string; senderId: string } }
const empty = { conversations: [] as Conversation[], loading: false, error: '' };
const ChatInboxContext = createContext({ ...empty, totalUnread: 0, refresh: async () => {} });
export function ChatInboxProvider({ children }: { children: ReactNode }) {
  const { currentUser } = useAuth(); const { chat: socket } = useSockets();
  const enabled = ['customer', 'merchant'].includes(currentUser?.role), userId = enabled ? currentUser.id : null;
  const [state, setState] = useState({ ...empty, userId });
  const refreshRef = useRef(async () => {});
  useEffect(() => {
    let active = true, sequence = 0;
    setState({ ...empty, userId, loading: !!userId });
    const refresh = async () => {
      if (!userId) return;
      const version = ++sequence;
      try {
        const rows = await request('/messages/conversations');
        if (!Array.isArray(rows)) throw new Error();
        if (active && version === sequence) setState({ userId, conversations: rows, loading: false, error: '' });
      } catch (error) { if (active && version === sequence) setState((old) => ({ ...old, conversations: [401, 403].includes(error.status) ? [] : old.conversations, loading: false, error: 'Không tải được hộp thư. Vui lòng thử lại.' })); }
    };
    refreshRef.current = refresh;
    const join = () => { socket?.emit('join-all-my-conversations', {}, () => { if (active) void refresh(); }); void refresh(); };
    void refresh(); if (socket?.connected && userId) join();
    socket?.on('connect', join); socket?.on('message.new', refresh); socket?.on('messages.read', refresh);
    const visible = () => { if (document.visibilityState === 'visible') void refresh(); };
    document.addEventListener('visibilitychange', visible);
    const timer = userId ? setInterval(refresh, 15000) : undefined;
    return () => { active = false; clearInterval(timer); document.removeEventListener('visibilitychange', visible);
      socket?.off('connect', join); socket?.off('message.new', refresh); socket?.off('messages.read', refresh); };
  }, [userId, socket]);
  const refresh = useCallback(async () => { await refreshRef.current(); }, []);
  const current = state.userId === userId ? state : empty;
  return <ChatInboxContext.Provider value={{ ...current, totalUnread: current.conversations.reduce((sum, row) => sum + Math.max(0, Number(row.unreadCount) || 0), 0), refresh }}>{children}</ChatInboxContext.Provider>;
}
export function useChatInbox() { return useContext(ChatInboxContext); }
