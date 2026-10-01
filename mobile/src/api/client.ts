import AsyncStorage from "@react-native-async-storage/async-storage";
import { Platform } from "react-native";

const TOKEN_KEY = "fourume.token";

/** Android emulator uses 10.0.2.2; iOS simulator / web use localhost. */
export const API_BASE =
  process.env.EXPO_PUBLIC_API_URL ??
  (Platform.OS === "android" ? "http://10.0.2.2:5088" : "http://127.0.0.1:5088");

export type AuthUser = {
  accessToken: string;
  userId: string;
  email: string;
  displayName: string;
};

export type Me = {
  userId: string;
  email: string;
  displayName: string;
  knownWords: number;
  hardWords: number;
  grammarLessonsCompleted: number;
};

export type Deck = {
  id: string;
  titleVi: string;
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
  status: number;
};

export type GrammarLesson = {
  slug: string;
  titleVi: string;
  level: string;
  exerciseCount: number;
  bestScore: number | null;
};

export type GrammarDetail = {
  slug: string;
  titleVi: string;
  level: string;
  summaryVi: string;
  formula: string;
  example: string;
  commonMistakeVi: string;
  exercises: {
    id: string;
    type: string;
    prompt: string;
    options: string[] | null;
    explanation: string;
    answer?: string;
  }[];
};

async function authHeaders(): Promise<Record<string, string>> {
  const token = await AsyncStorage.getItem(TOKEN_KEY);
  return token ? { Authorization: `Bearer ${token}` } : {};
}

async function request<T>(path: string, init: RequestInit = {}): Promise<T> {
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    ...(await authHeaders()),
    ...(init.headers as Record<string, string> | undefined),
  };
  const res = await fetch(`${API_BASE}${path}`, { ...init, headers });
  const text = await res.text();
  const data = text ? JSON.parse(text) : null;
  if (!res.ok) {
    throw new Error(data?.error ?? `Lỗi ${res.status}`);
  }
  return data as T;
}

export const api = {
  saveToken: (token: string) => AsyncStorage.setItem(TOKEN_KEY, token),
  clearToken: () => AsyncStorage.removeItem(TOKEN_KEY),
  getToken: () => AsyncStorage.getItem(TOKEN_KEY),
  register: (email: string, password: string, displayName: string) =>
    request<AuthUser>("/api/auth/register", {
      method: "POST",
      body: JSON.stringify({ email, password, displayName }),
    }),
  login: (email: string, password: string) =>
    request<AuthUser>("/api/auth/login", {
      method: "POST",
      body: JSON.stringify({ email, password }),
    }),
  me: () => request<Me>("/api/me"),
  decks: (level?: string) =>
    request<Deck[]>(`/api/vocabulary/decks${level ? `?level=${level}` : ""}`),
  deckWords: (deckId: string) => request<Word[]>(`/api/vocabulary/decks/${deckId}`),
  updateProgress: (wordId: string, status: number) =>
    request("/api/vocabulary/progress", {
      method: "POST",
      body: JSON.stringify({ wordId, status }),
    }),
  grammarLessons: () => request<GrammarLesson[]>("/api/grammar/lessons"),
  grammarLesson: (slug: string) => request<GrammarDetail>(`/api/grammar/lessons/${slug}`),
  submitGrammar: (slug: string, answers: { exerciseId: string; answer: string }[]) =>
    request<{ score: number; total: number; results: { exerciseId: string; correct: boolean; correctAnswer: string; explanation: string }[] }>(
      `/api/grammar/lessons/${slug}/submit`,
      { method: "POST", body: JSON.stringify({ answers }) }
    ),
};
