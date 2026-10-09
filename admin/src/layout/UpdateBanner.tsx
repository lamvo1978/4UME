import { Button, Group, Paper, Text } from "@mantine/core";
import { IconRefresh } from "@tabler/icons-react";
import { useEffect, useState } from "react";

const CHECK_EVERY_MS = 5 * 60_000;
const BUNDLE = /\/assets\/index-[\w-]+\.js/;

function loadedBundle(): string | null {
  const script = document.querySelector<HTMLScriptElement>('script[type="module"][src*="/assets/"]');
  return script?.src.match(BUNDLE)?.[0] ?? null;
}

/**
 * An iPhone home-screen app resumes the old page instead of reloading it, so a deploy goes unnoticed.
 * Compares the bundle named in the server's index.html with the running one whenever the app comes back
 * into view (and every few minutes) and offers a reload; it never reloads by itself to keep unsaved edits.
 */
export function UpdateBanner() {
  const [outdated, setOutdated] = useState(false);

  useEffect(() => {
    const current = loadedBundle();
    if (!import.meta.env.PROD || !current) return;

    let busy = false;
    async function check() {
      if (busy || document.visibilityState !== "visible") return;
      busy = true;
      try {
        const res = await fetch("/", { cache: "no-store" });
        const latest = res.ok ? (await res.text()).match(BUNDLE)?.[0] : null;
        if (latest && latest !== current) setOutdated(true);
      } catch {
        // Offline or mid-deploy; try again on the next check.
      } finally {
        busy = false;
      }
    }

    const timer = window.setInterval(check, CHECK_EVERY_MS);
    document.addEventListener("visibilitychange", check);
    window.addEventListener("focus", check);
    return () => {
      window.clearInterval(timer);
      document.removeEventListener("visibilitychange", check);
      window.removeEventListener("focus", check);
    };
  }, []);

  if (!outdated) return null;
  return (
    <Paper
      shadow="md"
      radius="lg"
      p="sm"
      withBorder
      style={{
        position: "fixed",
        top: "calc(12px + env(safe-area-inset-top))",
        left: 12,
        right: 12,
        maxWidth: 480,
        margin: "0 auto",
        zIndex: 300,
      }}
    >
      <Group justify="space-between" wrap="nowrap" gap="sm">
        <Text fz="sm" fw={600}>
          Đã có bản admin mới.
        </Text>
        <Button size="xs" leftSection={<IconRefresh size={16} />} onClick={() => window.location.reload()}>
          Tải lại
        </Button>
      </Group>
    </Paper>
  );
}
