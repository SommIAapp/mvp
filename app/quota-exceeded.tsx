import React from 'react';
import { useEffect } from 'react';
import { View, Text, StyleSheet, Modal } from 'react-native';
import { useRouter } from 'expo-router';
import { Clock, Crown } from 'lucide-react-native';
import { Colors } from '@/constants/Colors';
import { Typography } from '@/constants/Typography';
import { Button } from '@/components/Button';
import { useAuth } from '@/hooks/useAuth';

export default function QuotaExceededScreen() {
  const router = useRouter();
  const { profile, isTrialExpired, getTrialDaysRemaining } = useAuth();

  const trialExpired = isTrialExpired();
  const dailyLimitReached = profile && (profile.daily_count || 0) >= 1;
  const daysRemaining = getTrialDaysRemaining();

  useEffect(() => {
    console.log('🚫 QuotaExceeded: Component mounted');
    return () => {
      console.log('🚫 QuotaExceeded: Component unmounted');
    };
  }, []);

  return (
    <Modal visible={true} animationType="slide" presentationStyle="pageSheet">
      <View style={styles.container}>
        <View style={styles.content}>
          <View style={styles.iconContainer}>
            <Clock size={64} color={Colors.primary} strokeWidth={1} />
          </View>

          <Text style={styles.title}>
            {trialExpired 
              ? 'Essai terminé !' 
              : profile?.subscription_plan === 'trial' 
                ? 'Limite quotidienne atteinte'
                : 'Abonnement requis'
            }
          </Text>

          <Text style={styles.message}>
            {trialExpired 
              ? 'Ton essai de 7 jours est terminé. Continue avec Premium pour des recommandations illimitées !'
              : profile?.subscription_plan === 'trial'
                ? `Reviens demain pour une nouvelle recommandation (${daysRemaining} jours d'essai restants) ou passe à Premium`
                : 'Commence ton essai gratuit de 7 jours ou passe directement à Premium'
            }
          </Text>

          <View style={styles.premiumSection}>
            <View style={styles.premiumHeader}>
              <Crown size={24} color={Colors.secondary} />
              <Text style={styles.premiumTitle}>Avec Premium</Text>
            </View>
            
            <View style={styles.benefitsList}>
              <Text style={styles.benefit}>🍷 Accords personnalisés</Text>
              <Text style={styles.benefit}>📱 Explications détaillées</Text>
              <Text style={styles.benefit}>🔄 Historique complet</Text>
            </View>
            
            <Text style={styles.priceText}>Seulement €4,99/mois</Text>
          </View>

          <View style={styles.buttonSection}>
            <Button
              title={profile?.subscription_plan === 'free' && !profile?.trial_start_date ? "Commencer l'essai gratuit" : "Passer à Premium"}
              onPress={() => {
                console.log('🚫 QuotaExceeded: Premium button pressed, dismissing modal');
                router.dismiss();
                
                // Determine the reason for showing paywall
                let reason: 'daily_limit' | 'trial_expired' | 'trial_signup' = 'daily_limit';
                
                if (!profile) {
                  reason = 'trial_signup';
                } else if (profile.subscription_plan === 'free' && !profile.trial_start_date) {
                  reason = 'trial_signup';
                } else if (trialExpired) {
                  reason = 'trial_expired';
                } else {
                  reason = 'daily_limit';
                }
                
                router.push({
                  pathname: '/subscription',
                  params: { reason }
                });
              }}
              variant="primary"
              size="large"
              fullWidth
            />
            
            <Button
              title={trialExpired 
                ? "Ok, compris" 
                : profile?.subscription_plan === 'trial' 
                  ? "Ok, à demain !" 
                  : "Plus tard"
              }
              onPress={() => {
                console.log('🚫 QuotaExceeded: Dismiss button pressed, closing modal');
                router.dismiss();
              }}
              variant="outline"
              size="medium"
              fullWidth
            />
          </View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.accent,
    justifyContent: 'center',
    paddingHorizontal: 24,
  },
  content: {
    alignItems: 'center',
  },
  iconContainer: {
    width: 120,
    height: 120,
    borderRadius: 60,
    backgroundColor: Colors.softGray,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 32,
  },
  title: {
    fontSize: Typography.sizes.xl,
    fontWeight: Typography.weights.bold,
    color: Colors.textPrimary,
    textAlign: 'center',
    marginBottom: 16,
  },
  message: {
    fontSize: Typography.sizes.base,
    color: Colors.textSecondary,
    textAlign: 'center',
    lineHeight: Typography.sizes.base * Typography.lineHeights.relaxed,
    marginBottom: 32,
  },
  premiumSection: {
    backgroundColor: Colors.softGray,
    borderRadius: 16,
    padding: 24,
    width: '100%',
    marginBottom: 32,
  },
  premiumHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
  },
  premiumTitle: {
    fontSize: Typography.sizes.lg,
    fontWeight: Typography.weights.bold,
    color: Colors.textPrimary,
    marginLeft: 8,
  },
  benefitsList: {
    marginBottom: 16,
  },
  benefit: {
    fontSize: Typography.sizes.base,
    color: Colors.textPrimary,
    marginBottom: 8,
    textAlign: 'center',
  },
  priceText: {
    fontSize: Typography.sizes.lg,
    fontWeight: Typography.weights.bold,
    color: Colors.primary,
    textAlign: 'center',
  },
  buttonSection: {
    width: '100%',
    gap: 16,
  },
});