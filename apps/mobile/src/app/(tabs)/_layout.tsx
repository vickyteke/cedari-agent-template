import { RouteGuard } from "../../components/RouteGuard";
import { agentConfig } from "../../../../../packages/config/src/public.ts";
import { Tabs } from "expo-router";
import { colors, Loading } from "../../components/ui";
import { useShopper } from "../../lib/store";
import { tabs, tabRoute } from "../../lib/navigation";
export const unstable_settings = {
  initialRouteName: tabRoute(agentConfig.navigation.initialTab),
};
export default function TabsLayout() {
  const { ready } = useShopper();
  if (!ready) return <Loading />;
  return (
    <RouteGuard>
      <Tabs
        tabBar={() => null}
        screenOptions={{
          headerShown: false,
          sceneStyle: { backgroundColor: colors.paper },
        }}
      >
        {tabs.map((t) => (
          <Tabs.Screen
            key={t.id}
            name={tabRoute(t.id)}
            options={{ title: t.label }}
          />
        ))}
      </Tabs>
    </RouteGuard>
  );
}
