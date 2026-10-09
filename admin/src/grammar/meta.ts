import type { GrammarExercise, GrammarLesson, GrammarSection } from "../api";

export const LEVELS = ["A1", "A2", "B1", "B2"];

/** Same default titles as mobile/src/components/grammar/TheoryView.tsx. */
export const SECTION_TYPES: { type: string; label: string; hint: string }[] = [
  { type: "usage", label: "Cách dùng", hint: "Các ý cách dùng, mỗi ý kèm ví dụ" },
  { type: "formula", label: "Công thức", hint: "Khẳng định / phủ định / nghi vấn…" },
  { type: "table", label: "Bảng", hint: "Bảng chia động từ, quy tắc…" },
  { type: "examples", label: "Ví dụ", hint: "Câu ví dụ có nút nghe" },
  { type: "signals", label: "Dấu hiệu nhận biết", hint: "Từ / cụm từ gợi ý thì" },
  { type: "mistakes", label: "Lỗi hay gặp", hint: "Câu sai → câu đúng" },
  { type: "tip", label: "Mẹo nhớ", hint: "Một đoạn lưu ý ngắn" },
];
export const sectionLabel = (type: string) => SECTION_TYPES.find((s) => s.type === type)?.label ?? type;

export const FORMULA_KINDS = [
  { value: "affirmative", label: "Khẳng định" },
  { value: "negative", label: "Phủ định" },
  { value: "question", label: "Nghi vấn" },
  { value: "short-answer", label: "Trả lời ngắn" },
  { value: "note", label: "Lưu ý" },
];
export const kindLabel = (kind: string) => FORMULA_KINDS.find((k) => k.value === kind)?.label ?? kind;

export const EXERCISE_TYPES: { type: string; label: string; hint: string; color: string }[] = [
  { type: "mcq", label: "Trắc nghiệm", hint: "Chọn 1 đáp án đúng", color: "teal" },
  { type: "fill", label: "Điền từ", hint: "Gõ từ vào chỗ ___", color: "blue" },
  { type: "order", label: "Sắp xếp câu", hint: "Ghép mảnh thành câu theo nghĩa tiếng Việt", color: "grape" },
  { type: "transform", label: "Biến đổi câu", hint: "Đổi câu (phủ định, nghi vấn…) bằng mảnh ghép", color: "orange" },
  { type: "error", label: "Tìm lỗi sai", hint: "Chạm vào từ sai trong câu", color: "red" },
];
export const exerciseMeta = (type: string) => EXERCISE_TYPES.find((e) => e.type === type) ?? EXERCISE_TYPES[0];

export function newSection(type: string): GrammarSection {
  switch (type) {
    case "usage":
      return { type, items: [{ textVi: "", example: { en: "", vi: "" } }] };
    case "formula":
      return { type, rows: [{ kind: "affirmative", pattern: "", example: { en: "", vi: "" } }] };
    case "table":
      return { type, headers: ["", ""], cells: [["", ""]] };
    case "examples":
      return { type, items: [{ en: "", vi: "" }] };
    case "signals":
      return { type, words: [] };
    case "mistakes":
      return { type, items: [{ wrong: "", right: "", noteVi: "" }] };
    default:
      return { type, textVi: "" };
  }
}

/** Next id following the lesson's own prefix ("pc-14" → "pc-15"). */
export function nextExerciseId(lesson: GrammarLesson): string {
  const ids = lesson.exercises.map((e) => e.id);
  const prefix =
    ids.map((id) => id.match(/^(.*?)(\d+)$/)?.[1]).find(Boolean) ??
    `${lesson.slug.split("-").map((p) => p[0]).join("").slice(0, 3) || "ex"}-`;
  const max = Math.max(0, ...ids.map((id) => Number(id.match(/(\d+)$/)?.[1] ?? 0)));
  return `${prefix}${String(max + 1).padStart(2, "0")}`;
}

export function newExercise(type: string, id: string): GrammarExercise {
  const base = { id, type, explanationVi: "" };
  switch (type) {
    case "mcq":
      return { ...base, prompt: "", options: ["", "", ""], answer: "" };
    case "fill":
      return { ...base, prompt: "", answers: [""] };
    case "order":
      return { ...base, promptVi: "", answer: "", distractors: [] };
    case "transform":
      return { ...base, instructionVi: "", source: "", answer: "", distractors: [] };
    default:
      return { ...base, sentence: "", correction: "" };
  }
}

