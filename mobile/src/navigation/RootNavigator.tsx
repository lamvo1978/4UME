import Ionicons from "@expo/vector-icons/Ionicons";
import {
  createNavigationContainerRef,
  DefaultTheme,
  NavigationContainer,
  Theme,
  useIsFocused,
  useNavigation,
} from "@react-navigation/native";
import { createBottomTabNavigator } from "@react-navigation/bottom-tabs";
import { createNativeStackNavigator, NativeStackNavigationProp } from "@react-navigation/native-stack";
import { ComponentProps, useCallback, useEffect, useRef, useState } from "react";
import { ActivityIndicator, StyleSheet, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useAuth } from "../auth/AuthContext";
import { ErrorRetry } from "../components/ErrorRetry";
import { PracticeGiftPrompt, practiceGiftToAnnounce } from "../components/streak/PracticeGiftPrompt";
import { ReminderPrompt } from "../components/streak/ReminderPrompt";
import { StreakCelebration } from "../components/streak/StreakCelebration";
import { NotificationTarget, onNotificationTap, ReminderScreen, shouldOfferReminder } from "../notifications/reminders";
import { colors, shadow } from "../theme";
import { AboutScreen } from "../screens/AboutScreen";
import { FeedbackInboxScreen } from "../screens/FeedbackInboxScreen";
import { FeedbackNewScreen } from "../screens/FeedbackNewScreen";
import { FeedbackThreadScreen } from "../screens/FeedbackThreadScreen";
import { FlashcardScreen } from "../screens/FlashcardScreen";
import { ForgotPasswordScreen } from "../screens/ForgotPasswordScreen";
import { GrammarLessonScreen } from "../screens/GrammarLessonScreen";
import { DictationScreen, SpeakingScreen } from "../screens/DictationScreen";
import { ListeningListScreen } from "../screens/ListeningListScreen";
import { ListeningPlayerScreen } from "../screens/ListeningPlayerScreen";
import { GrammarReviewScreen } from "../screens/GrammarReviewScreen";
import { HomeScreen } from "../screens/HomeScreen";
import { LoginScreen } from "../screens/LoginScreen";
import { PlacementScreen } from "../screens/PlacementScreen";
import { PracticeHubScreen } from "../screens/PracticeHubScreen";
import { PremiumScreen } from "../screens/PremiumScreen";
import { AdRewardsScreen } from "../screens/AdRewardsScreen";
import { WeeklyScreen } from "../screens/WeeklyScreen";
import { InviteScreen } from "../screens/InviteScreen";
import { WeakWordsScreen } from "../screens/WeakWordsScreen";
import { ProfileScreen } from "../screens/ProfileScreen";
import { RegisterScreen } from "../screens/RegisterScreen";
import { ReviewScreen } from "../screens/ReviewScreen";
import { SentenceHubScreen } from "../screens/SentenceHubScreen";
import { SentencePracticeScreen } from "../screens/SentencePracticeScreen";
import { ConversationHubScreen } from "../screens/ConversationHubScreen";
import { ConversationScreen } from "../screens/ConversationScreen";
import { WritingEditorScreen } from "../screens/WritingEditorScreen";
import { WritingHubScreen } from "../screens/WritingHubScreen";
import { WritingResultScreen } from "../screens/WritingResultScreen";
import { SettingsScreen } from "../screens/SettingsScreen";
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

/** tabBar paddingTop 8 + tabItem padding 2/4 + icon pill 32 + label marginTop 2 + lineHeight 14. */
const TAB_BAR_HEIGHT = 62;

function tabIcon(active: IconName, inactive: IconName) {
  return ({ focused, color }: { focused: boolean; color: string }) => (
    <View style={[styles.iconPill, focused && styles.iconPillActive]}>
      <Ionicons name={focused ? active : inactive} size={22} color={color} />
    </View>
  );
}

/** Waits until the user is back on the tabs so the celebration never interrupts a session. */
function CelebrationHost() {
  const { me, celebration, dismissCelebration } = useAuth();
  const focused = useIsFocused();
  const [offerReminder, setOfferReminder] = useState(false);
  const [giftDays, setGiftDays] = useState<number | null>(null);
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();

  useEffect(() => {
    practiceGiftToAnnounce()
      .then(setGiftDays)
      .catch(() => undefined);
  }, []);

  const closeCelebration = useCallback(() => {
    dismissCelebration();
    shouldOfferReminder(me)
      .then(setOfferReminder)
      .catch(() => undefined);
  }, [me, dismissCelebration]);

  if (!focused) return null;
  if (celebration !== null) return <StreakCelebration streak={celebration} onClose={closeCelebration} />;
  if (giftDays !== null) {
    return (
      <PracticeGiftPrompt
        days={giftDays}
        onOpen={() => {
          setGiftDays(null);
          navigation.navigate("Main", { screen: "Sentences" });
        }}
        onClose={() => setGiftDays(null)}
      />
    );
  }
  return offerReminder ? <ReminderPrompt onClose={() => setOfferReminder(false)} /> : null;
}

