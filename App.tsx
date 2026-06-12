import "./global.css";
import { NavigationContainer } from "@react-navigation/native";
import { createBottomTabNavigator } from "@react-navigation/bottom-tabs";
import { createNativeStackNavigator } from "@react-navigation/native-stack";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { StatusBar } from "expo-status-bar";

import { BottomNav } from "./src/components/layout/BottomNav";
import HomePage from "./src/pages/HomePage";
import ChatPage from "./src/pages/ChatPage";
import RecordPage from "./src/pages/RecordPage";
import DonePage from "./src/pages/DonePage";
import FamilyPage from "./src/pages/FamilyPage";
import ReportPage from "./src/pages/ReportPage";
import SettingsPage from "./src/pages/SettingsPage";

import type { RootStackParamList, MainTabParamList } from "./src/navigation/types";

const Stack = createNativeStackNavigator<RootStackParamList>();
const Tab = createBottomTabNavigator<MainTabParamList>();

function MainTabs() {
  return (
    <Tab.Navigator
      tabBar={(props) => <BottomNav {...props} />}
      screenOptions={{ headerShown: false }}
    >
      <Tab.Screen name="Home" component={HomePage} />
      <Tab.Screen name="Record" component={RecordPage} />
      <Tab.Screen name="Family" component={FamilyPage} />
      <Tab.Screen name="Report" component={ReportPage} />
      <Tab.Screen name="Settings" component={SettingsPage} />
    </Tab.Navigator>
  );
}

export default function App() {
  return (
    <SafeAreaProvider>
      <NavigationContainer>
        <StatusBar style="dark" />
        <Stack.Navigator screenOptions={{ headerShown: false }}>
          <Stack.Screen name="Main" component={MainTabs} />
          <Stack.Screen name="Chat" component={ChatPage} />
          <Stack.Screen name="Done" component={DonePage} />
        </Stack.Navigator>
      </NavigationContainer>
    </SafeAreaProvider>
  );
}
