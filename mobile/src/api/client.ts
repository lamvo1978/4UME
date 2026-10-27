import AsyncStorage from "@react-native-async-storage/async-storage";
import { File } from "expo-file-system";
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
  /** Level new vocabulary starts at; null until the placement test or a manual pick. Changed via `applyPlacement`. */
  vocabLevel: VocabLevel | null;
  easyWordMode: EasyWordMode;
  placementTakenAt: string | null;
  /** Key of a built-in picture in `AVATARS`; null or "" shows the name's initial. Missing on older servers. */
  avatar?: string | null;
};

export const VOCAB_LEVELS = ["A1", "A2", "B1", "B2"] as const;
export type VocabLevel = (typeof VOCAB_LEVELS)[number];
/** Words below the start level: "skip" sorts them last in decks, "known" marks them known with rare reviews. */
export type EasyWordMode = "skip" | "known";

export type PlacementQuestion = {
  wordId: string;
  word: string;
  ipa: string;
  pos: string;
  options: string[];
  answer: number;
};
export type PlacementLevel = { level: VocabLevel; questions: PlacementQuestion[] };
/** `prompt` has ___ for the gap; `lessonSlug` is the grammar lesson the question tests. */
export type PlacementGrammarQuestion = { id: string; prompt: string; options: string[]; answer: number; lessonSlug: string | null };
export type PlacementGrammarLevel = { level: VocabLevel; questions: PlacementGrammarQuestion[] };
export type PlacementResult = { me: Me; markedKnown: number; cleared: number };

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

export type StreakFreezeConfig = {
  freezeEvery: number;
  premiumMonthlyGrant: boolean;
  maxFreezesFree: number;
  maxFreezesPremium: number;
};

/** Reminder wording edited in the admin; `{name}` placeholders are filled in by the app. */
export type NotificationTexts = {
  dueTitles: string[];
  newWordsTitles: string[];
  encouragementTitles: string[];
  startStreakLines: string[];
  streakLines: string[];
  milestoneTomorrow: string;
  milestoneSoon: string;
  rescueFreezeTitle: string;
  rescueFreezeBodies: string[];
  rescueTitles: string[];
  rescueBodies: string[];
  comebackTitles: string[];
  comebackDueBody: string;
  comebackNewBody: string;
  promptTitle: string;
  promptBody: string;
};

export type AppConfig = {
  notifications: NotificationConfig;
  listening?: ListeningConfig;
  /** Missing on servers older than the admin editor; the app falls back to its built-in texts. */
  notificationTexts?: Partial<NotificationTexts>;
  streakFreeze?: StreakFreezeConfig;
};

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
export type WordVoice = "female" | "male";

/** `audioUrl` is null until the sentence has a recording; the app reads it with the device voice meanwhile. */
export type PracticeSentence = { id: string; level: VocabLevel; topic: string; en: string; vi: string; audioUrl: string | null };
/** "gift" = open until midnight for keeping the streak; "trial" = the one free round is left. */
export type PracticeAccessState = "premium" | "gift" | "trial" | "locked";
/** `daysToGift`: study days still needed for the next gift day (0 = earned, it is tomorrow); null when the gift is off. */
export type PracticeAccess = { state: PracticeAccessState; giftEveryDays: number; daysToGift: number | null };
export type PracticeOverview = { levels: { level: VocabLevel; count: number }[]; access: PracticeAccess };

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
  /** Premium is active now (no ads), from any source. */
  premium: boolean;
  /** Hidden features unlocked by a partner code, e.g. "ielts". */
  features?: string[];
  /** Set while the learner is a partner centre's student. */
  partnerName?: string | null;
  /** End of the centre's access; null runs until the centre ends it. */
  partnerUntil?: string | null;
  /** Show the Home banner ad: switched on in admin and not Premium. */
  adsBanner?: boolean;
  premiumUntil?: string | null;
  conversationAddon?: boolean;
  conversationAddonUntil?: string | null;
};

export const FEATURE_IELTS = "ielts";
export const hasFeature = (me: Me | null | undefined, key: string) => !!me?.features?.includes(key);

