/* eslint-disable react-hooks/set-state-in-effect -- These effects synchronize loading and error status with an external catalog request. */
import { useEffect, useState } from 'react';
import { Pressable, ScrollView, Text, TextInput, View } from 'react-native';
import { catalog } from '../../lib/api';
import type { Product } from '../../lib/model';
import { track } from '../../lib/analytics';
import { Button, colors, Empty, Heading, IconButton, Loading, s, Screen } from '../../components/ui';
import { ProductCard } from '../../components/ProductCard';

const categoryFilters = [
  { key: '', name: 'All home' },
  { key: 'Wall Sculptures and Accents', name: 'Wall accents' },
  { key: 'Rugs', name: 'Rugs' },
  { key: 'Table Lamp', name: 'Table lamps' },
  { key: 'Dinnerware', name: 'Dinnerware' },
  { key: 'Curtains', name: 'Curtains' },
];

export default function DiscoverScreen() {
  const [query, setQuery] = useState(''); const [search, setSearch] = useState(''); const [store, setStore] = useState(''); const [budget, setBudget] = useState('');
  const [products, setProducts] = useState<Product[]>([]); const [busy, setBusy] = useState(true); const [error, setError] = useState(''); const [refresh, setRefresh] = useState(0);
  useEffect(() => { let alive = true; setBusy(true); setError(''); const filters: Record<string, string> = {}; if (search) filters.query = search; if (store) filters.category = store; if (budget) { filters.maxPrice = budget; filters.currency = 'USD'; }
    void catalog(filters).then(({ products }) => { if (alive) { setProducts(products); track('search_completed', { result_count: products.length, category: store || 'all', budget_filter: !!budget }); } }).catch(e => { if (alive) setError(e.message); }).finally(() => { if (alive) setBusy(false); }); return () => { alive = false; }; }, [search, store, budget, refresh]);
  return <Screen name="discover"><Heading eyebrow="Distinctive pieces. A considered home." title={'Discover your\nnext signature piece.'}/><View style={[s.row, s.input, { paddingVertical: 3, borderRadius: 28, marginBottom: 18 }]}><TextInput accessibilityLabel="Search products" value={query} onChangeText={setQuery} placeholder="Lamps, linens, tableware…" placeholderTextColor={colors.muted} returnKeyType="search" onSubmitEditing={() => setSearch(query.trim())} style={{ flex: 1, color: colors.ink, paddingVertical: 12 }}/><IconButton name="search" label="Search the collection" onPress={() => setSearch(query.trim())}/></View>
    <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8, paddingBottom: 12 }}>{categoryFilters.map(item => <Pressable key={item.key} onPress={() => setStore(item.key)} style={[s.chip, store === item.key && { backgroundColor: colors.ink }]}><Text style={[s.chipText, store === item.key && { color: colors.white }]}>{item.name}</Text></Pressable>)}</ScrollView>
    <View style={[s.row, { marginBottom: 25, flexWrap: 'wrap' }]}>{['', '100', '250', '500'].map(value => <Pressable key={value} onPress={() => setBudget(value)}><Text style={[s.small, { paddingVertical: 8, color: budget === value ? colors.accent : colors.muted, textDecorationLine: budget === value ? 'underline' : 'none' }]}>{value ? `Under $${value}` : 'Any budget'}</Text></Pressable>)}</View>
    <View style={[s.row, { justifyContent: 'space-between', marginBottom: 20 }]}><Text style={s.sectionTitle}>{search ? 'Your discoveries' : 'The collection'}</Text><Text style={s.small}>{products.length} pieces</Text></View>
    {busy ? <Loading/> : error ? <><Text style={s.error}>{error}</Text><Button secondary onPress={() => setRefresh(x => x + 1)}>Try again</Button></> : products.length ? <View style={{ flexDirection: 'row', justifyContent: 'space-between', flexWrap: 'wrap' }}>{products.map(product => <ProductCard key={product.id} product={product}/>)}</View> : <Empty title="A different direction to explore" detail="Try fewer keywords, another category, or a wider budget." action="Clear filters" onPress={() => { setQuery(''); setSearch(''); setStore(''); setBudget(''); }}/>}<Text style={s.small}>Prices and availability are confirmed by the merchant at checkout.</Text>
  </Screen>;
}
