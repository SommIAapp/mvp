import React from 'react';
import { View, Text, StyleSheet, ScrollView, Dimensions, Image } from 'react-native';
import Svg, { Path } from 'react-native-svg';
import { LinearGradient } from 'expo-linear-gradient';
import { Sparkles, Clock, Wine } from 'lucide-react-native';
import { useTranslation } from '@/hooks/useTranslation';
import { useRouter } from 'expo-router';
import { Colors } from '@/constants/Colors';
import { Typography } from '@/constants/Typography';
import { Button } from '@/components/Button';

const { width, height } = Dimensions.get('window');

export default function WelcomeScreen() {
  const router = useRouter();
  const { t } = useTranslation();

  return (
    <View style={styles.container}>
      <View style={styles.topSection}>
        <LinearGradient
          colors={[Colors.primary, '#8B4A52']}
          style={styles.gradientBackground}
        >
          <View style={styles.heroContent}>
            <Image
              source={require('../assets/images/appstorelogo.png')}
              style={styles.logoImage}
              resizeMode="contain"
            />
            <Text style={styles.title}>SOMMIA</Text>
          </View>
        </LinearGradient>
        
        {/* Wave Transition */}
        <View style={styles.waveContainer}>
          <Svg
            height="40"
            width={width}
            viewBox={`0 0 ${width} 40`}
            style={styles.wave}
          >
            <Path
              d={`M0,20 Q${width/4},0 ${width/2},15 T${width},20 L${width},40 L0,40 Z`}
              fill={Colors.accent}
            />
          </Svg>
        </View>
      </View>

      <View style={styles.bottomSection}>
        <View style={styles.descriptionSection}>
        </View>

        <View style={styles.featuresSection}>
        </View>

        <View style={styles.buttonSection}>
          <Button
            title={t('welcome.signUp')}
            onPress={() => router.push('/auth/signup')}
            variant="primary"
            size="large"
            fullWidth
          />
          
          <Button
            title={t('welcome.signIn')}
            onPress={() => router.push('/auth/signin')}
            variant="secondary"
            size="large"
            fullWidth
          />
        </View>
      </View>

       <Text style={styles.healthWarning}>
         {t('common.healthWarning')}
       </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.accent,
  },
  topSection: {
    height: height * 0.6,
    position: 'relative',
  },
  gradientBackground: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 24,
  },
  waveContainer: {
    position: 'absolute',
    bottom: -1,
    left: 0,
    width: width,
    height: 40,
    overflow: 'hidden',
    zIndex: 5,
  },
  wave: {
    width: '100%',
    height: '100%',
  },
  bottomSection: {
    flex: 1,
    backgroundColor: Colors.accent,
    paddingHorizontal: 24,
    borderRadius: 26,
    paddingBottom: 40,
  },
  heroContent: {
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
    letterSpacing: 1,
  },
  subtitle: {
    fontSize: Typography.sizes.xl,
    fontWeight: Typography.weights.semibold,
    color: Colors.accent,
    textAlign: 'center',
  },
  descriptionSection: {
    marginBottom: 40,
  },
  description: {
    fontSize: Typography.sizes.lg,
    color: Colors.textSecondary,
    textAlign: 'center',
    lineHeight: Typography.sizes.lg * Typography.lineHeights.relaxed,
  },
  featuresSection: {
    marginBottom: 48,
  },
  feature: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 20,
    paddingHorizontal: 8,
  },
  featureText: {
    fontSize: Typography.sizes.base,
    color: Colors.textPrimary,
    marginLeft: 16,
    flex: 1,
  },
  buttonSection: {
    gap: 16,
  },
  healthWarning: {
    fontSize: Typography.sizes.xs,
    color: Colors.textSecondary,
    textAlign: 'center',
    marginTop: 24,
    marginBottom: 20,
    paddingHorizontal: 40,
    fontStyle: 'italic',
  },
});