export type Invitee = {
  displayName: string;
  joinedAt: string;
  studyDays: number;
  rewardedAt: string | null;
  /** Counting is on hold while the friend studies with a partner centre. */
  paused?: boolean;
  avatar?: string | null;
};
export type MyReferral = {
  enabled: boolean;
  code: string;
  link: string;
  requiredStudyDays: number;
  rewardDays: number;
  maxRewards: number;
  rewardsEarned: number;
  /** The account is new enough and hasn't used an invite code yet. */
  canEnterInviteCode: boolean;
  invitedBy: string | null;
  invitees: Invitee[];
  /** Days after sign-up during which an invite code is accepted. */
  joinWindowDays: number;
  /** This learner's own invite reward is on hold while they study with a partner centre. */
  invitePaused?: boolean;
};
export type RedeemResult = { kind: "partner" | "referral"; message: string };

export type StudyDay = { date: string; newWords: number; reviews: number; grammarItems: number; frozen: boolean };

export type Streak = {
  current: number;
  best: number;
  freezes: number;
  maxFreezes: number;
  /** Free-tier milestone for earning a freeze; from admin config. */
  freezeEvery?: number;
  freezeOnStreak?: boolean;
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

/** A verb phrase of the answered question and its tense, e.g. "were preparing" · "quá khứ tiếp diễn". */
export type VerbNote = { phrase: string; tenseVi: string };
type ExerciseBase = { id: string; explanationVi: string; verbs?: VerbNote[] };

export type GrammarExercise =
  | (ExerciseBase & { type: "mcq"; prompt: string; options: string[]; answer: string })
  | (ExerciseBase & { type: "fill"; prompt: string; answers: string[] })
  | (ExerciseBase & { type: "order"; promptVi: string; answer: string; distractors?: string[] })
  | (ExerciseBase & { type: "transform"; instructionVi: string; source: string; answer: string; distractors?: string[] })
  | (ExerciseBase & { type: "error"; sentence: string; correction: string })
  | (ExerciseBase & { type: "cloze"; prompt: string; blanks: string[][] });

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
  practice?: GrammarExercise[];
};

/** "learned" = lessons done at least once, or a CEFR level. */
export type GrammarMixedScope = "learned" | "A1" | "A2" | "B1" | "B2";

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
  /** Words under "Ôn từ hay sai"; always 0 for grammar. */
  weakCount: number;
};

export type ReviewItem = {
  level: number;
  word: Word;
  wordOptions: string[];
  meaningOptions: string[];
  /** Latest pronunciation score, only sent for "Ôn từ hay sai". */
  speakScore?: number | null;
};

export type WeakWord = {
  wordId: string;
  word: string;
  ipa: string;
  meaningVi: string;
  /** Above 0 = missed lately; each clean answer lowers it by 1. */
  weakScore: number;
  speakScore: number | null;
};

/** Below this the latest pronunciation score puts a word under "Ôn từ hay sai" (matches the server). */
export const WEAK_SPEAK_SCORE = 70;

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

/** Detailed (Azure) checks left today; `remaining` is 0 also when the feature is off or the monthly budget is spent. */
/** Content of the About screen, edited in the admin web. Hidden sections/items are already filtered out. */
export type AboutContent = {
  tagline: string;
  sections: { title: string; items: { icon: string; title: string; body: string; url: string | null }[] }[];
};

/** Benefits on the Premium screen, edited in the admin web; hidden ones are already filtered out. */
export type PremiumPerk = { icon: string; title: string; body: string; soon: boolean };
/** Price in VND; empty list while the admin hides prices. */
export type PremiumPlan = { months: number; price: number; badge: string };

