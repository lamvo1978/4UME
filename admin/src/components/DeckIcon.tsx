import { Center } from "@mantine/core";
import { ioniconSrc } from "../lib";

/** The deck's Ionicons glyph, tinted like the app (accent on a soft circle). */
export function DeckIcon({ name, size = 40 }: { name: string; size?: number }) {
  return (
    <Center w={size} h={size} style={{ borderRadius: "50%", background: "#C8E4DC", flexShrink: 0 }}>
      <span
        aria-hidden
        style={{
          width: size * 0.5,
          height: size * 0.5,
          backgroundColor: "#0F6B5C",
          mask: `url(${ioniconSrc(name)}) center / contain no-repeat`,
          WebkitMask: `url(${ioniconSrc(name)}) center / contain no-repeat`,
        }}
      />
    </Center>
  );
}
