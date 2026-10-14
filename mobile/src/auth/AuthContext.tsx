import AsyncStorage from "@react-native-async-storage/async-storage";
import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import {
  api,
  ApiError,
  AuthUser,
  EasyWordMode,
  Me,
  PlacementResult,
  setUnauthorizedHandler,
  UserSettings,
  VocabLevel,
} from "../api/client";
import { configureSpeech } from "../components/SpeakButton";
import { resolveTexts } from "../notifications/copy";
import * as Sentry from "@sentry/react-native";
import { forgetPushToken, registerPushToken, unregisterPushToken } from "../notifications/push";
import { syncReminders } from "../notifications/reminders";

/** Last profile seen, so the app still opens signed in when it starts without internet. */
const ME_CACHE_KEY = "fourume.me";

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
  /** Set when the app started offline with no saved profile to fall back on; the user is still signed in. */
  startupError: string | null;
  retryStartup: () => void;
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
  /** True right after sign-up, so the placement test opens before the tabs. */
  onboarding: boolean;
  finishOnboarding: () => void;
  applyPlacement: (level: VocabLevel, mode: EasyWordMode, tested: boolean) => Promise<PlacementResult>;
};

const Ctx = createContext<AuthState | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [ready, setReady] = useState(false);
  const [startupError, setStartupError] = useState<string | null>(null);
  const [bootAttempt, setBootAttempt] = useState(0);
  const [user, setUser] = useState<AuthUser | null>(null);
  const [me, setMeState] = useState<Me | null>(null);
  const [celebration, setCelebration] = useState<number | null>(null);
  const [onboarding, setOnboarding] = useState(false);
  const meRef = useRef<Me | null>(null);

  const setMe = useCallback((next: Me | null) => {
    const prev = meRef.current;
    if (prev && next && prev.userId === next.userId && !prev.studiedToday && next.studiedToday) {
      setCelebration(next.streak);
    }
    meRef.current = next;
    setMeState(next);
    (next ? AsyncStorage.setItem(ME_CACHE_KEY, JSON.stringify(next)) : AsyncStorage.removeItem(ME_CACHE_KEY)).catch(() => undefined);
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
      if (!cancelled) {
        await syncReminders({ me: current, config: config.notifications, forecast, texts: resolveTexts(config.notificationTexts) });
      }
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

  // Crash reports carry the account id only, so a report can be matched to a feedback ticket.
  useEffect(() => {
    Sentry.setUser(me ? { id: me.userId } : null);
  }, [me?.userId]);

  // Turning a reminder on is when permission usually gets granted.
  useEffect(() => {
    if (!me) return;
    registerPushToken().catch(() => undefined);
  }, [me?.userId, me?.settings.reminderEnabled, me?.settings.notifyRescue]);

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
      forgetPushToken();
      syncReminders(null).catch(() => undefined);
      setUser(null);
      setMe(null);
      setCelebration(null);
    });
  }, [setMe]);

  useEffect(() => {
    (async () => {
      const token = await api.getToken().catch(() => null);
      if (!token) return;
      const signInAs = (profile: Me) => {
        setUser({ accessToken: token, userId: profile.userId, email: profile.email, displayName: profile.displayName });
        setMe(profile);
      };
      try {
        signInAs(await api.me());
        setStartupError(null);
      } catch (e) {
        // 401 has already signed the user out; anything else (offline, server down) keeps the session.
        if (e instanceof ApiError && e.status === 401) return;
        const cached = await AsyncStorage.getItem(ME_CACHE_KEY).catch(() => null);
        if (cached) {
          signInAs(JSON.parse(cached) as Me);
          setStartupError(null);
        } else {
          setStartupError(e instanceof Error ? e.message : "Không tải được hồ sơ.");
        }
      }
    })().finally(() => setReady(true));
  }, [setMe, bootAttempt]);

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
      startupError,
      retryStartup: () => {
        setStartupError(null);
        setReady(false);
        setBootAttempt((n) => n + 1);
      },
      user,
      me,
      celebration,
      dismissCelebration: () => setCelebration(null),
      async login(email, password) {
        await signIn(await api.login(email, password));
      },
      async register(email, password, displayName, code) {
        const auth = await api.register(email, password, displayName, code);
        setOnboarding(true);
        await signIn(auth);
      },
      async resetPassword(email, code, newPassword) {
        await signIn(await api.resetPassword(email, code, newPassword));
      },
      async logout() {
        await unregisterPushToken();
        await api.clearToken();
        syncReminders(null).catch(() => undefined);
        setUser(null);
        setMe(null);
        setCelebration(null);
        setOnboarding(false);
      },
      refreshMe,
      updateSettings,
      onboarding,
      finishOnboarding: () => setOnboarding(false),
      async applyPlacement(level, mode, tested) {
        const result = await api.applyPlacement(level, mode, tested);
        setMe(result.me);
        return result;
      },
    }),
    [ready, startupError, user, me, celebration, onboarding, setMe, signIn, refreshMe, updateSettings]
  );

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useAuth() {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error("useAuth outside provider");
  return ctx;
}
