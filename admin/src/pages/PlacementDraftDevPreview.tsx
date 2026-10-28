import { Container, Text, Title } from "@mantine/core";
import { notifications } from "@mantine/notifications";
import { useState } from "react";
import { PlacementDraftModal } from "../placement/PlacementDraftModal";
import { PREVIEW_LESSONS, PREVIEW_PLACEMENT_DRAFT } from "../placement/draftUiPreview";

/** Dev-only screen to review placement AI draft UI without login or API. */
export function PlacementDraftDevPreview() {
  const [open, setOpen] = useState(true);

  return (
    <Container py="xl" maw={900}>
      <Title order={3} mb="xs">
        Dev preview · AI soạn kiểm tra đầu vào
      </Title>
      <Text c="dimmed" size="sm" mb="md">
        Dữ liệu mẫu (không gọi API). Đóng modal rồi bấm vào nền trang nếu cần mở lại — tải lại trang để reset.
      </Text>
      <PlacementDraftModal
        devPreviewDraft={PREVIEW_PLACEMENT_DRAFT}
        opened={open}
        onClose={() => setOpen(false)}
        level="B2"
        lessons={PREVIEW_LESSONS}
        onAdd={async (qs) => {
          notifications.show({
            title: "Preview",
            message: `Sẽ lưu ${qs.length} câu (published: ${qs.filter((q) => q.published).length}, ẩn: ${qs.filter((q) => !q.published).length})`,
            color: "blue",
          });
        }}
      />
    </Container>
  );
}
