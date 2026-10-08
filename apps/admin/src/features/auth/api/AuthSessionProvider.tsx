import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { HttpClientError } from '@melearn/api-client';
import { useQueryClient } from '@tanstack/react-query';
import { authSessionApi } from './auth-session.ts';
import type { ApiSessionUser } from './auth-session.ts';
type SessionState = { status: 'loading' | 'ready' | 'error'; user: ApiSessionUser | null };
interface AuthSessionContextValue extends SessionState {
  enabled: boolean; refresh(): Promise<ApiSessionUser | null>;
  login(identifier: string, password: string, audience: 'web' | 'admin'): Promise<ApiSessionUser>; logout(): Promise<void>;
}
const AuthSessionContext = createContext<AuthSessionContextValue | null>(null);
export function AuthSessionProvider({ children }: { children: React.ReactNode }) {
  const queryClient = useQueryClient();
  const [state, setState] = useState<SessionState>({ status: authSessionApi.enabled ? 'loading' : 'ready', user: null });
  const refresh = useCallback(async () => {
    if (!authSessionApi.enabled) return null;
    try { const user = await authSessionApi.me(); setState({ status: 'ready', user }); return user; }
    catch (error) {
      if (error instanceof HttpClientError && error.kind === 'http' && error.status === 401) { setState({ status: 'ready', user: null }); return null; }
      setState({ status: 'error', user: null }); return null;
    }
  }, []);
  useEffect(() => { void refresh(); }, [refresh]);
  const login = useCallback(async (identifier: string, password: string, audience: 'web' | 'admin') => {
    const user = await authSessionApi.login(identifier, password, audience);
    await queryClient.cancelQueries(); queryClient.clear(); setState({ status: 'ready', user }); return user;
  }, [queryClient]);
  const logout = useCallback(async () => { try { await authSessionApi.logout(); } finally { await queryClient.cancelQueries(); queryClient.clear(); setState({ status: 'ready', user: null }); } }, [queryClient]);
  const value = useMemo(() => ({ ...state, enabled: authSessionApi.enabled, refresh, login, logout }), [state, refresh, login, logout]);
  return <AuthSessionContext.Provider value={value}>{children}</AuthSessionContext.Provider>;
}
export function useAuthSession(): AuthSessionContextValue {
  const value = useContext(AuthSessionContext); if (!value) throw new Error('useAuthSession must be used inside AuthSessionProvider'); return value;
}
