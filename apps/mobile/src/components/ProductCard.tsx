import { useEffect } from 'react';
import { Image, Pressable, Text, View } from 'react-native';
import { router } from 'expo-router';
import { colors, IconButton, s, serif } from './ui';
import { price, merchantName, type Product } from '../lib/model';
import { useShopper } from '../lib/store';
import { track } from '../lib/analytics';
export function ProductCard({ product, compact = false, full = false }: { product: Product; compact?: boolean; full?: boolean }) {
  const { state, save } = useShopper();
  useEffect(() => { track('product_impression', { product_id: product.id, merchant: product.store_key }); }, [product.id, product.store_key]);
  return <View style={{ width: compact ? 220 : full ? '100%' : '48%', marginBottom: 24 }}>
    <View style={{ borderRadius: 16, overflow: 'hidden', backgroundColor: colors.soft }}>
      <Pressable accessibilityRole="button" accessibilityLabel={`View ${product.title}`} onPress={() => router.push({ pathname: '/product/[id]', params: { id: product.id } })}>
        {product.image_url ? <Image source={{ uri: product.image_url }} style={{ width: '100%', aspectRatio: 0.88 }} resizeMode="cover"/> : <View style={{ aspectRatio: 0.88, justifyContent: 'center', padding: 15 }}><Text style={s.sectionTitle}>{product.title}</Text></View>}
      </Pressable>
      <View style={{ position: 'absolute', right: 7, top: 7, backgroundColor: colors.white, borderRadius: 24 }}><IconButton name="heart" label={state.saved[product.id]?.active ? 'Unsave product' : 'Save product'} onPress={() => save(product)} filled={state.saved[product.id]?.active} color={colors.accent}/></View>
    </View>
    <Pressable accessibilityRole="button" onPress={() => router.push({ pathname: '/product/[id]', params: { id: product.id } })} style={{ paddingTop: 12 }}><Text style={{ color: colors.accent, textTransform: 'uppercase', fontSize: 9, letterSpacing: 1.4 }}>{merchantName(product)}</Text><Text numberOfLines={2} style={{ fontFamily: serif, fontSize: 19, lineHeight: 23, color: colors.ink, marginTop: 7 }}>{product.title}</Text><Text style={{ color: colors.ink, marginTop: 9, fontSize: 13 }}>{price(product)}</Text>{!product.available && <Text style={s.small}>Currently unavailable</Text>}</Pressable>
  </View>;
}
