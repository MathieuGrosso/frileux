import { View } from "react-native";

function SkeletonCard() {
  return (
    <View className="mb-8">
      <View className="flex-row items-center gap-2.5 mb-3">
        <View className="w-7 h-7 bg-paper-200" />
        <View className="h-3 bg-paper-200 flex-1 max-w-[120px]" />
      </View>
      <View className="w-full bg-paper-200" style={{ height: 320 }} />
    </View>
  );
}

export function CircleFeedSkeleton() {
  return (
    <View className="px-6 pb-6">
      <SkeletonCard />
      <SkeletonCard />
      <SkeletonCard />
    </View>
  );
}
