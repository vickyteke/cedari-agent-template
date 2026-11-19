import { styleToken } from "../../../../packages/config/src/theme.ts";
import { t } from "../../../../packages/config/src/copy.ts";
import { agentConfig } from "../../../../packages/config/src/public.ts";
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
  return <View style={{ width: compact ? 220 : full ? '100%' : '48%', marginBottom: styleToken("ProductCard.marginBottom.c2356069e9","marginBottom",24) }}>
    <View style={{ borderRadius: styleToken("ProductCard.borderRadius.b17ef6d19c","borderRadius",16), overflow: 'hidden', backgroundColor: colors.soft }}>
      <Pressable accessibilityRole="button" accessibilityLabel={t("dynamic.f9feefa62b",{value0: String(product.title)})} onPress={() => router.push({ pathname: '/product/[id]', params: { id: product.id } })}>
        {product.image_url ? <Image source={{ uri: product.image_url }} style={{ width: '100%', aspectRatio: styleToken("ProductCard.aspectRatio.e2819fbe22","aspectRatio",0.88) }} resizeMode="cover"/> : <View style={{ aspectRatio: styleToken("ProductCard.aspectRatio.e2819fbe22","aspectRatio",0.88), justifyContent: 'center', padding: styleToken("ProductCard.padding.e629fa6598","padding",15) }}><Text style={s.sectionTitle}>{product.title}</Text></View>}
      </Pressable>
      <View style={{ position: 'absolute', right: 7, top: 7, backgroundColor: colors.white, borderRadius: styleToken("ProductCard.borderRadius.c2356069e9","borderRadius",24) }}>{agentConfig.features.saved && <IconButton name="heart" label={state.saved[product.id]?.active ? t("ui.6ee6f3ec00") : t("ui.1d7ffc0576")} onPress={() => save(product)} filled={state.saved[product.id]?.active} color={colors.accent}/>}</View>
    </View>
    <Pressable accessibilityRole="button" onPress={() => router.push({ pathname: '/product/[id]', params: { id: product.id } })} style={{ paddingTop: styleToken("ProductCard.paddingTop.6b51d431df","paddingTop",12) }}><Text style={{ color: colors.accent, textTransform: 'uppercase', fontSize: styleToken("ProductCard.fontSize.19581e27de","fontSize",9), letterSpacing: styleToken("ProductCard.letterSpacing.1a948f1b43","letterSpacing",1.4) }}>{merchantName(product)}</Text><Text numberOfLines={2} style={{ fontFamily: serif, fontSize: styleToken("ProductCard.fontSize.9400f1b21c","fontSize",19), lineHeight: styleToken("ProductCard.lineHeight.535fa30d7e","lineHeight",23), color: colors.ink, marginTop: styleToken("ProductCard.marginTop.7902699be4","marginTop",7) }}>{product.title}</Text><Text style={{ color: colors.ink, marginTop: styleToken("ProductCard.marginTop.19581e27de","marginTop",9), fontSize: styleToken("ProductCard.fontSize.3fdba35f04","fontSize",13) }}>{price(product)}</Text>{!product.available && <Text style={s.small}>{t("ui.3848efcfec")}</Text>}</Pressable>
  </View>;
}
