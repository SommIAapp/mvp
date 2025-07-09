import { useEffect } from 'react';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { useFrameworkReady } from '@/hooks/useFrameworkReady';

export default function RootLayout() {
  useFrameworkReady();

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <>
        <Stack screenOptions={{ headerShown: false }}>
          <Stack.Screen name="splash" />
          <Stack.Screen name="welcome" />
          <Stack.Screen name="auth/signin" />
          <Stack.Screen name="auth/signup" />
          <Stack.Screen name="subscription" />
          <Stack.Screen name="subscription-success" />
          <Stack.Screen name="recommendations" />
          <Stack.Screen name="quota-exceeded" options={{ presentation: 'modal' }} />
          <Stack.Screen name="(tabs)" />
          <Stack.Screen name="+not-found" />
        </Stack>
        <StatusBar style="auto" />
      </>
    </GestureHandlerRootView>
  );
}