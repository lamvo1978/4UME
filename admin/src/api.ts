const BASE = import.meta.env.VITE_API_URL ?? "";
const TOKEN_KEY = "fourume.admin.token";

export class ApiError extends Error {
  readonly status: number;
  constructor(message: string, status: number) {
    super(message);
    this.status = status;
  }
}

export const tokenStore = {
  get: () => localStorage.getItem(TOKEN_KEY),
  set: (t: string) => localStorage.setItem(TOKEN_KEY, t),
  clear: () => localStorage.removeItem(TOKEN_KEY),
};

/** Called on 401 so the app can drop back to the login screen. */
let onUnauthorized: () => void = () => {};
export function setUnauthorizedHandler(fn: () => void) {
  onUnauthorized = fn;
}

export async function request<T>(path: string, init: RequestInit = {}): Promise<T> {
  const headers: Record<string, string> = init.body instanceof FormData ? {} : { "Content-Type": "application/json" };
  const token = tokenStore.get();
  if (token) headers.Authorization = `Bearer ${token}`;

  const res = await fetch(`${BASE}${path}`, { ...init, headers: { ...headers, ...(init.headers as object) } });
  if (res.status === 401 && token) onUnauthorized();
  if (!res.ok) {
    const body = await res.json().catch(() => null);
    throw new ApiError(body?.error ?? `Lỗi máy chủ (${res.status})`, res.status);
  }
  return res.status === 204 ? (undefined as T) : res.json();
}

export async function requestBlob(path: string, init: RequestInit = {}): Promise<Blob> {
  const token = tokenStore.get();
  const res = await fetch(`${BASE}${path}`, {
    ...init,
    headers: { "Content-Type": "application/json", ...(token ? { Authorization: `Bearer ${token}` } : {}) },
  });
  if (res.status === 401 && token) onUnauthorized();
  if (!res.ok) {
    const body = await res.json().catch(() => null);
    throw new ApiError(body?.error ?? `Lỗi máy chủ (${res.status})`, res.status);
  }
  return res.blob();
}

export type AdminIdentity = { id: string; email: string; displayName: string; role: string };

export type OverviewDay = { date: string; learners: number; newUsers: number; newWords: number; reviews: number; grammarItems: number };
export type Overview = {
  words: number;
  decks: number;
  grammarLessons: number;
  wordsMissingImage: number;
  wordsMissingExample: number;
  wordsMissingIpa: number;
  users: number;
  activeUsers7Days: number;
  activeToday: number;
  newUsers7Days: number;
  admins: number;
  lockedUsers: number;
  activity: OverviewDay[];
  recentUsers: { id: string; displayName: string; email: string; createdAt: string }[];
  recentChanges: AuditEntry[];
};

export type UserFilter = "" | "admin" | "locked" | "active" | "inactive" | "premium";
export type UserQuery = { q?: string; filter?: UserFilter; sort?: string; page?: number; pageSize?: number };
export type AdminUser = {
  id: string;
  email: string;
  displayName: string;
  role: "user" | "admin";
  createdAt: string;
  lockedAt: string | null;
  lastStudyDate: string | null;
  currentStreak: number;
  knownWords: number;
  grammarPassed: number;
  /** Premium is active while this is in the future. */
  premiumUntil: string | null;
};
export type CreateUser = { email: string; displayName: string; password: string; role: AdminUser["role"] };
export type StudyDay = { date: string; newWords: number; reviews: number; grammarItems: number; frozen: boolean; listens: number };
export type AdminUserDetail = {
  user: AdminUser;
  bestStreak: number;
  streakFreezes: number;
  totalStudyDays: number;
  hardWords: number;
  grammarTotal: number;
  settings: {
    dailyGoal: number;
    reminderEnabled: boolean;
    reminderTime: string;
    notifyRescue: boolean;
    notifyWeekly: boolean;
    notifyNews: boolean;
    timeZone: string | null;
  };
  devices: { platform: string; appVersion: string | null; createdAt: string; lastSeenAt: string }[];
  days: StudyDay[];
  isSelf: boolean;
  /** Owner account: can never be locked or lose admin rights. */
  isProtected: boolean;
};

