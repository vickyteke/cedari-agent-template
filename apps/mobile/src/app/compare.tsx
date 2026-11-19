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
  return <Screen name="compare"><Back title="Side by side"/>{busy ? <Loading/> : error ? <Text style={s.error}>{error}</Text> : <>{missing && <Text style={[s.small, { marginTop: 12 }]}>Some saved pieces are no longer in the current catalog. Find them again to compare or check out.</Text>}<ScrollView horizontal contentContainerStyle={{ gap: 16, paddingTop: 20 }}>{products.map(p => <View key={p.id} style={{ width: 230 }}>{p.image_url && <Image source={{ uri: p.image_url }} style={{ width: 230, height: 260, borderRadius: 16, backgroundColor: colors.soft }}/>}<View style={{ height: 160, paddingTop: 15 }}><Text style={s.eyebrow}>{merchantName(p)}</Text><Text numberOfLines={4} style={[s.sectionTitle, { fontSize: 21, lineHeight: 26 }]}>{p.title}</Text></View>{[["Price", price(p)], ["Category", p.product_type || 'Home & décor'], ["Variant", p.variant_title === 'Default Title' ? 'Standard' : p.variant_title || 'Standard'], ["Availability", p.available ? 'Available when checked' : 'Unavailable']].map(([label, value]) => <View key={label} style={{ borderTopWidth: 1, borderColor: colors.line, paddingVertical: 17, minHeight: 80 }}><Text style={s.small}>{label}</Text><Text style={s.body}>{value}</Text></View>)}<Button disabled={!p.available} onPress={() => bag(p, (state.bag[p.id]?.quantity || 0) + 1)}>Add to bag</Button></View>)}</ScrollView></>}</Screen>;
}
