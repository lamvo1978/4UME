import React, { createContext, useContext, useEffect, useMemo, useState } from "react";
import { api, AuthUser, Me } from "../api/client";

type AuthState = {
  ready: boolean;
  user: AuthUser | null;
  me: Me | null;
  login: (email: string, password: string) => Promise<void>;
  register: (email: string, password: string, displayName: string) => Promise<void>;
  logout: () => Promise<void>;
  refreshMe: () => Promise<void>;
};

const Ctx = createContext<AuthState | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [ready, setReady] = useState(false);
  const [user, setUser] = useState<AuthUser | null>(null);
  const [me, setMe] = useState<Me | null>(null);

  useEffect(() => {
    (async () => {
      try {
        const token = await api.getToken();
        if (token) {
          const profile = await api.me();
          setUser({
            accessToken: token,
            userId: profile.userId,
            email: profile.email,
            displayName: profile.displayName,
          });
          setMe(profile);
        }
      } catch {
        await api.clearToken();
      } finally {
        setReady(true);
      }
    })();
  }, []);

  const value = useMemo<AuthState>(
    () => ({
      ready,
      user,
      me,
      async login(email, password) {
        const auth = await api.login(email, password);
        await api.saveToken(auth.accessToken);
        setUser(auth);
        setMe(await api.me());
      },
      async register(email, password, displayName) {
        const auth = await api.register(email, password, displayName);
        await api.saveToken(auth.accessToken);
        setUser(auth);
        setMe(await api.me());
      },
      async logout() {
        await api.clearToken();
        setUser(null);
        setMe(null);
      },
      async refreshMe() {
        setMe(await api.me());
      },
    }),
    [ready, user, me]
  );

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useAuth() {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error("useAuth outside provider");
  return ctx;
}
