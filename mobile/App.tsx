import * as Sentry from "@sentry/react-native";
import { StatusBar } from "expo-status-bar";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { AuthProvider } from "./src/auth/AuthContext";
import { RootNavigator } from "./src/navigation/RootNavigator";

const sentryDsn = process.env.EXPO_PUBLIC_SENTRY_DSN;

// Crash reports from store/TestFlight builds only; no email, IP or screen recordings are sent.
Sentry.init({
  dsn: sentryDsn,
  enabled: !!sentryDsn && !__DEV__,
  sendDefaultPii: false,
  tracesSampleRate: 0,
});

function App() {
  return (
    <SafeAreaProvider>
      <AuthProvider>
        <StatusBar style="dark" />
        <RootNavigator />
      </AuthProvider>
    </SafeAreaProvider>
  );
}

export default Sentry.wrap(App);
