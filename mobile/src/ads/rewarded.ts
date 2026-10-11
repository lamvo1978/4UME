import { api, PronunciationStatus } from "../api/client";

/**
 * Rewarded ads for extra pronunciation checks. Expo Go has no ad SDK, so development builds stand in
 * with the API's dev-only reward endpoint. The EAS build will show a real AdMob rewarded ad here,
 * passing the learner id and `localDate()` as server-side verification data, then poll the status
 * until the server has counted the reward (AdMob's callback can land a moment after the ad closes).
 */
export function rewardedAdsSupported() {
  return __DEV__;
}

/** Free learners only, while ads are switched on and the scorer is up. */
export const adsOffered = (status: PronunciationStatus | null): status is PronunciationStatus =>
  !!status && status.adsDailyLimit > 0 && rewardedAdsSupported();

/** The learner's calendar date, so a reward counts toward their own "today" rather than the server's. */
export function localDate(d = new Date()) {
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

/** Resolves with the updated status once the extra check is counted; throws if the ad couldn't be shown. */
export async function watchRewardedAd(): Promise<PronunciationStatus> {
  return api.devAdReward();
}
