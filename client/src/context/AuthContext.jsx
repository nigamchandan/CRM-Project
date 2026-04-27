import { createContext, useContext, useEffect, useState } from 'react';
import * as authService from '../services/authService';
import { connectSocket, disconnectSocket } from '../services/socket';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const token = localStorage.getItem('token');
    if (!token) { setLoading(false); return; }
    authService.me()
      .then((u) => { setUser(u); connectSocket(token); })
      .catch(() => localStorage.removeItem('token'))
      .finally(() => setLoading(false));
  }, []);

  const login = async (creds) => {
    const { user, token } = await authService.login(creds);
    localStorage.setItem('token', token);
    setUser(user);
    connectSocket(token);
    return user;
  };

  const register = async (data) => {
    const { user, token } = await authService.register(data);
    localStorage.setItem('token', token);
    setUser(user);
    connectSocket(token);
    return user;
  };

  const logout = async () => {
    try { await authService.logout(); } catch {}
    localStorage.removeItem('token');
    setUser(null);
    disconnectSocket();
  };

  /** Re-fetch /auth/me and replace the cached user (after a profile edit). */
  const refresh = async () => {
    try {
      const fresh = await authService.me();
      setUser(fresh);
      return fresh;
    } catch { /* token may have expired — leave existing state */ }
  };

  return (
    <AuthContext.Provider value={{ user, loading, login, register, logout, setUser, refresh }}>
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => useContext(AuthContext);
