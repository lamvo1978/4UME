import { Text } from "@mantine/core";

/** Editor-only AI review notes (not shown in the app test). */
export function PlacementReviewHints({
  reviewHintVi,
  reviewSuggestedAcceptedAnswers,
  prefix = "Gợi ý AI",
}: {
  reviewHintVi?: string | null;
  reviewSuggestedAcceptedAnswers?: string[] | null;
  prefix?: string;
}) {
  const suggested = reviewSuggestedAcceptedAnswers ?? [];
  const hint = (reviewHintVi ?? "").trim();
  if (!hint && suggested.length === 0) return null;

  return (
    <Text fz="xs" c="orange.8">
      {hint ? (
        <>
          {prefix}: {hint}
        </>
      ) : null}
      {suggested.length > 0 ? (
        <>
          {hint ? " — " : ""}
          gợi ý thêm <b>Cũng đúng</b>: {suggested.join(", ")}
        </>
      ) : null}
    </Text>
  );
}

export function suggestedOptionSet(reviewSuggestedAcceptedAnswers?: string[] | null) {
  return new Set(reviewSuggestedAcceptedAnswers ?? []);
}

