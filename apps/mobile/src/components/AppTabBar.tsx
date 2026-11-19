import { router } from 'expo-router';
import { Pressable, Text, View } from 'react-native';
import { FloatingTabBar, useScrollChrome } from './ScrollChrome';
import { Icon, colors } from './ui';
import { useShopper } from '../lib/store';

const tabs = [
  { route: 'index', href: '/', label: 'Chat', icon: 'chat' },
  { route: 'discover', href: '/discover', label: 'Discover', icon: 'discover' },
  { route: 'saved', href: '/saved', label: 'Saved', icon: 'heart' },
  { route: 'bag', href: '/bag', label: 'Bag', icon: 'bag' },
  { route: 'profile', href: '/profile', label: 'You', icon: 'user' },
] as const;

/** Outside the root stack, so detail routes keep the same navigation capsule. */
export function AppTabBar() {
  const { ready, state } = useShopper();
  const { activeTab: selected } = useScrollChrome();
  const count = Object.values(state.bag).reduce((sum, item) => sum + item.quantity, 0);
  if (!ready) return null;
  return <FloatingTabBar>{tabs.map(tab => {
    const active = selected === tab.route;
    return <Pressable key={tab.route} accessibilityRole="tab" aria-selected={active} accessibilityState={{ selected: active }} accessibilityLabel={tab.route === 'bag' && count ? `Bag, ${count} items` : tab.label}
      onPress={() => router.navigate(tab.href)} style={({ pressed }) => ({ flex: 1, height: 48, borderRadius: 24, marginHorizontal: 2, alignItems: 'center', justifyContent: 'center', backgroundColor: active ? 'rgba(138,98,74,0.14)' : 'transparent', opacity: pressed ? 0.65 : 1 })}>
      <View><Icon name={tab.icon} color={active ? '#684b39' : '#665e57'}/>{tab.route === 'bag' && count > 0 && <View style={{ position: 'absolute', right: -11, top: -7, minWidth: 17, height: 17, paddingHorizontal: 3, borderRadius: 9, backgroundColor: colors.accent, alignItems: 'center', justifyContent: 'center' }}><Text style={{ color: colors.white, fontSize: 9, fontWeight: '600' }}>{count > 99 ? '99+' : count}</Text></View>}</View>
    </Pressable>;
  })}</FloatingTabBar>;
}
