import React, { useState, useEffect } from 'react';
import { 
  View, 
  Text, 
  StyleSheet, 
  ScrollView, 
  TouchableOpacity,
  RefreshControl 
} from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { ArrowLeft, Star } from 'lucide-react-native';
import { Colors } from '@/constants/Colors';
import { Typography } from '@/constants/Typography';
import { Button } from '@/components/Button';
import { LoadingSpinner } from '@/components/LoadingSpinner';
import { useRecommendations, type WineRecommendation } from '@/hooks/useRecommendations';

export default function RecommendationsScreen() {
  const router = useRouter();
  const { dish, budget, recommendations: recommendationsParam, fromHistory } = useLocalSearchParams<{ 
    dish: string; 
    budget?: string;
    recommendations?: string;
    fromHistory?: string;
  }>();
  const { getRecommendations } = useRecommendations();
  const [recommendations, setRecommendations] = useState<WineRecommendation[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  useEffect(() => {
    loadRecommendations();
  }, []);

  const loadRecommendations = async () => {
    setLoading(true);
    
    try {
      if (recommendationsParam) {
        console.log('📚 loadRecommendations - Loading from', fromHistory === 'true' ? 'history' : 'params');
        // Use passed recommendations
        const parsedRecommendations = JSON.parse(recommendationsParam);
        setRecommendations(parsedRecommendations);
      } else {
        console.log('🤖 loadRecommendations - Fetching new recommendations');
        // Fetch new recommendations
        const newRecommendations = await getRecommendations(
          dish,
          budget ? parseInt(budget) : undefined
        );
        setRecommendations(newRecommendations);
      }
    } catch (error) {
      console.error('Error loading recommendations:', error);
      setRecommendations([]);
    } finally {
      setLoading(false);
    }
  };

  const onRefresh = async () => {
    setRefreshing(true);
    await loadRecommendations();
    setRefreshing(false);
  };

  const getCategoryColor = (category: string) => {
    switch (category) {
      case 'economique': return Colors.economique;
      case 'qualite-prix': return Colors.qualitePrix;
      case 'premium': return Colors.premium;
      default: return Colors.textSecondary;
    }
  };

  const getCategoryLabel = (category: string) => {
    switch (category) {
      case 'economique': return 'Économique';
      case 'qualite-prix': return 'Qualité-Prix';
      case 'premium': return 'Premium';
      default: return category;
    }
  };

  const getWineColorIndicator = (color: string) => {
    switch (color) {
      case 'rouge': return Colors.rouge;
      case 'blanc': return '#F5F5DC';
      case 'rose': return '#FFB6C1';
      case 'sparkling': return Colors.secondary;
      default: return Colors.textSecondary;
    }
  };

  const renderStars = (rating: number) => {
    const stars = Math.round(rating / 20); // Convert 100-point scale to 5-star
    return (
      <View style={styles.starsContainer}>
        {[...Array(5)].map((_, index) => (
          <Star
            key={index}
            size={16}
            color={index < stars ? Colors.secondary : Colors.textLight}
            fill={index < stars ? Colors.secondary : 'transparent'}
          />
        ))}
        <Text style={styles.ratingText}>{rating}/100</Text>
      </View>
    );
  };

  const handleWinePress = (wine: WineRecommendation) => {
    router.push({
      pathname: '/wine-detail',
      params: {
        wine: JSON.stringify(wine),
        dish: dish,
        budget: budget || '',
      },
    });
  };

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <LoadingSpinner text="Recommandation en cours..." />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity 
          style={styles.backButton}
          onPress={() => router.back()}
        >
          <ArrowLeft size={24} color={Colors.primary} />
        </TouchableOpacity>
        <View style={styles.headerContent}>
          <Text style={styles.headerTitle}>Mes recommandations</Text>
          <Text style={styles.headerSubtitle}>
            {fromHistory === 'true' ? 'Historique • ' : ''}Pour {dish}
            {budget && ` • Budget: €${budget}`}
          </Text>
        </View>
      </View>

      <ScrollView 
        style={styles.content}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
        }
        showsVerticalScrollIndicator={false}
      >
        {recommendations.map((wine) => (
          <TouchableOpacity
            key={wine.id}
            style={styles.wineCard}
            onPress={() => handleWinePress(wine)}
            activeOpacity={0.8}
          >
            <View style={styles.cardHeader}>
              <View style={[
                styles.categoryBadge,
                { backgroundColor: getCategoryColor(wine.category) }
              ]}>
                <Text style={styles.categoryText}>
                  {getCategoryLabel(wine.category)}
                </Text>
              </View>
              <View style={[
                styles.colorIndicator,
                { backgroundColor: getWineColorIndicator(wine.color) }
              ]} />
            </View>

            <View style={styles.wineImagePlaceholder}>
              <Text style={styles.winePlaceholderText}>🍷</Text>
            </View>

            <View style={styles.cardContent}>
              <Text style={styles.wineName}>{wine.name}</Text>
              <Text style={styles.wineProducer}>
                {wine.producer} • {wine.region}
              </Text>
              
              <View style={styles.priceRatingRow}>
                <Text style={styles.winePrice}>€{wine.price}</Text>
                {renderStars(wine.rating)}
              </View>

              <Text style={styles.reasoning} numberOfLines={2}>
                {wine.reasoning.length > 80 
                  ? wine.reasoning.substring(0, 80) + '...' 
                  : wine.reasoning
                }
              </Text>
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
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 24,
    paddingTop: 60,
    paddingBottom: 24,
    borderBottomWidth: 1,
    borderBottomColor: Colors.softGray,
  },
  backButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: Colors.softGray,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 16,
  },
  headerContent: {
    flex: 1,
  },
  headerTitle: {
    fontSize: Typography.sizes.lg,
    fontWeight: Typography.weights.bold,
    color: Colors.textPrimary,
  },
  headerSubtitle: {
    fontSize: Typography.sizes.sm,
    color: Colors.textSecondary,
    marginTop: 2,
  },
  content: {
    flex: 1,
    paddingHorizontal: 24,
    paddingTop: 16,
  },
  wineCard: {
    backgroundColor: Colors.accent,
    borderRadius: 16,
    padding: 20,
    marginBottom: 16,
    shadowColor: Colors.darkGray,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 3,
    position: 'relative',
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  categoryBadge: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 12,
  },
  categoryText: {
    fontSize: Typography.sizes.xs,
    fontWeight: Typography.weights.semibold,
    color: Colors.accent,
  },
  colorIndicator: {
    width: 12,
    height: 12,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: Colors.textLight,
    position: 'absolute',
    top: 0,
    right: 0,
  },
  wineImagePlaceholder: {
    width: 60,
    height: 80,
    backgroundColor: Colors.softGray,
    borderRadius: 8,
    justifyContent: 'center',
    alignItems: 'center',
    alignSelf: 'center',
    marginBottom: 16,
  },
  winePlaceholderText: {
    fontSize: 32,
  },
  cardContent: {
    flex: 1,
  },
  wineName: {
    fontSize: Typography.sizes.lg,
    fontWeight: Typography.weights.bold,
    color: Colors.textPrimary,
    marginBottom: 4,
  },
  wineProducer: {
    fontSize: Typography.sizes.sm,
    color: Colors.textSecondary,
    marginBottom: 12,
  },
  priceRatingRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  winePrice: {
    fontSize: Typography.sizes.xl,
    fontWeight: Typography.weights.bold,
    color: Colors.primary,
  },
  starsContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  ratingText: {
    fontSize: Typography.sizes.xs,
    color: Colors.textSecondary,
    marginLeft: 8,
  },
  reasoning: {
    fontSize: Typography.sizes.sm,
    color: Colors.textSecondary,
    lineHeight: Typography.sizes.sm * Typography.lineHeights.relaxed,
  },
});