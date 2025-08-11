import React, { useState, useEffect } from 'react';
import { 
  View, 
  Text, 
  StyleSheet, 
  ScrollView, 
  TouchableOpacity,
  RefreshControl,
} from 'react-native';
import { useRouter, useFocusEffect } from 'expo-router';
import { Wine, Calendar, Utensils } from 'lucide-react-native';
import { LinearGradient } from 'expo-linear-gradient';
import Svg, { Path } from 'react-native-svg';
import { Colors } from '@/constants/Colors';
import { Typography } from '@/constants/Typography';
import { LoadingSpinner } from '@/components/LoadingSpinner';
import { useAuth } from '@/hooks/useAuth';
import { useRecommendations } from '@/hooks/useRecommendations';
import { useRestaurantMode } from '@/hooks/useRestaurantMode';
import { tempStore } from '@/utils/tempStore';
import type { Database } from '@/lib/supabase';

type Recommendation = Database['public']['Tables']['recommendations']['Row'] & {
  type?: 'normal' | 'restaurant';
  restaurant_name?: string;
};

type RestaurantRecommendation = {
  id: string;
  dish_description: string;
  recommended_wines: any;
  created_at: string;
  restaurant_sessions: {
    restaurant_name: string;
    extracted_wines: any[];
  };
  type: 'restaurant';
};