/** Mirrors backend NotificationConfig; times are local "HH:mm", weeklyDay 0 = Sunday. */
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
export type PronunciationConfig = {
  enabled: boolean;
  freeDailyLimit: number;
  premiumDailyLimit: number;
  monthlyMinutesCap: number;
};
export type AdminSettings = {
  notifications: { value: NotificationConfig; defaults: NotificationConfig; updatedAt: string | null };
  listening: { value: ListeningConfig; defaults: ListeningConfig; updatedAt: string | null };
  pronunciation: {
    value: PronunciationConfig;
    defaults: PronunciationConfig;
    updatedAt: string | null;
    /** Azure checks this calendar month (UTC). */
    usage: { attempts: number; users: number; minutes: number };
    azureConfigured: boolean;
  };
};

/** The app's "Giới thiệu & bản quyền" screen; the CEFR-J citation is fixed in the app and not part of it. */
export type AboutItem = { icon: string; title: string; body: string; url: string | null; visible: boolean };
export type AboutSection = { title: string; items: AboutItem[]; visible: boolean };
export type AboutContent = { tagline: string; sections: AboutSection[] };
export type AdminAbout = { value: AboutContent; defaults: AboutContent; updatedAt: string | null };
export type PremiumPerk = { icon: string; title: string; body: string; soon: boolean; visible: boolean };
export type PremiumPerks = { perks: PremiumPerk[] };
export type AdminPremiumPerks = { value: PremiumPerks; defaults: PremiumPerks; updatedAt: string | null };

export type FeedbackReplyTemplate = { title: string; body: string };
export type FeedbackSettings = { recipients: string[]; replies: FeedbackReplyTemplate[]; dailyLimit: number; autoCloseDays: number };
export type AdminFeedbackSettings = { value: FeedbackSettings; defaults: FeedbackSettings; updatedAt: string | null };

export type FeedbackCategory = "idea" | "bug" | "content" | "other";
export type FeedbackStatus = "open" | "answered" | "closed";
export type FeedbackUser = { id: string; email: string; displayName: string };
export type FeedbackMessage = { id: string; fromAdmin: boolean; authorName: string | null; body: string; images: string[]; createdAt: string };
export type FeedbackCounts = { open: number; answered: number; closed: number; unread: number };
export type AdminFeedbackSummary = {
  id: string;
  category: FeedbackCategory;
  subject: string;
  status: FeedbackStatus;
  unread: boolean;
  createdAt: string;
  lastMessageAt: string;
  messages: number;
  user: FeedbackUser;
  wordText: string | null;
};
export type AdminFeedbackPage = { items: AdminFeedbackSummary[]; total: number; counts: FeedbackCounts };
export type AdminFeedbackTicket = {
  id: string;
  category: FeedbackCategory;
  subject: string;
  status: FeedbackStatus;
  closedBy: "user" | "admin" | "auto" | null;
  createdAt: string;
  lastMessageAt: string;
  appVersion: string | null;
  platform: string | null;
  device: string | null;
  user: FeedbackUser;
  word: { id: string; text: string; meaningVi: string; level: string } | null;
  messages: FeedbackMessage[];
};
export type FeedbackQuery = { status?: string; category?: string; q?: string; page?: number; pageSize?: number };

export const isPremium = (u: Pick<AdminUser, "premiumUntil">) => !!u.premiumUntil && new Date(u.premiumUntil) > new Date();

export type Paged<T> = { items: T[]; total: number; page: number; pageSize: number };

export type VocabularyMeta = { partsOfSpeech: string[]; levels: string[]; decks: { id: string; titleVi: string }[] };

