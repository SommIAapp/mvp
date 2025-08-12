import React, { useState } from 'react';
import { View, Text, StyleSheet, ScrollView, Alert, TouchableOpacity, Dimensions, Image } from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { Sparkles, Wine, Smartphone, RotateCcw, X, Check, ArrowLeft, Camera, DollarSign, BookOpen } from 'lucide-react-native';
import { LinearGradient } from 'expo-linear-gradient';
import Svg, { Path } from 'react-native-svg';
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
          buttonTitle: 'Passer à Premium',
          onPress: () => handleBuyPremium(premiumProduct?.priceId || ''),
          loading: false,
        };

      case 'trial_expired':
        return {
          title: 'Essai terminé !',
          subtitle: 'Continue avec Premium pour des recommandations illimitées',
          buttonTitle: 'Passer à Premium',
          onPress: () => handleBuyPremium(premiumProduct?.priceId || ''),
          loading: false,
        };

      case 'premium_upgrade':
        return {
          title: 'Passe à Premium',
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
      {checkoutLoading ? (
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
      ) : authLoading || subscriptionLoading ? (
        <View style={styles.loadingContainer}>
          <LoadingSpinner text="Chargement..." />
        </View>
      ) : reason !== 'trial_signup' ? (
        <>
          {/* Header avec gradient pour daily_limit, trial_expired, premium_upgrade */}
          <View style={styles.headerSection}>
            <LinearGradient
              colors={['#6B2B3A', '#8B4B5A']}
              style={styles.headerGradient}
            >
              <TouchableOpacity 
                style={styles.backButtonGradient}
                onPress={() => {
                  if (router.canGoBack()) {
                    router.back();
                  } else {
                    router.replace('/(tabs)');
                  }
                }}
              >
                <ArrowLeft size={24} color="white" />
              </TouchableOpacity>
              
              <Text style={styles.headerTitle}>SOMMIA</Text>
            </LinearGradient>
            
            <Svg
              height={40}
              width="100%"
              viewBox="0 0 400 40"
              style={styles.wave}
              preserveAspectRatio="none"
            >
              <Path
                d="M0,20 Q100,0 200,15 T400,20 L400,40 L0,40 Z"
                fill="#FAF6F0"
              />
            </Svg>
          </View>

          <View style={styles.titleSection}>
            <Text style={styles.pageTitle}>{contentConfig.title}</Text>
            {contentConfig.subtitle && (
              <Text style={styles.pageSubtitle}>{contentConfig.subtitle}</Text>
            )}
          </View>

          <View style={styles.content}>
            <Text style={styles.pricingSectionTitle}>Choisis ton plan</Text>
            
            <View style={styles.plansListContainer}>
              {/* Plans ici - copiez le contenu existant */}
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

            <View style={styles.footer}>
              <Text style={styles.footerText}>
                Annule quand tu veux • Restore Purchases
              </Text>
            </View>
          </View>
        </>
      ) : (
        <>
          {/* Contenu pour trial_signup */}
          <View style={styles.header}>
            <View style={styles.headerContent}></View>
          </View>

          <View style={styles.content}>
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

            <View style={styles.footer}>
              <Text style={styles.footerText}>
                Annule quand tu veux • Restore Purchases
              </Text>
            </View>
          </View>
        </>
      )}
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
  headerSection: {
    position: 'relative',
  },
  headerGradient: {
    paddingTop: 60,
    paddingHorizontal: 20,
    paddingBottom: 50,
    position: 'relative',
  },
  backButtonGradient: {
    position: 'absolute',
    top: 60,
    left: 20,
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: 'rgba(255,255,255,0.2)',
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 1,
  },
  headerTitle: {
    fontSize: 36,
    fontWeight: '700',
    color: 'white',
    textAlign: 'center',
    letterSpacing: 1.5,
    marginTop: 50,
  },
  wave: {
    position: 'absolute',
    bottom: -1,
    left: 0,
    right: 0,
  },
  titleSection: {
    alignItems: 'center',
    paddingHorizontal: 24,
    paddingTop: 30,
    paddingBottom: 20,
  },
  pageTitle: {
    fontSize: Typography.sizes.xxl,
    fontWeight: Typography.weights.bold,
    color: Colors.textPrimary,
    textAlign: 'center',
    marginBottom: 8,
  },
  pageSubtitle: {
    fontSize: Typography.sizes.lg,
    color: Colors.textSecondary,
    textAlign: 'center',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    paddingHorizontal: 24,
    paddingTop: 80,
    paddingBottom: 16,
  },
  headerContent: {
    flex: 1,
    alignItems: 'center',
  },
  content: {
    flex: 1,
    paddingHorizontal: 24,
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