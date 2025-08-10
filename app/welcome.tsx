import React from 'react';
import { View, Text, StyleSheet, Dimensions, Image } from 'react-native';
import { useRouter } from 'expo-router';
import { Colors } from '@/constants/Colors';
import { Typography } from '@/constants/Typography';
import { Button } from '@/components/Button';

const { width, height } = Dimensions.get('window');

export default function WelcomeScreen() {
  const router = useRouter();

  return (
    <View style={styles.container}>
      {/* TITRE (20% hauteur) */}
      <View style={styles.titleSection}>
        <Text style={styles.title}>Trouve le vin parfait</Text>
      </View>

      {/* GIF DEMO (40% hauteur) */}
      <View style={styles.demoSection}>
        <View style={styles.gifContainer}>
          <Image
            source={require('../assets/images/0810.gif')}
            style={styles.demoGif}
            resizeMode="contain"
          />
        </View>
      </View>

      {/* CARTE PRICING (30% hauteur) */}
      <View style={styles.pricingSection}>
        <View style={styles.pricingCard}>
          <Text style={styles.trialTitle}>Essai gratuit 7 jours</Text>
          <Text style={styles.priceText}>Puis seulement 4,99€/mois</Text>
          <Text style={styles.cancelText}>Annule à tout moment</Text>
        </View>
      </View>

      {/* BOUTON CTA (10% hauteur) */}
      <View style={styles.ctaSection}>
        <Button
          title="Commencer mon essai gratuit"
          onPress={() => router.push('/auth/signup')}
          variant="primary"
          size="large"
          fullWidth
        />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.accent,
  },
  
  // TITRE (20% hauteur)
  titleSection: {
    height: '20%',
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 24,
  },
  title: {
    fontSize: Typography.sizes.xxl + 4,
    fontWeight: Typography.weights.bold,
    color: Colors.textPrimary,
    textAlign: 'center',
    lineHeight: Typography.sizes.xxl * 1.2,
  },
  
  // GIF DEMO (40% hauteur)
  demoSection: {
    height: '40%',
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 24,
  },
  gifContainer: {
    maxWidth: 300,
    width: '100%',
    height: '100%',
    maxHeight: 350,
    backgroundColor: Colors.softGray,
    borderRadius: 16,
    padding: 20,
    shadowColor: Colors.darkGray,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 12,
    elevation: 6,
    justifyContent: 'center',
    alignItems: 'center',
  },
  demoGif: {
    width: '100%',
    height: '100%',
    borderRadius: 12,
  },
  
  // CARTE PRICING (30% hauteur)
  pricingSection: {
    height: '30%',
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 24,
  },
  pricingCard: {
    backgroundColor: Colors.accent,
    borderRadius: 16,
    padding: 24,
    width: '100%',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: Colors.softGray,
    shadowColor: Colors.darkGray,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 3,
  },
  trialTitle: {
    fontSize: Typography.sizes.xl,
    fontWeight: Typography.weights.bold,
    color: Colors.primary,
    marginBottom: 8,
    textAlign: 'center',
  },
  priceText: {
    fontSize: Typography.sizes.lg,
    fontWeight: Typography.weights.semibold,
    color: Colors.textPrimary,
    marginBottom: 4,
    textAlign: 'center',
  },
  cancelText: {
    fontSize: Typography.sizes.sm,
    color: Colors.textSecondary,
    textAlign: 'center',
  },
  
  // BOUTON CTA (10% hauteur)
  ctaSection: {
    height: '10%',
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: width * 0.05, // 5% padding = 90% width
    paddingBottom: 20,
  },
});