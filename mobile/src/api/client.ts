import AsyncStorage from "@react-native-async-storage/async-storage";
import { Platform } from "react-native";

const TOKEN_KEY = "fourume.token";

/** Android emulator uses 10.0.2.2; iOS simulator / web use localhost. */
export const API_BASE =
  process.env.EXPO_PUBLIC_API_URL ??
  (Platform.OS === "android" ? "http://10.0.2.2:5088" : "http://127.0.0.1:5088");

/** Images uploaded in the admin are stored as "/media/…" paths on the API host. */
export function mediaUrl(url: string | null): string | null {
  if (!url) return null;
  return url.startsWith("/") ? `${API_BASE}${url}` : url;
}

export type AuthUser = {
  accessToken: string;
  userId: string;
  email: string;
  displayName: string;
};

export type SendCodeResult = { resendAfterSeconds: number; expiresInMinutes: number };

export type UserSettings = {
  /** New words per day; also the flashcard batch size. */
  dailyGoal: number;
  speechRate: number;
  autoSpeak: boolean;
  reminderEnabled: boolean;
  /** Local "HH:mm". */
  reminderTime: string;
  notifyRescue: boolean;
  notifyWeekly: boolean;
  notifyNews: boolean;
  /** IANA zone, e.g. "Asia/Ho_Chi_Minh"; null until the app reports it. */
  timeZone: string | null;
};

/** Server-tunable notification rules; times are local "HH:mm", weeklyDay 0 = Sunday. */
export type NotificationConfig = {
  rescueTime: string;
  quietStart: string;
  quietEnd: string;
  maxPerDay: number;
  rescueMinStreak: number;
  comebackDaysLocal: number[];
  comebackDaysPush: number[];
  weeklyDay: number;
  weeklyTime: string;
  freezeNoticeTime: string;
};

export type ListeningConfig = { countsTowardStreak: boolean };

export type AppConfig = { notifications: NotificationConfig; listening?: ListeningConfig };

export type ListeningKind = "dialogue" | "story" | "news";
export type ListeningProgress = { positionMs: number; completed: boolean; timesCompleted: number; liked: boolean };
/** `hasAudio` is false until the admin generates the recording; the app then reads the script with the device voice. */
export type ListeningSummary = {
  slug: string;
  titleEn: string;
  titleVi: string;
  kind: ListeningKind;
  level: string;
  topic: string | null;
  summaryVi: string;
  lineCount: number;
  hasAudio: boolean;
  durationMs: number | null;
  progress: ListeningProgress;
};
export type ListeningLine = { speaker: string; en: string; vi: string; startMs: number | null; endMs: number | null };
export type ListeningDetail = {
  slug: string;
  titleEn: string;
  titleVi: string;
  kind: ListeningKind;
  level: string;
  topic: string | null;
  summaryVi: string;
  audioUrl: string | null;
  durationMs: number | null;
  speakers: { key: string; name: string }[];
  lines: ListeningLine[];
  progress: ListeningProgress;
};

/** Counts are cumulative: items due by the end of that local day, overdue included. */
export type ReviewForecastDay = { date: string; words: number; grammar: number };

export type Me = {
  userId: string;
  email: string;
  displayName: string;
  knownWords: number;
  hardWords: number;
  grammarLessonsCompleted: number;
  grammarLessonsTotal: number;
  streak: number;
  studiedToday: boolean;
  todayNewWords: number;
  streakFreezes: number;
  nextMilestone: number | null;
  /** Local "YYYY-MM-DD" of the last real (not frozen) study day. */
  lastStudyDate: string | null;
  settings: UserSettings;
};

export type StudyDay = { date: string; newWords: number; reviews: number; grammarItems: number; frozen: boolean };

export type Streak = {
  current: number;
  best: number;
  freezes: number;
  maxFreezes: number;
  studiedToday: boolean;
  todayNewWords: number;
  todayReviews: number;
  todayGrammar: number;
  dailyGoal: number;
  nextMilestone: number | null;
  /** Local "YYYY-MM-DD" as seen by the server. */
  today: string;
  /** Last 35 days with any activity (or saved by a freeze), oldest first. */
  days: StudyDay[];
};

export type Memory = {
  /** Count per review level, index 0 = level 1 … index 5 = level 6 (mastered). */
  levels: number[];
  learning: number;
  byLevel: { level: string; done: number; total: number }[];
};

export type Stats = {
  streak: Streak;
  vocabulary: Memory;
  grammar: Memory;
  totalStudyDays: number;
  memberSince: string;
};

export type Deck = {
  id: string;
  titleVi: string;
  /** Ionicons glyph name chosen in the web admin. */
  icon: string;
  totalWords: number;
  knownWords: number;
  hardWords: number;
  levels: string | null;
};

export type Word = {
  id: string;
  word: string;
  ipa: string;
  pos: string;
  level: string;
  meaningVi: string;
  example: string;
  exampleVi: string;
  imageUrl: string | null;
  status: number;
  /** Irregular forms, e.g. "go – went – gone" or "số nhiều: children". */
  forms: string | null;
};

