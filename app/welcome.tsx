import React from 'react';
import { View, Text, StyleSheet, ScrollView, Dimensions, Image } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Sparkles, Clock, Wine } from 'lucide-react-native';
import { useRouter } from 'expo-router';
import { Colors } from '@/constants/Colors';
import { Typography } from '@/constants/Typography';
import { Button } from '@/components/Button';
const Sommialogo = require('../assets/images/Sommialogo.PNG');

const { width, height } = Dimensions.get('window');

export default function WelcomeScreen() {
  const router = useRouter();

  return (
    <ScrollView style={styles.container} showsVerticalScrollIndicator={false}>
      <LinearGradient
        colors={[Colors.primary, '#8B4A52']}
        style={styles.header}
      >
        <View style={styles.heroContent}>
          <View style={styles.logoContainer}>
            <Image 
              source={Sommialogo}
              style={styles.logoImage}
              resizeMode="contain"
            />
          </View>
          <Text style={styles.title}>SOMMIA</Text>
          <Text style={styles.subtitle}>Découvre l'accord idéal</Text>
        </View>
      </LinearGradient>

      <View style={styles.content}>
        <View style={styles.descriptionSection}>
          <Text style={styles.description}>
            Trouve le vin parfait pour ton plat en 10 secondes avec notre recommendation experte
          </Text>
        </View>

        <View style={styles.featuresSection}>
          <View style={styles.feature}>
            <Wine size={24} color={Colors.secondary} />
            <Text style={styles.featureText}>Accords parfaits selon ton budget</Text>
          </View>
          <View style={styles.feature}>
            <Clock size={24} color={Colors.secondary} />
            <Text style={styles.featureText}>Résultats instantanés</Text>
          </View>
        </View>

        <View style={styles.buttonSection}>
          <Button
            title="Créer un compte"
            onPress={() => router.push('/auth/signup')}
            variant="primary"
            size="large"
            fullWidth
          />
          
          <Button
            title="J'ai déjà un compte"
            onPress={() => router.push('/auth/signin')}
            variant="outline"
            size="large"
            fullWidth
          />
        </View>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.accent,
  },
  header: {
    height: height * 0.5,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 24,
  },
  heroContent: {
    alignItems: 'center',
  },
  logoContainer: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 16,
  },
  logoImage: {
    width: 60,
    height: 60,
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
  content: {
    flex: 1,
    paddingHorizontal: 24,
    paddingTop: 32,
    paddingBottom: 40,
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
});