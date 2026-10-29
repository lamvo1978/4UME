import * as Updates from "expo-updates";
import { InteractionManager } from "react-native";

const OTA_CHECK_DELAY_MS = 4000;

/**
 * Download EAS Update in the background after the app has loaded.
 * Does not call reloadAsync — native ON_LOAD applies the bundle on the next cold start,
 * avoiding aborted API calls and false "no network" banners mid-session.
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
        } catch {
          // Embedded bundle keeps running.
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
