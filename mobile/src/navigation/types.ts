import type { NavigatorScreenParams } from "@react-navigation/native";

/** No params (or mode "due") = today's scheduled review; "practice" never raises levels. */
export type ReviewParams =
  | { mode: "due" }
  | { mode: "practice"; deckId?: string; wordIds?: string[]; title?: string };

export type RootStackParamList = {
  Welcome: undefined;
  Login: undefined;
  Register: undefined;
  Main: NavigatorScreenParams<MainTabParamList> | undefined;
  Flashcard: { deckId: string; titleVi: string };
  GrammarLesson: { slug: string; titleVi: string };
  Review: ReviewParams | undefined;
  GrammarReview: GrammarReviewParams | undefined;
  WordSearch: undefined;
};

export type HubTab = "vocab" | "grammar";

export type GrammarReviewParams = { mode: "due" } | { mode: "practice"; slug?: string; title?: string };

export type MainTabParamList = {
  Home: undefined;
  Study: { tab?: HubTab } | undefined;
  Practice: { tab?: HubTab } | undefined;
  Profile: undefined;
};
