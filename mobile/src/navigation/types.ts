import type { NavigatorScreenParams } from "@react-navigation/native";
import type { FeedbackCategory, GrammarMixedScope, VocabLevel, WritingSubmission } from "../api/client";

/**
 * `promptId` null = free writing at `level` (the learner types a topic). `text` / `parentId` come from
 * "Viết lại bài này" on a graded paragraph.
 */
export type WritingEditorParams = {
  promptId: string | null;
  level: VocabLevel;
  title: string;
  promptEn?: string | null;
  guideVi?: string;
  keyPhrases?: string[];
  minWords?: number;
  maxWords?: number;
  topic?: string | null;
  text?: string;
  parentId?: string;
};

/** "mix" alternates typed and spoken sentences. */
export type PracticeMode = "type" | "speak" | "mix";

/** No params (or mode "due") = today's scheduled review; "practice" never raises levels; `weak` = "Ôn từ hay sai". */
export type ReviewParams =
  | { mode: "due" }
  | { mode: "practice"; deckId?: string; wordIds?: string[]; weak?: boolean; title?: string };

export type RootStackParamList = {
  Welcome: undefined;
  Login: undefined;
  Register: undefined;
  ForgotPassword: { email?: string } | undefined;
  Main: NavigatorScreenParams<MainTabParamList> | undefined;
  Flashcard: { deckId: string; titleVi: string; level?: string };
  GrammarLesson: { slug: string; titleVi: string };
  Listening: { slug: string; titleVi: string };
  /** `all` = every line in order instead of a random handful. */
  Dictation: { slug: string; all?: boolean };
  Speaking: { slug: string; all?: boolean };
  SentencePractice: { level: VocabLevel; mode: PracticeMode };
  ConversationHub: undefined;
  /** `scenarioId` null = free talk at `level`. */
  Conversation: { scenarioId: string | null; level: VocabLevel; title: string };
  WritingHub: undefined;
  WritingEditor: WritingEditorParams;
  /** `submission` right after grading saves a reload; from the history only `id` is known. */
  WritingResult: { id: string; submission?: WritingSubmission };
  Review: ReviewParams | undefined;
  GrammarReview: GrammarReviewParams | undefined;
  WordSearch: undefined;
  Placement: undefined;
  About: undefined;
  Settings: undefined;
  Premium: undefined;
  AdRewards: undefined;
  Invite: undefined;
  /** `start` = the week's Monday ("YYYY-MM-DD"); defaults to the current week. */
  Weekly: { start?: string } | undefined;
  WeakWords: undefined;
  Feedback: undefined;
  /** wordId/wordText come from "Báo lỗi từ này" on a word card. */
  FeedbackNew: { category?: FeedbackCategory; wordId?: string; wordText?: string } | undefined;
  FeedbackThread: { id: string; justSent?: boolean };
};

/** "ielts" only exists in the Study hub, for partner students with that feature. */
export type HubTab = "vocab" | "grammar" | "ielts";

export type GrammarReviewParams =
  | { mode: "due" }
  | { mode: "practice"; slug?: string; title?: string }
  | { mode: "mixed"; scope: GrammarMixedScope };

export type MainTabParamList = {
  Home: undefined;
  Study: { tab?: HubTab } | undefined;
  Practice: { tab?: HubTab } | undefined;
  Sentences: undefined;
  Listen: undefined;
  Profile: undefined;
};
