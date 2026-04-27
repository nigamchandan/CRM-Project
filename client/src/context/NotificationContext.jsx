import { createContext, useContext, useEffect, useState, useCallback } from 'react';
import toast from 'react-hot-toast';
import * as notifService from '../services/notificationsService';
import { getSocket } from '../services/socket';
import { useAuth } from './AuthContext.jsx';

const NotificationContext = createContext(null);

export function NotificationProvider({ children }) {
  const { user } = useAuth();
  const [items, setItems] = useState([]);
  const [unreadCount, setUnreadCount] = useState(0);

  const refresh = useCallback(async () => {
    if (!user) return;
    const { data, unreadCount } = await notifService.list();
    setItems(data);
    setUnreadCount(unreadCount);
  }, [user]);

  useEffect(() => { refresh(); }, [refresh]);

  useEffect(() => {
    if (!user) return;
    const socket = getSocket();
    if (!socket) return;
    const onNew = (n) => {
      toast.success(n.title);
      setItems(prev => [n, ...prev]);
      setUnreadCount(c => c + 1);
    };
    socket.on('notification:new', onNew);
    return () => socket.off('notification:new', onNew);
  }, [user]);

  const markRead = async (id) => {
    await notifService.markRead(id);
    setItems(prev => prev.map(n => (n.id === id ? { ...n, is_read: true } : n)));
    setUnreadCount(c => Math.max(0, c - 1));
  };

  const markAllRead = async () => {
    await notifService.markAllRead();
    setItems(prev => prev.map(n => ({ ...n, is_read: true })));
    setUnreadCount(0);
  };

  return (
    <NotificationContext.Provider value={{ items, unreadCount, refresh, markRead, markAllRead }}>
      {children}
    </NotificationContext.Provider>
  );
}

export const useNotifications = () => useContext(NotificationContext);
