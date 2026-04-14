import { Tabs } from "expo-router";
import { Text, View, StyleSheet } from "react-native";
import { colors, fonts } from "@/lib/theme";

function TabIcon({ emoji, label, focused }: { emoji: string; label: string; focused: boolean }) {
  return (
    <View style={[styles.tabIcon, focused && styles.tabIconActive]}>
      <Text style={{ fontSize: 16 }}>{emoji}</Text>
      {focused && <Text style={styles.tabLabel}>{label}</Text>}
    </View>
  );
}

export default function TabLayout() {
  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarStyle: styles.tabBar,
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

const styles = StyleSheet.create({
  tabBar: {
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
  tabIcon: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  tabIconActive: {
    backgroundColor: colors.ice[100],
    borderWidth: 1,
    borderColor: colors.ice[200],
  },
  tabLabel: {
    fontFamily: fonts.bodyMedium,
    fontSize: 12,
    color: colors.ink[900],
  },
});
