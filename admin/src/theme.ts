import { createTheme, type MantineColorsTuple } from "@mantine/core";

// Shades around the app accent #0F6B5C (index 7) — see mobile/src/theme.ts.
const brand: MantineColorsTuple = [
  "#e7f4f0",
  "#c8e4dc",
  "#9fcfc1",
  "#72b8a5",
  "#4da48d",
  "#33977e",
  "#1f8a71",
  "#0f6b5c",
  "#0a5a4d",
  "#04493e",
];

export const theme = createTheme({
  primaryColor: "brand",
  primaryShade: 7,
  colors: { brand },
  fontFamily: '"Source Sans 3", system-ui, -apple-system, sans-serif',
  headings: { fontFamily: '"Fraunces", Georgia, serif', fontWeight: "700" },
  defaultRadius: "md",
  components: {
    Button: { defaultProps: { size: "md" } },
    TextInput: { defaultProps: { size: "md" } },
    PasswordInput: { defaultProps: { size: "md" } },
    Select: { defaultProps: { size: "md" } },
    NativeSelect: { defaultProps: { size: "md" } },
    MultiSelect: { defaultProps: { size: "md" } },
    Autocomplete: { defaultProps: { size: "md" } },
    Textarea: { defaultProps: { size: "md" } },
    NumberInput: { defaultProps: { size: "md" } },
    InputBase: { defaultProps: { size: "md" } },
    TagsInput: { defaultProps: { size: "md" } },
    InputWrapper: { defaultProps: { size: "md" } },
    SegmentedControl: { defaultProps: { size: "md" }, styles: { root: { height: 42 } } },
    Badge: { styles: { root: { textTransform: "none" } } },
  },
});

export const BG = "#E7F2EC";
export const ACCENT = "#0F6B5C";