export type PronunciationStatus = {
  enabled: boolean;
  premium: boolean;
  premiumUntil: string | null;
  dailyLimit: number;
  usedToday: number;
  remaining: number;
  serviceAvailable: boolean;
  premiumDailyLimit: number;
  freeDailyLimit: number;
  /** Each watched rewarded ad adds one check today; already included in `dailyLimit`. */
  adsWatchedToday: number;
  /** 0 = no ads offered: Premium, ads switched off, or the scorer is paused. */
  adsDailyLimit: number;
  adsLeftToday: number;
  /** Premium through a partner centre. */
  partnerName?: string | null;
  /** End of the centre's access; null runs until the centre ends it. */
  partnerUntil?: string | null;
  /** The learner's own Premium days on hold, resumed when the centre's access ends. */
  pausedPremiumDays?: number;
  /** No detailed check left, but the word may be checked with the phone's own speech recognition (admin switch). */
  deviceCheck?: boolean;
};

/** Turns left today for "Đàm thoại với AI"; `voice` says whether replies come with an Azure recording. */
export type ConversationStatus = {
  enabled: boolean;
  /** False while the AI isn't configured on the server. */
  available: boolean;
  premium: boolean;
  dailyLimit: number;
  usedToday: number;
  remaining: number;
  freeDailyLimit: number;
  premiumDailyLimit: number;
  maxTurnsPerSession: number;
  voice: "device" | "azure";
  sessionsAllowedToday?: number;
  sessionsUsedToday?: number;
  turnsPerSession?: number;
  nextSessionKind?: string | null;
  blockedReason?: "need_premium" | "no_sessions_left" | null;
  conversationAddon?: boolean;
  conversationAddonUntil?: string | null;
  premiumSessionsPerDay?: number;
  premiumTurnsPerSession?: number;
  addonSessionsPerDay?: number;
  addonTurnsPerSession?: number;
  addonDailyTurnCap?: number;
};

export type ConversationScenario = {
  id: string;
  level: VocabLevel;
  titleVi: string;
  icon: string;
  goalVi: string;
  aiRole: string;
  keyPhrases: string[];
};

export type ConversationCorrection = { original: string; corrected: string; explainVi: string };

export type ConversationTurn = {
  id: string;
  fromLearner: boolean;
  text: string;
  correction: ConversationCorrection | null;
  hintVi: string | null;
  suggestions: string[];
  /** Azure recording of an AI turn; null = read it with the phone's voice. */
  audioUrl: string | null;
};

export type ConversationStart = {
  id: string;
  level: VocabLevel;
  scenario: ConversationScenario | null;
  opening: ConversationTurn;
  status: ConversationStatus;
};

export type ConversationReply = {
  learner: ConversationTurn;
  reply: ConversationTurn;
  goalDone: boolean;
  /** No more messages fit in this conversation. */
  sessionFull: boolean;
  status: ConversationStatus;
};

export type ConversationSummary = {
  score: number;
  feedbackVi: string;
  mistakes: ConversationCorrection[];
  phrases: { en: string; vi: string }[];
  learnerTurns: number;
};

/** Checks left today for "Luyện viết với AI". */
export type WritingStatus = {
  enabled: boolean;
  /** False while no grading AI is configured on the server. */
  available: boolean;
  premium: boolean;
  dailyLimit: number;
  usedToday: number;
  remaining: number;
  freeDailyLimit: number;
  premiumDailyLimit: number;
  rewritePremiumOnly: boolean;
  freeHistoryCount: number;
  /** Everyone's checks today reached the share open to this plan. */
  dayFull: boolean;
};

export type WritingPrompt = {
  id: string;
  level: VocabLevel;
  titleVi: string;
  icon: string;
  promptEn: string;
  guideVi: string;
  minWords: number;
  maxWords: number;
  keyPhrases: string[];
};

export type WritingCorrectionKind = "grammar" | "word" | "spelling" | "punctuation" | "style";

/** `start` is where `original` sits in the learner's text; -1 when it couldn't be found. */
export type WritingCorrection = { original: string; corrected: string; explainVi: string; kind: WritingCorrectionKind; start: number };

export type WritingResult = {
  score: number;
  scores: { grammar: number; vocabulary: number; coherence: number; task: number };
  feedbackVi: string;
  corrections: WritingCorrection[];
  /** null when locked for the free plan (`rewritePreview` is still shown). */
  rewrite: string | null;
  rewriteLocked: boolean;
  rewritePreview: string;
  upgrades: { en: string; vi: string; whyVi: string }[];
};