export type AdminDeck = {
  id: string;
  titleVi: string;
  icon: string;
  sortOrder: number;
  published: boolean;
  wordCount: number;
  hiddenWords: number;
  levels: string | null;
};
export type SaveDeck = { id?: string; titleVi: string; icon: string; published: boolean };

export type AdminWord = {
  id: string;
  deckId: string;
  deckTitleVi: string;
  word: string;
  ipa: string;
  pos: string;
  level: string;
  meaningVi: string;
  example: string;
  exampleVi: string;
  imageUrl: string | null;
  sortOrder: number;
  published: boolean;
  editedAt: string | null;
  learners: number;
  /** Picked automatically and not approved yet; the app hides it. */
  imagePending: boolean;
  imageCredit: ImageCredit | null;
};
export type ImageCredit = { source: string; author: string | null; authorUrl: string | null; sourceUrl: string | null };
export type StockImage = {
  source: string;
  id: string;
  previewUrl: string;
  width: number;
  height: number;
  author: string;
  authorUrl: string | null;
  pageUrl: string;
  description: string | null;
};
export type StockSearch = { query: string; items: StockImage[]; sources: string[]; errors: string[] };
export type StockRef = { source: string; id: string };
export type AutoImageRequest = { level?: string; deckId?: string; pos?: string; after?: string; batch?: number };
export type AutoImageResult = {
  assigned: number;
  items: { wordId: string; word: string; imageUrl: string | null; source: string | null }[];
  next: string | null;
  remaining: number;
  warning: string | null;
  stopped: boolean;
};
export type SaveWord = Pick<
  AdminWord,
  "deckId" | "word" | "ipa" | "pos" | "level" | "meaningVi" | "example" | "exampleVi" | "imageUrl" | "published"
>;
export type WordFilters = {
  q?: string;
  deckId?: string;
  level?: string;
  pos?: string;
  missing?: string;
  published?: string;
  page?: number;
  pageSize?: number;
};

export type MediaItem = {
  id: string;
  url: string;
  originalName: string;
  width: number;
  height: number;
  bytes: number;
  createdAt: string;
  usedBy: number;
  credit: ImageCredit | null;
  /** First few words using the image; `usedBy` has the full count. */
  words: { id: string; word: string; level: string; deckTitle: string }[];
};

export type Bilingual = { en: string; vi: string };
export type SectionItem = {
  textVi?: string;
  example?: Bilingual | null;
  en?: string;
  vi?: string;
  wrong?: string;
  right?: string;
  noteVi?: string;
};
export type FormulaRow = { kind: string; pattern: string; example?: Bilingual | null };
/** One theory block (docs/grammar-lesson-schema.md); which fields apply depends on `type`. */
export type GrammarSection = {
  type: string;
  title?: string | null;
  textVi?: string;
  items?: SectionItem[];
  rows?: FormulaRow[];
  headers?: string[];
  cells?: string[][];
  words?: string[];
};
export type GrammarExercise = {
  id: string;
  type: string;
  prompt?: string;
  promptVi?: string;
  instructionVi?: string;
  source?: string;
  sentence?: string;
  options?: string[];
  answer?: string;
  answers?: string[];
  distractors?: string[];
  correction?: string;
  explanationVi: string;
};
export type GrammarLesson = {
  slug: string;
  version: number;
  titleVi: string;
  titleEn?: string | null;
  level: string;
  order: number;
  summaryVi: string;
  quizSize?: number | null;
  published?: boolean | null;
  sections: GrammarSection[];
  exercises: GrammarExercise[];
};
export type AdminGrammarSummary = {
  slug: string;
  titleVi: string;
  titleEn: string | null;
  level: string;
  sortOrder: number;
  published: boolean;
  quizSize: number;
  sectionCount: number;
  exerciseCount: number;
  version: number;
  updatedAt: string;
  editedAt: string | null;
  learners: number;
};
export type AdminGrammarDetail = {
  lesson: GrammarLesson;
  learners: number;
  updatedAt: string;
  editedAt: string | null;
  problems: string[];
};

