import type { NavigatorScreenParams } from "@react-navigation/native";
import type { FeedbackCategory } from "../api/client";

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
  Review: ReviewParams | undefined;
  GrammarReview: GrammarReviewParams | undefined;
  WordSearch: undefined;
  Placement: undefined;
  About: undefined;
  Settings: undefined;
  Premium: undefined;
  AdRewards: undefined;
  /** `start` = the week's Monday ("YYYY-MM-DD"); defaults to the current week. */
  Weekly: { start?: string } | undefined;
  WeakWords: undefined;
  Feedback: undefined;
  /** wordId/wordText come from "Báo lỗi từ này" on a word card. */
  FeedbackNew: { category?: FeedbackCategory; wordId?: string; wordText?: string } | undefined;
  FeedbackThread: { id: string; justSent?: boolean };
};

export type HubTab = "vocab" | "grammar";

export type GrammarReviewParams = { mode: "due" } | { mode: "practice"; slug?: string; title?: string };

export type MainTabParamList = {
  Home: undefined;
  Study: { tab?: HubTab } | undefined;
  Practice: { tab?: HubTab } | undefined;
  Listen: undefined;
  Profile: undefined;
};