export type WritingSubmission = {
  id: string;
  promptId: string | null;
  promptTitle: string | null;
  promptEn: string | null;
  level: VocabLevel;
  topic: string | null;
  text: string;
  wordCount: number;
  createdAt: string;
  result: WritingResult;
};

export type WritingHistoryItem = { id: string; title: string; level: VocabLevel; score: number; wordCount: number; createdAt: string; excerpt: string };
/** `hidden` = older paragraphs not listed on the free plan. */
export type WritingHistory = { items: WritingHistoryItem[]; total: number; hidden: number };

/** "Học viên X · đến 30/06/2027" or "· không thời hạn". */
export const partnerLine = (name: string, until: string | null | undefined, formatDate: (iso: string) => string) =>
  `Học viên ${name} · ${until ? `đến ${formatDate(until)}` : "không thời hạn"}`;

export type FeedbackCategory = "idea" | "bug" | "content" | "other";
/** "open" waits for 4UME, "answered" waits for the learner. */
export type FeedbackStatus = "open" | "answered" | "closed";
export type FeedbackMessage = { id: string; fromAdmin: boolean; authorName: string | null; body: string; images: string[]; createdAt: string };
export type FeedbackSummary = {
  id: string;
  category: FeedbackCategory;
  subject: string;
  status: FeedbackStatus;
  unread: boolean;
  createdAt: string;
  lastMessageAt: string;
  wordText: string | null;
};
export type FeedbackTicket = {
  id: string;
  category: FeedbackCategory;
  subject: string;
  status: FeedbackStatus;
  closedBy: "user" | "admin" | "auto" | null;
  createdAt: string;
  lastMessageAt: string;
  word: { id: string; text: string; meaningVi: string; level: string } | null;
  messages: FeedbackMessage[];
};
export type NewFeedback = {
  category: FeedbackCategory;
  body: string;
  wordId?: string;
  appVersion: string;
  platform: string;
  device: string;
  imageUris: string[];
};

export type WeekDay = {
  date: string;
  newWords: number;
  reviews: number;
  grammarItems: number;
  /** Pieces listened to the end, counted even when listening doesn't count toward the streak. */
  listens: number;
  dictationLines: number;
  studied: boolean;
  frozen: boolean;
};
/** Monday–Sunday in the learner's local calendar. */
export type WeekSummary = {
  start: string;
  end: string;
  inProgress: boolean;
  studyDays: number;
  newWords: number;
  reviews: number;
  grammarItems: number;
  listens: number;
  dictationLines: number;
  /** Different words read with an accuracy of 80+. */
  goodPronunciations: number;
  streakAtEnd: number;
  days: WeekDay[];
};
/** Newest week first. */
export type Weekly = {
  today: string;
  /** Admin switch: when off, finishing a piece doesn't make a study day (dictation always does). */
  listensCountTowardStreak: boolean;
  weeks: WeekSummary[];
};

export type PhonemeScore = { phoneme: string; score: number };

export type PronunciationResult = {
  score: number;
  accuracy: number;
  fluency: number;
  completeness: number;
  heard: string;
  words: { word: string; score: number; errorType: string; phonemes: PhonemeScore[] }[];
  status: PronunciationStatus;
};

/** The server answered with an error status; for `assessPronunciation`, 429 means today's detailed checks are used up. */
export class ApiError extends Error {
  constructor(
    message: string,
    readonly status: number,
    /** Machine-readable reason some endpoints add, e.g. "limit" / "dayFull" / "busy" for writing checks. */
    readonly code?: string,
  ) {
    super(message);
  }
}

export const OFFLINE_MESSAGE = "Không có kết nối mạng. Hãy kiểm tra Wi-Fi hoặc dữ liệu di động rồi thử lại.";
const TIMEOUT_MESSAGE = "Mạng chậm hoặc máy chủ chưa phản hồi. Hãy thử lại sau ít phút.";
const UNREADABLE_MESSAGE = "Không kết nối được tới 4UME. Nếu đang dùng Wi-Fi công cộng, hãy đăng nhập Wi-Fi rồi thử lại.";
const SERVER_DOWN_MESSAGE = "Máy chủ 4UME đang bận hoặc bảo trì. Hãy thử lại sau ít phút.";

