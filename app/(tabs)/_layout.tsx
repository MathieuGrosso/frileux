import { Tabs } from "expo-router";
import { Text, View } from "react-native";
import { colors } from "@/lib/theme";

function TabIcon({ emoji, label, focused }: { emoji: string; label: string; focused: boolean }) {
  return (
    <View
      className={`flex-row items-center gap-2 px-3.5 py-2.5 ${
        focused ? "bg-ice-100 border border-ice-200" : ""
      }`}
    >
      <Text style={{ fontSize: 16 }}>{emoji}</Text>
      {focused && (
        <Text className="font-body-medium text-caption text-ink-900">{label}</Text>
      )}
    </View>
  );
}

export default function TabLayout() {
  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarStyle: {
          backgroundColor: colors.paper[100],
          borderTopWidth: 1,
          borderTopColor: colors.paper[300],
          height: 80,
          paddingBottom: 8,
          paddingTop: 8,
          paddingHorizontal: 8,
          elevation: 0,
          shadowOpacity: 0,
        },
        tabBarShowLabel: false,
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          tabBarIcon: ({ focused }) => (
            <TabIcon emoji="🧣" label="Aujourd'hui" focused={focused} />
          ),
        }}
      />
      <Tabs.Screen
        name="wardrobe"
        options={{
          tabBarIcon: ({ focused }) => (
            <TabIcon emoji="🧥" label="Garde-robe" focused={focused} />
          ),
        }}
      />
      <Tabs.Screen
        name="history"
        options={{
          tabBarIcon: ({ focused }) => (
            <TabIcon emoji="📸" label="Historique" focused={focused} />
          ),
        }}
      />
      <Tabs.Screen
        name="circle"
        options={{
          tabBarIcon: ({ focused }) => (
            <TabIcon emoji="👯" label="Cercle" focused={focused} />
          ),
        }}
      />
    </Tabs>
  );
}
