import { Tabs } from "expo-router";
import { Text, View, StyleSheet } from "react-native";

function TabIcon({ emoji, label, focused }: { emoji: string; label: string; focused: boolean }) {
  return (
    <View style={[styles.tabIcon, focused && styles.tabIconActive]}>
      <Text style={{ fontSize: 18 }}>{emoji}</Text>
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
    backgroundColor: "#1C1917",
    borderTopWidth: 1,
    borderTopColor: "#292524",
    height: 80,
    paddingBottom: 8,
    paddingTop: 8,
    paddingHorizontal: 8,
  },
  tabIcon: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 30,
  },
  tabIconActive: {
    backgroundColor: "#292524",
    borderWidth: 1,
    borderColor: "#44403C",
  },
  tabLabel: {
    fontFamily: "DMSans_500Medium",
    fontSize: 13,
    color: "#D6D3D1",
  },
});
