import React, { useState } from 'react';
import { View, Text, StyleSheet, ScrollView, Alert, TouchableOpacity } from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { Sparkles, Wine, Smartphone, RotateCcw, X } from 'lucide-react-native';
import { Colors } from '@/constants/Colors';
import { Typography } from '@/constants/Typography';
import { Button } from '@/components/Button';
import { LoadingSpinner } from '@/components/LoadingSpinner';
import { useAuth } from '@/hooks/useAuth';
import { useSubscription } from '@/hooks/useSubscription';
import { supabase } from '@/lib/supabase';
import { stripeProducts } from '@/src/stripe-config';

type PaywallReason = 'trial_signup' | 'daily_limit' | 'trial_expired' | 'premium_upgrade';

export default function SubscriptionScreen() {
  const router = useRouter();
  const { reason = 'trial_signup' } = useLocalSearchParams<{ reason?: PaywallReason }>();
  const { user, profile, loading: authLoading, isTrialExpired, startFreeTrial } = useAuth();
  const { createCheckoutSession, loading: subscriptionLoading, checkoutLoading, cancelCheckout } = useSubscription();
  const [loading, setLoading] = useState(false);

  const premiumProduct = stripeProducts.find(p => p.name === 'SommIA Premium');

  const handleStartTrialFlow = async () => {
    console.log('🎯 handleStartTrialFlow - Starting free trial process');
    
    if (!user) {
      Alert.alert('Erreur', 'Utilisateur non connecté');
      return;
    }

    setLoading(true);
    
    try {
      const { error } = await startFreeTrial();

      if (error) {
        console.error('❌ handleStartTrialFlow - Error starting trial:', error);
        throw error;
      }

      console.log('✅ handleStartTrialFlow - Trial started successfully, navigating to app');
      // Navigate to main app
      router.replace('/(tabs)');
    } catch (error) {
      console.error('💥 handleStartTrialFlow - Unexpected error:', error);
      Alert.alert('Erreur', 'Impossible de démarrer l\'essai. Réessaie plus tard.');
    } finally {
      setLoading(false);
    }
  };

  const handleBuyPremium = async () => {
    if (!premiumProduct) {
      Alert.alert('Erreur', 'Produit non trouvé');
      return;
    }

    setLoading(true);
    
    try {
      await createCheckoutSession(premiumProduct.priceId, premiumProduct.mode);
    } catch (error) {
      console.error('Checkout error:', error);
      Alert.alert('Erreur', 'Impossible de créer la session de paiement. Réessaie plus tard.');
    } finally {
      setLoading(false);
    }
  };

  const getContentConfig = () => {
    // Show loading state while data is being fetched
    if (authLoading || subscriptionLoading) {
      return {
        title: 'Découvre l\'accord parfait',
        subtitle: 'Essai gratuit de 7 jours, puis 4,99€/mois',
        badge: '🎁 7 jours offerts',
        title: 'Chargement...',
        onPress: () => {},
        loading: true,
      };
    }

    switch (reason) {
      case 'trial_signup':
        return {
          title: 'Découvre l\'accord parfait',
          subtitle: 'Essai gratuit de 7 jours, puis 4,99€/mois',
          badge: '🎁 7 jours offerts',
          buttonTitle: 'Commencer mon essai gratuit',
          onPress: handleStartTrialFlow,
          loading: false,
        };

      case 'daily_limit':
        return {
          title: 'Limite quotidienne atteinte',
          subtitle: 'Passe à Premium pour des recommandations illimitées',
          badge: '⭐ Premium',
          buttonTitle: 'Passer à Premium',
          onPress: handleBuyPremium,
          loading: false,
        };

      case 'trial_expired':
        return {
          title: 'Essai terminé !',
          subtitle: 'Continue avec Premium pour des recommandations illimitées',
          badge: '⭐ Premium',
          buttonTitle: 'Passer à Premium',
          onPress: handleBuyPremium,
          loading: false,
        };

      case 'premium_upgrade':
        return {
          title: 'Passe à Premium',
          subtitle: 'Accès illimité à toutes les fonctionnalités',
          badge: '⭐ Premium',
          buttonTitle: 'Passer à Premium',
          onPress: handleBuyPremium,
          loading: false,
        };

      default:
        return {
          title: 'Découvre l\'accord parfait',
          subtitle: 'Essai gratuit de 7 jours, puis 4,99€/mois',
          badge: '🎁 7 jours offerts',
          buttonTitle: 'Commencer mon essai gratuit',
          onPress: handleStartTrialFlow,
          loading: false,
        };
    }
  };

  // Show checkout loading state
  if (checkoutLoading) {
    return (
      <View style={styles.checkoutLoadingContainer}>
        <View style={styles.checkoutLoadingContent}>
          <TouchableOpacity 
            style={styles.closeButton}
            onPress={cancelCheckout}
          >
            <X size={24} color={Colors.textSecondary} />
          </TouchableOpacity>
          
          <View style={styles.loadingIconContainer}>
            <Wine size={48} color={Colors.primary} />
          </View>
          
          <Text style={styles.checkoutTitle}>
            Finalise ton paiement
          </Text>
          
          <Text style={styles.checkoutMessage}>
            Un nouvel onglet s'est ouvert pour finaliser ton abonnement Premium.
          </Text>
          
          <Text style={styles.checkoutInstructions}>
            Reviens ici une fois le paiement terminé !
          </Text>
          
          <View style={styles.checkoutActions}>
            <Button
              title="Annuler le paiement"
              onPress={cancelCheckout}
              variant="outline"
              size="medium"
              fullWidth
            />
          </View>
        </View>
      </View>
    );
  }

  if (authLoading || subscriptionLoading) {
    return (
      <View style={styles.loadingContainer}>
        <LoadingSpinner text="Chargement..." />
      </View>
    );
  }

  const contentConfig = getContentConfig();

  return (
    <ScrollView style={styles.container} showsVerticalScrollIndicator={false}>
      <View style={styles.header}>
        <View style={styles.badge}>
          <Text style={styles.badgeText}>{contentConfig.badge}</Text>
        </View>
        <Text style={styles.title}>{contentConfig.title}</Text>
        <Text style={styles.subtitle}>{contentConfig.subtitle}</Text>
      </View>

      <View style={styles.content}>
        <View style={styles.benefitsSection}>
          <View style={styles.benefit}>
            <Wine size={24} color={Colors.secondary} />
            <Text style={styles.benefitText}>Accords personnalisés selon ton budget</Text>
          </View>
          
          <View style={styles.benefit}>
            <Smartphone size={24} color={Colors.secondary} />
            <Text style={styles.benefitText}>Explications sommelier pour chaque choix</Text>
          </View>
          
          <View style={styles.benefit}>
            <RotateCcw size={24} color={Colors.secondary} />
            <Text style={styles.benefitText}>Historique de tes découvertes</Text>
          </View>
        </View>

        <View style={styles.pricingSection}>
          <View style={styles.pricingCard}>
            <Text style={styles.trialText}>
              {reason === 'trial_signup' ? '7 jours gratuits' : 'Accès Premium'}
            </Text>
            <Text style={styles.priceText}>
              {reason === 'trial_signup' 
                ? 'Puis accès illimité pour €4,99/mois'
                : 'Accès illimité pour €4,99/mois'
              }
            </Text>
          </View>
        </View>

        <View style={styles.buttonSection}>
          <Button
            title={(loading || contentConfig.loading) ? "Chargement..." : contentConfig.buttonTitle}
            onPress={contentConfig.onPress}
            variant="primary"
            size="large"
            fullWidth
            loading={loading || contentConfig.loading}
          />
        </View>

        <View style={styles.footer}>
          <Text style={styles.footerText}>
            Annule quand tu veux • Restore Purchases
          </Text>
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
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: Colors.accent,
  },
  header: {
    alignItems: 'center',
    paddingHorizontal: 24,
    paddingTop: 80,
    paddingBottom: 32,
  },
  badge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.secondary,
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    marginBottom: 24,
    shadowColor: Colors.darkGray,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 2,
  },
  badgeText: {
    fontSize: Typography.sizes.sm,
    fontWeight: Typography.weights.semibold,
    color: Colors.darkGray,
  },
  title: {
    fontSize: Typography.sizes.xxl,
    fontWeight: Typography.weights.bold,
    color: Colors.textPrimary,
    marginBottom: 8,
    textAlign: 'center',
  },
  subtitle: {
    fontSize: Typography.sizes.lg,
    color: Colors.textSecondary,
    textAlign: 'center',
  },
  content: {
    flex: 1,
    paddingHorizontal: 24,
  },
  benefitsSection: {
    marginBottom: 40,
  },
  benefit: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 20,
    paddingHorizontal: 8,
  },
  benefitText: {
    fontSize: Typography.sizes.base,
    color: Colors.textPrimary,
    marginLeft: 16,
    flex: 1,
  },
  pricingSection: {
    marginBottom: 32,
  },
  pricingCard: {
    backgroundColor: Colors.softGray,
    borderRadius: 16,
    padding: 24,
    alignItems: 'center',
    shadowColor: Colors.darkGray,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 3,
  },
  trialText: {
    fontSize: Typography.sizes.lg,
    fontWeight: Typography.weights.bold,
    color: Colors.primary,
    marginBottom: 8,
  },
  priceText: {
    fontSize: Typography.sizes.xl,
    fontWeight: Typography.weights.bold,
    color: Colors.textPrimary,
  },
  buttonSection: {
    marginBottom: 24,
  },
  footer: {
    alignItems: 'center',
    paddingVertical: 16,
  },
  footerText: {
    fontSize: Typography.sizes.xs,
    color: Colors.textLight,
    textAlign: 'center',
  },
  checkoutLoadingContainer: {
    flex: 1,
    backgroundColor: Colors.accent,
    justifyContent: 'center',
    paddingHorizontal: 24,
  },
  checkoutLoadingContent: {
    alignItems: 'center',
    position: 'relative',
  },
  closeButton: {
    position: 'absolute',
    top: -40,
    right: 0,
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: Colors.softGray,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingIconContainer: {
    width: 100,
    height: 100,
    borderRadius: 50,
    backgroundColor: Colors.softGray,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 32,
  },
  checkoutTitle: {
    fontSize: Typography.sizes.xl,
    fontWeight: Typography.weights.bold,
    color: Colors.textPrimary,
    textAlign: 'center',
    marginBottom: 16,
  },
  checkoutMessage: {
    fontSize: Typography.sizes.base,
    color: Colors.textSecondary,
    textAlign: 'center',
    lineHeight: Typography.sizes.base * Typography.lineHeights.relaxed,
    marginBottom: 12,
  },
  checkoutInstructions: {
    fontSize: Typography.sizes.base,
    fontWeight: Typography.weights.semibold,
    color: Colors.primary,
    textAlign: 'center',
    marginBottom: 40,
  },
  checkoutActions: {
    width: '100%',
  },
});