import { ActionIcon, Autocomplete, Button, Group, Radio, Stack, TagsInput, Text, Textarea, TextInput } from "@mantine/core";
import { IconPlus, IconX } from "@tabler/icons-react";
import type { GrammarExercise } from "../api";
import { Select } from "../components/AppSelect";
import { convertExercise, EXERCISE_TYPES } from "./meta";

const INSTRUCTIONS = [
  "Chuyển sang câu phủ định",
  "Chuyển sang câu hỏi",
  "Chuyển sang câu bị động",
  "Chuyển sang câu gián tiếp",
  "Viết lại câu với từ cho sẵn",
  "Nối hai câu thành một",
];

type Props = { exercise: GrammarExercise; onChange: (e: GrammarExercise) => void };

export function ExerciseEditor({ exercise: ex, onChange }: Props) {
  const set = (patch: Partial<GrammarExercise>) => onChange({ ...ex, ...patch });
  return (
    <Stack gap="sm">
      <Group grow gap="sm" align="flex-start">
        <Select
          label="Dạng bài"
          data={EXERCISE_TYPES.map((t) => ({ value: t.type, label: t.label }))}
          value={ex.type}
          allowDeselect={false}
          onChange={(v) => v && v !== ex.type && window.confirm("Đổi dạng bài sẽ xoá nội dung câu hỏi hiện tại (giữ giải thích). Tiếp tục?") && onChange(convertExercise(ex, v))}
        />
        <TextInput label="Mã câu" value={ex.id} onChange={(e) => set({ id: e.currentTarget.value.trim() })} />
      </Group>
      <TypeFields exercise={ex} onChange={onChange} />
      <Textarea
        label="Giải thích (hiện sau khi trả lời)"
        required
        autosize
        minRows={2}
        value={ex.explanationVi}
        onChange={(e) => set({ explanationVi: e.currentTarget.value })}
      />
    </Stack>
  );
}

function TypeFields({ exercise: ex, onChange }: Props) {
  const set = (patch: Partial<GrammarExercise>) => onChange({ ...ex, ...patch });
  switch (ex.type) {
    case "mcq": {
      const options = ex.options ?? [];
      return (
        <>
          <Textarea label="Câu hỏi" required autosize minRows={1} placeholder="Look! The baby ___." value={ex.prompt ?? ""} onChange={(e) => set({ prompt: e.currentTarget.value })} />
          <div>
            <Text fz="sm" fw={600} mb={4}>
              Lựa chọn{" "}
              <Text span c="dimmed" fz="xs" fw={400}>
                (chấm tròn = đáp án đúng)
              </Text>
            </Text>
            <Radio.Group value={ex.answer && options.includes(ex.answer) ? String(options.indexOf(ex.answer)) : ""} onChange={(v) => set({ answer: options[Number(v)] })}>
              <Stack gap={6}>
                {options.map((o, i) => (
                  <Group key={i} gap={8} wrap="nowrap">
                    <Radio value={String(i)} aria-label={`Đáp án ${i + 1}`} />
                    <TextInput
                      style={{ flex: 1 }}
                      value={o}
                      placeholder={`Lựa chọn ${i + 1}`}
                      onChange={(e) => {
                        const v = e.currentTarget.value;
                        set({ options: options.map((x, j) => (j === i ? v : x)), answer: ex.answer === o ? v : ex.answer });
                      }}
                    />
                    <ActionIcon variant="subtle" color="red" disabled={options.length <= 2} onClick={() => set({ options: options.filter((_, j) => j !== i), answer: ex.answer === o ? "" : ex.answer })} aria-label="Xoá lựa chọn">
                      <IconX size={16} />
                    </ActionIcon>
                  </Group>
                ))}
              </Stack>
            </Radio.Group>
            {options.length < 6 ? (
              <Button variant="subtle" size="xs" mt={4} leftSection={<IconPlus size={14} />} onClick={() => set({ options: [...options, ""] })}>
                Thêm lựa chọn
              </Button>
            ) : null}
          </div>
        </>
      );
    }
    case "fill":
      return (
        <>
          <Textarea
            label="Câu có chỗ trống"
            required
            autosize
            minRows={1}
            description="Dùng ___ (3 gạch dưới) cho chỗ trống; nên gợi ý từ gốc trong ngoặc: He ___ (speak) English."
            value={ex.prompt ?? ""}
            onChange={(e) => set({ prompt: e.currentTarget.value })}
          />
          <TagsInput
            label="Đáp án chấp nhận"
            description="Mỗi cách viết đúng là một thẻ (vd: are playing, 're playing). Không phân biệt hoa thường."
            value={ex.answers ?? []}
            onChange={(answers) => set({ answers })}
            splitChars={[]}
          />
        </>
      );
    case "order":
      return (
        <>
          <TextInput label="Câu tiếng Việt" required value={ex.promptVi ?? ""} onChange={(e) => set({ promptVi: e.currentTarget.value })} />
          <TextInput label="Câu đúng (tiếng Anh)" required description="Được tách theo khoảng trắng thành các mảnh ghép." value={ex.answer ?? ""} onChange={(e) => set({ answer: e.currentTarget.value })} />
          <Distractors exercise={ex} onChange={onChange} />
        </>
      );
    case "transform":
      return (
        <>
          <Autocomplete label="Yêu cầu" required data={INSTRUCTIONS} value={ex.instructionVi ?? ""} onChange={(v) => set({ instructionVi: v })} />
          <TextInput label="Câu gốc" required value={ex.source ?? ""} onChange={(e) => set({ source: e.currentTarget.value })} />
          <TextInput label="Câu đúng sau khi đổi" required value={ex.answer ?? ""} onChange={(e) => set({ answer: e.currentTarget.value })} />
          <Distractors exercise={ex} onChange={onChange} />
        </>
      );
    default:
      return <ErrorFields exercise={ex} onChange={onChange} />;
  }
}

