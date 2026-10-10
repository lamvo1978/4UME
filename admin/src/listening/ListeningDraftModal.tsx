import { Alert, Button, Group, Input, Modal, SegmentedControl, Stack, Text, Textarea, TextInput } from "@mantine/core";
import { IconSparkles } from "@tabler/icons-react";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { api, type ListeningDraftLength, type ListeningKind } from "../api";
import { LEVELS } from "../grammar/meta";
import { KINDS } from "./meta";

const LENGTHS: { value: ListeningDraftLength; label: string }[] = [
  { value: "short", label: "Ngắn (~1 phút)" },
  { value: "medium", label: "Vừa (1–2 phút)" },
  { value: "long", label: "Dài (2–3 phút)" },
];

/** Asks Gemini for a draft, then opens it unsaved in the editor. */
export function ListeningDraftModal({ opened, onClose }: { opened: boolean; onClose: () => void }) {
  const navigate = useNavigate();
  const status = useQuery({ queryKey: ["listening-draft-status"], queryFn: api.listeningDraftStatus, enabled: opened, staleTime: 60_000 });
  const [level, setLevel] = useState("A2");
  const [kind, setKind] = useState<ListeningKind>("dialogue");
  const [length, setLength] = useState<ListeningDraftLength>("medium");
  const [topic, setTopic] = useState("");
  const [notes, setNotes] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  async function write() {
    setBusy(true);
    setError("");
    try {
      const draft = await api.draftListening({ level, kind, length, topic: topic.trim() || undefined, notes: notes.trim() || undefined });
      onClose();
      navigate("/listening/new", { state: { draft: draft.lesson } });
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  }

  const notConfigured = status.data && !status.data.configured;

  return (
    <Modal opened={opened} onClose={busy ? () => {} : onClose} title="AI viết nháp bài nghe" size="lg" radius="lg">
      <Stack>
        {notConfigured ? (
          <Alert color="yellow" title="Chưa bật Gemini">
            Máy chủ chưa có <b>GEMINI_API_KEY</b>. Tạo key miễn phí ở aistudio.google.com rồi thêm vào <b>.env</b> — xem docs/listening.md.
          </Alert>
        ) : (
          <Text size="sm" c="dimmed">
            Gemini viết bản nháp theo cấp độ và thể loại bạn chọn. Bài <b>chưa được lưu</b>: bạn đọc lại, sửa trong trang soạn bài rồi mới lưu và tạo âm thanh.
          </Text>
        )}
        <Input.Wrapper label="Cấp độ">
          <SegmentedControl fullWidth data={LEVELS} value={level} onChange={setLevel} />
        </Input.Wrapper>
        <Input.Wrapper label="Thể loại">
          <SegmentedControl fullWidth data={KINDS.map((k) => ({ value: k.value, label: k.label }))} value={kind} onChange={(v) => setKind(v as ListeningKind)} />
        </Input.Wrapper>
        <Input.Wrapper label="Độ dài">
          <SegmentedControl fullWidth data={LENGTHS} value={length} onChange={(v) => setLength(v as ListeningDraftLength)} />
        </Input.Wrapper>
        <TextInput
          label="Chủ đề / tình huống"
          placeholder="vd: trả lại món hàng bị lỗi ở siêu thị"
          description="Để trống thì AI tự chọn chủ đề chưa có."
          value={topic}
          onChange={(e) => setTopic(e.currentTarget.value)}
        />
        <Textarea
          label="Mong muốn thêm (không bắt buộc)"
          placeholder="vd: có một người Việt và một người Úc; kết thúc vui vẻ; dùng nhiều câu hỏi"
          autosize
          minRows={2}
          maxRows={5}
          value={notes}
          onChange={(e) => setNotes(e.currentTarget.value)}
        />
        {error ? <Alert color="red">{error}</Alert> : null}
        <Group justify="flex-end">
          <Button variant="default" onClick={onClose} disabled={busy}>
            Huỷ
          </Button>
          <Button leftSection={<IconSparkles size={18} />} onClick={write} loading={busy} disabled={notConfigured}>
            Viết nháp
          </Button>
        </Group>
        {busy ? (
          <Text size="xs" c="dimmed" ta="right">
            Thường mất 10–30 giây…
          </Text>
        ) : null}
      </Stack>
    </Modal>
  );
}
