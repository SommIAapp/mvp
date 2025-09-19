import React, { useEffect } from 'react';
import { View, Text, StyleSheet, Dimensions, Image } from 'react-native';
import { useRouter } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import Animated, { 
  useSharedValue, 
  useAnimatedStyle, 
  withTiming, 
  withSequence,
  runOnJS
} from 'react-native-reanimated';
import { Colors } from '@/constants/Colors';
import { Typography } from '@/constants/Typography';
import { useAuth } from '@/hooks/useAuth';

const { width, height } = Dimensions.get('window');

export default function SplashScreen() {
  const router = useRouter();
  const { user, loading } = useAuth();
  const opacity = useSharedValue(0);
  const scale = useSharedValue(0.8);

  useEffect(() => {
    if (__DEV__) {
      console.log('💫 Splash: useEffect triggered', {
        user: user ? `${user.id} (${user.email})` : 'null',
        loading
      });
    }
    
    // Start animations
    opacity.value = withTiming(1, { duration: 800 });
    scale.value = withSequence(
      withTiming(1.1, { duration: 600 }),
      withTiming(1, { duration: 400 })
    );

    // Navigate after 2 seconds
    const timer = setTimeout(() => {
      if (__DEV__) {
        console.log('💫 Splash: Timer callback executing', {
          user: user ? `${user.id} (${user.email})` : 'null',
          loading,
          decision: !loading ? (user ? 'Navigate to tabs' : 'Navigate to welcome') : 'Still loading'
        });
      }
      
      if (!loading) {
        if (user) {
          if (__DEV__) {
            console.log('💫 Splash: Navigating to /(tabs)');
          }
          router.replace('/(tabs)');
        } else {
          if (__DEV__) {
            console.log('💫 Splash: Navigating to /welcome');
          }
          router.replace('/welcome');
        }
      }
    }, 2000);

    return () => clearTimeout(timer);
  }, [user, loading]);

  const animatedStyle = useAnimatedStyle(() => ({
    opacity: opacity.value,
    transform: [{ scale: scale.value }],
  }));

  return (
    <View style={styles.container}>
      <LinearGradient
        colors={[Colors.primary, '#8B4A52']}
        style={styles.gradientBackground}
      >
        <Animated.View style={[styles.content, animatedStyle]}>
          <Image
            source={require('../assets/images/appstorelogo.png')}
            style={styles.logoImage}
            resizeMode="contain"
          />
          <Text style={styles.title}>SOMMIA</Text>
        </Animated.View>
      </LinearGradient>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  gradientBackground: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  content: {
    alignItems: 'center',
  },
  logoImage: {
    width: 120,
    height: 120,
    marginBottom: 24,
  },
  title: {
    fontSize: Typography.sizes.xxl,
    fontWeight: Typography.weights.bold,
    color: Colors.accent,
    marginBottom: 8,
    letterSpacing: 2,
  },
});