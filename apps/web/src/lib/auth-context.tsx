'use client';

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from 'react';
import { useRouter } from 'next/navigation';
import { apiFetch } from './api';
import {
  getToken,
  saveAuth,
  saveProjectId,
  savePlan,
  clearAuth,
} from './auth';

interface UserState {
  id: string;
  email: string;
  plan: string;
  projectId: string | null;
}

interface AuthContextType {
  user: UserState | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  login: (email: string, password: string) => Promise<void>;
  register: (email: string, password: string) => Promise<void>;
  logout: () => void;
}

const AuthContext = createContext<AuthContextType | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<UserState | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const router = useRouter();

  // Validate existing token on mount
  useEffect(() => {
    const token = getToken();
    if (!token) {
      setIsLoading(false);
      return;
    }

    apiFetch<{
      id: string;
      email: string;
      plan: string;
      projectId: string | null;
    }>('/auth/me', {
      headers: { Authorization: `Bearer ${token}` },
    })
      .then((profile) => {
        setUser({
          id: profile.id,
          email: profile.email,
          plan: profile.plan,
          projectId: profile.projectId,
        });
        if (profile.projectId) saveProjectId(profile.projectId);
        savePlan(profile.plan);
      })
      .catch(() => {
        // Token invalid — clear it
        clearAuth();
      })
      .finally(() => setIsLoading(false));
  }, []);

  const login = useCallback(
    async (email: string, password: string) => {
      const res = await apiFetch<{
        accessToken: string;
        userId: string;
        plan: string;
      }>('/auth/login', {
        method: 'POST',
        body: JSON.stringify({ email, password }),
      });

      saveAuth(res.accessToken, res.userId);
      savePlan(res.plan);

      // Fetch profile to get projectId
      const profile = await apiFetch<{
        id: string;
        email: string;
        plan: string;
        projectId: string | null;
      }>('/auth/me', {
        headers: { Authorization: `Bearer ${res.accessToken}` },
      });

      if (profile.projectId) saveProjectId(profile.projectId);

      setUser({
        id: profile.id,
        email: profile.email,
        plan: profile.plan,
        projectId: profile.projectId,
      });
    },
    [],
  );

  const register = useCallback(
    async (email: string, password: string) => {
      const res = await apiFetch<{
        accessToken: string;
        userId: string;
        plan: string;
      }>('/auth/register', {
        method: 'POST',
        body: JSON.stringify({ email, password }),
      });

      saveAuth(res.accessToken, res.userId);
      savePlan(res.plan);

      // Fetch profile to get projectId
      const profile = await apiFetch<{
        id: string;
        email: string;
        plan: string;
        projectId: string | null;
      }>('/auth/me', {
        headers: { Authorization: `Bearer ${res.accessToken}` },
      });

      if (profile.projectId) saveProjectId(profile.projectId);

      setUser({
        id: profile.id,
        email: profile.email,
        plan: profile.plan,
        projectId: profile.projectId,
      });
    },
    [],
  );

  const logout = useCallback(() => {
    clearAuth();
    setUser(null);
    router.push('/');
  }, [router]);

  const value = useMemo(
    () => ({
      user,
      isAuthenticated: !!user,
      isLoading,
      login,
      register,
      logout,
    }),
    [user, isLoading, login, register, logout],
  );

  return (
    <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
  );
}

export function useAuth(): AuthContextType {
  const ctx = useContext(AuthContext);
  if (!ctx) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return ctx;
}
