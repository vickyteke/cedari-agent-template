import { Stack, type ErrorBoundaryProps } from 'expo-router';
import { useEffect } from 'react';
import { View } from 'react-native';
import { ScrollChromeProvider } from '../components/ScrollChrome';
import { AppTabBar } from '../components/AppTabBar';
import { IntroductionProvider } from '../components/Introduction';
import { StatusBar } from 'expo-status-bar';
import { StoreProvider } from '../lib/store';
import { colors, Button, Empty, Screen } from '../components/ui';
import { track } from '../lib/analytics';
export function ErrorBoundary({ retry }: ErrorBoundaryProps) {
  useEffect(() => { track('app_error', { kind: 'render' }); }, []);
  return <Screen name="error"><Empty title="Let’s try that again" detail="This screen couldn’t load. Your saved pieces are still on your device."/><Button onPress={retry}>Try again</Button></Screen>;
}
export default function RootLayout() { return <StoreProvider><ScrollChromeProvider><IntroductionProvider><View style={{ flex: 1 }}><StatusBar style="dark"/><Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: colors.paper } }}><Stack.Screen name="(tabs)"/><Stack.Screen name="product/[id]"/><Stack.Screen name="sign-in"/><Stack.Screen name="compare"/></Stack><AppTabBar/></View></IntroductionProvider></ScrollChromeProvider></StoreProvider>; }