function MainTabs() {
  const insets = useSafeAreaInsets();
  return (
    <>
      <CelebrationHost />
      <Tab.Navigator
        screenOptions={{
          headerShown: false,
          tabBarActiveTintColor: colors.accent,
          tabBarInactiveTintColor: colors.muted,
          tabBarStyle: [styles.tabBar, { height: TAB_BAR_HEIGHT + insets.bottom }],
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
          name="Sentences"
          component={SentenceHubScreen}
          options={{ title: "Luyện", tabBarIcon: tabIcon("chatbubbles", "chatbubbles-outline") }}
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

const TAB_FOR: Record<ReminderScreen | "listen", keyof MainTabParamList> = { practice: "Practice", study: "Study", listen: "Listen" };

export function RootNavigator() {
  const { ready, user, onboarding, startupError, retryStartup } = useAuth();
  const pendingTap = useRef<NotificationTarget | null>(null);

  const openPendingTap = useCallback(() => {
    const target = pendingTap.current;
    if (!target || !navigationRef.isReady() || !navigationRef.getRootState()?.routeNames.includes("Main")) return;
    pendingTap.current = null;
    if (target.screen === "weekly") navigationRef.navigate("Weekly", { start: target.start });
    else if (target.screen === "feedback") navigationRef.navigate("FeedbackThread", { id: target.id });
    else if (target.screen === "invite") navigationRef.navigate("Invite");
    else navigationRef.navigate("Main", { screen: TAB_FOR[target.screen] });
  }, []);

  useEffect(() => {
    if (!user) return;
    return onNotificationTap((target) => {
      pendingTap.current = target;
      openPendingTap();
    });
  }, [user, openPendingTap]);

  if (!ready || startupError) {
    return (
      <View style={{ flex: 1, alignItems: "center", justifyContent: "center", backgroundColor: colors.bg }}>
        {startupError ? <ErrorRetry message={startupError} onRetry={retryStartup} /> : <ActivityIndicator color={colors.accent} />}
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
                  route.params?.mode === "practice"
                    ? (route.params.title ?? "Luyện ngữ pháp")
                    : route.params?.mode === "mixed"
                      ? "Luyện tập tổng hợp"
                      : "Ôn ngữ pháp hôm nay",
              })}
            />
            <Stack.Screen name="WordSearch" component={WordSearchScreen} options={{ title: "Tìm từ" }} />
            <Stack.Screen name="About" component={AboutScreen} options={{ title: "Giới thiệu & bản quyền" }} />
            <Stack.Screen name="Settings" component={SettingsScreen} options={{ title: "Cài đặt" }} />
            <Stack.Screen name="Premium" component={PremiumScreen} options={{ title: "4UME Premium" }} />
            <Stack.Screen name="AdRewards" component={AdRewardsScreen} options={{ title: "Thêm lượt kiểm tra" }} />
            <Stack.Screen name="Weekly" component={WeeklyScreen} options={{ title: "Tổng kết tuần" }} />
            <Stack.Screen name="Invite" component={InviteScreen} options={{ title: "Mời bạn bè" }} />
            <Stack.Screen name="WeakWords" component={WeakWordsScreen} options={{ title: "Từ hay sai" }} />
            <Stack.Screen name="Feedback" component={FeedbackInboxScreen} options={{ title: "Góp ý & hỗ trợ" }} />
            <Stack.Screen
              name="FeedbackNew"
              component={FeedbackNewScreen}
              options={({ route }) => ({ title: route.params?.wordId ? "Báo lỗi từ" : "Gửi góp ý" })}
            />
            <Stack.Screen name="FeedbackThread" component={FeedbackThreadScreen} options={{ title: "Góp ý" }} />
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
            <Stack.Screen name="Dictation" component={DictationScreen} options={{ title: "Chép chính tả" }} />
            <Stack.Screen name="Speaking" component={SpeakingScreen} options={{ title: "Luyện nói" }} />
            <Stack.Screen
              name="SentencePractice"
              component={SentencePracticeScreen}
              options={({ route }) => ({
                title: `${route.params.mode === "type" ? "Nghe – chép" : route.params.mode === "speak" ? "Nghe – nói" : "Luyện trộn"} · ${route.params.level}`,
              })}
            />
            <Stack.Screen name="ConversationHub" component={ConversationHubScreen} options={{ title: "Đàm thoại với AI" }} />
            <Stack.Screen
              name="Conversation"
              component={ConversationScreen}
              options={({ route }) => ({ title: `${route.params.title} · ${route.params.level}` })}
            />
            <Stack.Screen name="WritingHub" component={WritingHubScreen} options={{ title: "Luyện viết với AI" }} />
            <Stack.Screen name="WritingEditor" component={WritingEditorScreen} options={({ route }) => ({ title: route.params.title })} />
            <Stack.Screen name="WritingResult" component={WritingResultScreen} options={{ title: "Kết quả chấm" }} />
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
    paddingHorizontal: 4,
    ...shadow.card,
    shadowOffset: { width: 0, height: -4 },
  },
  tabItem: { paddingTop: 2, paddingBottom: 4, paddingHorizontal: 0 },
  tabLabel: { fontSize: 10.5, lineHeight: 14, fontWeight: "600", marginTop: 2, letterSpacing: -0.1 },
  tabIcon: { width: 48, height: 32 },
  iconPill: { width: 48, height: 32, borderRadius: 16, alignItems: "center", justifyContent: "center" },
  iconPillActive: { backgroundColor: colors.accentSoft },
});