/** The fields that make sense for a type, so switching type doesn't leave stale data behind. */
export function convertExercise(ex: GrammarExercise, type: string): GrammarExercise {
  return { ...newExercise(type, ex.id), explanationVi: ex.explanationVi };
}

export const EMPTY_LESSON: GrammarLesson = {
  slug: "",
  version: 1,
  titleVi: "",
  titleEn: "",
  level: "A1",
  order: 0,
  summaryVi: "",
  quizSize: 8,
  published: false,
  sections: [],
  exercises: [],
};

/** Server problems are prefixed "Bài tập {id}:" / "Lý thuyết khối {n}"; group them per item. */
export function groupProblems(problems: string[]) {
  const exercises = new Map<string, string[]>();
  const sections = new Map<number, string[]>();
  const general: string[] = [];
  for (const p of problems) {
    const ex = p.match(/^Bài tập (.*?): (.*)$/);
    const sec = p.match(/^Lý thuyết khối (\d+)(?: \(.*?\))?: (.*)$/);
    if (ex) exercises.set(ex[1], [...(exercises.get(ex[1]) ?? []), ex[2]]);
    else if (sec) sections.set(Number(sec[1]) - 1, [...(sections.get(Number(sec[1]) - 1) ?? []), sec[2]]);
    else general.push(p);
  }
  return { exercises, sections, general };
}

const ex = (e?: { en: string; vi: string } | null) => (e && e.en.trim() ? { en: e.en.trim(), vi: e.vi.trim() } : undefined);
const list = (l?: string[]) => (l ?? []).map((s) => s.trim()).filter(Boolean);

/** Drops empty optional parts (blank examples, blank distractors) so the app never renders empty rows. */
export function cleanLesson(l: GrammarLesson): GrammarLesson {
  return {
    ...l,
    titleVi: l.titleVi.trim(),
    titleEn: l.titleEn?.trim() || null,
    summaryVi: l.summaryVi.trim(),
    sections: l.sections.map((s) => ({
      ...s,
      title: s.title?.trim() || undefined,
      items: s.items?.map((it) => ({ ...it, example: ex(it.example), noteVi: it.noteVi?.trim() || undefined })),
      rows: s.rows?.map((r) => ({ ...r, pattern: r.pattern.trim(), example: ex(r.example) })),
      words: s.words ? list(s.words) : undefined,
    })),
    exercises: l.exercises.map((e) => ({
      ...e,
      distractors: e.distractors ? list(e.distractors) : undefined,
      answers: e.answers ? list(e.answers) : undefined,
    })),
  };
}

export function move<T>(list: T[], index: number, delta: number): T[] {
  const target = index + delta;
  if (target < 0 || target >= list.length) return list;
  const next = [...list];
  [next[index], next[target]] = [next[target], next[index]];
  return next;
}

/** Mirrors mobile/src/grammar/quiz.ts parseErrorSentence. */
export function parseErrorSentence(sentence: string) {
  const match = sentence.match(/^(.*?)\[(.+?)\](.*)$/);
  if (!match) return { tokens: sentence.split(/\s+/).filter(Boolean), wrongIndex: -1 };
  const [, before, inside, after] = match;
  const beforeTokens = before.trim() ? before.trim().split(/\s+/) : [];
  const afterTrim = after.trimStart();
  const glued = after.length > 0 && !/^\s/.test(after) ? afterTrim.split(/\s+/)[0] : "";
  const rest = glued ? afterTrim.slice(glued.length) : afterTrim;
  const afterTokens = rest.trim() ? rest.trim().split(/\s+/) : [];
  return { tokens: [...beforeTokens, inside + glued, ...afterTokens], wrongIndex: beforeTokens.length };
}

/** The full correct sentence, as the app shows it after answering. */
export function displayAnswer(ex: GrammarExercise): string {
  switch (ex.type) {
    case "mcq":
      return ex.prompt?.includes("___") ? ex.prompt.replace(/_{3,}/, ex.answer ?? "") : (ex.answer ?? "");
    case "fill":
      return (ex.prompt ?? "").replace(/_{3,}/, ex.answers?.[0] ?? "").replace(/\s*\([^)]*\)/, "");
    case "error":
      return (ex.sentence ?? "").replace(/\[(.+?)\]/, ex.correction ?? "");
    default:
      return ex.answer ?? "";
  }
}
