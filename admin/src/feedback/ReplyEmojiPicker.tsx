import { Button, Popover, SimpleGrid, UnstyledButton } from "@mantine/core";

/** Short set for laptop replies — no OS emoji keyboard required. */
const EMOJIS = [
  "😀", "😊", "😁", "😉", "😌",
  "🙏", "👍", "❤️", "💙", "✨",
  "✅", "🎉", "💪", "👋", "🤝",
  "😅", "🤔", "😮", "😢", "💡",
];

/** Inserts an emoji into the reply box. Stays open so several can be added. */
export function ReplyEmojiPicker({ onPick }: { onPick: (emoji: string) => void }) {
  return (
    <Popover position="top-start" shadow="md" withinPortal>
      <Popover.Target>
        <Button variant="subtle" leftSection={<span aria-hidden>😊</span>}>
          Cảm xúc
        </Button>
      </Popover.Target>
      <Popover.Dropdown>
        <SimpleGrid cols={5} spacing={4}>
          {EMOJIS.map((emoji) => (
            <UnstyledButton
              key={emoji}
              aria-label={emoji}
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => onPick(emoji)}
              style={{ fontSize: 22, lineHeight: 1, textAlign: "center", padding: 4, borderRadius: 8 }}
            >
              {emoji}
            </UnstyledButton>
          ))}
        </SimpleGrid>
      </Popover.Dropdown>
    </Popover>
  );
}
