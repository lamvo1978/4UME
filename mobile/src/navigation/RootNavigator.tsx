import Ionicons from "@expo/vector-icons/Ionicons";
import {
  createNavigationContainerRef,
  DefaultTheme,
  NavigationContainer,
  Theme,
  useIsFocused,
} from "@react-navigation/native";
import { createBottomTabNavigator } from "@react-navigation/bottom-tabs";
import { createNativeStackNavigator } from "@react-navigation/native-stack";
import { ComponentProps, useCallback, useEffect, useRef } from "react";
import { ActivityIndicator, StyleSheet, View } from "react-native";
import { useAuth } from "../auth/AuthContext";
import { StreakCelebration } from "../components/streak/StreakCelebration";
import { onReminderTap, ReminderScreen } from "../notifications/reminders";
import { colors, shadow } from "../theme";
import { AboutScreen } from "../screens/AboutScreen";
import { FlashcardScreen } from "../screens/FlashcardScreen";
import { ForgotPasswordScreen } from "../screens/ForgotPasswordScreen";
import { GrammarLessonScreen } from "../screens/GrammarLessonScreen";
import { ListeningListScreen } from "../screens/ListeningListScreen";
import { ListeningPlayerScreen } from "../screens/ListeningPlayerScreen";
import { GrammarReviewScreen } from "../screens/GrammarReviewScreen";
import { HomeScreen } from "../screens/HomeScreen";
import { LoginScreen } from "../screens/LoginScreen";
import { PlacementScreen } from "../screens/PlacementScreen";
import { PracticeHubScreen } from "../screens/PracticeHubScreen";
import { ProfileScreen } from "../screens/ProfileScreen";
import { RegisterScreen } from "../screens/RegisterScreen";
import { ReviewScreen } from "../screens/ReviewScreen";
import { StudyHubScreen } from "../screens/StudyHubScreen";
import { WelcomeScreen } from "../screens/WelcomeScreen";
import { WordSearchScreen } from "../screens/WordSearchScreen";
import { MainTabParamList, RootStackParamList } from "./types";

const Stack = createNativeStackNavigator<RootStackParamList>();
const Tab = createBottomTabNavigator<MainTabParamList>();

const navTheme: Theme = {
  ...DefaultTheme,
  colors: {
    ...DefaultTheme.colors,
    primary: colors.accent,
    background: colors.bg,
    card: colors.surface,
    text: colors.ink,
    border: colors.border,
  },
};

type IconName = ComponentProps<typeof Ionicons>["name"];

function tabIcon(active: IconName, inactive: IconName) {
  return ({ focused, color }: { focused: boolean; color: string }) => (
    <View style={[styles.iconPill, focused && styles.iconPillActive]}>
      <Ionicons name={focused ? active : inactive} size={22} color={color} />
    </View>
  );
}

/** Waits until the user is back on the tabs so the celebration never interrupts a session. */
function CelebrationHost() {
  const { celebration, dismissCelebration } = useAuth();
  const focused = useIsFocused();
  if (celebration === null || !focused) return null;
  return <StreakCelebration streak={celebration} onClose={dismissCelebration} />;
}

function MainTabs() {
  return (
    <>
      <CelebrationHost />
      <Tab.Navigator
        screenOptions={{
          headerShown: false,
          tabBarActiveTintColor: colors.accent,
          tabBarInactiveTintColor: colors.muted,
          tabBarStyle: styles.tabBar,
          tabBarItemStyle: styles.tabItem,
          tabBarIconStyle: styles.tabIcon,
          tabBarLabelStyle: styles.tabLabel,
        }}
      >
        <Tab.Screen
          name="Home"
          component={HomeScreen}
          options={{ title: "Trang chủ", tabBarIcon: tabIcon("home", "home-outline") }}
        />
        <Tab.Screen
          name="Study"
          component={StudyHubScreen}
          options={{ title: "Học", tabBarIcon: tabIcon("book", "book-outline") }}
        />
        <Tab.Screen
          name="Practice"
          component={PracticeHubScreen}
          options={{ title: "Ôn tập", tabBarIcon: tabIcon("repeat", "repeat-outline") }}
        />
        <Tab.Screen
          name="Listen"
          component={ListeningListScreen}
          options={{ title: "Nghe", tabBarIcon: tabIcon("headset", "headset-outline") }}
        />
        <Tab.Screen
          name="Profile"
          component={ProfileScreen}
          options={{ title: "Hồ sơ", tabBarIcon: tabIcon("person", "person-outline") }}
        />
      </Tab.Navigator>
    </>
  );
}

