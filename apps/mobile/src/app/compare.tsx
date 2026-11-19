import { styleToken } from "../../../../packages/config/src/theme.ts";
import { t } from "../../../../packages/config/src/copy.ts";
import { agentConfig } from "../../../../packages/config/src/public.ts";
import { useEffect, useState } from 'react';
import { Image, ScrollView, Text, View } from 'react-native';
import { useLocalSearchParams } from 'expo-router';
import { catalog } from '../lib/api';
import { price, merchantName, type Product } from '../lib/model';
import { track } from '../lib/analytics';
import { Back, Button, colors, Loading, s, Screen } from '../components/ui';
import { useShopper } from '../lib/store';
export default function CompareScreen() {
  const { ids } = useLocalSearchParams<{ ids: string }>(); const { bag, state } = useShopper();
  const [missing, setMissing] = useState(false);
  const [products, setProducts] = useState<Product[]>([]); const [error, setError] = useState(''); const [busy, setBusy] = useState(true);
  useEffect(() => { let alive = true; void catalog({ ids }).then(({ products, missingProductIds }) => { if (alive) { setMissing(missingProductIds.length > 0); setProducts(products); track('comparison_viewed', { product_count: products.length }); } }).catch(e => { if (alive) setError(e.message); }).finally(() => { if (alive) setBusy(false); }); return () => { alive = false; }; }, [ids]);
  return <Screen name="compare"><Back title={t("ui.a3d7b387c3")}/>{busy ? <Loading/> : error ? <Text style={s.error}>{error}</Text> : <>{missing && <Text style={[s.small, { marginTop: styleToken("compare.marginTop.6b51d431df","marginTop",12) }]}>{t("ui.be4443a945")}</Text>}<ScrollView horizontal contentContainerStyle={{ gap: styleToken("compare.gap.b17ef6d19c","gap",16), paddingTop: styleToken("compare.paddingTop.f5ca38f748","paddingTop",20) }}>{products.map(p => <View key={p.id} style={{ width: styleToken("compare.width.a0eaec5a55","width",230) }}>{p.image_url && <Image source={{ uri: p.image_url }} style={{ width: styleToken("compare.width.a0eaec5a55","width",230), height: styleToken("compare.height.39bb88f40d","height",260), borderRadius: styleToken("compare.borderRadius.b17ef6d19c","borderRadius",16), backgroundColor: colors.soft }}/>}<View style={{ height: styleToken("compare.height.a512db2741","height",160), paddingTop: styleToken("compare.paddingTop.e629fa6598","paddingTop",15) }}><Text style={s.eyebrow}>{merchantName(p)}</Text><Text numberOfLines={4} style={[s.sectionTitle, { fontSize: styleToken("compare.fontSize.6f4b661212","fontSize",21), lineHeight: styleToken("compare.lineHeight.5f9c4ab08c","lineHeight",26) }]}>{p.title}</Text></View>{[["Price", price(p)], ["Category", p.product_type || t("ui.d68fe5e505")], ["Variant", p.variant_title === t("ui.3dc1541e1a") ? t("ui.ef6691545d") : p.variant_title || t("ui.ef6691545d")], ["Availability", p.available ? t("ui.6c8b70aefd") : t("ui.ca18449697")]].map(([label, value]) => <View key={label} style={{ borderTopWidth: styleToken("compare.borderTopWidth.6b86b273ff","borderTopWidth",1), borderColor: colors.line, paddingVertical: styleToken("compare.paddingVertical.4523540f15","paddingVertical",17), minHeight: styleToken("compare.minHeight.48449a14a4","minHeight",80) }}><Text style={s.small}>{label}</Text><Text style={s.body}>{value}</Text></View>)}{agentConfig.features.checkout && <Button disabled={!p.available} onPress={() => bag(p, (state.bag[p.id]?.quantity || 0) + 1)}>{t("ui.39af9159d9")}</Button>}</View>)}</ScrollView></>}</Screen>;
}
