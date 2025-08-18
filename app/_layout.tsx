import { useEffect } from 'react';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { View, Text, StyleSheet } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { useFrameworkReady } from '@/hooks/useFrameworkReady';
import { useNetworkStatus } from '@/hooks/useNetworkStatus';
import { AuthProvider } from '@/context/AuthContext';
import { Colors } from '@/constants/Colors';
import { Typography } from '@/constants/Typography';

export default function RootLayout() {
  console.log('📱 Layout: RootLayout rendering');
  
  useFrameworkReady();
  const { isConnected } = useNetworkStatus();

  return (
    <AuthProvider>
      <GestureHandlerRootView style={{ flex: 1 }}>
        <>
          {!isConnected && (
            <View style={styles.offlineIndicator}>
              <Text style={styles.offlineText}>🔴 Hors ligne</Text>
            </View>
          )}
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

const styles = StyleSheet.create({
  offlineIndicator: {
    backgroundColor: Colors.error,
    paddingVertical: 8,
    alignItems: 'center',
  },
  offlineText: {
    ...Typography.caption,
    color: Colors.white,
  },
});