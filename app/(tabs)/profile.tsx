import React, { useState, useEffect } from 'react';
import { useFocusEffect } from '@react-navigation/native';
import { 
  View, 
  Text, 
  StyleSheet, 
  ScrollView, 
  TouchableOpacity,
  Alert,
  Linking
} from 'react-native';
import { useRouter } from 'expo-router';
import { User, Crown, Calendar, ChartBar as BarChart3, LogOut, Wine, FileText, Shield, Mail } from 'lucide-react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useTranslation } from '@/hooks/useTranslation';
import AsyncStorage from '@react-native-async-storage/async-storage';
import Svg, { Path } from 'react-native-svg';
import { Colors } from '@/constants/Colors';
import { Typography } from '@/constants/Typography';
import { Button } from '@/components/Button';
import { LoadingSpinner } from '@/components/LoadingSpinner';
import { useAuth } from '@/hooks/useAuth';
import { useSubscription } from '@/hooks/useSubscription';
import { supabase } from '@/lib/supabase';

export default function ProfileScreen() {
  const router = useRouter();
  const { t, locale, changeLanguage } = useTranslation();
  const { user, profile, loading: authLoading, signOut, getTrialDaysRemaining, fetchProfile } = useAuth();
  const { subscription, loading: subscriptionLoading, isPremium } = useSubscription();
  const [totalRecommendationsCount, setTotalRecommendationsCount] = useState(0);
  const [loadingStats, setLoadingStats] = useState(true);

  const handleLanguageChange = async (lang: string) => {
    changeLanguage(lang);
    await AsyncStorage.setItem('user_language', lang);
  };

  useEffect(() => {
    if (__DEV__) {
      console.log('👤 Profile: Component mounted');
    }
    return () => {
      if (__DEV__) {
        console.log('👤 Profile: Component unmounted');
      }
    };
  }, []);

  useEffect(() => {
    if (user) {
      fetchTotalRecommendations();
    }
  }, [user, profile]);

  useFocusEffect(
    React.useCallback(() => {
      if (__DEV__) {
        console.log('📱 Profile: Screen focused, refreshing profile...');
      }
      if (user?.id) {
        fetchProfile(user.id);
      }
    }, [user?.id])
  );

  const fetchTotalRecommendations = async () => {
    if (!user) return;
    
    try {
      setLoadingStats(true);
      
      const { count, error } = await supabase
        .from('recommendations')
        .select('*', { count: 'exact', head: true })
        .eq('user_id', user.id);

      if (error) {
        console.error('❌ fetchTotalRecommendations - Error:', error);
        throw error;
      }

      setTotalRecommendationsCount(count || 0);
    } catch (error) {
      console.error('💥 fetchTotalRecommendations - Unexpected error:', error);
      setTotalRecommendationsCount(0);
    } finally {
      setLoadingStats(false);
    }
  };

  const handleSignOut = async () => {
    Alert.alert(
      t('profile.signOut'),
      t('profile.signOutConfirm'),
      [
        { text: t('common.cancel'), style: 'cancel' },
        { 
          text: t('profile.signOut'), 
          style: 'destructive',
          onPress: async () => {
            await signOut();
            router.replace('/welcome');
          }
        },
      ]
    );
  };

  const getSubscriptionStatus = () => {
    if (__DEV__) {
      console.log('🔍 Profile Status Debug:');
      console.log('- Loading:', subscriptionLoading);
      console.log('- isPremium:', isPremium());
      console.log('- Profile plan:', profile?.subscription_plan);
      console.log('- Profile daily_count:', profile?.daily_count);
    }
    
    if (subscriptionLoading) return { text: t('common.loading'), color: Colors.textSecondary };
    
    // Vérifier d'abord le profil Supabase
    if (profile?.subscription_plan === 'premium') {
      return { text: t('profile.premium'), color: Colors.secondary };
    }
    
    // Ensuite vérifier RevenueCat
    if (isPremium()) {
      return { text: t('profile.premium'), color: Colors.secondary };
    }
    
    if (profile?.subscription_plan === 'trial') {
      return { text: t('profile.trial'), color: Colors.primary };
    }
    
    return { text: t('profile.trial'), color: Colors.primary };
  };

  const getUsageDisplay = () => {
    if (!profile) return t('common.loading');
    
    // Vérifier d'abord le profil Supabase
    if (profile?.subscription_plan === 'premium') {
      return t('profile.unlimitedAccess');
    }
    
    // Ensuite vérifier RevenueCat
    if (isPremium()) {
      return t('profile.unlimitedAccess');
    }
    
    if (profile.subscription_plan === 'trial') {
      const daysRemaining = getTrialDaysRemaining();
      const dailyUsed = profile.daily_count || 0;
      return t('profile.trialRemaining', { days: daysRemaining, used: dailyUsed, limit: 1 });
    }
    
    if (profile.subscription_plan === 'free') {
      return t('profile.startTrialToUnlock');
    }
    
    return t('profile.unknownStatus');
  };

  const subscriptionStatus = getSubscriptionStatus();
  const usageDisplay = getUsageDisplay();

  if (authLoading || subscriptionLoading || loadingStats) {
    return (
      <View style={styles.loadingContainer}>
        <LoadingSpinner text={t('common.loading')} />
      </View>
    );
  }

  return (
    <ScrollView style={styles.container} showsVerticalScrollIndicator={false}>
      <View style={styles.headerSection}>
        <LinearGradient
          colors={['#6B2B3A', '#8B4B5A']}
          style={styles.headerGradient}
        >
          <Text style={styles.headerTitle}>{t('profile.title')}</Text>
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

      <View style={styles.content}>
        {/* User Info Section */}
        <View style={styles.userSection}>
          <View style={styles.avatarContainer}>
            <User size={32} color={Colors.primary} />
          </View>
          <View style={styles.userInfo}>
            <Text style={styles.userName}>
              {profile?.full_name || user?.email?.split('@')[0] || 'Utilisateur'}
            </Text>
            <Text style={styles.userEmail}>{user?.email}</Text>
          </View>
        
        {/* Sélecteur de langue */}
        <View style={styles.languageSelector}>
          <TouchableOpacity
            style={[styles.languageButton, locale === 'fr' && styles.languageButtonActive]}
            onPress={() => handleLanguageChange('fr')}
          >
            <Text style={[styles.languageButtonText, locale === 'fr' && styles.languageButtonTextActive]}>
              FR
            </Text>
          </TouchableOpacity>
          
          <TouchableOpacity
            style={[styles.languageButton, locale === 'en' && styles.languageButtonActive]}
            onPress={() => handleLanguageChange('en')}
          >
            <Text style={[styles.languageButtonText, locale === 'en' && styles.languageButtonTextActive]}>
              EN
            </Text>
          </TouchableOpacity>
        </View>
        </View>

        {/* Subscription Status */}
        <View style={styles.subscriptionCard}>
          <View style={styles.subscriptionHeader}>
            <Crown size={24} color={subscriptionStatus.color} />
            <Text style={[styles.subscriptionStatus, { color: subscriptionStatus.color }]}>
              {subscriptionStatus.text}
            </Text>
          </View>
          
          <View style={styles.quotaInfo}>
            <View style={styles.quotaItem}>
              <Wine size={20} color={Colors.textSecondary} />
              <Text style={styles.quotaText}>
                {usageDisplay}
              </Text>
            </View>
          </View>

          {(profile?.subscription_plan !== 'premium' && !isPremium()) && (
            <Button
              title={t('profile.upgradeToPremium')}
              onPress={() => router.push({
                pathname: '/subscription',
                params: { reason: 'premium_upgrade' }
              })}
              variant="primary"
              size="medium"
              fullWidth
            />
          )}
        </View>
        {/* Bouton pour gérer l'abonnement Apple */}
        {(profile?.subscription_plan === 'premium' || isPremium()) && (
          <TouchableOpacity 
            style={styles.manageSubscriptionButton}
            onPress={() => Linking.openURL('https://apps.apple.com/account/subscriptions')}
          >
            <Text style={styles.manageSubscriptionText}>
              {t('profile.manageAppleSubscription')}
            </Text>
          </TouchableOpacity>
        )}

        {/* Stats Section */}
        <View style={styles.statsSection}>
          <Text style={styles.sectionTitle}>{t('profile.statistics')}</Text>
          
          <View style={styles.statsGrid}>
            <View style={styles.statCard}>
              <BarChart3 size={24} color={Colors.primary} />
              <Text style={styles.statValue}>
                {profile?.daily_count || 0}
              </Text>
              <Text style={styles.statLabel}>{t('profile.today')}</Text>
            </View>
            
            <View style={styles.statCard}>
              <Wine size={24} color={Colors.primary} />
              <Text style={styles.statValue}>
                {totalRecommendationsCount}
              </Text>
              <Text style={styles.statLabel}>{t('profile.discoveries')}</Text>
            </View>
          </View>
        </View>

        {/* Menu Section */}
        <View style={styles.menuSection}>
          <TouchableOpacity 
            style={styles.menuItem}
            onPress={() => router.push('/terms-of-service')}
          >
            <FileText size={24} color={Colors.textSecondary} />
            <Text style={styles.menuText}>{t('profile.termsOfService')}</Text>
          </TouchableOpacity>
          
          <TouchableOpacity 
            style={styles.menuItem}
            onPress={() => router.push('/privacy-policy')}
          >
            <Shield size={24} color={Colors.textSecondary} />
            <Text style={styles.menuText}>{t('profile.privacyPolicy')}</Text>
          </TouchableOpacity>
          
          <TouchableOpacity 
            style={styles.menuItem}
            onPress={() => Linking.openURL('mailto:sommiaapp@gmail.com?subject=Support SOMMIA')}
          >
            <Mail size={24} color={Colors.textSecondary} />
            <Text style={styles.menuText}>{t('profile.contactSupport')}</Text>
          </TouchableOpacity>
          
          <TouchableOpacity style={styles.menuItem} onPress={handleSignOut}>
            <LogOut size={24} color={Colors.error} />
            <Text style={[styles.menuText, { color: Colors.error }]}>
              {t('profile.signOut')}
            </Text>
          </TouchableOpacity>
        </View>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#FAF6F0',
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
  },
  headerTitle: {
    fontSize: 36,
    fontWeight: Typography.weights.bold,
    color: 'white',
    textAlign: 'center',
    marginTop: 50,
  },
  wave: {
    position: 'absolute',
    bottom: -1,
    left: 0,
    right: 0,
  },
  content: {
    flex: 1,
    paddingHorizontal: 24,
    marginTop: 20,
    marginBottom: 40,
  },
  userSection: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'white',
    borderRadius: 16,
    padding: 20,
    marginBottom: 24,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.08,
    shadowRadius: 20,
    elevation: 5,
  },
  avatarContainer: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: Colors.accent,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
  },
  userInfo: {
    flex: 1,
  },
  userName: {
    fontSize: Typography.sizes.lg,
    fontWeight: Typography.weights.bold,
    color: Colors.textPrimary,
    marginBottom: 4,
  },
  userEmail: {
    fontSize: Typography.sizes.sm,
    color: Colors.textSecondary,
  },
  subscriptionCard: {
    backgroundColor: 'white',
    borderRadius: 16,
    padding: 20,
    marginBottom: 24,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.08,
    shadowRadius: 20,
    elevation: 5,
  },
  subscriptionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
  },
  subscriptionStatus: {
    fontSize: Typography.sizes.lg,
    fontWeight: Typography.weights.bold,
    marginLeft: 12,
  },
  quotaInfo: {
    marginBottom: 20,
  },
  quotaItem: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  quotaText: {
    fontSize: Typography.sizes.base,
    color: Colors.textPrimary,
    marginLeft: 12,
  },
  statsSection: {
    marginBottom: 32,
  },
  sectionTitle: {
    fontSize: Typography.sizes.lg,
    fontWeight: Typography.weights.bold,
    color: Colors.textPrimary,
    marginBottom: 16,
  },
  statsGrid: {
    flexDirection: 'row',
    gap: 16,
  },
  statCard: {
    flex: 1,
    backgroundColor: 'white',
    borderRadius: 12,
    padding: 16,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.08,
    shadowRadius: 20,
    elevation: 5,
  },
  statValue: {
    fontSize: Typography.sizes.xl,
    fontWeight: Typography.weights.bold,
    color: Colors.textPrimary,
    marginTop: 8,
    marginBottom: 4,
  },
  statLabel: {
    fontSize: Typography.sizes.sm,
    color: Colors.textSecondary,
  },
  menuSection: {
    marginBottom: 32,
  },
  menuItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 16,
    paddingHorizontal: 4,
    borderBottomWidth: 1,
    borderBottomColor: Colors.softGray,
  },
  menuText: {
    fontSize: Typography.sizes.base,
    color: Colors.textPrimary,
    marginLeft: 16,
  },
  languageSelector: {
    flexDirection: 'row',
    gap: 8,
    marginLeft: 'auto',
  },
  languageButton: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: Colors.softGray,
  },
  languageButtonActive: {
    backgroundColor: Colors.primary,
    borderColor: Colors.primary,
  },
  languageButtonText: {
    fontSize: 12,
    fontWeight: '600',
    color: Colors.textSecondary,
  },
  languageButtonTextActive: {
    color: 'white',
  },
  manageSubscriptionButton: {
    marginTop: 12,
    paddingVertical: 8,
  },
  manageSubscriptionText: {
    fontSize: Typography.sizes.sm,
    color: Colors.primary,
    textAlign: 'center',
    textDecorationLine: 'underline',
  },
});