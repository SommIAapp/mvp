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
      <View style={styles.loadingContainer}>
        <LoadingSpinner text="Chargement du profil..." />
      </View>
    );
  }

  return (
    <ScrollView style={styles.container} showsVerticalScrollIndicator={false}>
      <View style={styles.header}>
        <Text style={styles.title}>Profil</Text>
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
    paddingHorizontal: 24,
    paddingTop: 60,
    paddingBottom: 24,
  },
  title: {
    fontSize: Typography.sizes.xxl,
    fontWeight: Typography.weights.bold,
    color: Colors.textPrimary,
  },
  content: {
    flex: 1,
    paddingHorizontal: 24,
  },
  userSection: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.softGray,
    borderRadius: 16,
    padding: 20,
    marginBottom: 24,
    shadowColor: Colors.darkGray,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 3,
  },
  avatarContainer: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: Colors.accent,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 16,
    shadowColor: Colors.darkGray,
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 1,
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
    backgroundColor: Colors.softGray,
    borderRadius: 16,
    padding: 20,
    marginBottom: 24,
    shadowColor: Colors.darkGray,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 3,
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
    backgroundColor: Colors.softGray,
    borderRadius: 12,
    padding: 16,
    alignItems: 'center',
    shadowColor: Colors.darkGray,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 6,
    elevation: 2,
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
});