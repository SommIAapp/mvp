import React, { useState, useEffect } from 'react';
import { 
  View, 
  Text, 
  StyleSheet, 
  ScrollView, 
  TouchableOpacity,
  Alert 
} from 'react-native';
import { useRouter } from 'expo-router';
import { User, Crown, Calendar, ChartBar as BarChart3, Settings, LogOut, Wine } from 'lucide-react-native';
import { LinearGradient } from 'expo-linear-gradient';
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
  const { user, profile, loading: authLoading, signOut, getTrialDaysRemaining } = useAuth();
  const { subscription, loading: subscriptionLoading, isPremium } = useSubscription();
  const [totalRecommendationsCount, setTotalRecommendationsCount] = useState(0);
  const [loadingStats, setLoadingStats] = useState(true);

  useEffect(() => {
    console.log('👤 Profile: Component mounted');
    return () => {
      console.log('👤 Profile: Component unmounted');
    };
  }, []);

  useEffect(() => {
    if (user) {
      fetchTotalRecommendations();
    }
  }, [user, profile]);

  const fetchTotalRecommendations = async () => {
    if (!user) return;
    
    try {
      setLoadingStats(true);
      console.log('📊 fetchTotalRecommendations - Fetching total count for user:', user.id);
      
      const { count, error } = await supabase
        .from('recommendations')
        .select('*', { count: 'exact', head: true })
        .eq('user_id', user.id);

      if (error) {
        console.error('❌ fetchTotalRecommendations - Error:', error);
        throw error;
      }

      console.log('✅ fetchTotalRecommendations - Total recommendations:', count);
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
      'Déconnexion',
      'Es-tu sûr de vouloir te déconnecter ?',
      [
        { text: 'Annuler', style: 'cancel' },
        { 
          text: 'Déconnexion', 
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
    if (subscriptionLoading) return { text: 'Chargement...', color: Colors.textSecondary };
    
    if (isPremium()) {
      return { text: 'Premium', color: Colors.secondary };
    }
    
    if (profile?.subscription_plan === 'trial') {
      return { text: 'Essai', color: Colors.primary };
    }
    
    return { text: 'Essai', color: Colors.primary };
  };

  const getUsageDisplay = () => {
    if (!profile) return 'Chargement...';
    
    if (isPremium()) {
      return 'Accès illimité ✨';
    }
    
    if (profile.subscription_plan === 'trial') {
      const daysRemaining = getTrialDaysRemaining();
      const dailyUsed = profile.daily_count || 0;
      return `Essai : ${daysRemaining} jours restants • ${dailyUsed}/1 aujourd'hui`;
    }
    
    if (profile.subscription_plan === 'free') {
      return 'Commence ton essai gratuit pour débloquer les recommandations';
    }
    
    return 'Statut inconnu';
  };

  const subscriptionStatus = getSubscriptionStatus();
  const usageDisplay = getUsageDisplay();

  if (authLoading || subscriptionLoading || loadingStats) {
    return (
      <View style={styles.container}>
        <View style={styles.headerSection}>
          <LinearGradient
            colors={['#6B2B3A', '#8B4B5A']}
            style={styles.headerGradient}
          >
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
        
        <View style={styles.loadingContent}>
          <LoadingSpinner text="Chargement du profil..." />
        </View>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <View style={styles.headerSection}>
        <LinearGradient
          colors={['#6B2B3A', '#8B4B5A']}
          style={styles.headerGradient}
        >
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

          {!isPremium() && (
            <Button
              title="Passer à Premium"
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

        {/* Stats Section */}
        <View style={styles.statsSection}>
          <Text style={styles.sectionTitle}>Statistiques</Text>
          
          <View style={styles.statsGrid}>
            <View style={styles.statCard}>
              <BarChart3 size={24} color={Colors.primary} />
              <Text style={styles.statValue}>
                {profile?.daily_count || 0}
              </Text>
              <Text style={styles.statLabel}>Aujourd'hui</Text>
            </View>
            
            <View style={styles.statCard}>
              <Wine size={24} color={Colors.primary} />
              <Text style={styles.statValue}>
                {totalRecommendationsCount}
              </Text>
              <Text style={styles.statLabel}>Découvertes</Text>
            </View>
          </View>
        </View>

        {/* Menu Section */}
        <View style={styles.menuSection}>
          <TouchableOpacity style={styles.menuItem}>
            <Settings size={24} color={Colors.textSecondary} />
            <Text style={styles.menuText}>Paramètres</Text>
          </TouchableOpacity>
          
          <TouchableOpacity style={styles.menuItem} onPress={handleSignOut}>
            <LogOut size={24} color={Colors.error} />
            <Text style={[styles.menuText, { color: Colors.error }]}>
              Déconnexion
            </Text>
          </TouchableOpacity>
      </ScrollView>
    </View>
  );
    <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
}

const styles = StyleSheet.create({
    }
  container: {
    flex: 1,
    backgroundColor: '#FAF6F0',
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
  loadingContent: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  content: {
    flex: 1,
    paddingHorizontal: 20,
    paddingTop: 20,
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
    backgroundColor: '#FAF6F0',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 8,
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
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 10,
    elevation: 3,
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
    borderBottomColor: '#E0E0E0',
  },
  menuText: {
    fontSize: Typography.sizes.base,
    color: Colors.textPrimary,
    marginLeft: 16,
  },
});