/** A spreadsheet row; a missing column is null (keeps the stored value), an empty cell is "". */
export type ImportWordRow = {
  line: number;
  id: string | null;
  word: string | null;
  pos: string | null;
  level: string | null;
  deck: string | null;
  meaningVi: string | null;
  ipa: string | null;
  example: string | null;
  exampleVi: string | null;
  imageUrl: string | null;
  published: string | null;
};
export type ImportStatus = "create" | "update" | "unchanged" | "duplicate" | "error";
export type ImportWordRowResult = {
  line: number;
  word: string;
  pos: string;
  status: ImportStatus;
  id: string | null;
  messages: string[];
  changes: string[];
};
export type ImportWordsResult = {
  created: number;
  updated: number;
  unchanged: number;
  duplicates: number;
  errors: number;
  committed: boolean;
  rows: ImportWordRowResult[];
};
export type ExportWord = {
  id: string;
  word: string;
  pos: string;
  level: string;
  deck: string;
  deckTitleVi: string;
  meaningVi: string;
  ipa: string;
  example: string;
  exampleVi: string;
  imageUrl: string | null;
  published: boolean;
};
export type ImportGrammarRow = { slug: string; titleVi: string; status: ImportStatus; currentVersion: number | null; problems: string[] };
export type ImportGrammarResult = {
  created: number;
  updated: number;
  unchanged: number;
  errors: number;
  committed: boolean;
  rows: ImportGrammarRow[];
};

export type ListeningKind = "dialogue" | "story" | "news";
export type ListeningSpeaker = { key: string; name: string; voice: string };
export type ListeningLine = { speaker: string; en: string; vi: string };
/** A listening piece (docs/listening.md); audio is generated from it on the server. */
export type ListeningLesson = {
  slug: string;
  version: number;
  titleEn: string;
  titleVi: string;
  kind: ListeningKind;
  level: string;
  topic?: string | null;
  order: number;
  summaryVi: string;
  published?: boolean | null;
  speakers: ListeningSpeaker[];
  lines: ListeningLine[];
};
export type ListeningAudioState = "none" | "ready" | "stale" | "running" | "failed";
export type AdminListeningSummary = {
  slug: string;
  titleEn: string;
  titleVi: string;
  kind: ListeningKind;
  level: string;
  topic: string | null;
  sortOrder: number;
  published: boolean;
  lineCount: number;
  chars: number;
  durationMs: number | null;
  audioState: ListeningAudioState;
  listeners: number;
  completions: number;
  likes: number;
  version: number;
  updatedAt: string;
  editedAt: string | null;
};
export type AdminListeningAudio = {
  state: ListeningAudioState;
  url: string | null;
  durationMs: number | null;
  /** [startMs, endMs] per line while the audio matches the script. */
  timings: [number, number][] | null;
  done: number;
  total: number;
  error: string | null;
};
export type AdminListeningDetail = {
  lesson: ListeningLesson;
  audio: AdminListeningAudio;
  chars: number;
  listeners: number;
  completions: number;
  likes: number;
  updatedAt: string;
  editedAt: string | null;
  problems: string[];
};
export type ListeningVoice = { name: string; label: string; accent: string; gender: string };
export type SpeechStatus = {
  configured: boolean;
  region: string | null;
  voices: ListeningVoice[];
  month: string;
  charsUsed: number;
  monthlyCharLimit: number;
};
export type ListeningDraftStatus = { configured: boolean; model: string };
export type ListeningDraftLength = "short" | "medium" | "long";
export type ListeningDraftRequest = { level: string; kind: ListeningKind; topic?: string; notes?: string; length: ListeningDraftLength };
export type ListeningDraft = { lesson: ListeningLesson; problems: string[] };
export type ImportListeningRow = { slug: string; titleEn: string; status: ImportStatus; currentVersion: number | null; problems: string[] };
export type ImportListeningResult = {
  created: number;
  updated: number;
  unchanged: number;
  errors: number;
  committed: boolean;
  rows: ImportListeningRow[];
};

