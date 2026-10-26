import { useEffect, useState } from "react";
import { StyleSheet, Text, View } from "react-native";
import { ads, adUnitId, initAds } from "../../ads/sdk";
import { colors, spacing } from "../../theme";

/**
 * The Home banner, pinned below the scroll so new cards never push it out of view. Nothing is reserved until an ad
 * has loaded, so the layout doesn't jump. Expo Go has no ad SDK and shows a dashed placeholder in dev instead.
 */
export function HomeBanner({ enabled }: { enabled: boolean | undefined }) {
  const [canRequest, setCanRequest] = useState(false);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    if (!enabled || !ads) return;
    let active = true;
    initAds().then((ok) => {
      if (active) setCanRequest(ok);
    });
    return () => {
      active = false;
    };
  }, [enabled]);

  if (!enabled) return null;
  if (!ads) return __DEV__ ? <Placeholder /> : null;
  if (!canRequest) return null;
  const { BannerAd, BannerAdSize } = ads;
  return (
    <View style={loaded ? styles.wrap : styles.loading}>
      {loaded ? <Text style={styles.label}>Quảng cáo</Text> : null}
      <BannerAd
        unitId={adUnitId("banner")}
        size={BannerAdSize.ANCHORED_ADAPTIVE_BANNER}
        onAdLoaded={() => setLoaded(true)}
        onAdFailedToLoad={() => setLoaded(false)}
      />
    </View>
  );
}

function Placeholder() {
  return (
    <View style={styles.wrap}>
      <Text style={styles.label}>Quảng cáo</Text>
      <View style={styles.box}>
        <Text style={styles.boxText}>Banner quảng cáo (giả lập)</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    alignItems: "center",
    paddingTop: 4,
    paddingBottom: spacing.sm,
    backgroundColor: colors.bg,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.border,
  },
  loading: { alignItems: "center" },
  label: { alignSelf: "flex-start", paddingHorizontal: spacing.lg, fontSize: 10, fontWeight: "600", color: colors.muted, marginBottom: 2 },
  box: {
    alignSelf: "stretch",
    marginHorizontal: spacing.lg,
    height: 50,
    borderRadius: 8,
    borderWidth: 1,
    borderStyle: "dashed",
    borderColor: colors.border,
    backgroundColor: colors.bgAlt,
    alignItems: "center",
    justifyContent: "center",
  },
  boxText: { fontSize: 12, color: colors.muted },
});
