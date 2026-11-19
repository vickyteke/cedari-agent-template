/* eslint-disable react-hooks/set-state-in-effect -- These effects synchronize loading and error status with an external catalog request. */
import { useEffect, useState } from 'react';
import { Image, Linking, Text, View } from 'react-native';
import { useLocalSearchParams } from 'expo-router';
import { catalog } from '../../lib/api';
import { price, merchantName, type Product } from '../../lib/model';
import { useShopper } from '../../lib/store';
import { track } from '../../lib/analytics';
import { Back, Button, colors, Heading, IconButton, Loading, s, Screen } from '../../components/ui';
export default function ProductScreen() {
  const { id } = useLocalSearchParams<{ id: string }>(); const { state, update, save, bag } = useShopper();
  const [product, setProduct] = useState<Product | null>(null); const [error, setError] = useState(''); const [busy, setBusy] = useState(true); const [added, setAdded] = useState(false); const [retry, setRetry] = useState(0);
  useEffect(() => { let alive = true; setBusy(true); setError(''); void catalog({ ids: id }).then(({ products }) => {
    const p = products[0]; if (!p) throw new Error('This piece is no longer in the catalog.');
    if (alive) { setProduct(p); update(s => ({ ...s, viewed: Object.fromEntries(Object.entries({ ...s.viewed, [p.id]: { product: p, updatedAt: Date.now() } }).sort(([, a], [, b]) => b.updatedAt - a.updatedAt).slice(0, 80)) })); track('product_viewed', { product_id: p.id, merchant: p.store_key }); }
  }).catch(e => { if (alive) setError(e.message); }).finally(() => { if (alive) setBusy(false); }); return () => { alive = false; }; /* update intentionally uses the provider's current state */
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id, retry]);
  return <Screen name="product"><Back title="A closer look"/>{busy ? <Loading/> : error ? <><Text style={s.error}>{error}</Text><Button secondary onPress={() => setRetry(v => v + 1)}>Try again</Button></> : product && <>
    {product.image_url && <Image source={{ uri: product.image_url }} style={{ width: '100%', aspectRatio: 0.9, borderRadius: 20, backgroundColor: colors.soft, marginTop: 20, marginBottom: 25 }} resizeMode="cover"/>}
    <Heading eyebrow={merchantName(product)} title={product.title}/><View style={[s.row, { justifyContent: 'space-between' }]}><Text style={s.sectionTitle}>{price(product)}</Text><IconButton name="heart" label="Toggle saved product" onPress={() => save(product)} filled={state.saved[product.id]?.active} color={colors.accent}/></View>
    {!!product.variant_title && product.variant_title !== 'Default Title' && <Text style={[s.body, { marginVertical: 10 }]}>Variant: {product.variant_title}</Text>}
    <Text style={[s.body, { marginVertical: 22 }]}>{product.description?.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim() || 'Explore this piece on the merchant’s website for the full details.'}</Text>
    <Button disabled={!product.available} onPress={() => { bag(product, (state.bag[product.id]?.quantity || 0) + 1); setAdded(true); }}>{!product.available ? 'Currently unavailable' : added ? 'Added to your bag ✓' : 'Add to bag'}</Button>
    <Button secondary disabled={!product.product_url} style={{ marginTop: 12 }} onPress={() => { void Linking.openURL(product.product_url!).catch(() => setError('Could not open the merchant website.')); }}>View at {merchantName(product)} ↗</Button>
    <Text style={[s.small, { marginTop: 20 }]}>Sold and fulfilled by {merchantName(product)}. You’ll complete checkout on their website. Prices, availability, delivery and returns are confirmed by the shop.</Text>
  </>}</Screen>;
}