export type AuditEntry = {
  id: string;
  at: string;
  userName: string;
  entityType: string;
  entityId: string;
  action: string;
  summary: string;
  restorable: boolean;
};
export type AuditDetail = {
  entry: AuditEntry;
  before: Record<string, unknown> | null;
  after: Record<string, unknown> | null;
  exists: boolean;
};
export type AuditFilters = { entityType?: string; entityId?: string; q?: string; page?: number; pageSize?: number };

const json = (method: string, body: unknown): RequestInit => ({ method, body: JSON.stringify(body) });

function query(params: Record<string, string | number | undefined>) {
  const qs = new URLSearchParams();
  for (const [k, v] of Object.entries(params)) if (v !== undefined && v !== "") qs.set(k, String(v));
  return qs.toString();
}

export const api = {
  login: (email: string, password: string) =>
    request<{ accessToken: string }>("/api/auth/login", json("POST", { email, password })),
  sendResetCode: (email: string) =>
    request<{ resendAfterSeconds: number; expiresInMinutes: number }>("/api/auth/password/code", json("POST", { email })),
  resetPassword: (email: string, code: string, newPassword: string) =>
    request<{ accessToken: string }>("/api/auth/password/reset", json("POST", { email, code, newPassword })),
  me: () => request<AdminIdentity>("/api/admin/me"),
  overview: () => request<Overview>("/api/admin/overview"),

  users: (q: UserQuery) => request<Paged<AdminUser>>(`/api/admin/users?${query(q)}`),
  user: (id: string) => request<AdminUserDetail>(`/api/admin/users/${id}`),
  createUser: (u: CreateUser) => request<AdminUserDetail>("/api/admin/users", json("POST", u)),
  changePassword: (currentPassword: string, newPassword: string) =>
    request<void>("/api/me/password", json("POST", { currentPassword, newPassword })),
  setUserRole: (id: string, role: AdminUser["role"]) => request<AdminUserDetail>(`/api/admin/users/${id}/role`, json("PUT", { role })),
  setUserLocked: (id: string, locked: boolean) => request<AdminUserDetail>(`/api/admin/users/${id}/lock`, json("PUT", { locked })),
  setUserPremium: (id: string, until: string | null) =>
    request<AdminUserDetail>(`/api/admin/users/${id}/premium`, json("PUT", { until })),

  settings: () => request<AdminSettings>("/api/admin/settings"),
  saveNotificationSettings: (c: NotificationConfig) => request<AdminSettings>("/api/admin/settings/notifications", json("PUT", c)),
  resetNotificationSettings: () => request<AdminSettings>("/api/admin/settings/notifications/reset", { method: "POST" }),
  saveListeningSettings: (c: ListeningConfig) => request<AdminSettings>("/api/admin/settings/listening", json("PUT", c)),
  savePronunciationSettings: (c: PronunciationConfig) =>
    request<AdminSettings>("/api/admin/settings/pronunciation", json("PUT", c)),
  resetPronunciationSettings: () => request<AdminSettings>("/api/admin/settings/pronunciation/reset", { method: "POST" }),
  about: () => request<AdminAbout>("/api/admin/about"),
  saveAbout: (c: AboutContent) => request<AdminAbout>("/api/admin/about", json("PUT", c)),
  resetAbout: () => request<AdminAbout>("/api/admin/about/reset", { method: "POST" }),
  premiumPerks: () => request<AdminPremiumPerks>("/api/admin/premium-perks"),
  savePremiumPerks: (p: PremiumPerks) => request<AdminPremiumPerks>("/api/admin/premium-perks", json("PUT", p)),
  resetPremiumPerks: () => request<AdminPremiumPerks>("/api/admin/premium-perks/reset", { method: "POST" }),
  feedbackSettings: () => request<AdminFeedbackSettings>("/api/admin/feedback-settings"),
  saveFeedbackSettings: (s: FeedbackSettings) => request<AdminFeedbackSettings>("/api/admin/feedback-settings", json("PUT", s)),
  resetFeedbackSettings: () => request<AdminFeedbackSettings>("/api/admin/feedback-settings/reset", { method: "POST" }),
  feedbackList: (q: FeedbackQuery) => request<AdminFeedbackPage>(`/api/admin/feedback?${query(q)}`),
  feedbackCounts: () => request<FeedbackCounts>("/api/admin/feedback/counts"),
  feedbackTicket: (id: string) => request<AdminFeedbackTicket>(`/api/admin/feedback/${id}`),
  replyFeedback: (id: string, body: string, close: boolean, images: File[] = []) => {
    const form = new FormData();
    form.append("body", body);
    form.append("close", String(close));
    for (const image of images) form.append("images", image);
    return request<AdminFeedbackTicket>(`/api/admin/feedback/${id}/messages`, { method: "POST", body: form });
  },
  closeFeedback: (id: string) => request<AdminFeedbackTicket>(`/api/admin/feedback/${id}/close`, { method: "POST" }),
  reopenFeedback: (id: string) => request<AdminFeedbackTicket>(`/api/admin/feedback/${id}/reopen`, { method: "POST" }),

  meta: () => request<VocabularyMeta>("/api/admin/vocabulary/meta"),

  decks: () => request<AdminDeck[]>("/api/admin/decks"),
  createDeck: (d: SaveDeck) => request<AdminDeck>("/api/admin/decks", json("POST", d)),
  updateDeck: (id: string, d: SaveDeck) => request<AdminDeck>(`/api/admin/decks/${id}`, json("PUT", d)),
  reorderDecks: (ids: string[]) => request<void>("/api/admin/decks/order", json("PUT", { ids })),
  deleteDeck: (id: string) => request<void>(`/api/admin/decks/${id}`, { method: "DELETE" }),

  words: (f: WordFilters) => request<Paged<AdminWord>>(`/api/admin/words?${query(f)}`),
  word: (id: string) => request<AdminWord>(`/api/admin/words/${encodeURIComponent(id)}`),
  createWord: (w: SaveWord) => request<AdminWord>("/api/admin/words", json("POST", w)),
  updateWord: (id: string, w: SaveWord) => request<AdminWord>(`/api/admin/words/${encodeURIComponent(id)}`, json("PUT", w)),
  deleteWord: (id: string) => request<void>(`/api/admin/words/${encodeURIComponent(id)}`, { method: "DELETE" }),
  exportWords: (f: WordFilters) => request<ExportWord[]>(`/api/admin/words/export?${query({ ...f, page: undefined, pageSize: undefined })}`),
  importWords: (rows: ImportWordRow[], updateExisting: boolean, commit: boolean) =>
    request<ImportWordsResult>("/api/admin/words/import", json("POST", { rows, updateExisting, commit })),

  grammarLessons: () => request<AdminGrammarSummary[]>("/api/admin/grammar"),
  grammarLesson: (slug: string) => request<AdminGrammarDetail>(`/api/admin/grammar/${slug}`),
  createGrammar: (l: GrammarLesson) => request<AdminGrammarDetail>("/api/admin/grammar", json("POST", l)),
  updateGrammar: (slug: string, l: GrammarLesson) => request<AdminGrammarDetail>(`/api/admin/grammar/${slug}`, json("PUT", l)),
  validateGrammar: (l: GrammarLesson) => request<{ problems: string[] }>("/api/admin/grammar/validate", json("POST", l)),
  reorderGrammar: (ids: string[]) => request<void>("/api/admin/grammar/order", json("PUT", { ids })),
  deleteGrammar: (slug: string) => request<void>(`/api/admin/grammar/${slug}`, { method: "DELETE" }),
  exportGrammar: () => request<GrammarLesson[]>("/api/admin/grammar/export"),
  listeningLessons: () => request<AdminListeningSummary[]>("/api/admin/listening"),
  listeningLesson: (slug: string) => request<AdminListeningDetail>(`/api/admin/listening/${slug}`),
  createListening: (l: ListeningLesson) => request<AdminListeningDetail>("/api/admin/listening", json("POST", l)),
  updateListening: (slug: string, l: ListeningLesson) => request<AdminListeningDetail>(`/api/admin/listening/${slug}`, json("PUT", l)),
  validateListening: (l: ListeningLesson) => request<{ problems: string[] }>("/api/admin/listening/validate", json("POST", l)),
  reorderListening: (ids: string[]) => request<void>("/api/admin/listening/order", json("PUT", { ids })),
  deleteListening: (slug: string) => request<void>(`/api/admin/listening/${slug}`, { method: "DELETE" }),
  exportListening: () => request<ListeningLesson[]>("/api/admin/listening/export"),
  importListening: (lessons: unknown[], commit: boolean) =>
    request<ImportListeningResult>("/api/admin/listening/import", json("POST", { lessons, commit })),
  generateListeningAudio: (slug: string) => request<AdminListeningAudio>(`/api/admin/listening/${slug}/audio`, { method: "POST" }),
  speechStatus: () => request<SpeechStatus>("/api/admin/listening/speech"),
  listeningDraftStatus: () => request<ListeningDraftStatus>("/api/admin/listening/draft"),
  draftListening: (r: ListeningDraftRequest) => request<ListeningDraft>("/api/admin/listening/draft", json("POST", r)),
  previewVoice: (voice: string, text?: string, level?: string) => requestBlob("/api/admin/listening/speech/preview", json("POST", { voice, text, level })),
  importGrammar: (lessons: unknown[], commit: boolean) =>
    request<ImportGrammarResult>("/api/admin/grammar/import", json("POST", { lessons, commit })),

  audit: (f: AuditFilters) => request<Paged<AuditEntry>>(`/api/admin/audit?${query(f)}`),
  auditEntry: (id: string) => request<AuditDetail>(`/api/admin/audit/${id}`),
  restoreAudit: (id: string) => request<{ entityType: string; entityId: string }>(`/api/admin/audit/${id}/restore`, { method: "POST" }),

  media: () => request<MediaItem[]>("/api/admin/media"),
  uploadMedia: (file: File, crop = true) => {
    const form = new FormData();
    form.append("file", file);
    form.append("crop", String(crop));
    return request<MediaItem>("/api/admin/media", { method: "POST", body: form });
  },
  deleteMedia: (id: string) => request<void>(`/api/admin/media/${id}`, { method: "DELETE" }),

  searchStock: (q: string, page = 1) => request<StockSearch>(`/api/admin/stock-images?${query({ q, page })}`),
  importStock: (ref: StockRef) => request<MediaItem>("/api/admin/stock-images/import", json("POST", ref)),
  setWordStockImage: (id: string, ref: StockRef) =>
    request<AdminWord>(`/api/admin/words/${encodeURIComponent(id)}/image`, json("PUT", ref)),
  approveWordImage: (id: string) => request<AdminWord>(`/api/admin/words/${encodeURIComponent(id)}/image/approve`, { method: "POST" }),
  removeWordImage: (id: string) => request<AdminWord>(`/api/admin/words/${encodeURIComponent(id)}/image`, { method: "DELETE" }),
  autoImages: (r: AutoImageRequest) => request<AutoImageResult>("/api/admin/words/auto-images", json("POST", r)),
};

export const stockLabel = (source: string) => (source === "pexels" ? "Pexels" : source === "pixabay" ? "Pixabay" : source);

/** Uploaded images are "/media/…" paths on the API host. */
export const mediaSrc = (url: string) => (url.startsWith("/") ? `${BASE}${url}` : url);
