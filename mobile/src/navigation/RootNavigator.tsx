import { NavigationContainer } from "@react-navigation/native";
import { createBottomTabNavigator } from "@react-navigation/bottom-tabs";
import { createNativeStackNavigator } from "@react-navigation/native-stack";
import { ActivityIndicator, Text, View } from "react-native";
import { useAuth } from "../auth/AuthContext";
import { colors } from "../theme";
import { FlashcardScreen } from "../screens/FlashcardScreen";
import { GrammarLessonScreen } from "../screens/GrammarLessonScreen";
import { HomeScreen } from "../screens/HomeScreen";
import { LoginScreen } from "../screens/LoginScreen";
import { ProfileScreen } from "../screens/ProfileScreen";
import { RegisterScreen } from "../screens/RegisterScreen";
import { StudyHubScreen } from "../screens/StudyHubScreen";
import { WelcomeScreen } from "../screens/WelcomeScreen";
import { MainTabParamList, RootStackParamList } from "./types";

const Stack = createNativeStackNavigator<RootStackParamList>();
const Tab = createBottomTabNavigator<MainTabParamList>();

function MainTabs() {
  return (
    <Tab.Navigator
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: colors.accent,
        tabBarInactiveTintColor: colors.muted,
        tabBarStyle: { backgroundColor: colors.surface, borderTopColor: colors.border },
      }}
    >
      <Tab.Screen
        name="Home"
        component={HomeScreen}
        options={{ title: "Trang chủ", tabBarIcon: () => <Text>⌂</Text> }}
      />
      <Tab.Screen
        name="Study"
        component={StudyHubScreen}
        options={{ title: "Học", tabBarIcon: () => <Text>✎</Text> }}
      />
      <Tab.Screen
        name="Profile"
        component={ProfileScreen}
        options={{ title: "Hồ sơ", tabBarIcon: () => <Text>●</Text> }}
      />
    </Tab.Navigator>
  );
}

export function RootNavigator() {
  const { ready, user } = useAuth();

  if (!ready) {
    return (
      <View style={{ flex: 1, alignItems: "center", justifyContent: "center", backgroundColor: colors.bg }}>
        <ActivityIndicator color={colors.accent} />
      </View>
    );
  }

  return (
    <NavigationContainer>
      <Stack.Navigator
        screenOptions={{
          headerStyle: { backgroundColor: colors.bg },
          headerTintColor: colors.accent,
          headerTitleStyle: { color: colors.ink },
          contentStyle: { backgroundColor: colors.bg },
        }}
      >
        {!user ? (
          <>
            <Stack.Screen name="Welcome" component={WelcomeScreen} options={{ headerShown: false }} />
            <Stack.Screen name="Login" component={LoginScreen} options={{ title: "Đăng nhập" }} />
            <Stack.Screen name="Register" component={RegisterScreen} options={{ title: "Tạo tài khoản" }} />
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
              name="GrammarLesson"
              component={GrammarLessonScreen}
              options={({ route }) => ({ title: route.params.titleVi })}
            />
          </>
        )}
      </Stack.Navigator>
    </NavigationContainer>
  );
}
