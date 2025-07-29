import React, { useState } from 'react';
import { View, Text, StyleSheet, ScrollView, Alert, TouchableOpacity, Dimensions } from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { Sparkles, Wine, Smartphone, RotateCcw, X, Check, ArrowLeft, Camera, DollarSign, BookOpen } from 'lucide-react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Colors } from '@/constants/Colors';
import { Typography } from '@/constants/Typography';
import { Button } from '@/components/Button';
import { LoadingSpinner } from '@/components/LoadingSpinner';
import { useAuth } from '@/hooks/useAuth';
import { useSubscription } from '@/hooks/useSubscription';
import { supabase } from '@/lib/supabase';
import { stripeProducts } from '@/src/stripe-config';

const { width } = Dimensions.get('window');

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
  const [selectedPlan, setSelectedPlan] = useState('annual'); // Pre-select annual plan

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
        {reason === 'trial_signup' ? (
          <Text style={styles.mainTitle}>
            Trouve le vin parfait{'\n'}pour chaque plat
          </Text>
        ) : (
          <Text style={styles.title}>{contentConfig.title}</Text>
        )}
        <Text style={styles.subtitle}>{contentConfig.subtitle}</Text>
        </View>
      </View>

      <View style={styles.content}>
        {reason === 'trial_signup' ? (
          <>
            <View style={styles.benefitsSection}>
              <View style={styles.benefit}>
                <Wine size={32} color={Colors.secondary} />
                <Text style={styles.benefitText}>Recommandations IA personnalisées</Text>
              </View>
              
              <View style={styles.benefit}>
                <Camera size={32} color={Colors.secondary} />
                <Text style={styles.benefitText}>Analyse photo de tes plats</Text>
              </View>
              
              <View style={styles.benefit}>
                <DollarSign size={32} color={Colors.secondary} />
                <Text style={styles.benefitText}>Économise sur chaque bouteille</Text>
              </View>
              
              <View style={styles.benefit}>
                <BookOpen size={32} color={Colors.secondary} />
                <Text style={styles.benefitText}>Apprends avec un sommelier virtuel</Text>
              </View>
            </View>

            <View style={styles.offerBox}>
              <Text style={styles.offerTitle}>Essai gratuit 7 jours</Text>
              <Text style={styles.offerSubtitle}>Puis seulement 4,99€/mois</Text>
              <Text style={styles.offerDetail}>Annule à tout moment</Text>
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
          </>
        ) : (
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
        )}
        {reason !== 'trial_signup' && (
          <View style={styles.pricingSection}>
            <Text style={styles.pricingSectionTitle}>Choisis ton plan</Text>
            
            <View style={styles.plansContainer}>
              {/* Plan Hebdomadaire */}
              <TouchableOpacity 
                style={[
                  styles.planCard, 
                  selectedPlan === 'weekly' && styles.selectedPlanCard
                ]}
                onPress={() => setSelectedPlan('weekly')}
              >
                <View style={styles.planHeader}>
                  <Text style={styles.planName}>Hebdomadaire</Text>
                </View>
                <View style={styles.planPricing}>
                  <Text style={styles.planPrice}>2,99€</Text>
                  <Text style={styles.planPeriod}>sem</Text>
                </View>
                <View style={styles.planFeatures}>
                  <View style={styles.feature}>
                    <Check size={16} color={Colors.success} />
                    <Text style={styles.featureText}>Illimité</Text>
                  </View>
                  <View style={styles.feature}>
                    <Check size={16} color={Colors.success} />
                    <Text style={styles.featureText}>Détails</Text>
                  </View>
                </View>
              </TouchableOpacity>

              {/* Plan Mensuel */}
              <TouchableOpacity 
                style={[
                  styles.planCard, 
                  selectedPlan === 'monthly' && styles.selectedPlanCard
                ]}
                onPress={() => setSelectedPlan('monthly')}
              >
                <View style={styles.planHeader}>
                  <Text style={styles.planName}>Mensuel</Text>
                  <View style={styles.popularBadge}>
                    <Text style={styles.popularText}>Populaire</Text>
                  </View>
                </View>
                <View style={styles.planPricing}>
                  <Text style={styles.planPrice}>4,99€</Text>
                  <Text style={styles.planPeriod}>mois</Text>
                </View>
                <View style={styles.planFeatures}>
                  <View style={styles.feature}>
                    <Check size={16} color={Colors.success} />
                    <Text style={styles.featureText}>Illimité</Text>
                  </View>
                  <View style={styles.feature}>
                    <Check size={16} color={Colors.success} />
                    <Text style={styles.featureText}>Détails</Text>
                  </View>
                </View>
              </TouchableOpacity>

              {/* Plan Annuel */}
              <TouchableOpacity 
                style={[
                  styles.planCard, 
                  styles.bestValueCard,
                  selectedPlan === 'annual' && styles.selectedPlanCard
                ]}
                onPress={() => setSelectedPlan('annual')}
              >
                <View style={styles.bestValueBadge}>
                  <Text style={styles.badgeText}>-50%</Text>
                </View>
                <View style={styles.planHeader}>
                  <Text style={styles.planName}>Annuel</Text>
                  <Text style={styles.bestOfferText}>MEILLEURE OFFRE</Text>
                </View>
                <View style={styles.planPricing}>
                  <Text style={styles.planPrice}>30€</Text>
                  <Text style={styles.planPeriod}>an</Text>
                  <Text style={styles.equivalentPrice}>2,50€/mois</Text>
                </View>
                <View style={styles.planFeatures}>
                  <View style={styles.feature}>
                    <Check size={16} color={Colors.success} />
                    <Text style={styles.featureText}>Illimité</Text>
                  </View>
                  <View style={styles.feature}>
                    <Check size={16} color={Colors.success} />
                    <Text style={styles.featureText}>Détails</Text>
                  </View>
                </View>
              </TouchableOpacity>
            </View>

            {selectedPlan === 'annual' && (
              <View style={styles.savingHighlight}>
                <Text style={styles.savingText}>🎉 Économise 29,88€ par rapport au mensuel !</Text>
              </View>
            )}

            <LinearGradient
              colors={[Colors.primary, '#8B4A52']}
              style={styles.ctaButton}
            >
              <TouchableOpacity
                style={styles.ctaButtonInner}
                onPress={() => {
                  const priceId = selectedPlan === 'weekly' ? weeklyProduct?.priceId :
                                 selectedPlan === 'monthly' ? premiumProduct?.priceId :
                                 annualProduct?.priceId;
                  handleBuyPremium(priceId || '');
                }}
                disabled={loading}
              >
                <Text style={styles.ctaButtonText}>
                  {selectedPlan === 'weekly' ? 'Choisir Hebdomadaire' :
                   selectedPlan === 'monthly' ? 'Choisir Mensuel' :
                   'Choisir Annuel'}
                </Text>
              </TouchableOpacity>
            </LinearGradient>

            <View style={styles.trustBadges}>
              <Text style={styles.trustText}>✓ 7 jours gratuits</Text>
              <Text style={styles.trustText}>✓ Annulation facile</Text>
              <Text style={styles.trustText}>✓ Paiement sécurisé</Text>
            </View>
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
  mainTitle: {
    fontSize: Typography.sizes.xxl + 4,
    fontWeight: Typography.weights.bold,
    color: Colors.textPrimary,
    textAlign: 'center',
    marginBottom: 16,
    lineHeight: Typography.sizes.xxl * 1.2,
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
    marginBottom: 24,
    paddingHorizontal: 8,
  },
  benefitText: {
    fontSize: Typography.sizes.lg,
    fontWeight: Typography.weights.medium,
    color: Colors.textPrimary,
    marginLeft: 16,
    flex: 1,
  },
  offerBox: {
    backgroundColor: Colors.softGray,
    borderRadius: 16,
    padding: 24,
    alignItems: 'center',
    marginBottom: 32,
    shadowColor: Colors.darkGray,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 12,
    elevation: 6,
  },
  offerTitle: {
    fontSize: Typography.sizes.xl,
    fontWeight: Typography.weights.bold,
    color: Colors.primary,
    marginBottom: 8,
  },
  offerSubtitle: {
    fontSize: Typography.sizes.lg,
    fontWeight: Typography.weights.semibold,
    color: Colors.textPrimary,
    marginBottom: 4,
  },
  offerDetail: {
    fontSize: Typography.sizes.sm,
    color: Colors.textSecondary,
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
  plansContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 20,
  },
  planCard: {
    width: '30%',
    backgroundColor: Colors.softGray,
    borderRadius: 12,
    padding: 12,
    marginHorizontal: '1.5%',
    position: 'relative',
    shadowColor: Colors.darkGray,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.12,
    shadowRadius: 8,
    elevation: 4,
    borderWidth: 2,
    borderColor: '#E0E0E0',
  },
  selectedPlanCard: {
    borderColor: Colors.secondary,
    borderWidth: 3,
    transform: [{ scale: 1.05 }],
    shadowColor: Colors.primary,
    shadowOpacity: 0.2,
  },
  bestValueCard: {
    borderColor: Colors.secondary,
    backgroundColor: '#FFFEF8',
  },
  bestValueBadge: {
    position: 'absolute',
    top: -8,
    right: 8,
    backgroundColor: Colors.secondary,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
    shadowColor: Colors.secondary,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
    elevation: 3,
  },
  planHeader: {
    alignItems: 'center',
    marginBottom: 12,
  },
  planName: {
    fontSize: Typography.sizes.base,
    fontWeight: Typography.weights.bold,
    color: Colors.textPrimary,
    marginBottom: 2,
  },
  popularBadge: {
    backgroundColor: Colors.primary,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 6,
  },
  popularText: {
    fontSize: Typography.sizes.xs,
    fontWeight: Typography.weights.semibold,
    color: Colors.accent,
  },
  bestOfferText: {
    fontSize: Typography.sizes.xs,
    fontWeight: Typography.weights.bold,
    color: Colors.secondary,
    letterSpacing: 0.5,
  },
  planPricing: {
    alignItems: 'center',
    marginBottom: 12,
  },
  planPrice: {
    fontSize: 20,
    fontWeight: Typography.weights.bold,
    color: Colors.primary,
  },
  planPeriod: {
    fontSize: 12,
    color: Colors.textSecondary,
    marginTop: 2,
  },
  equivalentPrice: {
    fontSize: Typography.sizes.sm,
    color: Colors.secondary,
    fontWeight: Typography.weights.semibold,
    marginTop: 2,
  },
  planFeatures: {
    marginBottom: 8,
  },
  feature: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 4,
  },
  featureText: {
    fontSize: Typography.sizes.sm,
    color: Colors.textPrimary,
    marginLeft: 8,
  },
  savingHighlight: {
    backgroundColor: Colors.softGray,
    borderRadius: 12,
    padding: 16,
    marginBottom: 20,
    alignItems: 'center',
  },
  savingText: {
    fontSize: Typography.sizes.base,
    color: Colors.success,
    fontWeight: Typography.weights.bold,
    textAlign: 'center',
  },
  ctaButton: {
    borderRadius: 16,
    marginBottom: 24,
    shadowColor: Colors.primary,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 6,
  },
  ctaButtonInner: {
    paddingVertical: 18,
    paddingHorizontal: 32,
    alignItems: 'center',
    justifyContent: 'center',
  },
  ctaButtonText: {
    fontSize: Typography.sizes.lg,
    fontWeight: Typography.weights.bold,
    color: Colors.accent,
  },
  trustBadges: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    paddingHorizontal: 16,
    marginBottom: 16,
  },
  trustText: {
    fontSize: Typography.sizes.xs,
    color: Colors.textSecondary,
    textAlign: 'center',
    flex: 1,
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