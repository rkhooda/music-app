import React, { useEffect, useMemo, useState } from 'react';
import { StatusBar } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { DarkTheme, DefaultTheme, NavigationContainer, useNavigationContainerRef } from '@react-navigation/native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { AppChrome } from './src/components/AppChrome';
import { RootNavigator } from './src/navigation/RootNavigator';
import { useDownloadsStore } from './src/store/downloads.store';
import { useTheme } from './src/theme';

const queryClient = new QueryClient({
  defaultOptions: { queries: { retry: 0, staleTime: 5 * 60 * 1000, gcTime: 15 * 60 * 1000 } },
});

export default function App() {
  const theme = useTheme();
  const navigationRef = useNavigationContainerRef();
  const [routeName, setRouteName] = useState<string | undefined>(undefined);

  useEffect(() => {
    void useDownloadsStore.getState().resume();
  }, []);

  const navigationTheme = useMemo(() => {
    const base = theme.dark ? DarkTheme : DefaultTheme;
    return { ...base, colors: { ...base.colors, background: theme.colors.bg, card: theme.colors.bg, text: theme.colors.ink } };
  }, [theme]);

  return (
    <GestureHandlerRootView style={{ flex: 1, backgroundColor: theme.colors.bg }}>
      <SafeAreaProvider>
        <QueryClientProvider client={queryClient}>
          <StatusBar barStyle={theme.dark ? 'light-content' : 'dark-content'} backgroundColor="transparent" translucent />
          <NavigationContainer
            ref={navigationRef}
            theme={navigationTheme}
            onReady={() => setRouteName(navigationRef.getCurrentRoute()?.name)}
            onStateChange={() => setRouteName(navigationRef.getCurrentRoute()?.name)}
          >
            <RootNavigator />
            <AppChrome routeName={routeName} />
          </NavigationContainer>
        </QueryClientProvider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}
