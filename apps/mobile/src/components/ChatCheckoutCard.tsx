import { useState } from 'react';
import { Image, Linking, Pressable, Text, View } from 'react-native';
import { checkout } from '../lib/api';
import { track } from '../lib/analytics';
import { router } from 'expo-router';
import type { CheckoutLink, Product } from '../lib/model';
import { Button, colors, s } from './ui';

export function ChatCheckoutCard({ link, products = [] }: { link: CheckoutLink; products?: Product[] }) {
  const [busy, setBusy] = useState(false); const [error, setError] = useState('');
  async function open() {
    setBusy(true); setError('');
    try {
      // Saved conversations may contain old links. Recheck the selected items
      // through MCP before opening the merchant's current checkout.
      const fresh = await checkout(link.items.map(item => ({ productId: item.productId, quantity: item.quantity })));
      if (!fresh.url.startsWith('https://')) throw new Error('Could not prepare a secure merchant checkout.');
      await Linking.openURL(fresh.url);
      track('checkout_opened', { merchant: link.storeKey, item_count: link.items.length, source: 'chat' });
    } catch (e) { setError(e instanceof Error ? e.message : 'Could not open checkout. Please try again.'); track('checkout_failed', { merchant: link.storeKey, source: 'chat' }); }
    finally { setBusy(false); }
  }
  return <View style={[s.panel, { marginTop: 16, borderColor: colors.accent }]}>
    <Text style={s.eyebrow}>Your selection</Text><Text style={[s.sectionTitle, { marginBottom: 15 }]}>{link.merchant}</Text>
    {link.items.map(item => <CheckoutItem key={item.productId} item={item} imageUrl={item.imageUrl !== undefined ? item.imageUrl : products.find(product => product.id === item.productId)?.image_url}/>) }
    <Button disabled={busy} onPress={() => void open()}>{busy ? 'Preparing your checkout…' : `Continue to ${link.merchant} ↗`}</Button>
    <Text style={[s.small, { marginTop: 12 }]}>Review your items, shipping and payment on the shop’s website. Checkout preparation does not submit payment.</Text>
    {!!error && <Text accessibilityLiveRegion="polite" style={s.error}>{error}</Text>}
  </View>;
}

function CheckoutItem({ item, imageUrl }: { item: CheckoutLink['items'][number]; imageUrl?: string | null }) {
  const [imageFailed, setImageFailed] = useState(false);
  const currentImage = imageUrl?.includes('/api/product-image/') && !imageUrl.includes('?') ? `${imageUrl}?variantImage=1` : imageUrl;
  return <Pressable accessibilityRole="button" accessibilityLabel={`View details for ${item.title}`} onPress={() => router.push({ pathname: '/product/[id]', params: { id: item.productId } })} style={[s.row, { alignItems: 'flex-start', gap: 14, marginBottom: 20 }]}>
    {currentImage && !imageFailed ? <Image source={{ uri: currentImage }} accessibilityLabel={item.title} onError={() => setImageFailed(true)} style={{ width: 88, height: 110, borderRadius: 10, backgroundColor: colors.soft }} resizeMode="cover"/> : <View style={{ width: 88, height: 110, borderRadius: 10, backgroundColor: colors.soft, alignItems: 'center', justifyContent: 'center' }}><Text style={s.small}>Your piece</Text></View>}
    <View style={{ flex: 1 }}><Text style={[s.body, { color: colors.ink, fontSize: 16, lineHeight: 22, marginBottom: 5 }]}>{item.title}</Text>
      {item.variant && !['Default', 'Default Title'].includes(item.variant) && <Text style={[s.small, { marginBottom: 6 }]}>{item.variant}</Text>}
      <Text style={s.small}>Quantity: {item.quantity}</Text><Text style={[s.body, { color: colors.ink }]}>{new Intl.NumberFormat('en-US', { style: 'currency', currency: item.currency }).format(item.price)} each</Text>
    </View>
  </Pressable>;
}
