import type { CSSProperties } from "react";

/** Save bar pinned just above the phone tab bar, which also covers the iPhone home-indicator inset. */
export const mobileActionBarStyle: CSSProperties = {
  position: "fixed",
  left: 0,
  right: 0,
  bottom: "calc(64px + env(safe-area-inset-bottom))",
  zIndex: 50,
  borderRadius: 0,
};
