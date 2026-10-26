import { requireOptionalNativeModule } from "expo";
import { Platform, TurboModuleRegistry } from "react-native";

type Lib = typeof import("react-native-google-mobile-ads");

/** AdMob only exists in EAS builds; Expo Go has no native module and importing the library there would crash. */
export const ads: Lib | null = TurboModuleRegistry.get("RNGoogleMobileAdsModule")
  ? require("react-native-google-mobile-ads")
  : null;

/** Real ad units come from EAS env; dev builds and builds without them get Google's test units. */
export function adUnitId(kind: "rewarded" | "banner"): string {
  if (!ads) return "";
  const real =
    kind === "rewarded"
      ? Platform.select({ ios: process.env.EXPO_PUBLIC_ADMOB_REWARDED_IOS, android: process.env.EXPO_PUBLIC_ADMOB_REWARDED_ANDROID })
      : Platform.select({ ios: process.env.EXPO_PUBLIC_ADMOB_BANNER_IOS, android: process.env.EXPO_PUBLIC_ADMOB_BANNER_ANDROID });
  if (__DEV__ || !real) return kind === "rewarded" ? ads.TestIds.REWARDED : ads.TestIds.ADAPTIVE_BANNER;
  return real;
}

/** True when real ad units are in use, i.e. AdMob calls our server to count rewards. */
export const liveAdUnits = () => !!ads && adUnitId("rewarded") !== ads.TestIds.REWARDED;

let started: Promise<boolean> | null = null;

/**
 * Consent first (Google's UMP form where the law needs it, then Apple's tracking prompt), then the SDK.
 * Runs once, and only when an ad is about to be shown, so learners who never see one are never asked.
 * Resolves false when ads may not be requested.
 */
export function initAds(): Promise<boolean> {
  const lib = ads;
  if (!lib) return Promise.resolve(false);
  started ??= (async () => {
    try {
      await lib.AdsConsent.gatherConsent();
    } catch {
      // No form or no network: the SDK still decides from the stored consent below.
    }
    if (Platform.OS === "ios" && requireOptionalNativeModule("ExpoTrackingTransparency")) {
      const tracking: typeof import("expo-tracking-transparency") = require("expo-tracking-transparency");
      await tracking.requestTrackingPermissionsAsync().catch(() => undefined);
    }
    const consent = await lib.AdsConsent.getConsentInfo().catch(() => null);
    if (consent && !consent.canRequestAds) return false;
    await lib.default().setRequestConfiguration({ maxAdContentRating: lib.MaxAdContentRating.G });
    await lib.default().initialize();
    return true;
  })().catch(() => {
    started = null;
    return false;
  });
  return started;
}