/** `matchedForm` is set when the query was an inflected form that led to this base word ("went" → go). */
export type WordSearchResult = { word: Word; deckId: string; deckTitleVi: string; matchedForm: string | null };

export type GrammarLesson = {
  slug: string;
  titleVi: string;
  titleEn: string | null;
  level: string;
  order: number;
  quizSize: number;
  bestScore: number | null;
  bestTotal: number | null;
  reviewLevel: number;
  nextReviewAt: string | null;
};

/** Lesson content follows docs/grammar-lesson-schema.md. */
export type Bilingual = { en: string; vi: string };

export type GrammarSection =
  | { type: "usage"; title?: string; items: { textVi: string; example?: Bilingual }[] }
  | {
      type: "formula";
      title?: string;
      rows: { kind: "affirmative" | "negative" | "question" | "short-answer" | "note"; pattern: string; example?: Bilingual }[];
    }
  | { type: "table"; title?: string; headers: string[]; cells: string[][] }
  | { type: "examples"; title?: string; items: Bilingual[] }
  | { type: "signals"; title?: string; words: string[] }
  | { type: "mistakes"; title?: string; items: { wrong: string; right: string; noteVi?: string }[] }
  | { type: "tip"; title?: string; textVi: string };

type ExerciseBase = { id: string; explanationVi: string };

export type GrammarExercise =
  | (ExerciseBase & { type: "mcq"; prompt: string; options: string[]; answer: string })
  | (ExerciseBase & { type: "fill"; prompt: string; answers: string[] })
  | (ExerciseBase & { type: "order"; promptVi: string; answer: string; distractors?: string[] })
  | (ExerciseBase & { type: "transform"; instructionVi: string; source: string; answer: string; distractors?: string[] })
  | (ExerciseBase & { type: "error"; sentence: string; correction: string });

export type GrammarDetail = {
  slug: string;
  titleVi: string;
  titleEn: string | null;
  level: string;
  summaryVi: string;
  quizSize: number;
  sections: GrammarSection[];
  exercises: GrammarExercise[];
  reviewLevel: number;
};

export type GrammarCompleteResult = {
  score: number;
  total: number;
  passed: boolean;
  addedToReview: boolean;
  nextReviewAt: string | null;
};

export type GrammarReviewItem = {
  slug: string;
  titleVi: string;
  level: number;
  exercises: GrammarExercise[];
};

export type GrammarReviewAnswerResult = {
  slug: string;
  level: number;
  nextReviewAt: string | null;
  suggestRelearn: boolean;
  pulledForward: boolean;
};

export type ReviewSummary = {
  dueCount: number;
  inReview: number;
  mastered: number;
  nextDueAt: string | null;
};

export type ReviewItem = {
  level: number;
  word: Word;
  wordOptions: string[];
  meaningOptions: string[];
};

export type PracticeAnswerResult = {
  wordId: string;
  nextReviewAt: string | null;
  pulledForward: boolean;
};

export type ReviewAnswerResult = {
  wordId: string;
  level: number;
  status: number;
  nextReviewAt: string | null;
  backToLearning: boolean;
};

async function authHeaders(): Promise<Record<string, string>> {
  const token = await AsyncStorage.getItem(TOKEN_KEY);
  return token ? { Authorization: `Bearer ${token}` } : {};
}

/** Called when a signed-in request gets 401 (session expired, account locked or deleted). */
let onUnauthorized: () => void = () => undefined;
export function setUnauthorizedHandler(fn: () => void) {
  onUnauthorized = fn;
}

async function request<T>(path: string, init: RequestInit = {}): Promise<T> {
  const auth = await authHeaders();
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    // Lets the server count study days by the user's local calendar.
    "X-Utc-Offset": String(-new Date().getTimezoneOffset()),
    ...auth,
    ...(init.headers as Record<string, string> | undefined),
  };
  const res = await fetch(`${API_BASE}${path}`, { ...init, headers });
  const text = await res.text();
  const data = text ? JSON.parse(text) : null;
  if (res.status === 401 && auth.Authorization) {
    onUnauthorized();
    throw new Error("Phiên đăng nhập đã hết hạn. Vui lòng đăng nhập lại.");
  }
  if (!res.ok) {
    throw new Error(data?.error ?? `Lỗi ${res.status}`);
  }
  return data as T;
}

let configCache: Promise<AppConfig> | null = null;