/** No usable answer from the server: offline, timed out, or a Wi-Fi login page answered instead. */
export class NetworkError extends Error {}

const REQUEST_TIMEOUT_MS = 30_000;
/** An AI reply (plus its recording) can take most of a minute when the first provider is busy. */
const AI_TIMEOUT_MS = 70_000;
/** Uploads (recordings, screenshots) on a slow mobile connection. */
const UPLOAD_TIMEOUT_MS = 90_000;

async function send(path: string, init: RequestInit, timeoutMs: number): Promise<{ res: Response; data: any }> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  let res: Response;
  let text: string;
  try {
    res = await fetch(`${API_BASE}${path}`, { ...init, signal: controller.signal });
    text = await res.text();
  } catch {
    throw new NetworkError(controller.signal.aborted ? TIMEOUT_MESSAGE : OFFLINE_MESSAGE);
  } finally {
    clearTimeout(timer);
  }
  let data: any = null;
  if (text) {
    try {
      data = JSON.parse(text);
    } catch {
      if (res.status >= 500) throw new ApiError(SERVER_DOWN_MESSAGE, res.status);
      throw new NetworkError(UNREADABLE_MESSAGE);
    }
  }
  return { res, data };
}

function errorMessage(status: number, data: any) {
  if (typeof data?.error === "string" && data.error) return data.error as string;
  return status >= 500 ? SERVER_DOWN_MESSAGE : `Lỗi ${status}`;
}

async function authHeaders(): Promise<Record<string, string>> {
  const token = await AsyncStorage.getItem(TOKEN_KEY);
  return token ? { Authorization: `Bearer ${token}` } : {};
}

/** Called when a signed-in request gets 401 (session expired, account locked or deleted). */
let onUnauthorized: () => void = () => undefined;
export function setUnauthorizedHandler(fn: () => void) {
  onUnauthorized = fn;
}

async function request<T>(path: string, init: RequestInit = {}, timeoutMs = REQUEST_TIMEOUT_MS): Promise<T> {
  const auth = await authHeaders();
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    // Lets the server count study days by the user's local calendar.
    "X-Utc-Offset": String(-new Date().getTimezoneOffset()),
    ...auth,
    ...(init.headers as Record<string, string> | undefined),
  };
  const { res, data } = await send(path, { ...init, headers }, timeoutMs);
  if (res.status === 401 && auth.Authorization) {
    onUnauthorized();
    throw new ApiError("Phiên đăng nhập đã hết hạn. Vui lòng đăng nhập lại.", 401);
  }
  if (!res.ok) throw new ApiError(errorMessage(res.status, data), res.status, typeof data?.code === "string" ? data.code : undefined);
  return data as T;
}

async function appendFile(form: FormData, field: string, uri: string, webName: string) {
  if (Platform.OS === "web") {
    form.append(field, await (await fetch(uri)).blob(), webName);
  } else {
    // Expo's fetch rejects React Native's { uri, name, type } parts; it needs a Blob-like File.
    form.append(field, new File(uri));
  }
}

async function postForm<T>(path: string, form: FormData): Promise<T> {
  const auth = await authHeaders();
  const { res, data } = await send(
    path,
    { method: "POST", headers: { "X-Utc-Offset": String(-new Date().getTimezoneOffset()), ...auth }, body: form },
    UPLOAD_TIMEOUT_MS,
  );
  if (res.status === 401 && auth.Authorization) {
    onUnauthorized();
    throw new ApiError("Phiên đăng nhập đã hết hạn. Vui lòng đăng nhập lại.", 401);
  }
  if (!res.ok) throw new ApiError(errorMessage(res.status, data), res.status);
  return data as T;
}

