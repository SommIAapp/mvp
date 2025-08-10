import React, { useState } from 'react';
import { View, Text, StyleSheet, ScrollView, Alert, TouchableOpacity, Dimensions, Image } from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { Sparkles, Wine, Smartphone, RotateCcw, X, Check, ArrowLeft, Camera, DollarSign, BookOpen } from 'lucide-react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Video } from 'expo-av';
import { Colors } from '@/constants/Colors';
import { Typography } from '@/constants/Typography';
import { Button } from '@/components/Button';
import { LoadingSpinner } from '@/components/LoadingSpinner';
import { useAuth } from '@/hooks/useAuth';
import { useSubscription } from '@/hooks/useSubscription';
import { supabase } from '@/lib/supabase';
import { stripeProducts } from '@/src/stripe-config';

const { width, height } = Dimensions.get('window');

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
        {reason !== 'trial_signup' && (
          <>
            <View style={styles.badge}>
              <Text style={styles.badgeText}>{contentConfig.badge}</Text>
            </View>
            <Text style={styles.title}>{contentConfig.title}</Text>
          </>
        )}
        {reason !== 'trial_signup' && (
          <Text style={styles.subtitle}>{contentConfig.subtitle}</Text>
        )}
      </View>
      </View>

      <View style={styles.content}>
        {reason === 'trial_signup' ? (
          <>
            <Image
              source={require('@/assets/images/vdsub.gif')}
              style={styles.demoGif}
              resizeMode="contain"
            />

            <Text style={styles.trialText}>
              Essai gratuit 7 jours
            </Text>

            <View style={styles.buttonSection}>
              <Button
                title={(loading || contentConfig.loading) ? "Chargement..." : "Commencer"}
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
          <>
            <Text style={styles.pricingSectionTitle}>Choisis ton plan</Text>
            
            <View style={styles.plansListContainer}>
              {/* Plan Annuel - En premier et mis en avant */}
              <TouchableOpacity 
                style={[
                  styles.planOption, 
                  styles.recommendedPlan,
                  selectedPlan === 'annual' && styles.selectedPlanOption
                ]}
                onPress={() => setSelectedPlan('annual')}
              >
                <View style={styles.planContent}>
                  <View style={styles.planHeader}>
                    <Text style={styles.planTitle}>Annuel</Text>
                    <View style={styles.saveBadge}>
                      <Text style={styles.saveText}>ÉCONOMISE 50%</Text>
                    </View>
                  </View>
                  <Text style={styles.planPrice}>30€ par an</Text>
                  <Text style={styles.planEquivalent}>Seulement 2,50€/mois</Text>
                </View>
                <View style={styles.radioButton}>
                  {selectedPlan === 'annual' && <View style={styles.radioButtonInner} />}
                </View>
              </TouchableOpacity>

              {/* Plan Mensuel */}
              <TouchableOpacity 
                style={[
                  styles.planOption,
                  selectedPlan === 'monthly' && styles.selectedPlanOption
                ]}
                onPress={() => setSelectedPlan('monthly')}
              >
                <View style={styles.planContent}>
                  <View style={styles.planHeader}>
                    <Text style={styles.planTitle}>Mensuel</Text>
                  </View>
                  <Text style={styles.planPrice}>4,99€ par mois</Text>
                </View>
                <View style={styles.radioButton}>
                  {selectedPlan === 'monthly' && <View style={styles.radioButtonInner} />}
                </View>
              </TouchableOpacity>

              {/* Plan Hebdomadaire */}
              <TouchableOpacity 
                style={[
                  styles.planOption,
                  selectedPlan === 'weekly' && styles.selectedPlanOption
                ]}
                onPress={() => setSelectedPlan('weekly')}
              >
                <View style={styles.planContent}>
                  <View style={styles.planHeader}>
                    <Text style={styles.planTitle}>Hebdomadaire</Text>
                  </View>
                  <Text style={styles.planPrice}>2,99€ par semaine</Text>
                </View>
                <View style={styles.radioButton}>
                  {selectedPlan === 'weekly' && <View style={styles.radioButtonInner} />}
                </View>
              </TouchableOpacity>
            </View>

            <View style={styles.freeTrialToggle}>
              <Text style={styles.freeTrialText}>✓ Essai gratuit 7 jours inclus</Text>
            </View>

            <Button
              title="Commencer l'essai gratuit"
              onPress={() => {
                const priceId = selectedPlan === 'weekly' ? weeklyProduct?.priceId :
                               selectedPlan === 'monthly' ? premiumProduct?.priceId :
                               annualProduct?.priceId;
                handleBuyPremium(priceId || '');
              }}
              variant="primary"
              size="large"
              fullWidth
              loading={loading}
            />

            <View style={styles.trustBadges}>
              <Text style={styles.trustText}>✓ 7 jours gratuits</Text>
              <Text style={styles.trustText}>✓ Annulation facile</Text>
              <Text style={styles.trustText}>✓ Paiement sécurisé</Text>
            </View>
          </>
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
    paddingBottom: 16,
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
  mainTitle: {
    fontSize: Typography.sizes.xxl,
    fontWeight: Typography.weights.bold,
    color: Colors.textPrimary,
    marginBottom: 8,
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
  pricingSectionTitle: {
    fontSize: Typography.sizes.xl,
    fontWeight: Typography.weights.bold,
    color: Colors.textPrimary,
    textAlign: 'center',
    marginBottom: 20,
  },
  plansListContainer: {
    paddingHorizontal: 16,
    marginTop: 20,
    marginBottom: 24,
  },
  planOption: {
    backgroundColor: '#F5F5F5',
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderWidth: 2,
    borderColor: 'transparent',
  },
  recommendedPlan: {
    backgroundColor: '#FFF9E6',
    borderColor: '#D4AF37',
  },
  selectedPlanOption: {
    borderColor: '#D4AF37',
    borderWidth: 3,
  },
  planContent: {
    flex: 1,
  },
  planHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 4,
  },
  planTitle: {
    fontSize: Typography.sizes.base,
    fontWeight: Typography.weights.semibold,
    color: Colors.textPrimary,
  },
  saveBadge: {
    backgroundColor: '#FF4444',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 4,
  },
  saveText: {
    color: Colors.accent,
    fontSize: 10,
    fontWeight: Typography.weights.bold,
  },
  planPrice: {
    fontSize: Typography.sizes.sm,
    color: Colors.textSecondary,
  },
  planEquivalent: {
    fontSize: Typography.sizes.xs,
    color: Colors.success,
    marginTop: 2,
  },
  radioButton: {
    width: 24,
    height: 24,
    borderRadius: 12,
    borderWidth: 2,
    borderColor: Colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  radioButtonInner: {
    width: 12,
    height: 12,
    borderRadius: 6,
    backgroundColor: Colors.primary,
  },
  freeTrialToggle: {
    alignItems: 'center',
    marginBottom: 24,
  },
  freeTrialText: {
    fontSize: Typography.sizes.sm,
    color: Colors.success,
    fontWeight: Typography.weights.semibold,
  },
  trustBadges: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    paddingHorizontal: 16,
    marginTop: 16,
    marginBottom: 24,
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
  demoGif: {
    width: width - 20,
    height: height * 0.55,
    maxHeight: 600,
    alignSelf: 'center',
    marginTop: 20,
    marginBottom: 30,
    borderRadius: 20,
  },
  trialText: {
    fontSize: Typography.sizes.xl,
    fontWeight: Typography.weights.bold,
    color: Colors.primary,
    textAlign: 'center',
    marginBottom: 32,
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