function Distractors({ exercise: ex, onChange }: Props) {
  return (
    <TagsInput
      label="Mảnh gây nhiễu (tuỳ chọn)"
      description="Từ sai hay gặp, trộn lẫn vào các mảnh (vd: does, is)."
      value={ex.distractors ?? []}
      onChange={(distractors) => onChange({ ...ex, distractors })}
      splitChars={[",", " "]}
    />
  );
}

/** Click a word to mark it as the wrong one; that wraps it in [ ]. */
function ErrorFields({ exercise: ex, onChange }: Props) {
  const sentence = ex.sentence ?? "";
  const plain = sentence.replace(/[[\]]/g, "");
  const words = plain.split(/\s+/).filter(Boolean);
  const bracket = sentence.match(/^(.*?)\[(.+?)\]/);
  const start = bracket ? bracket[1].trim().split(/\s+/).filter(Boolean).length : -1;
  const length = bracket ? bracket[2].trim().split(/\s+/).length : 0;
  const mark = (index: number) => {
    const w = words[index];
    const punct = w.match(/[.,!?;:]+$/)?.[0] ?? "";
    onChange({ ...ex, sentence: words.map((x, i) => (i === index ? `[${w.slice(0, w.length - punct.length)}]${punct}` : x)).join(" ") });
  };
  return (
    <>
      <TextInput
        label="Câu có lỗi"
        required
        description="Gõ câu rồi bấm vào từ sai bên dưới (hoặc tự đặt từ sai trong [ ])."
        value={sentence}
        onChange={(e) => onChange({ ...ex, sentence: e.currentTarget.value })}
      />
      {plain.trim() ? (
        <Group gap={4}>
          {words.map((t, i) => {
            const wrong = i >= start && i < start + length;
            return (
              <Button key={i} size="compact-sm" variant={wrong ? "filled" : "default"} color={wrong ? "red" : undefined} onClick={() => mark(i)}>
                {t}
              </Button>
            );
          })}
        </Group>
      ) : null}
      <TextInput label="Sửa lại thành" required placeholder="is" value={ex.correction ?? ""} onChange={(e) => onChange({ ...ex, correction: e.currentTarget.value })} />
    </>
  );
}
