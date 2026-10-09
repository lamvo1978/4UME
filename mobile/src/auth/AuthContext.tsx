import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import { api, AuthUser, Me, setUnauthorizedHandler, UserSettings } from "../api/client";
import { configureSpeech } from "../components/SpeakButton";
import { syncReminders } from "../notifications/reminders";

type SettingsChange = Partial<UserSettings> & { displayName?: string };

function deviceTimeZone(): string | null {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone ?? null;
  } catch {
    return null;
  }
}

type AuthState = {
  ready: boolean;
  user: AuthUser | null;
  me: Me | null;
  /** Streak count to celebrate after the first activity of the day; shown once the user is back on the tabs. */
  celebration: number | null;
  dismissCelebration: () => void;
  login: (email: string, password: string) => Promise<void>;
  register: (email: string, password: string, displayName: string, code: string) => Promise<void>;
  /** Sets the new password and signs in. */
  resetPassword: (email: string, code: string, newPassword: string) => Promise<void>;
  logout: () => Promise<void>;
  refreshMe: () => Promise<void>;
  updateSettings: (changes: SettingsChange) => Promise<void>;
};

const Ctx = createContext<AuthState | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [ready, setReady] = useState(false);
  const [user, setUser] = useState<AuthUser | null>(null);
  const [me, setMeState] = useState<Me | null>(null);
  const [celebration, setCelebration] = useState<number | null>(null);
  const meRef = useRef<Me | null>(null);

  const setMe = useCallback((next: Me | null) => {
    const prev = meRef.current;
    if (prev && next && prev.userId === next.userId && !prev.studiedToday && next.studiedToday) {
      setCelebration(next.streak);
    }
    meRef.current = next;
    setMeState(next);
  }, []);

  const refreshMe = useCallback(async () => {
    setMe(await api.me());
  }, [setMe]);

  const updateSettings = useCallback(
    async (changes: SettingsChange) => {
      const prev = meRef.current;
      if (prev) {
        const { displayName, ...settings } = changes;
        setMe({ ...prev, displayName: displayName ?? prev.displayName, settings: { ...prev.settings, ...settings } });
      }
      try {
        setMe(await api.updateSettings(changes));
      } catch (e) {
        setMe(prev);
        throw e;
      }
    },
    [setMe]
  );

  useEffect(() => {
    if (!me) return;
    configureSpeech(me.settings.speechRate, me.settings.autoSpeak);
  }, [me?.settings.speechRate, me?.settings.autoSpeak]);

  // Rebuilt after every study session too: due counts and today's reminders change with it.
  useEffect(() => {
    const current = meRef.current;
    if (!current) return;
    let cancelled = false;
    (async () => {
      const [config, forecast] = await Promise.all([api.config(), api.reviewForecast(7)]);
      if (!cancelled) await syncReminders({ me: current, config: config.notifications, forecast });
    })().catch(() => undefined);
    return () => {
      cancelled = true;
    };
  }, [
    me?.userId,
    me?.settings.reminderEnabled,
    me?.settings.reminderTime,
    me?.settings.notifyRescue,
    me?.settings.dailyGoal,
    me?.streak,
    me?.streakFreezes,
    me?.studiedToday,
    me?.todayNewWords,
  ]);

  useEffect(() => {
    if (!me) return;
    const zone = deviceTimeZone();
    if (zone && zone !== me.settings.timeZone) {
      api.updateSettings({ timeZone: zone }).then(setMe).catch(() => undefined);
    }
  }, [me?.userId, me?.settings.timeZone, setMe]);

  useEffect(() => {
    setUnauthorizedHandler(() => {
      api.clearToken().catch(() => undefined);
      syncReminders(null).catch(() => undefined);
      setUser(null);
      setMe(null);
      setCelebration(null);
    });
  }, [setMe]);

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
  }, [setMe]);

  const signIn = useCallback(
    async (auth: AuthUser) => {
      await api.saveToken(auth.accessToken);
      setUser(auth);
      setMe(await api.me());
    },
    [setMe]
  );

  const value = useMemo<AuthState>(
    () => ({
      ready,
      user,
      me,
      celebration,
      dismissCelebration: () => setCelebration(null),
      async login(email, password) {
        await signIn(await api.login(email, password));
      },
      async register(email, password, displayName, code) {
        await signIn(await api.register(email, password, displayName, code));
      },
      async resetPassword(email, code, newPassword) {
        await signIn(await api.resetPassword(email, code, newPassword));
      },
      async logout() {
        await api.clearToken();
        syncReminders(null).catch(() => undefined);
        setUser(null);
        setMe(null);
        setCelebration(null);
      },
      refreshMe,
      updateSettings,
    }),
    [ready, user, me, celebration, setMe, signIn, refreshMe, updateSettings]
  );

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useAuth() {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error("useAuth outside provider");
  return ctx;
}
