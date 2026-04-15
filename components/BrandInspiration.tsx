import { useEffect, useState } from "react";
import { View, Text, ScrollView, Pressable, Linking } from "react-native";
import { Image } from "expo-image";
import { HatchedPlaceholder } from "@/components/HatchedPlaceholder";
import { fetchBrandInspiration, type BrandProduct } from "@/lib/brand-inspiration";

interface Props {
  favoriteBrands: string[];
}

export function BrandInspiration({ favoriteBrands }: Props) {
  const [items, setItems] = useState<BrandProduct[]>([]);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    let active = true;
    fetchBrandInspiration(favoriteBrands, 6).then((products) => {
      if (active) {
        setItems(products);
        setLoaded(true);
      }
    });
    return () => {
      active = false;
    };
  }, [favoriteBrands]);

  if (!loaded || items.length === 0) return null;

  const openProduct = (url: string | null) => {
    if (!url) return;
    Linking.openURL(url).catch(() => undefined);
  };

  return (
    <View className="border-t border-paper-300 pt-8 mt-8">
      <View className="px-6 mb-4">
        <Text className="font-body-medium text-eyebrow text-ink-500 uppercase">
          À chiner
        </Text>
        <Text className="font-body text-caption text-ink-400 mt-1">
          Inspiration hors garde-robe, depuis tes marques.
        </Text>
      </View>

      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={{ paddingHorizontal: 24 }}
      >
        {items.map((product) => (
          <Pressable
            key={product.id}
            onPress={() => openProduct(product.product_url)}
            disabled={!product.product_url}
            className="mr-3 w-40 active:opacity-80"
          >
            <View className="aspect-square border border-paper-300">
              {product.image_url ? (
                <Image
                  source={{ uri: product.image_url }}
                  style={{ width: "100%", height: "100%" }}
                  contentFit="cover"
                  cachePolicy="memory-disk"
                />
              ) : (
                <HatchedPlaceholder />
              )}
            </View>
            <Text
              className="font-body-medium text-caption text-ink-900 uppercase tracking-widest mt-2"
              numberOfLines={1}
            >
              {product.brand_name}
            </Text>
            <Text
              className="font-body text-caption text-ink-500 mt-[2px]"
              numberOfLines={2}
            >
              {product.name}
            </Text>
          </Pressable>
        ))}
      </ScrollView>
    </View>
  );
}
