import React from 'react';
import { 
  View, 
  Text, 
  StyleSheet, 
  ScrollView, 
  TouchableOpacity 
} from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { ArrowLeft } from 'lucide-react-native';
import { Colors } from '@/constants/Colors';
import { Typography } from '@/constants/Typography';
import { type WineRecommendation } from '@/hooks/useRecommendations';

export default function WineDetailScreen() {
  const router = useRouter();
  const { wine: wineParam, dish, budget } = useLocalSearchParams<{ 
    wine: string; 
    dish: string;
    budget?: string;
  }>();

  const wine: WineRecommendation = JSON.parse(wineParam);

  const getCategoryColor = (category: string) => {
    // Return background color based on wine color instead of category
    return Colors.textSecondary; // This will be overridden by getWineColorBackground
  };

  const getWineColorBackground = (color: string) => {
    switch (color) {
      case 'blanc': return '#F5F5DC';
      case 'rouge': return '#722F37';
      case 'sparkling': return '#D4AF37';
      case 'rosé': return '#FFB6C1';
      default: return '#F5F5DC';
    }
  };

  const getCategoryBadgeTextColor = (color: string) => {
    switch (color) {
      case 'blanc': return '#333';
      case 'rouge': return '#FFF';
      case 'sparkling': return '#333';
      case 'rosé': return '#333';
      default: return '#333';
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
          <Text style={styles.headerTitle}>Détails du vin</Text>
          <Text style={styles.headerSubtitle}>
            Pour {dish}{budget && ` • Budget: €${budget}`}
          </Text>
        </View>
      </View>

      <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
        <View style={styles.wineCard}>
          {/* Wine Image Placeholder */}
          {/* Wine Basic Info */}
          <View style={styles.basicInfo}>
            <View style={styles.nameAndCategory}>
              <Text style={styles.wineName}>{wine.name}</Text>
              <View style={[
                styles.categoryBadge,
                { 
                  backgroundColor: getWineColorBackground(wine.color),
                  borderColor: getWineColorBackground(wine.color)
                }
              ]}>
                <Text style={[
                  styles.categoryText,
                  { color: getCategoryBadgeTextColor(wine.color) }
                ]}>
                  {getCategoryLabel(wine.category)}
                </Text>
              </View>
            </View>
            
            <Text style={styles.wineProducer}>
              {wine.producer}
            </Text>
            
            <Text style={styles.wineRegion}>
              {wine.region}{wine.appellation && ` • ${wine.appellation}`}
            </Text>
            
            {wine.vintage && (
              <Text style={styles.wineVintage}>
                Millésime: {wine.vintage}
              </Text>
            )}
          </View>

          {/* Price and Rating */}
          <View style={styles.priceRatingSection}>
            <View style={styles.priceContainer}>
              <Text style={styles.priceLabel}>Prix</Text>
              <Text style={styles.winePrice}>
                €{wine.price_estimate ? 
                  (Number.isInteger(wine.price_estimate) ? 
                    wine.price_estimate.toString() : 
                    wine.price_estimate.toFixed(2)
                  ) : '0'
                }
              </Text>
            </View>
            <View style={styles.ratingContainer}>
              <Text style={styles.ratingLabel}>Note</Text>
            </View>
          </View>

          {/* Grape Varieties */}
          {wine.grapeVarieties && wine.grapeVarieties.length > 0 && (
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Cépages</Text>
              <View style={styles.grapeContainer}>
                {wine.grapeVarieties.map((grape, index) => (
                  <View key={index} style={styles.grapeBadge}>
                    <Text style={styles.grapeText}>{grape}</Text>
                  </View>
                ))}
              </View>
            </View>
          )}

          {/* Reasoning */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Pourquoi ce choix ?</Text>
            <Text style={styles.reasoningText}>{wine.reasoning}</Text>
          </View>

          {/* Food Pairings */}
          {wine.foodPairings && wine.foodPairings.length > 0 && (
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Autres accords</Text>
              <View style={styles.pairingsContainer}>
                {wine.foodPairings.map((pairing, index) => (
                  <View key={index} style={styles.pairingBadge}>
                    <Text style={styles.pairingText}>{pairing}</Text>
                  </View>
                ))}
              </View>
            </View>
          )}
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
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
    padding: 24,
    marginBottom: 24,
    shadowColor: Colors.darkGray,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 3,
  },
  basicInfo: {
    marginBottom: 20,
  },
  nameAndCategory: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 8,
  },
  wineName: {
    fontSize: Typography.sizes.xl,
    fontWeight: Typography.weights.bold,
    color: Colors.textPrimary,
    flex: 1,
    marginRight: 12,
  },
  categoryBadge: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 12,
    borderWidth: 1,
  },
  categoryText: {
    fontSize: Typography.sizes.xs,
    fontWeight: Typography.weights.semibold,
  },
  wineProducer: {
    fontSize: Typography.sizes.lg,
    fontWeight: Typography.weights.medium,
    color: Colors.textSecondary,
    marginBottom: 4,
  },
  wineRegion: {
    fontSize: Typography.sizes.base,
    color: Colors.textSecondary,
    marginBottom: 4,
  },
  wineVintage: {
    fontSize: Typography.sizes.sm,
    color: Colors.textLight,
  },
  priceRatingSection: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 20,
    borderTopWidth: 1,
    borderBottomWidth: 1,
    borderColor: Colors.softGray,
    marginBottom: 24,
  },
  priceContainer: {
    alignItems: 'flex-start',
  },
  priceLabel: {
    fontSize: Typography.sizes.sm,
    color: Colors.textSecondary,
    marginBottom: 4,
  },
  winePrice: {
    fontSize: Typography.sizes.xxl,
    fontWeight: Typography.weights.bold,
    color: Colors.primary,
  },
  ratingContainer: {
    alignItems: 'flex-end',
  },
  ratingLabel: {
    fontSize: Typography.sizes.sm,
    color: Colors.textSecondary,
    marginBottom: 4,
  },
  section: {
    marginBottom: 24,
  },
  sectionTitle: {
    fontSize: Typography.sizes.lg,
    fontWeight: Typography.weights.bold,
    color: Colors.textPrimary,
    marginBottom: 12,
  },
  grapeContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  grapeBadge: {
    backgroundColor: Colors.softGray,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
  },
  grapeText: {
    fontSize: Typography.sizes.sm,
    color: Colors.textPrimary,
    fontWeight: Typography.weights.medium,
  },
  reasoningText: {
    fontSize: Typography.sizes.base,
    color: Colors.textPrimary,
    lineHeight: Typography.sizes.base * Typography.lineHeights.relaxed,
  },
  pairingsContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  pairingBadge: {
    backgroundColor: Colors.primary,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
  },
  pairingText: {
    fontSize: Typography.sizes.sm,
    color: Colors.accent,
    fontWeight: Typography.weights.medium,
  },
});