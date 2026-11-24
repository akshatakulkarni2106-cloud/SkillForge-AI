import { createContext, useContext, useEffect, useState } from 'react';
import { api } from '../services/api';
const Ctx = createContext(null);
export const useAuth = () => useContext(Ctx);
export function AuthProvider({ children }) {
  const [user, setUser] = useState(null); const [loading, setLoading] = useState(!!localStorage.getItem('sf_token'));
  useEffect(() => { if (!loading) return;
    api('/user/profile').then(setUser).catch(() => localStorage.removeItem('sf_token')).finally(() => setLoading(false)); }, []);
  const authenticate = async (path, body) => { const { token, user } = await api(path, { method: 'POST', body });
    localStorage.setItem('sf_token', token); setUser(user); };
  const logout = () => {
    localStorage.removeItem('sf_token');
    setUser(null);
  };
  const updateUser = (updated) => setUser((prev) => (prev ? { ...prev, ...updated } : updated));
  const refreshUser = async () => {
    try {
      const fresh = await api('/user/profile');
      setUser(fresh);
      return fresh;
    } catch (err) {
      // Ignore refresh error
    }
  };

  return (
    <Ctx.Provider
      value={{
        user,
        setUser,
        updateUser,
        refreshUser,
        loading,
        login: (b) => authenticate('/auth/login', b),
        register: (b) => authenticate('/auth/register', b),
        logout,
      }}
    >
      {children}
    </Ctx.Provider>
  );
}

