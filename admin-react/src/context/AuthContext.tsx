import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';
import { api, getToken, setToken } from '../lib/api';
import type { AdminUser, Envelope } from '../lib/types';

const USER_KEY = 'gomel_admin_user';

function readCachedAdmin(): AdminUser | null {
  try {
    return JSON.parse(localStorage.getItem(USER_KEY) || 'null');
  } catch {
    return null;
  }
}

interface AuthValue {
  admin: AdminUser | null;
  ready: boolean; // finished the initial token check
  loggedIn: boolean;
  login: (email: string, password: string) => Promise<void>;
  logout: () => void;
  // Update the cached admin (after a profile save, or /admin/me refresh).
  setAdmin: (user: AdminUser | null) => void;
}

const AuthContext = createContext<AuthValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [admin, setAdminState] = useState<AdminUser | null>(readCachedAdmin());
  const [loggedIn, setLoggedIn] = useState<boolean>(!!getToken());
  const [ready, setReady] = useState<boolean>(!getToken());

  const setAdmin = useCallback((user: AdminUser | null) => {
    setAdminState(user);
    if (user) localStorage.setItem(USER_KEY, JSON.stringify(user));
    else localStorage.removeItem(USER_KEY);
  }, []);

  const login = useCallback(
    async (email: string, password: string) => {
      const { token, user } = await api<{ token: string; user: AdminUser }>('/admin/login', {
        method: 'POST',
        body: { email, password },
      });
      setToken(token);
      setAdmin(user);
      setLoggedIn(true);
      setReady(true);
    },
    [setAdmin],
  );

  const logout = useCallback(() => {
    setToken('');
    setAdmin(null);
    setLoggedIn(false);
    setReady(true);
  }, [setAdmin]);

  // On boot: if we have a token, validate it against /admin/stats (matches the
  // original boot). On success refresh the admin from /admin/me; on failure
  // clear the stale token and fall back to the login screen.
  useEffect(() => {
    if (!getToken()) return;
    let alive = true;
    api('/admin/stats')
      .then(() => {
        if (!alive) return;
        setLoggedIn(true);
        setReady(true);
        api<Envelope<AdminUser>>('/admin/me')
          .then((r) => alive && setAdmin(r.data))
          .catch(() => {});
      })
      .catch(() => {
        if (!alive) return;
        setToken('');
        setLoggedIn(false);
        setReady(true);
      });
    return () => {
      alive = false;
    };
  }, [setAdmin]);

  const value = useMemo<AuthValue>(
    () => ({ admin, ready, loggedIn, login, logout, setAdmin }),
    [admin, ready, loggedIn, login, logout, setAdmin],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}
