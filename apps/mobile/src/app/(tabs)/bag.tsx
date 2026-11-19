import { useState } from 'react';
import { Image, Linking, Text, View } from 'react-native';
import { router } from 'expo-router';
import { checkout } from '../../lib/api';
import { groupBag, price, merchantName } from '../../lib/model';
import { track } from '../../lib/analytics';
import { useShopper } from '../../lib/store';
import { Button, colors, Empty, Heading, IconButton, s, Screen } from '../../components/ui';
export default function BagScreen() {
  const { state, bag } = useShopper(); const groups = groupBag(state);
  const [busy, setBusy] = useState(''); const [error, setError] = useState('');
  async function openCheckout(merchant: string) {
    setBusy(merchant); setError('');
    try {
      const { url } = await checkout(groups[merchant].map(item => ({ productId: item.product.id, quantity: item.quantity })));
      if (!url.startsWith('https://')) throw new Error('Invalid merchant checkout.');
      await Linking.openURL(url); track('checkout_opened', { merchant, item_count: groups[merchant].length });
    } catch (e) { setError(e instanceof Error ? e.message : 'Could not open checkout.'); track('checkout_failed', { merchant }); }
    finally { setBusy(''); }
  }
  return <Screen name="bag"><Heading eyebrow="Considered choices, ready for your home" title="Your shopping bag."/><Text style={[s.body, { marginBottom: 25 }]}>Each shop handles its own secure checkout, delivery and returns.</Text>
    {Object.entries(groups).map(([merchant, items]) => <View key={merchant} style={s.panel}><Text style={[s.sectionTitle, { marginBottom: 18 }]}>{merchantName(items[0].product)}</Text>{items.map(({ product, quantity }) => <View key={product.id} style={{ marginBottom: 20 }}><View style={[s.row, { alignItems: 'flex-start' }]}>{product.image_url && <Image source={{ uri: product.image_url }} style={{ width: 66, height: 80, borderRadius: 8, backgroundColor: colors.soft }}/>}<View style={{ flex: 1 }}><Text style={{ color: colors.ink, fontSize: 14, lineHeight: 21 }}>{product.title}</Text>{product.variant_title && product.variant_title !== 'Default Title' && <Text style={s.small}>{product.variant_title}</Text>}<Text style={s.body}>{price(product)}</Text><View style={s.row}><Button secondary onPress={() => bag(product, quantity - 1)} style={{ minHeight: 34, paddingHorizontal: 14 }}>−</Button><Text>{quantity}</Text><Button secondary disabled={quantity >= 20} onPress={() => bag(product, quantity + 1)} style={{ minHeight: 34, paddingHorizontal: 14 }}>+</Button><IconButton name="close" label={`Remove ${product.title}`} onPress={() => bag(product, 0)}/></View></View></View></View>)}<Text style={[s.small, { marginBottom: 12 }]}>Shipping, tax and final prices calculated by the shop.</Text><Button disabled={!!busy} onPress={() => void openCheckout(merchant)}>{busy === merchant ? 'Preparing checkout…' : `Checkout at ${merchantName(items[0].product)} ↗`}</Button></View>)}
    {!!error && <Text style={s.error}>{error}</Text>}{!Object.keys(groups).length && <Empty title="The next chapter of your space" detail="Bring together the pieces you’ve chosen for your home." action="Find your next piece" onPress={() => router.push('/discover')}/>}
  </Screen>;
}
