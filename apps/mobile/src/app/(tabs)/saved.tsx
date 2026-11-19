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
  return <Screen name="saved"><Heading eyebrow="A collection taking shape" title="Your personal edit."/>{!session && <Pressable style={s.panel} onPress={() => router.push('/sign-in')}><Text style={s.body}>Saved on this device. <Text style={{ color: colors.accent }}>Sign in to keep your favorites everywhere ↗</Text></Text></Pressable>}
    {!!products.length && <><Text style={[s.small, { marginBottom: 15 }]}>Select 2–4 pieces to compare.</Text><View style={{ flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between' }}>{products.map(product => <View key={product.id} style={{ width: '48%' }}><Pressable accessibilityRole="checkbox" accessibilityState={{ checked: ids.includes(product.id) }} onPress={() => setSelected(previous => previous.includes(product.id) ? previous.filter(id => id !== product.id) : previous.length < 4 ? [...previous, product.id] : previous)} style={{ paddingVertical: 10 }}><Text style={{ fontSize: 12, color: colors.accent }}>{ids.includes(product.id) ? '● Selected' : '○ Compare'}</Text></Pressable><ProductCard product={product} full/></View>)}</View><Button disabled={ids.length < 2} onPress={() => router.push({ pathname: '/compare', params: { ids: ids.join(',') } })}>Compare {ids.length || ''} pieces</Button></>}
    {!products.length && <Empty title="Your personal edit starts here" detail="Save the pieces that speak to your style. Return to compare details and see how your ideas come together." action="Explore the collection" onPress={() => router.push('/discover')}/>}
  </Screen>;
}