export default function HistoryScreen() {
  const router = useRouter();
  const { user } = useAuth();
  const { getRecommendationHistory } = useRecommendations();
  const { getRestaurantRecommendationHistory } = useRestaurantMode();
  const [history, setHistory] = useState<Recommendation[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  useEffect(() => {
    console.log('📚 History: Component mounted');
    return () => {
      console.log('📚 History: Component unmounted');
    };
  }, []);

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
      
      // Récupérer les recommandations normales
      const normalRecommendations = await getRecommendationHistory(user.id);
      console.log('📚 loadHistory - Received normal recommendations:', normalRecommendations?.length || 0);
      
      // Récupérer les recommandations restaurant
      const restaurantRecommendations = await getRestaurantRecommendationHistory(user.id);
      console.log('📚 loadHistory - Received restaurant recommendations:', restaurantRecommendations?.length || 0);
      
      // Combiner et marquer les types
      const combinedHistory: Recommendation[] = [
        ...(normalRecommendations || []).map(rec => ({ ...rec, type: 'normal' as const })),
        ...(restaurantRecommendations || []).map(rec => ({
          id: rec.id,
          dish_description: rec.dish_description,
          recommended_wines: rec.recommended_wines,
          created_at: rec.created_at,
          user_id: user.id,
          user_budget: null,
          type: 'restaurant' as const,
          restaurant_name: rec.restaurant_sessions?.restaurant_name || 'Restaurant'
        }))
      ];
      
      // Trier par date (plus récent en premier)
      const sortedHistory = combinedHistory.sort((a, b) => 
        new Date(b.created_at || '').getTime() - new Date(a.created_at || '').getTime()
      );
      
      if (sortedHistory && sortedHistory.length > 0) {
        console.log('📚 loadHistory - Sample combined recommendation structure:', {
          id: sortedHistory[0].id,
          dish_description: sortedHistory[0].dish_description,
          type: sortedHistory[0].type,
          restaurant_name: sortedHistory[0].restaurant_name,
          recommended_wines_type: typeof sortedHistory[0].recommended_wines,
          recommended_wines_isArray: Array.isArray(sortedHistory[0].recommended_wines),
          recommended_wines_length: Array.isArray(sortedHistory[0].recommended_wines) ? sortedHistory[0].recommended_wines.length : 'N/A',
          created_at: sortedHistory[0].created_at
        });
      }
      
      setHistory(sortedHistory);
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
    
    if (item.type === 'restaurant') {
      // Store large data objects in temporary store to avoid large URL parameters
      tempStore.set(item.id, {
        recommendations: item.recommended_wines,
        extractedWines: item.restaurant_sessions?.extracted_wines || [],
      });
      
      // Navigate with minimal parameters
      router.push({
        pathname: '/(tabs)/restaurant',
        params: {
          fromHistory: 'true',
          sessionId: item.id,
          dish: item.dish_description,
          restaurantName: item.restaurant_name || 'Restaurant',
        },
      });
    } else {
      // Navigation normale vers les recommandations
      router.push({
        pathname: '/recommendations',
        params: {
          dish: item.dish_description,
          budget: item.user_budget?.toString() || '',
          recommendations: JSON.stringify(item.recommended_wines),
          fromHistory: 'true',
        },
      });
    }
  };

  if (loading) {
    return (
      <View style={styles.container}>
        {/* Header avec gradient */}
        <View style={styles.headerSection}>
          <LinearGradient
            colors={['#6B2B3A', '#8B4B5A']}
            style={styles.headerGradient}
          >
            <Text style={styles.headerTitle}>SOMMIA</Text>
            <Text style={styles.pageTitle}>Historique</Text>
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
          <LoadingSpinner text="Chargement de l'historique..." />
        </View>
      </View>
    );
  }

  if (history.length === 0) {
    return (
      <View style={styles.container}>
        {/* Header avec gradient */}
        <View style={styles.headerSection}>
          <LinearGradient
            colors={['#6B2B3A', '#8B4B5A']}
            style={styles.headerGradient}
          >
            <Text style={styles.headerTitle}>SOMMIA</Text>
            <Text style={styles.pageTitle}>Historique</Text>
            <Text style={styles.pageSubtitle}>Tes dernières découvertes</Text>
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
        
        <View style={styles.emptyContent}>
          <Wine size={64} color={Colors.textLight} strokeWidth={1} />
          <Text style={styles.emptyTitle}>Aucune recommandation</Text>
          <Text style={styles.emptySubtitle}>
            Tes recommandations apparaîtront ici après ta première recherche
          </Text>
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
          <Text style={styles.pageTitle}>Historique</Text>
          {/* PAS de sous-titre ici */}
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
                <View style={styles.dishHeader}>
                  {item.type === 'restaurant' && (
                    <View style={styles.restaurantBadge}>
                      <Utensils size={12} color={Colors.accent} />
                      <Text style={styles.restaurantBadgeText}>Restaurant</Text>
                    </View>
                  )}
                </View>
                <Text style={styles.dishName} numberOfLines={2}>
                  {item.dish_description}
                </Text>
                {item.type === 'restaurant' && item.restaurant_name && (
                  <Text style={styles.restaurantName}>
                    Chez {item.restaurant_name}
                  </Text>
                )}
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
    backgroundColor: '#FAF6F0',
  },
  loadingContent: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  emptyContent: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 48,
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
    marginBottom: 30,
  },
  pageTitle: {
    fontSize: 28,
    fontWeight: '600',
    color: 'white',
    textAlign: 'center',
    marginBottom: 8,
  },
  pageSubtitle: {
    fontSize: Typography.sizes.base,
    color: 'rgba(255,255,255,0.8)',
    textAlign: 'center',
  },
  wave: {
    position: 'absolute',
    bottom: -1,
    left: 0,
    right: 0,
  },
  content: {
    flex: 1,
    paddingHorizontal: 20,
    paddingTop: 20,
  },
  historyCard: {
    backgroundColor: 'white',
    borderRadius: 20,
    padding: 20,
    marginBottom: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.08,
    shadowRadius: 20,
    elevation: 5,
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
  dishHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 4,
  },
  restaurantBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#6B2B3A',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
    marginBottom: 4,
  },
  restaurantBadgeText: {
    fontSize: Typography.sizes.xs,
    fontWeight: Typography.weights.semibold,
    color: 'white',
    marginLeft: 4,
  },
  dishName: {
    fontSize: Typography.sizes.lg,
    fontWeight: Typography.weights.semibold,
    color: Colors.textPrimary,
    marginBottom: 4,
  },
  restaurantName: {
    fontSize: Typography.sizes.sm,
    color: Colors.primary,
    fontWeight: Typography.weights.medium,
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
    backgroundColor: '#FAF6F0',
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