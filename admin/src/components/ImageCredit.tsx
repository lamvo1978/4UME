import { Anchor, Text } from "@mantine/core";
import { stockLabel, type ImageCredit } from "../api";

/** "Ảnh: Jane Doe / Pexels" with links to the photographer and the photo page. */
export function ImageCreditText({ credit }: { credit: ImageCredit }) {
  return (
    <Text fz="xs" c="dimmed" truncate>
      Ảnh:{" "}
      {credit.author ? (
        credit.authorUrl ? (
          <Anchor href={credit.authorUrl} target="_blank" fz="xs">
            {credit.author}
          </Anchor>
        ) : (
          credit.author
        )
      ) : null}
      {credit.author ? " / " : null}
      {credit.sourceUrl ? (
        <Anchor href={credit.sourceUrl} target="_blank" fz="xs">
          {stockLabel(credit.source)}
        </Anchor>
      ) : (
        stockLabel(credit.source)
      )}
    </Text>
  );
}
