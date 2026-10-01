export type RootStackParamList = {
  Welcome: undefined;
  Login: undefined;
  Register: undefined;
  Main: undefined;
  Flashcard: { deckId: string; titleVi: string };
  GrammarLesson: { slug: string; titleVi: string };
};

export type MainTabParamList = {
  Home: undefined;
  Study: undefined;
  Profile: undefined;
};
