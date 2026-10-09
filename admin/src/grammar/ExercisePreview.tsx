import { Alert, Badge, Button, Group, Paper, Stack, Text, TextInput } from "@mantine/core";
import { useMemo, useState } from "react";
import type { GrammarExercise } from "../api";
import { displayAnswer, exerciseMeta, parseErrorSentence } from "./meta";

const norm = (s: string, stripEnd = false) => {
  let out = s.replace(/[’‘]/g, "'").trim().toLowerCase().replace(/\s+/g, " ");
  if (stripEnd) out = out.replace(/[.!?,;:]+$/, "").trim();
  return out;
};

function shuffle<T>(list: T[]): T[] {
  const a = [...list];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

/** Try one exercise the way the app asks it. Remount (key) to reset. */
export function ExercisePreview({ exercise: ex }: { exercise: GrammarExercise }) {
  const [result, setResult] = useState<boolean | null>(null);
  const meta = exerciseMeta(ex.type);

  return (
    <Paper radius={20} p="md" shadow="xs">
      <Stack gap="sm">
        <Group justify="space-between">
          <Badge variant="light" color={meta.color}>
            {meta.label}
          </Badge>
          <Text fz="xs" c="dimmed">
            {ex.id}
          </Text>
        </Group>
        <Question exercise={ex} onAnswer={setResult} locked={result !== null} />
        {result !== null ? (
          <Alert color={result ? "teal" : "red"} title={result ? "Chính xác!" : "Chưa đúng"} radius="lg">
            {!result ? (
              <Text fw={700} mb={4}>
                {displayAnswer(ex)}
              </Text>
            ) : null}
            <Text fz="sm">{ex.explanationVi || <i>(chưa có giải thích)</i>}</Text>
            <Button size="xs" variant="subtle" mt="xs" onClick={() => setResult(null)}>
              Thử lại
            </Button>
          </Alert>
        ) : null}
      </Stack>
    </Paper>
  );
}

type QuestionProps = { exercise: GrammarExercise; onAnswer: (correct: boolean) => void; locked: boolean };

function Question({ exercise: ex, onAnswer, locked }: QuestionProps) {
  switch (ex.type) {
    case "mcq":
      return <Mcq exercise={ex} onAnswer={onAnswer} locked={locked} />;
    case "fill":
      return <Fill exercise={ex} onAnswer={onAnswer} locked={locked} />;
    case "order":
    case "transform":
      return <Tiles key={`${ex.answer}|${ex.distractors?.join()}`} exercise={ex} onAnswer={onAnswer} locked={locked} />;
    default:
      return <ErrorPick exercise={ex} onAnswer={onAnswer} locked={locked} />;
  }
}

function Mcq({ exercise: ex, onAnswer, locked }: QuestionProps) {
  const [picked, setPicked] = useState<string | null>(null);
  return (
    <>
      <Text fz="lg" fw={600}>
        {ex.prompt}
      </Text>
      <Stack gap={8}>
        {ex.options?.map((o, i) => {
          const state = locked && picked !== null ? (o === ex.answer ? "teal" : o === picked ? "red" : "gray") : "gray";
          return (
            <Button
              key={i}
              variant={state === "gray" ? "default" : "light"}
              color={state}
              justify="flex-start"
              radius="lg"
              onClick={() => {
                if (locked) return;
                setPicked(o);
                onAnswer(o === ex.answer);
              }}
            >
              {o || "…"}
            </Button>
          );
        })}
      </Stack>
    </>
  );
}

function Fill({ exercise: ex, onAnswer, locked }: QuestionProps) {
  const [value, setValue] = useState("");
  const check = () => onAnswer((ex.answers ?? []).some((a) => norm(a, true) === norm(value, true)));
  return (
    <>
      <Text fz="lg" fw={600}>
        {ex.prompt}
      </Text>
      <Group gap="xs" wrap="nowrap">
        <TextInput
          style={{ flex: 1 }}
          placeholder="Gõ đáp án…"
          value={value}
          disabled={locked}
          onChange={(e) => setValue(e.currentTarget.value)}
          onKeyDown={(e) => e.key === "Enter" && value.trim() && check()}
        />
        <Button disabled={locked || !value.trim()} onClick={check}>
          Kiểm tra
        </Button>
      </Group>
    </>
  );
}

function Tiles({ exercise: ex, onAnswer, locked }: QuestionProps) {
  const pool = useMemo(
    () => shuffle([...(ex.answer ?? "").split(/\s+/).filter(Boolean), ...(ex.distractors ?? []).filter(Boolean)].map((t, i) => ({ t, i }))),
    [ex.answer, ex.distractors],
  );
  const [chosen, setChosen] = useState<number[]>([]);
  const sentence = chosen.map((i) => pool.find((p) => p.i === i)!.t).join(" ");
  return (
    <>
      {ex.type === "order" ? (
        <Text fz="lg" fw={600}>
          {ex.promptVi}
        </Text>
      ) : (
        <>
          <Text c="dimmed" fz="sm" fw={600}>
            {ex.instructionVi}
          </Text>
          <Text fz="lg" fw={600}>
            {ex.source}
          </Text>
        </>
      )}
      <Paper withBorder radius="lg" p="sm" mih={52}>
        <Group gap={6}>
          {chosen.map((i) => (
            <Button key={i} size="compact-md" variant="light" onClick={() => !locked && setChosen(chosen.filter((c) => c !== i))}>
              {pool.find((p) => p.i === i)!.t}
            </Button>
          ))}
        </Group>
      </Paper>
      <Group gap={6}>
        {pool
          .filter((p) => !chosen.includes(p.i))
          .map((p) => (
            <Button key={p.i} size="compact-md" variant="default" onClick={() => !locked && setChosen([...chosen, p.i])}>
              {p.t}
            </Button>
          ))}
      </Group>
      <Button disabled={locked || chosen.length === 0} onClick={() => onAnswer(norm(sentence) === norm(ex.answer ?? ""))}>
        Kiểm tra
      </Button>
    </>
  );
}

function ErrorPick({ exercise: ex, onAnswer, locked }: QuestionProps) {
  const { tokens, wrongIndex } = parseErrorSentence(ex.sentence ?? "");
  const [picked, setPicked] = useState<number | null>(null);
  return (
    <>
      <Text c="dimmed" fz="sm" fw={600}>
        Chạm vào từ sai trong câu
      </Text>
      <Group gap={6}>
        {tokens.map((t, i) => (
          <Button
            key={i}
            size="compact-lg"
            variant={locked && (i === wrongIndex || i === picked) ? "light" : "subtle"}
            color={locked ? (i === wrongIndex ? "teal" : i === picked ? "red" : "dark") : "dark"}
            onClick={() => {
              if (locked) return;
              setPicked(i);
              onAnswer(i === wrongIndex);
            }}
          >
            {t}
          </Button>
        ))}
      </Group>
    </>
  );
}
