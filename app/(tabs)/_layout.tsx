import { Tabs } from "expo-router";
import { Text } from "react-native";

function TabIcon({ emoji, focused }: { emoji: string; focused: boolean }) {
  return (
    <Text style={{ fontSize: 22, opacity: focused ? 1 : 0.5 }}>{emoji}</Text>
  );
}

export default function TabLayout() {
  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarStyle: {
          backgroundColor: "#1a1a2e",
          borderTopColor: "#2E2E4F",
          paddingBottom: 8,
          paddingTop: 8,
          height: 88,
        },
        tabBarActiveTintColor: "#FFC94D",
        tabBarInactiveTintColor: "#6F6F91",
        tabBarLabelStyle: {
          fontSize: 12,
          fontWeight: "600",
        },
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: "Aujourd'hui",
          tabBarIcon: ({ focused }) => (
            <TabIcon emoji="🧣" focused={focused} />
          ),
        }}
      />
      <Tabs.Screen
        name="history"
        options={{
          title: "Historique",
          tabBarIcon: ({ focused }) => (
            <TabIcon emoji="📸" focused={focused} />
          ),
        }}
      />
      <Tabs.Screen
        name="circle"
        options={{
          title: "Cercle",
          tabBarIcon: ({ focused }) => (
            <TabIcon emoji="👯" focused={focused} />
          ),
        }}
      />
    </Tabs>
  );
}
