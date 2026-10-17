import { useEffect } from 'react';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import * as SplashScreen from 'expo-splash-screen';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { useAsomiFonts } from '@/theme/fonts';
import { colors } from '@/theme';
import '../global.css';

/**
 * Root layout.
 *
 * Holds the splash screen until the brand fonts are ready. Showing the first
 * screen in a system fallback font and then snapping to Sora is the kind of
 * flash that makes an app feel cheap, and Asomi's whole pitch is that it feels
 * premium - so the splash waits.
 */

// Must be called at module scope, before the component first renders.
SplashScreen.preventAutoHideAsync().catch(() => {
  // Already hidden, or called twice during fast refresh. Harmless.
});

export default function RootLayout() {
  const { loaded, error } = useAsomiFonts();

  useEffect(() => {
    // Hide on error too. A missing font is a bad screen; a splash that never
    // goes away is a broken app, and the system fallback is still readable.
    if (loaded || error) {
      SplashScreen.hideAsync().catch(() => {});
    }
  }, [loaded, error]);

  if (!loaded && !error) {
    return null;
  }

  return (
    <GestureHandlerRootView style={{ flex: 1, backgroundColor: colors.base }}>
      {/* Light icons: Asomi is dark-only, so this never needs to flip. */}
      <StatusBar style="light" />
      <Stack
        screenOptions={{
          headerShown: false,
          contentStyle: { backgroundColor: colors.base },
          animation: 'fade',
        }}
      />
    </GestureHandlerRootView>
  );
}
