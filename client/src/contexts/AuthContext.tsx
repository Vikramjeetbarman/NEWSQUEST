import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { api } from '../lib/api';
import type { User } from '../lib/types';

interface AuthApi {
  user: User | null;
  loading: boolean;
  refresh: () => Promise<User | null>;
  ensureUser: () => Promise<User>;
  login: (u: string, p: string) => Promise<void>;
  register: (u: string, p: string, displayName?: string) => Promise<void>;
  logout: () => Promise<void>;
  setUser: (u: User | null) => void;
}

const Ctx = createContext<AuthApi | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    try {
      const { user } = await api.me();
      setUser(user);
      return user;
    } catch {
      return null;
    }
  }, []);

  useEffect(() => {
    refresh().finally(() => setLoading(false));
  }, [refresh]);

  const value = useMemo<AuthApi>(
    () => ({
      user,
      loading,
      refresh,
      setUser,
      ensureUser: async () => {
        if (user) return user;
        const { user: u } = await api.guest();
        setUser(u);
        return u;
      },
      login: async (u, p) => setUser((await api.login(u, p)).user),
      register: async (u, p, d) => setUser((await api.register(u, p, d)).user),
      logout: async () => {
        await api.logout();
        setUser(null);
      },
    }),
    [user, loading, refresh],
  );

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useAuth() {
  const c = useContext(Ctx);
  if (!c) throw new Error('useAuth outside provider');
  return c;
}