import React, { useState } from 'react';
import { 
  View, 
  Text, 
  StyleSheet, 
  ScrollView, 
  TouchableOpacity,
  RefreshControl,
} from 'react-native';
import { useRouter, useFocusEffect } from 'expo-router';
import { Wine, Calendar } from 'lucide-react-native';
import { Colors } from '@/constants/Colors';
import { Typography } from '@/constants/Typography';
import { LoadingSpinner } from '@/components/LoadingSpinner';
import { useAuth } from '@/hooks/useAuth';
import { useRecommendations } from '@/hooks/useRecommendations';
import type { Database } from '@/lib/supabase';

type Recommendation = Database['public']['Tables']['recommendations']['Row'];

export default function HistoryScreen() {
  const router = useRouter();
  const { user } = useAuth();
  const { getRecommendationHistory } = useRecommendations();
  const [history, setHistory] = useState<Recommendation[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  // Use useFocusEffect to refresh data every time screen comes into focus
  useFocusEffect(
    React.useCallback(() => {
      console.log('🔄 useFocusEffect - History screen focused, loading data');
      loadHistory();
    }, [user])
  );

  const loadHistory = async () => {
    console.log('📚 loadHistory - Starting to load history');
    console.log('👤 loadHistory - User:', user?.id);
    
    if (!user?.id) {
      console.log('❌ loadHistory - No user ID available');
      setHistory([]);
      setLoading(false);
      return;
    }

    setLoading(true);
    
    try {
      console.log('📚 loadHistory - Calling getRecommendationHistory for user:', user.id);
      const recommendations = await getRecommendationHistory(user.id);
      console.log('📚 loadHistory - Received recommendations:', recommendations);
      console.log('📚 loadHistory - Recommendations count:', recommendations?.length || 0);
      
      if (recommendations && recommendations.length > 0) {
        console.log('📚 loadHistory - Sample recommendation structure:', {
          id: recommendations[0].id,
          dish_description: recommendations[0].dish_description,
          recommended_wines_type: typeof recommendations[0].recommended_wines,
          recommended_wines_isArray: Array.isArray(recommendations[0].recommended_wines),
          recommended_wines_length: Array.isArray(recommendations[0].recommended_wines) ? recommendations[0].recommended_wines.length : 'N/A',
          created_at: recommendations[0].created_at
        });
      }
      
      setHistory(recommendations || []);
    } catch (error) {
      console.error('❌ loadHistory - Error loading history:', error);
      setHistory([]);
    } finally {
      setLoading(false);
    }
  };

  const onRefresh = async () => {
    console.log('🔄 onRefresh - Refreshing history data');
    setRefreshing(true);
    await loadHistory();
    setRefreshing(false);
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    const now = new Date();
    const diffTime = Math.abs(now.getTime() - date.getTime());
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

    if (diffDays === 1) return 'Hier';
    if (diffDays < 7) return `Il y a ${diffDays} jours`;
    
    return date.toLocaleDateString('fr-FR', {
      day: 'numeric',
      month: 'long',
    });
  };

  const handleHistoryItemPress = (item: Recommendation) => {
    console.log('🔍 handleHistoryItemPress - Opening recommendation:', item.id);
    
    router.push({
      pathname: '/recommendations',
      params: {
        dish: item.dish_description,
        budget: item.user_budget?.toString() || '',
        recommendations: JSON.stringify(item.recommended_wines),
        fromHistory: 'true',
      },
    });
  };

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <LoadingSpinner text="Chargement de l'historique..." />
      </View>
    );
  }

  if (history.length === 0) {
    return (
      <View style={styles.emptyContainer}>
        <Wine size={64} color={Colors.textLight} strokeWidth={1} />
        <Text style={styles.emptyTitle}>Aucune recommandation</Text>
        <Text style={styles.emptySubtitle}>
          Tes recommandations apparaîtront ici après ta première recherche
        </Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>Historique</Text>
        <Text style={styles.subtitle}>Tes dernières découvertes</Text>
      </View>

      <ScrollView 
        style={styles.content}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
        }
        showsVerticalScrollIndicator={false}
      >
        {history.map((item) => (
          <TouchableOpacity
            key={item.id}
            style={styles.historyCard}
            onPress={() => handleHistoryItemPress(item)}
            activeOpacity={0.8}
          >
            <View style={styles.cardHeader}>
              <View style={styles.dishInfo}>
                <Text style={styles.dishName} numberOfLines={2}>
                  {item.dish_description}
                </Text>
                {item.user_budget && (
                  <Text style={styles.budgetText}>
                    Budget: €{item.user_budget}
                  </Text>
                )}
              </View>
              <View style={styles.wineCount}>
                <Wine size={20} color={Colors.primary} />
                <Text style={styles.wineCountText}>
                  {Array.isArray(item.recommended_wines) ? item.recommended_wines.length : 0}
                </Text>
              </View>
            </View>

            <View style={styles.cardFooter}>
              <View style={styles.dateContainer}>
                <Calendar size={16} color={Colors.textLight} />
                <Text style={styles.dateText}>
                  {formatDate(item.created_at || new Date().toISOString())}
                </Text>
              </View>
            </View>
          </TouchableOpacity>
        ))}
      </ScrollView>
    </View>
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
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 48,
    backgroundColor: Colors.accent,
  },
  emptyTitle: {
    fontSize: Typography.sizes.xl,
    fontWeight: Typography.weights.bold,
    color: Colors.textPrimary,
    marginTop: 24,
    marginBottom: 8,
    textAlign: 'center',
  },
  emptySubtitle: {
    fontSize: Typography.sizes.base,
    color: Colors.textSecondary,
    textAlign: 'center',
    lineHeight: Typography.sizes.base * Typography.lineHeights.relaxed,
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
    marginBottom: 4,
  },
  subtitle: {
    fontSize: Typography.sizes.base,
    color: Colors.textSecondary,
  },
  content: {
    flex: 1,
    paddingHorizontal: 24,
  },
  historyCard: {
    backgroundColor: Colors.softGray,
    borderRadius: 16,
    padding: 20,
    marginBottom: 16,
    shadowColor: Colors.darkGray,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 3,
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 16,
  },
  dishInfo: {
    flex: 1,
    marginRight: 16,
  },
  dishName: {
    fontSize: Typography.sizes.lg,
    fontWeight: Typography.weights.semibold,
    color: Colors.textPrimary,
    marginBottom: 4,
  },
  budgetText: {
    fontSize: Typography.sizes.sm,
    color: Colors.textSecondary,
    marginTop: 2,
  },
  wineCount: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.accent,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 12,
  },
  wineCountText: {
    fontSize: Typography.sizes.sm,
    fontWeight: Typography.weights.semibold,
    color: Colors.primary,
    marginLeft: 4,
  },
  cardFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  dateContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  dateText: {
    fontSize: Typography.sizes.xs,
    color: Colors.textLight,
    marginLeft: 6,
  },
});