// Auth state for the whole app.
//
// Source of truth is the server (the HttpOnly access/refresh cookies live
// in the browser but are unreadable from JS). On mount we ask the backend
// `GET /api/auth/me`; that tells us who we are or 401s us into a
// signed-out state. Every subsequent mutation (login, logout,
// switch_mode) invalidates that query so the UI re-syncs.
import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  type ReactNode,
} from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api, ApiError } from "@/api/client";
import type { LoginIn, RegisterIn, Role, UserOut } from "@/api/types";

interface AuthContextValue {
  user: UserOut | null;
  /** True while the initial /me check is in flight — render nothing
   *  protected until this is false to avoid flashes. */
  isLoading: boolean;
  login: (input: LoginIn) => Promise<UserOut>;
  register: (input: RegisterIn) => Promise<UserOut>;
  logout: () => Promise<void>;
  switchMode: (role: Role) => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const qc = useQueryClient();

  const meQuery = useQuery<UserOut | null>({
    queryKey: ["auth", "me"],
    queryFn: async () => {
      try {
        return await api.get<UserOut>("/api/auth/me");
      } catch (err) {
        // 401 from /me just means "not signed in" — that's a real,
        // expected state, not an error to log/toast.
        if (err instanceof ApiError && err.isAuthError) return null;
        throw err;
      }
    },
    // Auth state shouldn't flicker on tab refocus; we'll refetch
    // ourselves after mutations.
    refetchOnWindowFocus: false,
    staleTime: 5 * 60_000,
    retry: false,
  });

  const loginMut = useMutation({
    mutationFn: (input: LoginIn) => api.post<UserOut>("/api/auth/login", input),
    onSuccess: (user) => qc.setQueryData(["auth", "me"], user),
  });

  const registerMut = useMutation({
    mutationFn: (input: RegisterIn) =>
      api.post<UserOut>("/api/auth/register", input),
    onSuccess: (user) => qc.setQueryData(["auth", "me"], user),
  });

  const logoutMut = useMutation({
    mutationFn: () => api.post<void>("/api/auth/logout"),
    onSuccess: () => {
      qc.setQueryData(["auth", "me"], null);
      // Aggressive clear: when you sign out we don't want a leftover
      // cached /api/admin/dashboard sitting around in memory.
      qc.removeQueries();
    },
  });

  const switchMut = useMutation({
    mutationFn: (role: Role) =>
      api.post<UserOut>(`/api/auth/switch-mode/${role}`),
    onSuccess: (user) => qc.setQueryData(["auth", "me"], user),
  });

  const login = useCallback(
    (input: LoginIn) => loginMut.mutateAsync(input),
    [loginMut]
  );
  const register = useCallback(
    (input: RegisterIn) => registerMut.mutateAsync(input),
    [registerMut]
  );
  const logout = useCallback(async () => {
    await logoutMut.mutateAsync();
  }, [logoutMut]);
  const switchMode = useCallback(
    async (role: Role) => {
      await switchMut.mutateAsync(role);
    },
    [switchMut]
  );

  const value = useMemo<AuthContextValue>(
    () => ({
      user: meQuery.data ?? null,
      isLoading: meQuery.isLoading,
      login,
      register,
      logout,
      switchMode,
    }),
    [meQuery.data, meQuery.isLoading, login, register, logout, switchMode]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) {
    throw new Error("useAuth must be used inside <AuthProvider>");
  }
  return ctx;
}