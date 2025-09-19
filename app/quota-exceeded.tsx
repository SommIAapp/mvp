import React from 'react';
import { useEffect } from 'react';
import { View, Text, StyleSheet, Modal } from 'react-native';
import { useRouter } from 'expo-router';
import { Clock, Crown } from 'lucide-react-native';
import { Colors } from '@/constants/Colors';
import { Typography } from '@/constants/Typography';
import { useTranslation } from '@/hooks/useTranslation';
import { Button } from '@/components/Button';
import { useAuth } from '@/hooks/useAuth';

export default function QuotaExceededScreen() {
  const router = useRouter();
  const { t } = useTranslation();
  const { profile, isTrialExpired, getTrialDaysRemaining } = useAuth();

  const trialExpired = isTrialExpired();
  const dailyLimitReached = profile && (profile.daily_count || 0) >= 1;
  const daysRemaining = getTrialDaysRemaining();

  useEffect(() => {
    if (__DEV__) {
      console.log('🚫 QuotaExceeded: Component mounted');
    }
    return () => {
      if (__DEV__) {
        console.log('🚫 QuotaExceeded: Component unmounted');
      }
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
              ? t('quotaExceeded.trialExpiredTitle')
              : profile?.subscription_plan === 'trial' 
                ? t('quotaExceeded.dailyLimitTitle')
                : t('quotaExceeded.subscriptionRequiredTitle')
            }
          </Text>

          <Text style={styles.message}>
            {trialExpired 
              ? t('quotaExceeded.trialExpiredMessage')
              : profile?.subscription_plan === 'trial'
                ? daysRemaining > 0 
                  ? t('quotaExceeded.dailyLimitMessage', { days: daysRemaining })
                  : t('quotaExceeded.trialExpiredLimitMessage')
                : t('quotaExceeded.subscriptionRequiredMessage')
            }
          </Text>

          <View style={styles.premiumSection}>
            <View style={styles.premiumHeader}>
              <Crown size={24} color={Colors.secondary} />
              <Text style={styles.premiumTitle}>{t('quotaExceeded.withPremium')}</Text>
            </View>
            
            <View style={styles.benefitsList}>
              <Text style={styles.benefit}>{t('quotaExceeded.benefits.personalized')}</Text>
              <Text style={styles.benefit}>{t('quotaExceeded.benefits.detailed')}</Text>
              <Text style={styles.benefit}>{t('quotaExceeded.benefits.history')}</Text>
            </View>
            
            <Text style={styles.priceText}>{t('quotaExceeded.priceText')}</Text>
          </View>

          <View style={styles.buttonSection}>
            <Button
              title={profile?.subscription_plan === 'free' && !profile?.trial_start_date ? t('quotaExceeded.startFreeTrial') : t('quotaExceeded.upgradeToPremium')}
              onPress={() => {
                if (__DEV__) {
                  console.log('🚫 QuotaExceeded: Premium button pressed, dismissing modal');
                }
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
                ? t('quotaExceeded.okUnderstood')
                : profile?.subscription_plan === 'trial' 
                  ? t('quotaExceeded.okSeeTomorrow')
                  : t('quotaExceeded.later')
              }
              onPress={() => {
                if (__DEV__) {
                  console.log('🚫 QuotaExceeded: Dismiss button pressed, closing modal');
                }
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
    borderRadius: 26,
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