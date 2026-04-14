import { Feather } from "@expo/vector-icons";
import { Tabs } from "expo-router";
import { Text, View } from "react-native";
import { colors } from "@/lib/theme";

type FeatherName = React.ComponentProps<typeof Feather>["name"];

function TabIcon({
  icon,
  label,
  focused,
}: {
  icon: FeatherName;
  label: string;
  focused: boolean;
}) {
  return (
    <View
      className={`flex-row items-center gap-2 px-3 py-2 ${
        focused ? "bg-ice-100 border border-ice-200" : ""
      }`}
    >
      <Feather
        name={icon}
        size={22}
        color={focused ? colors.ink[900] : colors.ink[500]}
      />
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
            <TabIcon icon="sun" label="Aujourd'hui" focused={focused} />
          ),
        }}
      />
      <Tabs.Screen
        name="wardrobe"
        options={{
          tabBarIcon: ({ focused }) => (
            <TabIcon icon="grid" label="Garde-robe" focused={focused} />
          ),
        }}
      />
      <Tabs.Screen
        name="history"
        options={{
          tabBarIcon: ({ focused }) => (
            <TabIcon icon="clock" label="Historique" focused={focused} />
          ),
        }}
      />
      <Tabs.Screen
        name="circle"
        options={{
          tabBarIcon: ({ focused }) => (
            <TabIcon icon="users" label="Cercle" focused={focused} />
          ),
        }}
      />
    </Tabs>
  );
}
