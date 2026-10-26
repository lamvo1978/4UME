import { api, PronunciationStatus } from "../api/client";
import { ads, adUnitId, initAds, liveAdUnits } from "./sdk";

/**
 * Rewarded ads for extra pronunciation checks. EAS builds show a real AdMob ad; AdMob then calls the API with a signed
 * callback carrying the learner id and their local date, and only that callback adds the check. Expo Go has no SDK,
 * so development stands in with the API's dev-only reward endpoint.
 */
export function rewardedAdsSupported() {
  return !!ads || __DEV__;
}

/** Free learners only, while ads are switched on and the scorer is up. */
export const adsOffered = (status: PronunciationStatus | null): status is PronunciationStatus =>
  !!status && status.adsDailyLimit > 0 && rewardedAdsSupported();

/** The learner's calendar date, so a reward counts toward their own "today" rather than the server's. */
export function localDate(d = new Date()) {
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

/** The learner closed the ad before it finished, so there's nothing to count. */
export class AdNotFinishedError extends Error {
  constructor() {
    super("Bạn cần xem hết quảng cáo để được thêm lượt.");
  }
}

const POLL_MS = 1000;
const POLL_TRIES = 8;

/**
 * Resolves with the updated status once the extra check is counted (or with the last status if AdMob's callback is slow,
 * so the caller can say it wasn't counted yet); throws if the ad couldn't be shown or was closed early.
 */
export async function watchRewardedAd(userId: string, before: PronunciationStatus): Promise<PronunciationStatus> {
  const lib = ads;
  if (!lib) return api.devAdReward();
  if (!(await initAds())) throw new Error("ads unavailable");

  const ad = lib.RewardedAd.createForAdRequest(adUnitId("rewarded"), {
    serverSideVerificationOptions: { userId, customData: localDate() },
  });
  const earned = await new Promise<boolean>((resolve, reject) => {
    let got = false;
    const subs = [
      ad.addAdEventListener(lib.RewardedAdEventType.LOADED, () => {
        ad.show().catch((e: unknown) => done(() => reject(e)));
      }),
      ad.addAdEventListener(lib.RewardedAdEventType.EARNED_REWARD, () => {
        got = true;
      }),
      ad.addAdEventListener(lib.AdEventType.CLOSED, () => done(() => resolve(got))),
      ad.addAdEventListener(lib.AdEventType.ERROR, (e) => done(() => reject(e))),
    ];
    function done(settle: () => void) {
      subs.forEach((unsubscribe) => unsubscribe());
      settle();
    }
    ad.load();
  });
  if (!earned) throw new AdNotFinishedError();

  // Google's test units never call our server, so development counts the view itself.
  if (!liveAdUnits() && __DEV__) return api.devAdReward();
  return waitForReward(before.adsWatchedToday);
}

/** AdMob's callback can land a moment after the ad closes. */
async function waitForReward(watchedBefore: number): Promise<PronunciationStatus> {
  let latest: PronunciationStatus | null = null;
  for (let i = 0; i < POLL_TRIES; i++) {
    await new Promise((r) => setTimeout(r, POLL_MS));
    latest = await api.pronunciationStatus().catch(() => latest);
    if (latest && latest.adsWatchedToday > watchedBefore) return latest;
  }
  if (!latest) throw new Error("status unavailable");
  return latest;
}
