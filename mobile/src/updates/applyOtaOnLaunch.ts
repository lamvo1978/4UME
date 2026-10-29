import * as Updates from "expo-updates";

/**
 * Pull EAS Update on cold start (store / TestFlight). Dev and Expo Go skip this path.
 */
export async function applyOtaOnLaunch(): Promise<void> {
  if (__DEV__) return;
  if (!Updates.isEnabled) return;

  try {
    const result = await Updates.checkForUpdateAsync();
    if (!result.isAvailable) return;

    await Updates.fetchUpdateAsync();
    await Updates.reloadAsync();
  } catch {
    // Keep running the embedded bundle if the update server is unreachable.
  }
}
