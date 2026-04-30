import { useEffect } from "react";
import { Modal, View, Text, Pressable, FlatList, StyleSheet } from "react-native";
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withTiming,
} from "react-native-reanimated";
import { colors, motion } from "@/lib/theme";
import { RECIPES, type Recipe } from "./RecipeChips";

interface CommandPickerProps {
  visible: boolean;
  onClose: () => void;
  onPick: (recipe: Recipe) => void;
}

export function CommandPicker({ visible, onClose, onPick }: CommandPickerProps) {
  const translateY = useSharedValue(visible ? 0 : 200);
  const opacity = useSharedValue(visible ? 1 : 0);

  useEffect(() => {
    translateY.value = withTiming(visible ? 0 : 200, {
      duration: motion.fast,
      easing: motion.easing,
    });
    opacity.value = withTiming(visible ? 1 : 0, {
      duration: motion.fast,
      easing: motion.easing,
    });
  }, [visible, translateY, opacity]);

  const sheetStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: translateY.value }],
  }));
  const overlayStyle = useAnimatedStyle(() => ({
    opacity: opacity.value * 0.4,
  }));

  return (
    <Modal visible={visible} transparent animationType="none" onRequestClose={onClose}>
      <View style={{ flex: 1, justifyContent: "flex-end" }}>
        <Animated.View
          pointerEvents="none"
          style={[
            { ...StyleSheet.absoluteFillObject, backgroundColor: colors.ink[900] },
            overlayStyle,
          ]}
        />
        <Pressable onPress={onClose} style={{ flex: 1 }} accessibilityLabel="Fermer le picker" />
        <Animated.View
          style={[
            { backgroundColor: colors.paper[100], borderTopWidth: 1, borderTopColor: colors.ink[200] },
            sheetStyle,
          ]}
        >
          <View className="px-5 py-4 border-b border-ink-100">
            <Text
              className="font-body-medium"
              style={{ fontSize: 10, letterSpacing: 2, color: colors.ink[300] }}
            >
              RECIPES
            </Text>
            <Text
              className="font-display tracking-tight mt-1"
              style={{ fontSize: 22, lineHeight: 26, color: colors.ink[900] }}
            >
              COMMANDES DISPONIBLES
            </Text>
          </View>
          <FlatList
            data={RECIPES}
            keyExtractor={(r) => r.command}
            contentContainerStyle={{ paddingBottom: 24 }}
            renderItem={({ item }) => (
              <Pressable
                onPress={() => {
                  onPick(item);
                  onClose();
                }}
                className="px-5 py-4 border-b border-ink-100 active:bg-paper-200"
                accessibilityLabel={`Choisir /${item.command}`}
              >
                <View className="flex-row items-center">
                  <View
                    className="border border-ink-300 items-center justify-center mr-3"
                    style={{ width: 22, height: 22 }}
                  >
                    <Text
                      className="font-body-medium"
                      style={{ fontSize: 13, color: colors.ink[700] }}
                    >
                      /
                    </Text>
                  </View>
                  <View className="flex-1">
                    <Text
                      className="font-body-semibold"
                      style={{ fontSize: 14, color: colors.ink[900] }}
                    >
                      /{item.command}
                    </Text>
                    {item.hint ? (
                      <Text
                        className="font-body mt-0.5"
                        style={{ fontSize: 12, color: colors.ink[500] }}
                      >
                        {item.hint}
                      </Text>
                    ) : null}
                  </View>
                  <Text className="font-body" style={{ fontSize: 14, color: colors.ink[300] }}>
                    →
                  </Text>
                </View>
              </Pressable>
            )}
          />
        </Animated.View>
      </View>
    </Modal>
  );
}
