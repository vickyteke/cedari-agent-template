import { styleToken } from "../../../../../packages/config/src/theme.ts";
import { t } from "../../../../../packages/config/src/copy.ts";
import { agentConfig } from "../../../../../packages/config/src/public.ts";
/* eslint-disable react-hooks/set-state-in-effect -- These effects synchronize loading and error status with an external catalog request. */
import { useEffect, useState } from 'react';
import { Pressable, ScrollView, Text, TextInput, View } from 'react-native';
import { catalog } from '../../lib/api';
import type { Product } from '../../lib/model';
import { track } from '../../lib/analytics';
import { Button, colors, Empty, Heading, IconButton, Loading, s, Screen } from '../../components/ui';
import { ProductCard } from '../../components/ProductCard';

const categoryFilters = [{key:'',name:t("ui.718622df41")}, ...agentConfig.assortment.registry.categories.filter(c => agentConfig.assortment.categories.mode === 'all' || agentConfig.assortment.categories.ids.includes(c.id)).map(c=>({key:c.id,name:c.label}))];

export default function DiscoverScreen() {
  const [query, setQuery] = useState(''); const [search, setSearch] = useState(''); const [store, setStore] = useState(''); const [budget, setBudget] = useState('');
  const [products, setProducts] = useState<Product[]>([]); const [busy, setBusy] = useState(true); const [error, setError] = useState(''); const [refresh, setRefresh] = useState(0);
  useEffect(() => { let alive = true; setBusy(true); setError(''); const filters: Record<string, string> = {}; if (search) filters.query = search; if (store) filters.category = store; if (budget) { filters.maxPrice = budget; filters.currency = agentConfig.discovery.currency; }
    void catalog(filters).then(({ products }) => { if (alive) { setProducts(products); track('search_completed', { result_count: products.length, category: store || 'all', budget_filter: !!budget }); } }).catch(e => { if (alive) setError(e.message); }).finally(() => { if (alive) setBusy(false); }); return () => { alive = false; }; }, [search, store, budget, refresh]);
  return <Screen name="discover"><Heading eyebrow={t("ui.e7d810a324")} title={t("ui.1d8c0a42a2")}/><View style={[s.row, s.input, { paddingVertical: styleToken("discover.paddingVertical.4e07408562","paddingVertical",3), borderRadius: styleToken("discover.borderRadius.59e19706d5","borderRadius",28), marginBottom: styleToken("discover.marginBottom.4ec9599fc2","marginBottom",18) }]}><TextInput accessibilityLabel={t("ui.c65cb6b210")} value={query} onChangeText={setQuery} placeholder={t("ui.f8a1dbd8f9")} placeholderTextColor={colors.muted} returnKeyType="search" onSubmitEditing={() => setSearch(query.trim())} style={{ flex: 1, color: colors.ink, paddingVertical: styleToken("discover.paddingVertical.6b51d431df","paddingVertical",12) }}/><IconButton name="search" label={t("ui.86a303e542")} onPress={() => setSearch(query.trim())}/></View>
    <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: styleToken("discover.gap.2c624232cd","gap",8), paddingBottom: styleToken("discover.paddingBottom.6b51d431df","paddingBottom",12) }}>{categoryFilters.map(item => <Pressable key={item.key} onPress={() => setStore(item.key)} style={[s.chip, store === item.key && { backgroundColor: colors.ink }]}><Text style={[s.chipText, store === item.key && { color: colors.white }]}>{item.name}</Text></Pressable>)}</ScrollView>
    <View style={[s.row, { marginBottom: styleToken("discover.marginBottom.b7a56873cd","marginBottom",25), flexWrap: 'wrap' }]}>{['', ...agentConfig.discovery.budgets.map(String)].map(value => <Pressable key={value} onPress={() => setBudget(value)}><Text style={[s.small, { paddingVertical: styleToken("discover.paddingVertical.2c624232cd","paddingVertical",8), color: budget === value ? colors.accent : colors.muted, textDecorationLine: budget === value ? 'underline' : 'none' }]}>{value ? t("dynamic.d1d4fc8b31",{value0: String(new Intl.NumberFormat(agentConfig.locale,{style:'currency',currency:agentConfig.discovery.currency,maximumFractionDigits:0}).format(Number(value)))}) : t("ui.4707becc32")}</Text></Pressable>)}</View>
    <View style={[s.row, { justifyContent: 'space-between', marginBottom: styleToken("discover.marginBottom.f5ca38f748","marginBottom",20) }]}><Text style={s.sectionTitle}>{search ? t("ui.d1625e66b2") : t("ui.e49841024c")}</Text><Text style={s.small}>{products.length} {t("ui.b6aa423de4")}</Text></View>
    {busy ? <Loading/> : error ? <><Text style={s.error}>{error}</Text><Button secondary onPress={() => setRefresh(x => x + 1)}>{t("ui.d8b8392e2c")}</Button></> : products.length ? <View style={{ flexDirection: 'row', justifyContent: 'space-between', flexWrap: 'wrap' }}>{products.map(product => <ProductCard key={product.id} product={product}/>)}</View> : <Empty title={t("ui.9c216e69db")} detail={t("ui.cf00aa0104")} action={t("ui.7179ea0035")} onPress={() => { setQuery(''); setSearch(''); setStore(''); setBudget(''); }}/>}<Text style={s.small}>{t("ui.41bdaa891c")}</Text>
  </Screen>;
}
