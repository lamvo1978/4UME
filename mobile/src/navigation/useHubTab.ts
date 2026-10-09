import { RouteProp, useNavigation, useRoute } from "@react-navigation/native";
import { useEffect, useState } from "react";
import { HubTab, MainTabParamList } from "./types";

/**
 * Segment state for the Study/Practice hubs. Another screen can open a specific segment via
 * `navigate("Study", { tab: "grammar" })`; the param is cleared once applied so the same
 * request works again after the user switches segments manually.
 */
export function useHubTab(): [HubTab, (tab: HubTab) => void] {
  const route = useRoute<RouteProp<MainTabParamList, "Study" | "Practice">>();
  const navigation = useNavigation();
  const requested = route.params?.tab;
  const [tab, setTab] = useState<HubTab>(requested ?? "vocab");

  useEffect(() => {
    if (!requested) return;
    setTab(requested);
    navigation.setParams({ tab: undefined } as never);
  }, [requested, navigation]);

  return [tab, setTab];
}
