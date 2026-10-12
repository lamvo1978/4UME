import Constants from "expo-constants";
import * as Notifications from "expo-notifications";
import { Platform } from "react-native";
import { api } from "../api/client";

/** Token sent to the server in this session, so it is posted once and can be removed on logout. */
let registered: string | null = null;

/**
 * Sends this phone's Expo push token to the server once notifications are allowed, so the server can push the
 * weekly summary, long-absence reminders and feedback replies. Never asks for permission itself.
 */
export async function registerPushToken() {
  if (Platform.OS === "web") return;
  const { granted } = await Notifications.getPermissionsAsync();
  if (!granted) return;
  const projectId = Constants.expoConfig?.extra?.eas?.projectId as string | undefined;
  const { data: token } = await Notifications.getExpoPushTokenAsync(projectId ? { projectId } : undefined);
  if (token === registered) return;
  await api.registerDevice(token, Platform.OS, Constants.expoConfig?.version ?? "1.0.0");
  registered = token;
}

/** Call before the auth token is cleared: the server only removes devices of the signed-in user. */
export async function unregisterPushToken() {
  const token = registered;
  registered = null;
  if (token) await api.removeDevice(token).catch(() => undefined);
}

/** Forgets the token without calling the server (session already expired). */
export function forgetPushToken() {
  registered = null;
}
