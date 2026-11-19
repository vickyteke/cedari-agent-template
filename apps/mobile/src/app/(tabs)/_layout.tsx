import { Tabs } from 'expo-router';
import { colors, Icon, Loading } from '../../components/ui';
import { useShopper } from '../../lib/store';
export default function TabsLayout() {
  const { ready, state } = useShopper();
  if (!ready) return <Loading/>;
  const count = Object.values(state.bag).reduce((sum, item) => sum + item.quantity, 0);
  return <Tabs tabBar={() => null} screenOptions={{ headerShown: false, tabBarHideOnKeyboard: true, tabBarActiveTintColor: colors.accent, tabBarInactiveTintColor: colors.muted, tabBarStyle: { backgroundColor: colors.white, borderTopColor: colors.line }, tabBarLabelStyle: { fontSize: 10 }, sceneStyle: { backgroundColor: colors.paper } }}>
    <Tabs.Screen name="index" options={{ title: 'Chat', tabBarIcon: ({ color }) => <Icon name="chat" color={typeof color === 'string' ? color : colors.accent}/> }}/>
    <Tabs.Screen name="discover" options={{ title: 'Discover', tabBarIcon: ({ color }) => <Icon name="discover" color={typeof color === 'string' ? color : colors.accent}/> }}/>
    <Tabs.Screen name="saved" options={{ title: 'Saved', tabBarIcon: ({ color }) => <Icon name="heart" color={typeof color === 'string' ? color : colors.accent}/> }}/>
    <Tabs.Screen name="bag" options={{ title: 'Bag', tabBarBadge: count || undefined, tabBarIcon: ({ color }) => <Icon name="bag" color={typeof color === 'string' ? color : colors.accent}/> }}/>
    <Tabs.Screen name="profile" options={{ title: 'You', tabBarIcon: ({ color }) => <Icon name="user" color={typeof color === 'string' ? color : colors.accent}/> }}/>
  </Tabs>;
}
