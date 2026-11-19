import { styleToken } from "../../../../packages/config/src/theme.ts";
import { tabs as configuredTabs, tabHref, tabRoute } from "../lib/navigation";
import { theme } from "../../../../packages/config/src/public.ts";
import type { Href } from "expo-router";
import { router } from 'expo-router';
import { Pressable, Text, View } from 'react-native';
import { FloatingTabBar, useScrollChrome } from './ScrollChrome';
import { Icon, colors } from './ui';
import { useShopper } from '../lib/store';

/** Outside the root stack, so detail routes keep the same navigation capsule. */
export function AppTabBar() {
  const { ready, state } = useShopper();
  const { activeTab: selected } = useScrollChrome();
  const count = Object.values(state.bag).reduce((sum, item) => sum + item.quantity, 0);
  if (!ready) return null;
  return <FloatingTabBar>{configuredTabs.map(item => {
    const tab = {...item, route:tabRoute(item.id),href:tabHref(item.id)};
    const active = selected === tab.route;
    return <Pressable key={tab.route} accessibilityRole="tab" aria-selected={active} accessibilityState={{ selected: active }} accessibilityLabel={tab.route === 'bag' && count ? `Bag, ${count} items` : tab.label}
      onPress={() => router.navigate(tab.href as Href)} style={({ pressed }) => ({ flex: 1, height: styleToken("AppTabBar.height.98010bd927","height",48), borderRadius: styleToken("AppTabBar.borderRadius.c2356069e9","borderRadius",24), marginHorizontal: styleToken("AppTabBar.marginHorizontal.d4735e3a26","marginHorizontal",2), alignItems: 'center', justifyContent: 'center', backgroundColor: active ? theme.colors.tabActive : 'transparent', opacity: pressed ? 0.65 : 1 })}>
      <View><Icon name={tab.icon} color={active ? theme.colors.tabInk : theme.colors.tabMuted}/>{tab.route === 'bag' && count > 0 && <View style={{ position: 'absolute', right: -11, top: -7, minWidth: styleToken("AppTabBar.minWidth.4523540f15","minWidth",17), height: styleToken("AppTabBar.height.4523540f15","height",17), paddingHorizontal: styleToken("AppTabBar.paddingHorizontal.4e07408562","paddingHorizontal",3), borderRadius: styleToken("AppTabBar.borderRadius.19581e27de","borderRadius",9), backgroundColor: colors.accent, alignItems: 'center', justifyContent: 'center' }}><Text style={{ color: colors.white, fontSize: styleToken("AppTabBar.fontSize.19581e27de","fontSize",9), fontWeight: '600' }}>{count > 99 ? '99+' : count}</Text></View>}</View>
    </Pressable>;
  })}</FloatingTabBar>;
}