async function assessPronunciation(wordId: string, recordingUri: string): Promise<PronunciationResult> {
  const form = new FormData();
  form.append("wordId", wordId);
  await appendFile(form, "audio", recordingUri, "recording.webm");
  return postForm<PronunciationResult>("/api/pronunciation/assess", form);
}

async function appendImages(form: FormData, imageUris: string[]) {
  for (const [i, uri] of imageUris.entries()) await appendFile(form, "images", uri, `image-${i + 1}.jpg`);
}

async function createFeedback(input: NewFeedback): Promise<FeedbackTicket> {
  const form = new FormData();
  form.append("category", input.category);
  form.append("body", input.body);
  if (input.wordId) form.append("wordId", input.wordId);
  form.append("appVersion", input.appVersion);
  form.append("platform", input.platform);
  form.append("device", input.device);
  await appendImages(form, input.imageUris);
  return postForm<FeedbackTicket>("/api/feedback", form);
}

async function replyFeedback(id: string, body: string, imageUris: string[]): Promise<FeedbackTicket> {
  const form = new FormData();
  form.append("body", body);
  await appendImages(form, imageUris);
  return postForm<FeedbackTicket>(`/api/feedback/${id}/messages`, form);
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
  registerDevice: (token: string, platform: string, appVersion: string) =>
    request<void>("/api/me/devices", { method: "POST", body: JSON.stringify({ token, platform, appVersion }) }),
  removeDevice: (token: string) => request<void>(`/api/me/devices/${encodeURIComponent(token)}`, { method: "DELETE" }),
  notificationOpened: (ids: { logId?: string; broadcastId?: string }) =>
    request<void>("/api/me/notifications/opened", { method: "POST", body: JSON.stringify(ids) }),
  reviewForecast: (days = 7) => request<ReviewForecastDay[]>(`/api/review/forecast?days=${days}`),
  stats: () => request<Stats>("/api/me/stats"),
  weekly: (weeks: number) => request<Weekly>(`/api/me/weekly?weeks=${weeks}`),
  referral: () => request<MyReferral>("/api/me/referral"),
  /** Invite or partner code; the server tells them apart. */
  redeemCode: (code: string) => request<RedeemResult>("/api/codes/redeem", { method: "POST", body: JSON.stringify({ code }) }),
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
  practiceItems: (opts: { deckId?: string; wordIds?: string[]; limit?: number; weak?: boolean } = {}) => {
    const qs = new URLSearchParams({ limit: String(opts.limit ?? 10) });
    if (opts.deckId) qs.set("deckId", opts.deckId);
    if (opts.wordIds?.length) qs.set("wordIds", opts.wordIds.join(","));
    if (opts.weak) qs.set("weak", "true");
    return request<ReviewItem[]>(`/api/review/practice?${qs.toString()}`);
  },
  weakWords: () => request<WeakWord[]>("/api/review/weak"),
  practiceAnswer: (wordId: string, mistakes: number) =>
    request<PracticeAnswerResult>("/api/review/practice/answer", {
      method: "POST",
      body: JSON.stringify({ wordId, mistakes }),
    }),
  pronunciationStatus: () => request<PronunciationStatus>("/api/pronunciation/status"),
  about: () => request<AboutContent>("/api/about"),
  premiumPerks: () =>
    request<{ perks: PremiumPerk[]; plans?: PremiumPlan[]; addonPlans?: PremiumPlan[]; showPrices?: boolean; iapEnabled?: boolean }>(
      "/api/premium-perks",
    ).then((r) => ({
      perks: r.perks,
      plans: r.plans ?? [],
      addonPlans: r.addonPlans ?? [],
      showPrices: r.showPrices !== false,
      iapEnabled: r.iapEnabled ?? false,
    })),
  assessPronunciation,
  /** Development servers only: grants the check a watched ad would. */
  devAdReward: () => request<PronunciationStatus>("/api/ads/dev-reward", { method: "POST" }),
  feedbackList: () => request<FeedbackSummary[]>("/api/feedback"),
  feedbackUnread: () => request<{ count: number }>("/api/feedback/unread").then((r) => r.count),
  feedbackTicket: (id: string) => request<FeedbackTicket>(`/api/feedback/${id}`),
  createFeedback,
  replyFeedback,
  resolveFeedback: (id: string) => request<FeedbackTicket>(`/api/feedback/${id}/resolve`, { method: "POST" }),
  placementQuestions: () => request<PlacementLevel[]>("/api/placement/questions"),
  placementGrammar: () => request<PlacementGrammarLevel[]>("/api/placement/grammar"),
  /** Replaces the previous result: words the last test marked known (and never studied since) are cleared first. */
  applyPlacement: (level: VocabLevel, mode: EasyWordMode, tested: boolean) =>
    request<PlacementResult>("/api/placement/apply", { method: "POST", body: JSON.stringify({ level, mode, tested }) }),
  listeningLessons: () => request<ListeningSummary[]>("/api/listening"),
  listeningLesson: (slug: string) => request<ListeningDetail>(`/api/listening/${slug}`),
  saveListeningProgress: (slug: string, changes: { positionMs?: number; completed?: boolean; liked?: boolean }) =>
    request<ListeningProgress>(`/api/listening/${slug}/progress`, { method: "PUT", body: JSON.stringify(changes) }),
  recordDictation: (slug: string) => request<void>(`/api/listening/${slug}/dictation`, { method: "POST" }),
  /** `url` is null when there is no Azure recording (quota spent or unknown word): read it with the phone's voice. */
  wordAudio: (text: string, voice: WordVoice) =>
    request<{ url: string | null }>(`/api/speech/word?text=${encodeURIComponent(text)}&voice=${voice}`),
  practiceOverview: () => request<PracticeOverview>("/api/practice"),
  practiceSentences: (level: VocabLevel, count = 10) =>
    request<PracticeSentence[]>(`/api/practice/sentences?level=${level}&count=${count}`),
  recordPractice: () => request<void>("/api/practice/record", { method: "POST" }),
  conversationStatus: () => request<ConversationStatus>("/api/conversation/status"),
  conversationScenarios: () => request<ConversationScenario[]>("/api/conversation/scenarios"),
  /** Without `scenarioId` starts free talk at `level`. 429 = today's turns are used up. */
  startConversation: (scenarioId: string | null, level: VocabLevel) =>
    request<ConversationStart>("/api/conversation", { method: "POST", body: JSON.stringify({ scenarioId, level }) }, AI_TIMEOUT_MS),
  sendConversationTurn: (id: string, text: string) =>
    request<ConversationReply>(`/api/conversation/${id}/turns`, { method: "POST", body: JSON.stringify({ text }) }, AI_TIMEOUT_MS),
  endConversation: (id: string) => request<ConversationSummary>(`/api/conversation/${id}/end`, { method: "POST" }, AI_TIMEOUT_MS),
  writingStatus: () => request<WritingStatus>("/api/writing/status"),
  writingPrompts: () => request<WritingPrompt[]>("/api/writing/prompts"),
  /** 429 with `code` "limit" (own checks used up) or "dayFull"; 503 "busy" = AI failed, not counted. */
  submitWriting: (body: { promptId: string | null; level: VocabLevel; topic?: string; text: string; parentId?: string | null }) =>
    request<{ submission: WritingSubmission; status: WritingStatus }>(
      "/api/writing/submissions",
      { method: "POST", body: JSON.stringify(body) },
      AI_TIMEOUT_MS,
    ),
  writingHistory: () => request<WritingHistory>("/api/writing/submissions"),
  writingSubmission: (id: string) => request<WritingSubmission>(`/api/writing/submissions/${id}`),
  deleteWriting: (id: string) => request<void>(`/api/writing/submissions/${id}`, { method: "DELETE" }),
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
  grammarMixed: (scope: GrammarMixedScope, limit = 6) =>
    request<GrammarReviewItem[]>(`/api/grammar/mixed?scope=${scope}&limit=${limit}`),
  completeGrammarMixed: (mistakes: Record<string, number>) =>
    request<{ pulled: number }>("/api/grammar/mixed/complete", {
      method: "POST",
      body: JSON.stringify({ mistakes }),
    }),
};
