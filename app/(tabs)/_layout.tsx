import { Feather } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { Tabs } from "expo-router";
import type { BottomTabBarProps } from "@react-navigation/bottom-tabs";
import { useEffect } from "react";
import { Platform, Pressable, Text, View } from "react-native";
import Animated, {
  Easing,
  interpolate,
  interpolateColor,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withTiming,
} from "react-native-reanimated";
import { colors } from "@/lib/theme";

type FeatherName = React.ComponentProps<typeof Feather>["name"];

type TabDef = {
  name: string;
  icon: FeatherName;
  label: string;
};

const TABS: TabDef[] = [
  { name: "index", icon: "sun", label: "Aujourd'hui" },
  { name: "wardrobe", icon: "grid", label: "Garde-robe" },
  { name: "history", icon: "clock", label: "Historique" },
  { name: "circle", icon: "users", label: "Cercle" },
];

const EASE = Easing.bezier(0.23, 1, 0.32, 1);
const DUR = 180;

const AnimatedFeather = Animated.createAnimatedComponent(Feather);

function TabItem({
  tab,
  focused,
  onPress,
  reducedMotion,
}: {
  tab: TabDef;
  focused: boolean;
  onPress: () => void;
  reducedMotion: boolean;
}) {
  const focus = useSharedValue(focused ? 1 : 0);
  const press = useSharedValue(0);

  useEffect(() => {
    focus.value = reducedMotion
      ? focused
        ? 1
        : 0
      : withTiming(focused ? 1 : 0, { duration: DUR, easing: EASE });
  }, [focused, reducedMotion, focus]);

  const pillStyle = useAnimatedStyle(() => ({
    opacity: focus.value,
    transform: [{ scale: interpolate(focus.value, [0, 1], [0.96, 1]) }],
  }));

  const iconStyle = useAnimatedStyle(() => ({
    color: interpolateColor(
      focus.value,
      [0, 1],
      [colors.ink[500], colors.ink[900]],
    ) as unknown as string,
  }));

  const labelStyle = useAnimatedStyle(() => ({
    opacity: focus.value,
    maxWidth: interpolate(focus.value, [0, 1], [0, 120]),
    marginLeft: interpolate(focus.value, [0, 1], [0, 8]),
    transform: [
      { translateX: interpolate(focus.value, [0, 1], [-4, 0]) },
    ],
  }));

  const pressStyle = useAnimatedStyle(() => ({
    transform: [{ scale: interpolate(press.value, [0, 1], [1, 0.97]) }],
  }));

  return (
    <Pressable
      accessibilityRole="tab"
      accessibilityState={{ selected: focused }}
      accessibilityLabel={tab.label}
      onPress={() => {
        if (Platform.OS !== "web") {
          Haptics.selectionAsync().catch(() => {});
        }
        onPress();
      }}
      onPressIn={() => {
        press.value = reducedMotion
          ? 1
          : withTiming(1, { duration: 90, easing: EASE });
      }}
      onPressOut={() => {
        press.value = reducedMotion
          ? 0
          : withTiming(0, { duration: 140, easing: EASE });
      }}
      className="flex-1 items-center justify-center"
      hitSlop={8}
    >
      <Animated.View style={pressStyle} className="flex-row items-center">
        <View className="relative flex-row items-center px-3 py-2">
          <Animated.View
            pointerEvents="none"
            style={[
              pillStyle,
              {
                position: "absolute",
                top: 0,
                right: 0,
                bottom: 0,
                left: 0,
                backgroundColor: colors.ice[100],
                borderWidth: 1,
                borderColor: colors.ice[200],
              },
            ]}
          />
          <AnimatedFeather
            name={tab.icon}
            size={22}
            style={iconStyle}
          />
          <Animated.View style={[labelStyle, { overflow: "hidden" }]}>
            <Text
              numberOfLines={1}
              className="font-body-medium text-caption text-ink-900"
            >
              {tab.label}
            </Text>
          </Animated.View>
        </View>
      </Animated.View>
    </Pressable>
  );
}

function CustomTabBar({ state, navigation }: BottomTabBarProps) {
  const reducedMotion = useReducedMotion() ?? false;

  return (
    <View
      style={{
        flexDirection: "row",
        backgroundColor: colors.paper[100],
        borderTopWidth: 1,
        borderTopColor: colors.paper[300],
        paddingTop: 8,
        paddingBottom: 8,
        paddingHorizontal: 8,
      }}
    >
      {state.routes.map((route, index) => {
        const def = TABS.find((t) => t.name === route.name);
        if (!def) return null;
        const focused = state.index === index;
        return (
          <TabItem
            key={route.key}
            tab={def}
            focused={focused}
            reducedMotion={reducedMotion}
            onPress={() => {
              const event = navigation.emit({
                type: "tabPress",
                target: route.key,
                canPreventDefault: true,
              });
              if (!focused && !event.defaultPrevented) {
                navigation.navigate(route.name);
              }
            }}
          />
        );
      })}
    </View>
  );
}

export default function TabLayout() {
  return (
    <Tabs
      tabBar={(props) => <CustomTabBar {...props} />}
      screenOptions={{ headerShown: false }}
    >
      {TABS.map((t) => (
        <Tabs.Screen key={t.name} name={t.name} />
      ))}
    </Tabs>
  );
}
