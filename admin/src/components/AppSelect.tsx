import { NativeSelect, Select as MantineSelect, type SelectProps } from "@mantine/core";
import { useMediaQuery } from "@mantine/hooks";

type Option = string | { value: string; label: string };

/**
 * Mantine Select on desktop, the phone's own picker on touch screens: Mantine's Select is a text input,
 * which makes iOS show its AutoFill bar and squeezes the label in narrow rows.
 */
export function Select(props: SelectProps) {
  const touch = useMediaQuery("(pointer: coarse)", false);
  if (!touch) return <MantineSelect {...props} />;

  const { data, value, onChange, placeholder, clearable, label, description, required, error, disabled, w, style, className, size } = props;
  const options = ((data ?? []) as Option[]).map((o) => (typeof o === "string" ? { value: o, label: o } : o));
  const hasBlankOption = options.some((o) => o.value === "");
  const empty = !hasBlankOption && (value == null || value === "");
  const withBlank = !hasBlankOption && (clearable || empty);

  return (
    <NativeSelect
      label={label}
      description={description}
      required={required}
      error={error}
      disabled={disabled}
      w={w}
      style={style}
      className={className}
      size={size}
      value={value ?? ""}
      onChange={(e) => {
        const v = e.currentTarget.value;
        const option = options.find((o) => o.value === v) ?? null;
        onChange?.(v || null, option as never);
      }}
      data={[...(withBlank ? [{ value: "", label: placeholder ?? "—", disabled: !clearable }] : []), ...options]}
      styles={empty ? { input: { color: "var(--mantine-color-placeholder)" } } : undefined}
    />
  );
}
