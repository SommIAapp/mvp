import { useEffect } from 'react';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { useFrameworkReady } from '@/hooks/useFrameworkReady';
import { AuthProvider } from '@/context/AuthContext';
import { analytics } from '@/src/services/mixpanel';

export default function RootLayout() {
  console.log('📱 Layout: RootLayout rendering');
  
  useFrameworkReady();

  useEffect(() => {
    // Initialiser Mixpanel
    analytics.init();
  }, []);

  return (
    <AuthProvider>
      <GestureHandlerRootView style={{ flex: 1 }}>
        <>
          <Stack screenOptions={{ headerShown: false }}>
            <Stack.Screen name="splash" />
            <Stack.Screen name="welcome" />
            <Stack.Screen name="auth/signin" />
            <Stack.Screen name="auth/signup" />
            <Stack.Screen name="subscription" options={{ presentation: 'modal' }} />
            <Stack.Screen name="subscription-success" options={{ presentation: 'modal' }} />
            <Stack.Screen name="recommendations" options={{ presentation: 'modal' }} />
            <Stack.Screen name="wine-detail" options={{ presentation: 'modal' }} />
            <Stack.Screen name="quota-exceeded" options={{ presentation: 'modal' }} />
            <Stack.Screen name="(tabs)" />
            <Stack.Screen name="+not-found" />
          </Stack>
          <StatusBar style="auto" />
        </>
      </GestureHandlerRootView>
    </AuthProvider>
  );
}