import type { AdminGrammarSummary, PlacementGrammarDraft, PlacementLevel } from "../api";

/** Sample B2 lessons so badges render in the dev preview. */
const lesson = (slug: string, titleVi: string, titleEn: string, sortOrder: number): AdminGrammarSummary => ({
  slug,
  level: "B2",
  titleVi,
  titleEn,
  sortOrder,
  published: true,
  quizSize: 12,
  sectionCount: 1,
  exerciseCount: 12,
  practiceCount: 0,
  version: 1,
  updatedAt: "",
  editedAt: null,
  learners: 0,
});

export const PREVIEW_LESSONS: AdminGrammarSummary[] = [
  lesson("mixed-conditionals", "Câu điều kiện hỗn hợp", "Mixed conditionals", 47),
  lesson("future-perfect-continuous", "Tương lai hoàn thành và tiếp diễn", "Future perfect & continuous", 48),
  lesson("modals-past", "Modal quá khứ", "Past modals", 49),
  lesson("causative-have-get", "Causative: have / get something done", "Causative", 50),
  lesson("participle-clauses", "Mệnh đề phân từ", "Participle clauses", 51),
];

const L = "B2" as PlacementLevel;

/** Mirrors a real AI draft + checker response for local UI review (dev only). */
export const PREVIEW_PLACEMENT_DRAFT: PlacementGrammarDraft = {
  model: "preview-local",
  checked: true,
  items: [
    {
      question: {
        level: L,
        prompt: "If she ___ her passport, she would be here now.",
        options: ["had not lost", "didn't lose", "hasn't lost", "wasn't losing"],
        answer: "had not lost",
        acceptedAnswers: [],
        explanationVi: "Câu điều kiện hỗn hợp: dùng quá khứ hoàn thành ở mệnh đề if, hiện tại ở mệnh đề chính.",
        lessonSlug: "mixed-conditionals",
        published: true,
      },
      problems: [],
      warning: "Có đáp án đúng khác không được liệt kê.",
      suggestedAcceptedAnswers: ["didn't lose"],
    },
    {
      question: {
        level: L,
        prompt: "By the time you arrive, I ___ for two hours.",
        options: ["will have been waiting", "will be waiting", "will have waited", "will wait"],
        answer: "will have been waiting",
        acceptedAnswers: [],
        explanationVi: "By + mốc thời gian → future perfect continuous khi nhấn thời lượng.",
        lessonSlug: "future-perfect-continuous",
        published: true,
      },
      problems: [],
      warning: "Có đáp án đúng khác không được liệt kê.",
      suggestedAcceptedAnswers: ["will be waiting"],
    },
    {
      question: {
        level: L,
        prompt: "She ___ at home yesterday, but the lights were on.",
        options: ["must have been", "might have been", "can't have been", "should have been"],
        answer: "must have been",
        acceptedAnswers: [],
        explanationVi: "Đèn sáng → suy luận chắc chắn: must have been.",
        lessonSlug: "modals-past",
        published: true,
      },
      problems: [],
      warning: "Có đáp án đúng khác không được liệt kê.",
      suggestedAcceptedAnswers: ["might have been"],
    },
    {
      question: {
        level: L,
        prompt: "I ___ my car washed every month.",
        options: ["have", "get", "had", "will have"],
        answer: "have",
        acceptedAnswers: ["get"],
        explanationVi: "have/get + object + V3.",
        lessonSlug: "causative-have-get",
        published: true,
      },
      problems: [],
      warning: null,
      suggestedAcceptedAnswers: [],
    },
    {
      question: {
        level: L,
        prompt: "The students, ___ hard, passed the exam.",
        options: ["studying", "studied", "having studied", "to study"],
        answer: "studying",
        acceptedAnswers: [],
        explanationVi: "Rút gọn mệnh đề quan hệ → V-ing.",
        lessonSlug: "participle-clauses",
        published: true,
      },
      problems: [],
      warning: "Có đáp án đúng khác không được liệt kê.",
      suggestedAcceptedAnswers: ["having studied"],
    },
  ],
};
