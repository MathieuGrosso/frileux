import { Feather } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { Tabs } from "expo-router";
import type { BottomTabBarProps } from "@react-navigation/bottom-tabs";
import { useState } from "react";
import { Platform, Pressable, Text, View } from "react-native";
import Animated, {
  Easing,
  interpolateColor,
  useAnimatedStyle,
  useDerivedValue,
  useReducedMotion,
  useSharedValue,
  withTiming,
} from "react-native-reanimated";
import { useEffect } from "react";
import { colors } from "@/lib/theme";

type FeatherName = React.ComponentProps<typeof Feather>["name"];

type TabDef = {
  name: string;
  icon: FeatherName;
  label: string;
};

const TABS: TabDef[] = [
  { name: "index", icon: "sun", label: "AUJOURD'HUI" },
  { name: "wardrobe", icon: "grid", label: "GARDE-ROBE" },
  { name: "history", icon: "clock", label: "HISTORIQUE" },
  { name: "circle", icon: "users", label: "CERCLE" },
];

const EASE = Easing.bezier(0.23, 1, 0.32, 1);
const DUR = 180;
const INDICATOR_WIDTH = 24;

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

  const iconStyle = useAnimatedStyle(() => ({
    color: interpolateColor(
      focus.value,
      [0, 1],
      [colors.ink[500], colors.ink[900]],
    ) as unknown as string,
  }));

  const labelStyle = useAnimatedStyle(() => ({
    color: interpolateColor(
      focus.value,
      [0, 1],
      [colors.ink[300], colors.ink[900]],
    ),
  }));

  const pressStyle = useAnimatedStyle(() => ({
    transform: [{ scale: 1 - press.value * 0.03 }],
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
      <Animated.View
        style={pressStyle}
        className="items-center justify-center gap-1.5 py-1"
      >
        <AnimatedFeather name={tab.icon} size={22} style={iconStyle} />
        <Animated.Text
          numberOfLines={1}
          style={[
            labelStyle,
            {
              fontFamily: "Jost_500Medium",
              fontSize: 9,
              letterSpacing: 1.2,
            },
          ]}
        >
          {tab.label}
        </Animated.Text>
      </Animated.View>
    </Pressable>
  );
}

function CustomTabBar({ state, navigation }: BottomTabBarProps) {
  const reducedMotion = useReducedMotion() ?? false;
  const [barWidth, setBarWidth] = useState(0);

  const indicatorIndex = useSharedValue(state.index);
  useEffect(() => {
    indicatorIndex.value = reducedMotion
      ? state.index
      : withTiming(state.index, { duration: DUR, easing: EASE });
  }, [state.index, reducedMotion, indicatorIndex]);

  const tabWidth = barWidth > 0 ? barWidth / state.routes.length : 0;

  const indicatorStyle = useAnimatedStyle(() => {
    const center = tabWidth * (indicatorIndex.value + 0.5);
    return {
      transform: [{ translateX: center - INDICATOR_WIDTH / 2 }],
    };
  });

  return (
    <View
      onLayout={(e) => setBarWidth(e.nativeEvent.layout.width)}
      style={{
        backgroundColor: colors.paper[100],
        borderTopWidth: 1,
        borderTopColor: colors.paper[300],
        paddingTop: 10,
        paddingBottom: 10,
      }}
    >
      {tabWidth > 0 && (
        <Animated.View
          pointerEvents="none"
          style={[
            {
              position: "absolute",
              top: -1,
              left: 0,
              width: INDICATOR_WIDTH,
              height: 1,
              backgroundColor: colors.ink[900],
            },
            indicatorStyle,
          ]}
        />
      )}
      <View style={{ flexDirection: "row" }}>
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