const navigationRef = createNavigationContainerRef<RootStackParamList>();

const TAB_FOR: Record<ReminderScreen, keyof MainTabParamList> = { practice: "Practice", study: "Study" };

export function RootNavigator() {
  const { ready, user, onboarding } = useAuth();
  const pendingTap = useRef<ReminderScreen | null>(null);

  const openPendingTap = useCallback(() => {
    const screen = pendingTap.current;
    if (!screen || !navigationRef.isReady() || !navigationRef.getRootState()?.routeNames.includes("Main")) return;
    pendingTap.current = null;
    navigationRef.navigate("Main", { screen: TAB_FOR[screen] });
  }, []);

  useEffect(() => {
    if (!user) return;
    return onReminderTap((screen) => {
      pendingTap.current = screen;
      openPendingTap();
    });
  }, [user, openPendingTap]);

  if (!ready) {
    return (
      <View style={{ flex: 1, alignItems: "center", justifyContent: "center", backgroundColor: colors.bg }}>
        <ActivityIndicator color={colors.accent} />
      </View>
    );
  }

  return (
    <NavigationContainer ref={navigationRef} theme={navTheme} onReady={openPendingTap}>
      <Stack.Navigator
        initialRouteName={user && onboarding ? "Placement" : undefined}
        screenOptions={{
          headerStyle: { backgroundColor: colors.bg },
          headerShadowVisible: false,
          headerTintColor: colors.accent,
          headerTitleAlign: "center",
          headerTitleStyle: { color: colors.ink, fontWeight: "700", fontSize: 17 },
          headerBackButtonDisplayMode: "minimal",
          contentStyle: { backgroundColor: colors.bg },
        }}
      >
        {!user ? (
          <>
            <Stack.Screen name="Welcome" component={WelcomeScreen} options={{ headerShown: false }} />
            <Stack.Screen name="Login" component={LoginScreen} options={{ title: "" }} />
            <Stack.Screen name="Register" component={RegisterScreen} options={{ title: "" }} />
            <Stack.Screen name="ForgotPassword" component={ForgotPasswordScreen} options={{ title: "" }} />
          </>
        ) : (
          <>
            <Stack.Screen name="Main" component={MainTabs} options={{ headerShown: false }} />
            <Stack.Screen
              name="Flashcard"
              component={FlashcardScreen}
              options={({ route }) => ({ title: route.params.titleVi })}
            />
            <Stack.Screen
              name="Review"
              component={ReviewScreen}
              options={({ route }) => ({
                title: route.params?.mode === "practice" ? (route.params.title ?? "Luyện thêm") : "Ôn tập hôm nay",
              })}
            />
            <Stack.Screen
              name="GrammarReview"
              component={GrammarReviewScreen}
              options={({ route }) => ({
                title:
                  route.params?.mode === "practice" ? (route.params.title ?? "Luyện ngữ pháp") : "Ôn ngữ pháp hôm nay",
              })}
            />
            <Stack.Screen name="WordSearch" component={WordSearchScreen} options={{ title: "Tìm từ" }} />
            <Stack.Screen name="About" component={AboutScreen} options={{ title: "Giới thiệu & bản quyền" }} />
            <Stack.Screen
              name="Placement"
              component={PlacementScreen}
              options={
                onboarding ? { headerShown: false, gestureEnabled: false } : { title: "Kiểm tra trình độ" }
              }
            />
            <Stack.Screen
              name="GrammarLesson"
              component={GrammarLessonScreen}
              options={({ route }) => ({ title: route.params.titleVi })}
            />
            <Stack.Screen
              name="Listening"
              component={ListeningPlayerScreen}
              options={({ route }) => ({ title: route.params.titleVi })}
            />
          </>
        )}
      </Stack.Navigator>
    </NavigationContainer>
  );
}

const styles = StyleSheet.create({
  tabBar: {
    backgroundColor: colors.surface,
    borderTopWidth: 0,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingTop: 8,
    paddingHorizontal: 8,
    ...shadow.card,
    shadowOffset: { width: 0, height: -4 },
  },
  tabItem: { paddingTop: 2, paddingHorizontal: 0 },
  tabLabel: { fontSize: 11, fontWeight: "600", marginTop: 2 },
  tabIcon: { width: 52, height: 32 },
  iconPill: { width: 52, height: 32, borderRadius: 16, alignItems: "center", justifyContent: "center" },
  iconPillActive: { backgroundColor: colors.accentSoft },
});
