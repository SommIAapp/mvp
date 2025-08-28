import React, { useState, useEffect } from 'react';
import { 
  View, 
  Text, 
  StyleSheet, 
  ScrollView, 
  TouchableOpacity,
  ActivityIndicator 
} from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { ArrowLeft, Wine } from 'lucide-react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Colors } from '@/constants/Colors';
import { Typography } from '@/constants/Typography';
import { supabase } from '@/lib/supabase';

export default function WineRecommendationDetailScreen() {
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();
  const [loading, setLoading] = useState(true);
  const [recommendation, setRecommendation] = useState<any>(null);
  const [selectedWineIndex, setSelectedWineIndex] = useState(0);

  // Helper function to get price from different wine formats
  const getPrice = (wine: any) => {
    if (!wine) return 0;
    
    // Pour les recommandations restaurant
    if (wine.price_bottle !== undefined && wine.price_bottle !== null) return wine.price_bottle;
    if (wine.price_glass !== undefined && wine.price_glass !== null) return wine.price_glass;
    
    // Pour les recommandations normales
    if (wine.price_estimate !== undefined && wine.price_estimate !== null) return wine.price_estimate;
    
    // Legacy support
    if (wine.price !== undefined && wine.price !== null) return wine.price;
    
    // Fallback
    return 0;
  };

  useEffect(() => {
    loadRecommendation();
  }, [id]);

  const loadRecommendation = async () => {
    try {
      console.log('📚 Loading recommendation with ID:', id);
      
      const { data, error } = await supabase
        .from('recommendations')
        .select('*')
        .eq('id', id)
        .single();

      if (error) throw error;

      console.log('📊 Loaded recommendation:', data);
      setRecommendation(data);
    } catch (error) {
      console.error('❌ Error loading recommendation:', error);
    } finally {
      setLoading(false);
    }
  };

  const getWineColor = (wine: any) => {
    return wine?.type || wine?.color || 'rouge';
  };

  const getHeaderGradient = (wine: any) => {
    const color = getWineColor(wine);
    switch(color) {
      case 'rouge':
      case 'red':
        return ['#6B2B3A', '#8B4B5A'];
      case 'blanc':
      case 'white':
        return ['#D4AF37', '#E5C755'];
      case 'rosé':
      case 'rose':
        return ['#FFB6C1', '#FFC0CB'];
      default:
        return ['#6B2B3A', '#8B4B5A'];
    }
  };

  const getCategoryLabel = (wine: any) => {
    const price = getPrice(wine);
    if (price <= 15) return 'Économique';
    if (price <= 30) return 'Qualité-Prix';
    return 'Premium';
  };

  const getCategoryColor = (wine: any) => {
    const price = getPrice(wine);
    if (price <= 15) return Colors.success;
    if (price <= 30) return Colors.warning;
    return Colors.primary;
  };

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={Colors.primary} />
      </View>
    );
  }

  if (!recommendation || !recommendation.recommended_wines) {
    return (
      <View style={styles.errorContainer}>
        <Text style={styles.errorText}>Recommandation introuvable</Text>
        <TouchableOpacity 
          style={styles.backButton}
          onPress={() => router.back()}
        >
          <Text style={styles.backButtonText}>Retour</Text>
        </TouchableOpacity>
      </View>
    );
  }

  // Gérer les deux formats possibles
  const wines = Array.isArray(recommendation.recommended_wines) 
    ? recommendation.recommended_wines 
    : (recommendation.recommended_wines.recommendations || []);
  
  const selectedWine = wines[selectedWineIndex] || wines[0];

  if (!selectedWine) {
    return (
      <View style={styles.errorContainer}>
        <Text style={styles.errorText}>Aucun vin trouvé</Text>
        <TouchableOpacity 
          style={styles.backButton}
          onPress={() => router.back()}
        >
          <Text style={styles.backButtonText}>Retour</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <LinearGradient
        colors={getHeaderGradient(selectedWine)}
        style={styles.header}
      >
        <TouchableOpacity 
          style={styles.headerBackButton}
          onPress={() => router.back()}
        >
          <ArrowLeft size={24} color="white" />
        </TouchableOpacity>
        
        <Text style={styles.wineTitle}>{selectedWine.name || 'Vin sélectionné'}</Text>
        <Text style={styles.wineSubtitle}>{selectedWine.vintage || new Date().getFullYear()}</Text>
      </LinearGradient>

      <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
        {/* Sélecteur de vins si plusieurs */}
        {wines.length > 1 && (
          <ScrollView 
            horizontal 
            showsHorizontalScrollIndicator={false}
            style={styles.wineSelector}
            contentContainerStyle={styles.wineSelectorContent}
          >
            {wines.map((wine: any, index: number) => (
              <TouchableOpacity
                key={index}
                style={[
                  styles.wineSelectorItem,
                  selectedWineIndex === index && styles.wineSelectorItemActive
                ]}
                onPress={() => setSelectedWineIndex(index)}
              >
                <Wine size={20} color={selectedWineIndex === index ? Colors.accent : Colors.textSecondary} />
                <Text style={[
                  styles.wineSelectorText,
                  selectedWineIndex === index && styles.wineSelectorTextActive
                ]}>
                  Vin {index + 1}
                </Text>
              </TouchableOpacity>
            ))}
          </ScrollView>
        )}

        {/* Informations du plat */}
        <View style={styles.dishInfo}>
          <Text style={styles.dishLabel}>Recommandé pour</Text>
          <Text style={styles.dishName}>{recommendation.dish_description}</Text>
          {recommendation.user_budget && (
            <Text style={styles.budgetInfo}>Budget: €{recommendation.user_budget}</Text>
          )}
        </View>

        {/* Carte du vin */}
        <View style={styles.wineCard}>
          {/* Badge catégorie */}
          <View style={[styles.categoryBadge, { backgroundColor: getCategoryColor(selectedWine) }]}>
            <Text style={styles.categoryText}>{getCategoryLabel(selectedWine)}</Text>
          </View>

          {/* Infos principales */}
          <View style={styles.mainInfo}>
            <Text style={styles.infoLabel}>PRODUCTEUR</Text>
            <Text style={styles.infoValue}>{selectedWine.producer || 'Non spécifié'}</Text>
            
            <Text style={[styles.infoLabel, { marginTop: 16 }]}>RÉGION</Text>
            <Text style={styles.infoValue}>
              {selectedWine.region || 'France'}
              {selectedWine.appellation && ` • ${selectedWine.appellation}`}
            </Text>
            
            <Text style={[styles.infoLabel, { marginTop: 16 }]}>TYPE</Text>
            <Text style={styles.infoValue}>{getWineColor(selectedWine)}</Text>
          </View>

          {/* Prix et Score */}
          {/* Prix */}
          <View style={styles.priceSection}>
            <Text style={styles.priceLabel}>PRIX</Text>
            <Text style={styles.priceValue}>
              €{(() => {
                const price = getPrice(selectedWine);
                if (price && typeof price === 'number' && price > 0) {
                  return Number.isInteger(price) ? price.toString() : price.toFixed(2);
                }
                return 'Prix sur demande';
              })()}
            </Text>
            {selectedWine.price_display && (
              <Text style={styles.priceDisplay}>{selectedWine.price_display}</Text>
            )}
          </View>

          {/* Reasoning */}
          <View style={styles.reasoningSection}>
            <Text style={styles.reasoningTitle}>Pourquoi ce vin ?</Text>
            <Text style={styles.reasoningText}>
              {selectedWine.reasoning || 'Ce vin a été sélectionné pour son excellent accord avec votre plat.'}
            </Text>
          </View>

          {/* Cépages si disponibles */}
          {selectedWine.grapeVarieties && selectedWine.grapeVarieties.length > 0 && (
            <View style={styles.grapesSection}>
              <Text style={styles.grapesTitle}>Cépages</Text>
              <View style={styles.grapesContainer}>
                {selectedWine.grapeVarieties.map((grape: string, index: number) => (
                  <View key={index} style={styles.grapeBadge}>
                    <Text style={styles.grapeText}>{grape}</Text>
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
    backgroundColor: '#FAF6F0',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#FAF6F0',
  },
  errorContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#FAF6F0',
    padding: 24,
  },
  errorText: {
    fontSize: Typography.sizes.lg,
    color: Colors.textSecondary,
    marginBottom: 20,
    textAlign: 'center',
  },
  backButton: {
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 24,
    backgroundColor: Colors.primary,
  },
  backButtonText: {
    color: Colors.accent,
    fontSize: Typography.sizes.base,
    fontWeight: Typography.weights.semibold,
  },
  header: {
    paddingTop: 60,
    paddingBottom: 30,
    paddingHorizontal: 24,
  },
  headerBackButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 20,
  },
  wineTitle: {
    fontSize: Typography.sizes.xxl,
    fontWeight: Typography.weights.bold,
    color: 'white',
    marginBottom: 4,
  },
  wineSubtitle: {
    fontSize: Typography.sizes.lg,
    color: 'rgba(255, 255, 255, 0.8)',
  },
  content: {
    flex: 1,
    padding: 24,
  },
  wineSelector: {
    marginBottom: 24,
    marginHorizontal: -24,
  },
  wineSelectorContent: {
    paddingHorizontal: 24,
    gap: 12,
  },
  wineSelectorItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: 'white',
    marginRight: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
  },
  wineSelectorItemActive: {
    backgroundColor: Colors.primary,
  },
  wineSelectorText: {
    fontSize: Typography.sizes.sm,
    color: Colors.textSecondary,
    marginLeft: 8,
  },
  wineSelectorTextActive: {
    color: Colors.accent,
    fontWeight: Typography.weights.semibold,
  },
  dishInfo: {
    backgroundColor: 'white',
    borderRadius: 16,
    padding: 20,
    marginBottom: 24,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 3,
  },
  dishLabel: {
    fontSize: Typography.sizes.xs,
    fontWeight: Typography.weights.semibold,
    color: Colors.textSecondary,
    textTransform: 'uppercase',
    letterSpacing: 1,
    marginBottom: 8,
  },
  dishName: {
    fontSize: Typography.sizes.lg,
    fontWeight: Typography.weights.semibold,
    color: Colors.textPrimary,
  },
  budgetInfo: {
    fontSize: Typography.sizes.sm,
    color: Colors.textSecondary,
    marginTop: 4,
  },
  wineCard: {
    backgroundColor: 'white',
    borderRadius: 20,
    padding: 24,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.08,
    shadowRadius: 12,
    elevation: 5,
  },
  categoryBadge: {
    alignSelf: 'flex-start',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 12,
    marginBottom: 20,
  },
  categoryText: {
    fontSize: Typography.sizes.xs,
    fontWeight: Typography.weights.bold,
    color: 'white',
    textTransform: 'uppercase',
  },
  mainInfo: {
    marginBottom: 24,
  },
  infoLabel: {
    fontSize: Typography.sizes.xs,
    fontWeight: Typography.weights.semibold,
    color: Colors.textSecondary,
    textTransform: 'uppercase',
    letterSpacing: 1,
    marginBottom: 4,
  },
  infoValue: {
    fontSize: Typography.sizes.base,
    fontWeight: Typography.weights.medium,
    color: Colors.textPrimary,
  },
  priceSection: {
    paddingVertical: 20,
    borderTopWidth: 1,
    borderBottomWidth: 1,
    borderColor: Colors.softGray,
    marginBottom: 24,
  },
  priceLabel: {
    fontSize: Typography.sizes.xs,
    fontWeight: Typography.weights.semibold,
    color: Colors.textSecondary,
    textTransform: 'uppercase',
    letterSpacing: 1,
    marginBottom: 4,
  },
  priceValue: {
    fontSize: Typography.sizes.xxl,
    fontWeight: Typography.weights.bold,
    color: Colors.primary,
  },
  priceDisplay: {
    fontSize: Typography.sizes.xs,
    color: Colors.textSecondary,
    marginTop: 2,
  },
  reasoningSection: {
    marginBottom: 24,
  },
  reasoningTitle: {
    fontSize: Typography.sizes.lg,
    fontWeight: Typography.weights.bold,
    color: Colors.textPrimary,
    marginBottom: 12,
  },
  reasoningText: {
    fontSize: Typography.sizes.base,
    color: Colors.textPrimary,
    lineHeight: Typography.sizes.base * Typography.lineHeights.relaxed,
  },
  grapesSection: {
    marginTop: 24,
  },
  grapesTitle: {
    fontSize: Typography.sizes.lg,
    fontWeight: Typography.weights.bold,
    color: Colors.textPrimary,
    marginBottom: 12,
  },
  grapesContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  grapeBadge: {
    backgroundColor: Colors.softGray,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
    marginRight: 8,
    marginBottom: 8,
  },
  grapeText: {
    fontSize: Typography.sizes.sm,
    color: Colors.textPrimary,
    fontWeight: Typography.weights.medium,
  },
});