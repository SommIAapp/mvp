import React, { useState } from 'react';
import { View, Text, StyleSheet, ScrollView, Alert, TouchableOpacity } from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { Sparkles, Wine, Smartphone, RotateCcw, X, Check, ArrowLeft } from 'lucide-react-native';
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
  const weeklyProduct = stripeProducts.find(p => p.name === 'SommIA Premium (Hebdomadaire)');
  const annualProduct = stripeProducts.find(p => p.name === 'SommIA Premium (Annuel)');

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

  const handleBuyPremium = async (priceId: string) => {
    if (!priceId) {
      Alert.alert('Erreur', 'Produit non trouvé');
      return;
    }

    setLoading(true);
    
    try {
      await createCheckoutSession(priceId, 'subscription');
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
        buttonTitle: 'Chargement...',
        onPress: () => {},
        loading: true,
      };
    }

    switch (reason) {
      case 'trial_signup':
        return {
          title: 'Découvre l\'accord parfait',
          subtitle: 'Essai gratuit de 7 jours, puis 2,99€/semaine, 4,99€/mois ou 30€/an',
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
          onPress: () => handleBuyPremium(premiumProduct?.priceId || ''),
          loading: false,
        };

      case 'trial_expired':
        return {
          title: 'Essai terminé !',
          subtitle: 'Continue avec Premium pour des recommandations illimitées',
          badge: '⭐ Premium',
          buttonTitle: 'Passer à Premium',
          onPress: () => handleBuyPremium(premiumProduct?.priceId || ''),
          loading: false,
        };

      case 'premium_upgrade':
        return {
          title: 'Passe à Premium',
          subtitle: 'Accès illimité à toutes les fonctionnalités',
          badge: '⭐ Premium',
          buttonTitle: 'Passer à Premium',
          onPress: () => handleBuyPremium(premiumProduct?.priceId || ''),
          loading: false,
        };

      default:
        return {
          title: 'Découvre l\'accord parfait',
          subtitle: 'Essai gratuit de 7 jours, puis 4,99€/mois ou 30€/an',
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
        {reason !== 'trial_signup' && (
          <TouchableOpacity 
            style={styles.backButton}
            onPress={() => {
              if (router.canGoBack()) {
                router.back();
              } else {
                router.replace('/(tabs)');
              }
            }}
          >
            <ArrowLeft size={24} color={Colors.primary} />
          </TouchableOpacity>
        )}
        
        <View style={styles.headerContent}>
        <View style={styles.badge}>
          <Text style={styles.badgeText}>{contentConfig.badge}</Text>
        </View>
        <Text style={styles.title}>{contentConfig.title}</Text>
        <Text style={styles.subtitle}>{contentConfig.subtitle}</Text>
        </View>
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

        {reason !== 'trial_signup' && (
          <View style={styles.pricingSection}>
            <Text style={styles.pricingSectionTitle}>Choisis ton plan</Text>
            
            <View style={styles.pricingGrid}>
              {/* Plan Hebdomadaire */}
              <View style={[styles.pricingCard, styles.pricingCardThreeColumn]}>
                <View style={styles.pricingHeader}>
                  <Text style={styles.planName}>Hebdomadaire</Text>
                </View>
                <View style={styles.pricingContent}>
                  <Text style={styles.priceAmount}>€2,99</Text>
                  <Text style={styles.pricePeriod}>par semaine</Text>
                </View>
                <View style={styles.pricingFeatures}>
                  <View style={styles.feature}>
                    <Check size={16} color={Colors.success} />
                    <Text style={styles.featureText}>Recommandations illimitées</Text>
                  </View>
                  <View style={styles.feature}>
                    <Check size={16} color={Colors.success} />
                    <Text style={styles.featureText}>Explications détaillées</Text>
                  </View>
                </View>
                <Button
                  title="Choisir Hebdomadaire"
                  onPress={() => handleBuyPremium(weeklyProduct?.priceId || '')}
                  variant="outline"
                  size="medium"
                  fullWidth
                  loading={loading}
                />
              </View>

              {/* Plan Mensuel */}
              <View style={[styles.pricingCard, styles.pricingCardThreeColumn]}>
                <View style={styles.pricingHeader}>
                  <Text style={styles.planName}>Mensuel</Text>
                </View>
                <View style={styles.pricingContent}>
                  <Text style={styles.priceAmount}>€4,99</Text>
                  <Text style={styles.pricePeriod}>par mois</Text>
                </View>
                <View style={styles.pricingFeatures}>
                  <View style={styles.feature}>
                    <Check size={16} color={Colors.success} />
                    <Text style={styles.featureText}>Recommandations illimitées</Text>
                  </View>
                  <View style={styles.feature}>
                    <Check size={16} color={Colors.success} />
                    <Text style={styles.featureText}>Explications détaillées</Text>
                  </View>
                </View>
                <Button
                  title="Choisir Mensuel"
                  onPress={() => handleBuyPremium(premiumProduct?.priceId || '')}
                  variant="outline"
                  size="medium"
                  fullWidth
                  loading={loading}
                />
              </View>

              {/* Plan Annuel */}
              <View style={[styles.pricingCard, styles.pricingCardThreeColumn]}>
                <View style={styles.pricingHeader}>
                  <Text style={styles.planName}>Annuel</Text>
                </View>
                <View style={styles.pricingContent}>
                  <Text style={styles.priceAmount}>€30</Text>
                  <Text style={styles.pricePeriod}>par an</Text>
                  <Text style={styles.priceEquivalent}>€2.5/mois</Text>
                </View>
                <View style={styles.pricingFeatures}>
                  <View style={styles.feature}>
                    <Check size={16} color={Colors.success} />
                    <Text style={styles.featureText}>Recommandations illimitées</Text>
                  </View>
                  <View style={styles.feature}>
                    <Check size={16} color={Colors.success} />
                    <Text style={styles.featureText}>Explications détaillées</Text>
                  </View>
                </View>
                <Button
                  title="Choisir Annuel"
                  onPress={() => handleBuyPremium(annualProduct?.priceId || '')}
                  variant="primary"
                  size="medium"
                  fullWidth
                  loading={loading}
                />
              </View>
            </View>
          </View>
        )}

        {reason === 'trial_signup' && (
          <View style={styles.pricingSection}>
            <View style={styles.pricingCard}>
              <Text style={styles.trialText}>7 jours gratuits</Text>
              <Text style={styles.priceText}>
                Puis choisis entre €2,99/semaine, €4,99/mois ou €30/an
              </Text>
            </View>
          </View>
        )}

        {reason === 'trial_signup' && (
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
        )}

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
    flexDirection: 'row',
    alignItems: 'flex-start',
    paddingHorizontal: 24,
    paddingTop: 80,
    paddingBottom: 32,
  },
  backButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: Colors.softGray,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 16,
    marginTop: 8,
  },
  headerContent: {
    flex: 1,
    alignItems: 'center',
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
  pricingSectionTitle: {
    fontSize: Typography.sizes.lg,
    fontWeight: Typography.weights.bold,
    color: Colors.textPrimary,
    textAlign: 'center',
    marginBottom: 20,
  },
  pricingGrid: {
    flexDirection: 'column',
    gap: 16,
  },
  pricingCard: {
    backgroundColor: Colors.softGray,
    borderRadius: 16,
    padding: 24,
    position: 'relative',
    shadowColor: Colors.darkGray,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 3,
  },
  pricingCardThreeColumn: {
    width: '100%',
  },
  pricingHeader: {
    alignItems: 'center',
    marginBottom: 16,
  },
  planName: {
    fontSize: Typography.sizes.lg,
    fontWeight: Typography.weights.bold,
    color: Colors.textPrimary,
  },
  pricingContent: {
    alignItems: 'center',
    marginBottom: 20,
  },
  priceAmount: {
    fontSize: Typography.sizes.xxl,
    fontWeight: Typography.weights.bold,
    color: Colors.primary,
  },
  pricePeriod: {
    fontSize: Typography.sizes.base,
    color: Colors.textSecondary,
    marginTop: 4,
  },
  priceEquivalent: {
    fontSize: Typography.sizes.sm,
    color: Colors.textLight,
    marginTop: 2,
  },
  pricingFeatures: {
    marginBottom: 20,
  },
  feature: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  featureText: {
    fontSize: Typography.sizes.sm,
    color: Colors.textPrimary,
    marginLeft: 8,
  },
  trialText: {
    fontSize: Typography.sizes.lg,
    fontWeight: Typography.weights.bold,
    color: Colors.primary,
    marginBottom: 8,
    textAlign: 'center',
  },
  priceText: {
    fontSize: Typography.sizes.base,
    fontWeight: Typography.weights.bold,
    color: Colors.textPrimary,
    textAlign: 'center',
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