export const api = {
  saveToken: (token: string) => AsyncStorage.setItem(TOKEN_KEY, token),
  clearToken: () => AsyncStorage.removeItem(TOKEN_KEY),
  getToken: () => AsyncStorage.getItem(TOKEN_KEY),
  sendRegisterCode: (email: string) =>
    request<SendCodeResult>("/api/auth/register/code", { method: "POST", body: JSON.stringify({ email }) }),
  register: (email: string, password: string, displayName: string, code: string) =>
    request<AuthUser>("/api/auth/register", {
      method: "POST",
      body: JSON.stringify({ email, password, displayName, code }),
    }),
  sendResetCode: (email: string) =>
    request<SendCodeResult>("/api/auth/password/code", { method: "POST", body: JSON.stringify({ email }) }),
  resetPassword: (email: string, code: string, newPassword: string) =>
    request<AuthUser>("/api/auth/password/reset", {
      method: "POST",
      body: JSON.stringify({ email, code, newPassword }),
    }),
  login: (email: string, password: string) =>
    request<AuthUser>("/api/auth/login", {
      method: "POST",
      body: JSON.stringify({ email, password }),
    }),
  config: () => (configCache ??= request<AppConfig>("/api/config").catch((e) => {
    configCache = null;
    throw e;
  })),
  me: () => request<Me>("/api/me"),
  reviewForecast: (days = 7) => request<ReviewForecastDay[]>(`/api/review/forecast?days=${days}`),
  stats: () => request<Stats>("/api/me/stats"),
  updateSettings: (changes: Partial<UserSettings> & { displayName?: string }) =>
    request<Me>("/api/me/settings", { method: "PUT", body: JSON.stringify(changes) }),
  changePassword: (currentPassword: string, newPassword: string) =>
    request<null>("/api/me/password", { method: "POST", body: JSON.stringify({ currentPassword, newPassword }) }),
  deleteAccount: (password: string) =>
    request<null>("/api/me/delete", { method: "POST", body: JSON.stringify({ password }) }),
  decks: (level?: string) =>
    request<Deck[]>(`/api/vocabulary/decks${level ? `?level=${level}` : ""}`),
  deckWords: (deckId: string) => request<Word[]>(`/api/vocabulary/decks/${deckId}`),
  searchWords: (q: string, limit = 30) =>
    request<WordSearchResult[]>(`/api/vocabulary/search?${new URLSearchParams({ q, limit: String(limit) })}`),
  updateProgress: (wordId: string, status: number) =>
    request("/api/vocabulary/progress", {
      method: "POST",
      body: JSON.stringify({ wordId, status }),
    }),
  reviewSummary: () => request<ReviewSummary>("/api/review/summary"),
  reviewDue: (limit = 10) => request<ReviewItem[]>(`/api/review/due?limit=${limit}`),
  reviewAnswer: (wordId: string, mistakes: number) =>
    request<ReviewAnswerResult>("/api/review/answer", {
      method: "POST",
      body: JSON.stringify({ wordId, mistakes }),
    }),
  practiceItems: (opts: { deckId?: string; wordIds?: string[]; limit?: number } = {}) => {
    const qs = new URLSearchParams({ limit: String(opts.limit ?? 10) });
    if (opts.deckId) qs.set("deckId", opts.deckId);
    if (opts.wordIds?.length) qs.set("wordIds", opts.wordIds.join(","));
    return request<ReviewItem[]>(`/api/review/practice?${qs.toString()}`);
  },
  practiceAnswer: (wordId: string, mistakes: number) =>
    request<PracticeAnswerResult>("/api/review/practice/answer", {
      method: "POST",
      body: JSON.stringify({ wordId, mistakes }),
    }),
  listeningLessons: () => request<ListeningSummary[]>("/api/listening"),
  listeningLesson: (slug: string) => request<ListeningDetail>(`/api/listening/${slug}`),
  saveListeningProgress: (slug: string, changes: { positionMs?: number; completed?: boolean; liked?: boolean }) =>
    request<ListeningProgress>(`/api/listening/${slug}/progress`, { method: "PUT", body: JSON.stringify(changes) }),
  grammarLessons: () => request<GrammarLesson[]>("/api/grammar/lessons"),
  grammarLesson: (slug: string) => request<GrammarDetail>(`/api/grammar/lessons/${slug}`),
  completeGrammar: (slug: string, score: number, total: number) =>
    request<GrammarCompleteResult>(`/api/grammar/lessons/${slug}/complete`, {
      method: "POST",
      body: JSON.stringify({ score, total }),
    }),
  grammarReviewSummary: () => request<ReviewSummary>("/api/grammar/review/summary"),
  grammarReviewDue: (limit = 5) => request<GrammarReviewItem[]>(`/api/grammar/review/due?limit=${limit}`),
  grammarPractice: (slug?: string, limit = 4) => {
    const qs = new URLSearchParams({ limit: String(limit) });
    if (slug) qs.set("slug", slug);
    return request<GrammarReviewItem[]>(`/api/grammar/review/practice?${qs.toString()}`);
  },
  grammarReviewAnswer: (slug: string, mistakes: number) =>
    request<GrammarReviewAnswerResult>("/api/grammar/review/answer", {
      method: "POST",
      body: JSON.stringify({ slug, mistakes }),
    }),
  grammarPracticeAnswer: (slug: string, mistakes: number) =>
    request<GrammarReviewAnswerResult>("/api/grammar/review/practice/answer", {
      method: "POST",
      body: JSON.stringify({ slug, mistakes }),
    }),
};
