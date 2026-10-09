import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from "react";
import { api, ApiError, setUnauthorizedHandler, tokenStore, type AdminIdentity } from "./api";

type AuthState = {
  ready: boolean;
  admin: AdminIdentity | null;
  login: (email: string, password: string) => Promise<void>;
  /** Sets the new password with the mailed code, then signs in. */
  resetPassword: (email: string, code: string, newPassword: string) => Promise<void>;
  logout: () => void;
};

const AuthContext = createContext<AuthState | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [ready, setReady] = useState(false);
  const [admin, setAdmin] = useState<AdminIdentity | null>(null);

  const logout = useCallback(() => {
    tokenStore.clear();
    setAdmin(null);
  }, []);

  useEffect(() => {
    setUnauthorizedHandler(logout);
    if (!tokenStore.get()) {
      setReady(true);
      return;
    }
    api
      .me()
      .then(setAdmin)
      .catch(() => logout())
      .finally(() => setReady(true));
  }, [logout]);

  const signIn = useCallback(async (accessToken: string) => {
    tokenStore.set(accessToken);
    try {
      setAdmin(await api.me());
    } catch (e) {
      tokenStore.clear();
      if (e instanceof ApiError && e.status === 403) throw new Error("Tài khoản này không có quyền quản trị.");
      throw e;
    }
  }, []);

  const login = useCallback(
    async (email: string, password: string) => signIn((await api.login(email, password)).accessToken),
    [signIn]
  );

  const resetPassword = useCallback(
    async (email: string, code: string, newPassword: string) =>
      signIn((await api.resetPassword(email, code, newPassword)).accessToken),
    [signIn]
  );

  return <AuthContext.Provider value={{ ready, admin, login, resetPassword, logout }}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used inside AuthProvider");
  return ctx;
}
