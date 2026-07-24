import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { api } from '../api/client';
import { supabase } from '../supabaseClient';

const AuthContext = createContext(null);

const NO_PERMISSIONS = {
  manageUsers: false,
  manageDevelopments: false,
  manageTasks: false,
  viewAllTasks: false,
  validateTasks: false,
};

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    try {
      const {
        data: { session },
      } = await supabase.auth.getSession();
      if (!session) {
        setUser(null);
        return;
      }
      const data = await api.get('/auth/me');
      setUser(data.user);
    } catch {
      setUser(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    refresh();

    const { data: subscription } = supabase.auth.onAuthStateChange(() => {
      refresh();
    });

    return () => subscription.subscription.unsubscribe();
  }, [refresh]);

  const login = useCallback(async (email, password) => {
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) throw new Error(error.message);
    const data = await api.get('/auth/me');
    setUser(data.user);
    return data.user;
  }, []);

  const logout = useCallback(async () => {
    await supabase.auth.signOut();
    setUser(null);
  }, []);

  const permissions = user?.permissions || NO_PERMISSIONS;

  const value = useMemo(
    () => ({
      user,
      setUser,
      loading,
      login,
      logout,
      refresh,
      permissions,
      can: (permission) => !!permissions[permission],
    }),
    [user, loading, login, logout, refresh, permissions]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}
