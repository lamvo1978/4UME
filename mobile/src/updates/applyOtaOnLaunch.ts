import * as Updates from "expo-updates";
import { InteractionManager } from "react-native";

const OTA_CHECK_DELAY_MS = 2500;

/**
 * Pull EAS Update after the first screen has had time to mount (auth + profile fetch).
 * Immediate reload on launch was interrupting API calls and left Hồ sơ with an empty stats block.
 */
export function applyOtaOnLaunch(): () => void {
  if (__DEV__ || !Updates.isEnabled) return () => {};

  let cancelled = false;
  let timer: ReturnType<typeof setTimeout> | undefined;

  const handle = InteractionManager.runAfterInteractions(() => {
    timer = setTimeout(() => {
      void (async () => {
        if (cancelled) return;
        try {
          const result = await Updates.checkForUpdateAsync();
          if (cancelled || !result.isAvailable) return;

          await Updates.fetchUpdateAsync();
          if (cancelled) return;
          await Updates.reloadAsync();
        } catch {
          // Keep running the embedded bundle if the update server is unreachable.
        }
      })();
    }, OTA_CHECK_DELAY_MS);
  });

  return () => {
    cancelled = true;
    handle.cancel();
    if (timer) clearTimeout(timer);
  };
}
