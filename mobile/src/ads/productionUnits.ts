/** Must match `mobile/eas.json` → build.base.env (OTA bundles may omit those vars). */
export const PRODUCTION_ADMOB_UNITS = {
  rewarded: {
    ios: "ca-app-pub-3892770660039931/3622306884",
    android: "ca-app-pub-3892770660039931/4369868612",
  },
  banner: {
    ios: "ca-app-pub-3892770660039931/1601728336",
    android: "ca-app-pub-3892770660039931/4419463361",
  },
} as const;
