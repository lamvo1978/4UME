import { Input, SegmentedControl } from "@mantine/core";
import { useLocalStorage } from "@mantine/hooks";
import type { AiProvider } from "../api";

/** "" is the automatic order (Groq, then Gemini when Groq fails). Remembered so the admin can compare drafts across lessons. */
export function useAiProvider(providers: AiProvider[] | undefined) {
  const [value, setValue] = useLocalStorage({ key: "ai-draft-provider", defaultValue: "", getInitialValueInEffect: false });
  const usable = value === "" || providers?.some((p) => p.key === value && p.configured);
  return [usable ? value : "", setValue] as const;
}

export function AiProviderSelect({
  providers,
  value,
  onChange,
}: {
  providers: AiProvider[] | undefined;
  value: string;
  onChange: (v: string) => void;
}) {
  if (!providers?.length) return null;
  const picked = providers.find((p) => p.key === value);
  return (
    <Input.Wrapper
      label="AI soạn"
      description={
        picked
          ? `Chỉ dùng ${picked.name} (${picked.model}), không tự chuyển AI khác khi lỗi.`
          : "Groq trước, lỗi hoặc hết lượt thì tự chuyển sang Gemini."
      }
    >
      <SegmentedControl
        mt={6}
        fullWidth
        value={value}
        onChange={onChange}
        data={[
          { value: "", label: "Tự động" },
          ...providers.map((p) => ({ value: p.key, label: p.configured ? p.name : `${p.name} (chưa có key)`, disabled: !p.configured })),
        ]}
      />
    </Input.Wrapper>
  );
}
