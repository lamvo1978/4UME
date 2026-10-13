import { Switch } from "@mantine/core";
import { useLocalStorage } from "@mantine/hooks";

/** Remembered across drafts: on the free AI tiers the check pass halves how many drafts fit in a day. */
export function useSkipCheck() {
  return useLocalStorage({ key: "ai-draft-skip-check", defaultValue: false, getInitialValueInEffect: false });
}

export function SkipCheckSwitch({ value, onChange }: { value: boolean; onChange: (v: boolean) => void }) {
  return (
    <Switch
      label="Bỏ bước AI tự kiểm tra đáp án"
      description="Mỗi lần soạn chỉ tốn 1 lượt gọi AI thay vì 2 (đỡ hết lượt gói miễn phí). Khi bật, bạn cần tự đọc kỹ đáp án."
      checked={value}
      onChange={(e) => onChange(e.currentTarget.checked)}
    />
  );
}
