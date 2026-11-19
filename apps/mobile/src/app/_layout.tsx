import { agentConfig } from "../../../../packages/config/src/public.ts";
import { t } from "../../../../packages/config/src/copy.ts";

import { Stack, type ErrorBoundaryProps } from "expo-router";
import { useEffect } from "react";
import { View } from "react-native";
import { ScrollChromeProvider } from "../components/ScrollChrome";
import { AppTabBar } from "../components/AppTabBar";
import { IntroductionProvider } from "../components/Introduction";
import { StatusBar } from "expo-status-bar";
import { StoreProvider, useShopper } from "../lib/store";
import { colors, Button, Empty, Screen, Loading } from "../components/ui";
import { track } from "../lib/analytics";
export function ErrorBoundary({ retry }: ErrorBoundaryProps) {
  useEffect(() => {
    track("app_error", { kind: "render" });
  }, []);
  return (
    <Screen name="error">
      <Empty title={t("ui.e618b8c7ec")} detail={t("ui.606db817ee")} />
      <Button onPress={retry}>{t("ui.d8b8392e2c")}</Button>
    </Screen>
  );
}
export default function RootLayout() {
  return (
    <StoreProvider>
      <ReadyGate>
        <ScrollChromeProvider>
          <IntroductionProvider>
            <View style={{ flex: 1 }}>
              <StatusBar style={agentConfig.theme.statusBar} />
              <Stack
                screenOptions={{
                  headerShown: false,
                  contentStyle: { backgroundColor: colors.paper },
                }}
              >
                <Stack.Screen name="(tabs)" />
                <Stack.Screen name="product/[id]" />
                <Stack.Screen name="sign-in" />
                <Stack.Screen name="compare" />
              </Stack>
              <AppTabBar />
            </View>
          </IntroductionProvider>
        </ScrollChromeProvider>
      </ReadyGate>
    </StoreProvider>
  );
}

function ReadyGate({ children }: { children: React.ReactNode }) {
  const { ready, syncStatus, retrySync } = useShopper();
  if (ready) return children;
  return (
    <View style={{ flex: 1, padding: 24, justifyContent: "center" }}>
      <Loading />
      <Button onPress={retrySync}>{syncStatus}</Button>
    </View>
  );
}
