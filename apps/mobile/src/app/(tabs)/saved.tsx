import { styleToken } from "../../../../../packages/config/src/theme.ts";
import { t } from "../../../../../packages/config/src/copy.ts";
import { agentConfig } from "../../../../../packages/config/src/public.ts";
import { useState } from 'react';
import { Pressable, Text, View } from 'react-native';
import { router } from 'expo-router';
import { useShopper } from '../../lib/store';
import { Button, colors, Empty, Heading, s, Screen } from '../../components/ui';
import { ProductCard } from '../../components/ProductCard';
export default function SavedScreen() {
  const { state, session } = useShopper(); const [selected, setSelected] = useState<string[]>([]);
  const products = Object.values(state.saved).filter(item => item.active).sort((a, b) => b.updatedAt - a.updatedAt).map(item => item.product);
  const ids = selected.filter(id => state.saved[id]?.active);
  return <Screen name="saved"><Heading eyebrow={t("ui.1fb346c920")} title={t("ui.88a201909e")}/>{!session && <Pressable style={s.panel} onPress={() => router.push('/sign-in')}><Text style={s.body}>{t("ui.e495f5fbd6")}<Text style={{ color: colors.accent }}>{t("ui.795bf312cc")}</Text></Text></Pressable>}
    {!!products.length && <>{agentConfig.features.comparison && <Text style={[s.small, { marginBottom: styleToken("saved.marginBottom.e629fa6598","marginBottom",15) }]}>{t("ui.2250a8a00c")}</Text>}<View style={{ flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between' }}>{products.map(product => <View key={product.id} style={{ width: '48%' }}>{agentConfig.features.comparison && <Pressable accessibilityRole="checkbox" accessibilityState={{ checked: ids.includes(product.id) }} onPress={() => setSelected(previous => previous.includes(product.id) ? previous.filter(id => id !== product.id) : previous.length < 4 ? [...previous, product.id] : previous)} style={{ paddingVertical: styleToken("saved.paddingVertical.4a44dc1536","paddingVertical",10) }}><Text style={{ fontSize: styleToken("saved.fontSize.6b51d431df","fontSize",12), color: colors.accent }}>{ids.includes(product.id) ? '● Selected' : '○ Compare'}</Text></Pressable>}<ProductCard product={product} full/></View>)}</View>{agentConfig.features.comparison && <Button disabled={ids.length < 2} onPress={() => router.push({ pathname: '/compare', params: { ids: ids.join(',') } })}>{t("ui.e888155d8c")}{ids.length || ''} {t("ui.b6aa423de4")}</Button>}</>}
    {!products.length && <Empty title={t("ui.b360ece9bc")} detail={t("ui.63a804e445")} action={t("ui.41bd09a912")} onPress={() => router.push('/discover')}/>}
  </Screen>;
}
