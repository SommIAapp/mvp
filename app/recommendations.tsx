import React, { useState, useEffect } from 'react';
import { 
  View, 
  Text, 
  StyleSheet, 
  TouchableOpacity,
  Dimensions,
  Image,
  ActivityIndicator,
  ScrollView,
} from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import { ArrowLeft, Camera } from 'lucide-react-native';
import Svg, { Path } from 'react-native-svg';
import { Colors } from '@/constants/Colors';
import { Typography } from '@/constants/Typography';
import { useTranslation } from '@/hooks/useTranslation';
import { useRecommendations, type WineRecommendation } from '@/hooks/useRecommendations';

// Helper pour obtenir la couleur du vin
const getWineColor = (wine: any) => {
  // Mode restaurant utilise 'type', mode normal utilise 'color'
  return wine.type || wine.color || 'rouge';
};

const { width, height } = Dimensions.get('window');

export default function RecommendationsScreen() {
  const router = useRouter();
  const { t } = useTranslation();
  const { 
    dish = '', 
    budget = '0', 
    recommendations: recommendationsParam = '[]', 
    fromHistory = 'false', 
    photoMode = 'false', 
    visionConfidence = '0',
    mode = 'text',
    wineType = 'all',
    restaurantName = ''
  } = useLocalSearchParams<{ 
    dish?: string; 
    budget?: string;
    recommendations?: string;
    fromHistory?: string;
    photoMode?: string;
    visionConfidence?: string;
    mode?: string;
    wineType?: string;
    restaurantName?: string;
  }>();
  
  const { getRecommendations } = useRecommendations();
  const [recommendations, setRecommendations] = useState<WineRecommendation[]>([]);
  const [loading, setLoading] = useState(true);
  const [currentWine, setCurrentWine] = useState(0);
  const [isTransitioning, setIsTransitioning] = useState(false);
  const [showSwipeHint, setShowSwipeHint] = useState(true);

  useEffect(() => {
    loadRecommendations();
  }, []);

  useEffect(() => {
    // Faire disparaître l'indicateur après 3 secondes
    if (recommendations.length > 1 && showSwipeHint) {
      const timer = setTimeout(() => {
        setShowSwipeHint(false);
      }, 3000);
      
      return () => clearTimeout(timer);
    }
  }, [recommendations.length, showSwipeHint]);

  const loadRecommendations = async () => {
    setLoading(true);
    try {
      if (recommendationsParam) {
        const parsedRecommendations = JSON.parse(recommendationsParam || '[]');
        setRecommendations(parsedRecommendations);
      } else {
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

  // Fonction pour obtenir le gradient selon la couleur du vin
  const getHeaderGradient = (color: string) => {
    switch((getWineColor(wine) || '').toLowerCase()) {
      case 'rosé':
      case 'rose':
        return ['#E5A593', '#F5B5A3'];
      case 'rouge':
      case 'red':
        return ['#90515A', '#A0616A'];
      case 'blanc':
      case 'white':
        return ['#C4B590', '#D4C5A0'];
      case 'sparkling':
      case 'champagne':
      case 'pétillant':
      case 'mousseux':
      case 'crémant':
        return ['#D4AF37', '#E4BF47'];
      default:
        return ['#6B2B3A', '#8B4B5A'];
    }
  };

  // Navigation entre vins
  const goToWine = (index: number) => {
    if (isTransitioning) return;
    setIsTransitioning(true);
    
    setCurrentWine(index);
    setIsTransitioning(false);
  };

  const nextWine = () => {
    const nextIndex = (currentWine + 1) % recommendations.length;
    setShowSwipeHint(false);
    goToWine(nextIndex);
  };

  const prevWine = () => {
    const prevIndex = (currentWine - 1 + recommendations.length) % recommendations.length;
    setShowSwipeHint(false);
    goToWine(prevIndex);
  };

  // Nouveau scan
  const handleNewScan = () => {
    router.replace('/(tabs)');
  };

  // Ajoute cette fonction après loadRecommendations :
  const getPriceBadge = (wine: WineRecommendation, allWines: WineRecommendation[]) => {
    // Fonction helper pour récupérer le prix selon le mode
    const getPrice = (w) => {
      // Mode restaurant : utiliser les vrais prix de la carte
      if (w.price_bottle) return w.price_bottle;
      if (w.price_glass && !w.price_bottle) {
        // Si seulement prix au verre, estimer la bouteille (x5-6)
        return w.price_glass * 5.5;
      }
      // Mode normal : utiliser price_estimate
      return w.price_estimate || 0;
    };
    
    const prices = allWines.map(w => getPrice(w)).sort((a, b) => a - b);
    const winePrice = getPrice(wine);
    
    if (prices.length !== 3) return null;
    
    if (winePrice === prices[0]) {
      return { text: 'Économique', color: '#4CAF50' };
    } else if (winePrice === prices[2]) {
      return { text: 'Premium', color: '#D4AF37' };
    } else {
      return { text: 'Supérieur', color: '#6B2B3A' };
    }
  };

  const getWineImage = (color: string) => {
    switch((color || '').toLowerCase()) {
      case 'rosé':
      case 'rose':
        return require('@/assets/images/rose.png/rose.png');
      case 'rouge':
      case 'red':
        return require('@/assets/images/rouge.png/rouge.png');
      case 'blanc':
      case 'white':
        return require('@/assets/images/blanc.png/blanc.png');
      case 'sparkling':
      case 'champagne':
      case 'pétillant':
      case 'mousseux':
      case 'crémant':
        return require('@/assets/images/champagne.png/champagne.png');
      default:
        return require('@/assets/images/rouge.png/rouge.png');
    }
  };

  // Fonction pour extraire juste le nom du vin (enlève la région si elle est dans le nom)
  const getCleanWineName = (wine: WineRecommendation) => {
    // Si c'est un nom générique du mode restaurant
    if (wine.name?.includes('VINS') || wine.name?.length < 5) {
      return `${wine.producer || 'Sélection'} ${wine.type || wine.color || 'Rouge'}`;
    }
    
    let cleanName = wine.name;
    
    // Enlève les patterns courants : ", Bordeaux", " - Bordeaux", " Bordeaux", etc.
    const regionPatterns = [
      `, ${wine.region}`,
      ` - ${wine.region}`,
      ` ${wine.region}`,
      ', Bordeaux',
      ', Bourgogne',
      ', Loire',
      ', Provence',
      ' AOC',
      ' AOP',
    ];
    
    regionPatterns.forEach(pattern => {
      if (cleanName.includes(pattern)) {
        cleanName = cleanName.replace(pattern, '');
      }
    });
    
    // Enlève aussi le millésime s'il est dans le nom
    const yearPattern = / \d{4}$/;
    cleanName = cleanName.replace(yearPattern, '');
    
    return cleanName.trim();
  };
  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={Colors.primary} />
        <Text style={styles.loadingText}>{t('recommendations.loading')}</Text>
      </View>
    );
  }

  if (recommendations.length === 0) {
    return (
      <View style={styles.errorContainer}>
        <Text style={styles.errorText}>{t('recommendations.notFound')}</Text>
        <TouchableOpacity style={styles.retryButton} onPress={handleNewScan}>
          <Text style={styles.retryButtonText}>{t('common.retry')}</Text>
        </TouchableOpacity>
      </View>
    );
  }

  const wine = recommendations[currentWine];
  const prevWineData = recommendations[(currentWine - 1 + recommendations.length) % recommendations.length];
  const nextWineData = recommendations[(currentWine + 1) % recommendations.length];

  return (
    <View style={styles.container}>
      {/* HEADER avec gradient - 27% */}
      <View style={styles.headerSection}>
        <LinearGradient
          colors={getHeaderGradient(wine.color)}
          style={styles.headerGradient}
        >
          {/* Flèche retour */}
          <TouchableOpacity 
            style={styles.backButton}
            onPress={() => router.back()}
          >
            <ArrowLeft size={24} color="white" />
          </TouchableOpacity>

          {/* Nom et millésime du vin */}
          <View style={styles.headerContent}>
            <Text 
              style={styles.wineName} 
              numberOfLines={2}
            >
              {wine.name && !wine.name.includes('VINS') ? 
                getCleanWineName(wine) : 
                `Sélection ${wine.type || 'Rouge'} ${currentWine + 1}`}
            </Text>
            <Text style={styles.vintage}>{wine.vintage || new Date().getFullYear()}</Text>
          </View>
        </LinearGradient>

        {/* Vague SVG */}
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

      {/* SECTION BOUTEILLES - 38% */}
      <View style={styles.bottlesSection}>
        {/* Zones tactiles invisibles */}
        <TouchableOpacity 
          style={[styles.touchZone, styles.leftZone]}
          onPress={prevWine}
          activeOpacity={1}
        />
        <TouchableOpacity 
          style={[styles.touchZone, styles.rightZone]}
          onPress={nextWine}
          activeOpacity={1}
        />

        {/* Container des 3 bouteilles */}
        <View style={styles.bottlesWrapper}>
          {/* Bouteille gauche */}
          <View style={styles.sideBottleContainer}>
            {getPriceBadge(prevWineData, recommendations) && (
              <View style={[
                styles.priceBadge,
                { backgroundColor: getPriceBadge(prevWineData, recommendations).color }
              ]}>
                <Text style={styles.priceBadgeText}>
                  {getPriceBadge(prevWineData, recommendations).text}
                </Text>
              </View>
            )}
            <Image
              source={getWineImage(getWineColor(prevWineData))}
              style={styles.sideBottle}
              resizeMode="contain"
            />
          </View>

          {/* Bouteille centrale */}
          <View style={styles.centerBottleContainer}>
            {getPriceBadge(wine, recommendations) && (
              <View style={[
                styles.priceBadge,
                styles.priceBadgeCenter,
                { backgroundColor: getPriceBadge(wine, recommendations).color }
              ]}>
                <Text style={styles.priceBadgeText}>
                  {getPriceBadge(wine, recommendations).text}
                </Text>
              </View>
            )}
            <Image
              source={getWineImage(getWineColor(wine))}
              style={styles.centerBottle}
              resizeMode="contain"
            />
          </View>

          {/* Bouteille droite */}
          <View style={styles.sideBottleContainer}>
            {getPriceBadge(nextWineData, recommendations) && (
              <View style={[
                styles.priceBadge,
                { backgroundColor: getPriceBadge(nextWineData, recommendations).color }
              ]}>
                <Text style={styles.priceBadgeText}>
                  {getPriceBadge(nextWineData, recommendations).text}
                </Text>
              </View>
            )}
            <Image
              source={getWineImage(getWineColor(nextWineData))}
              style={styles.sideBottle}
              resizeMode="contain"
            />
          </View>
        </View>

        {/* Indicateur swipe */}
        {recommendations.length > 1 && showSwipeHint && (
          <View style={styles.swipeHint}>
            <Text style={styles.swipeHintText}>
              {t('recommendations.swipeHint')}
            </Text>
          </View>
        )}
      </View>

      {/* SECTION INFOS - 35% */}
      <View style={styles.infoSection}>
        <ScrollView showsVerticalScrollIndicator={false}>
          {/* Plat et budget */}
          <View style={styles.dishSection}>
            <Text style={styles.dishLabel}>
              {t('recommendations.forDish', { dish })}
            </Text>
            {budget && budget !== '0' && (
              <Text style={styles.budgetLabel}>
                Budget: €{budget}
              </Text>
            )}
            {photoMode === 'true' && visionConfidence && parseFloat(visionConfidence) > 0 && (
              <View style={styles.photoConfidence}>
                <Camera size={16} color={Colors.textSecondary} />
                <Text style={styles.photoConfidenceText}>
                  Confiance: {Math.round(parseFloat(visionConfidence) * 100)}%
                </Text>
              </View>
            )}
          </View>

          {/* Infos du vin */}
          <View style={styles.wineInfoCard}>
            <View style={styles.wineHeader}>
              <Text style={styles.wineNameText}>
                {wine.name && !wine.name.includes('VINS') ? 
                  getCleanWineName(wine) : 
                  `Sélection ${wine.type || 'Rouge'} ${currentWine + 1}`}
              </Text>
              <Text style={styles.wineProducer}>
                {wine.producer}
              </Text>
            </View>

            <View style={styles.wineDetails}>
              <View style={styles.detailRow}>
                <Text style={styles.detailLabel}>{t('recommendations.region')}</Text>
                <Text style={styles.detailValue}>
                  {wine.region}{wine.appellation && ` • ${wine.appellation}`}
                </Text>
              </View>
              
              <View style={styles.detailRow}>
                <Text style={styles.detailLabel}>{t('recommendations.price')}</Text>
                <Text style={styles.priceValue}>
                  €{(() => {
                    // Mode restaurant : utiliser les vrais prix de la carte
                    if (wine.price_bottle) return wine.price_bottle;
                    if (wine.price_glass && !wine.price_bottle) return wine.price_glass;
                    // Mode normal : utiliser price_estimate
                    const price = wine.price_estimate || wine.price || 0;
                    return Number.isInteger(price) ? price.toString() : price.toFixed(2);
                  })()}
                </Text>
              </View>
              
              <View style={styles.detailRow}>
                <Text style={styles.detailLabel}>{t('recommendations.type')}</Text>
                <Text style={styles.detailValue}>
                  {getWineColor(wine)}
                </Text>
              </View>
            </View>

            {/* Reasoning */}
            <View style={styles.reasoningSection}>
              <Text style={styles.reasoningText}>
                {wine.reasoning}
              </Text>
            </View>
          </View>
        </ScrollView>

        {/* Navigation dots */}
        {recommendations.length > 1 && (
          <View style={styles.dotsContainer}>
            {recommendations.map((_, index) => (
              <TouchableOpacity
                key={index}
                style={[
                  styles.dot,
                  currentWine === index && styles.activeDot
                ]}
                onPress={() => goToWine(index)}
              />
            ))}
          </View>
        )}
      </View>
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
  loadingText: {
    fontSize: Typography.sizes.base,
    color: Colors.textSecondary,
    marginTop: 16,
  },
  errorContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#FAF6F0',
    paddingHorizontal: 24,
  },
  errorText: {
    fontSize: Typography.sizes.lg,
    color: Colors.textSecondary,
    textAlign: 'center',
    marginBottom: 24,
  },
  retryButton: {
    backgroundColor: Colors.primary,
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 24,
  },
  retryButtonText: {
    color: Colors.accent,
    fontSize: Typography.sizes.base,
    fontWeight: Typography.weights.semibold,
  },
  headerSection: {
    position: 'relative',
    height: height * 0.27,
  },
  headerGradient: {
    flex: 1,
    paddingTop: 60,
    paddingHorizontal: 20,
    paddingBottom: 20,
    justifyContent: 'center',
  },
  backButton: {
    position: 'absolute',
    top: 60,
    left: 20,
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: 'rgba(255,255,255,0.2)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  wineName: {
    fontSize: Typography.sizes.xxl,
    fontWeight: Typography.weights.bold,
    color: 'white',
    textAlign: 'center',
    marginBottom: 8,
    paddingHorizontal: 20,
  },
  vintage: {
    fontSize: Typography.sizes.lg,
    color: 'rgba(255,255,255,0.8)',
    textAlign: 'center',
  },
  headerContent: {
    alignItems: 'center',
    marginTop: 20,
  },
  wave: {
    position: 'absolute',
    bottom: -1,
    left: 0,
    right: 0,
  },
  bottlesSection: {
    height: height * 0.38,
    position: 'relative',
    justifyContent: 'center',
    alignItems: 'center',
  },
  touchZone: {
    position: 'absolute',
    top: 0,
    bottom: 0,
    width: '40%',
    zIndex: 10,
  },
  leftZone: {
    left: 0,
  },
  rightZone: {
    right: 0,
  },
  bottlesWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    width: '100%',
    paddingHorizontal: 20,
  },
  sideBottleContainer: {
    flex: 1,
    alignItems: 'center',
    opacity: 0.6,
  },
  centerBottleContainer: {
    flex: 1.5,
    alignItems: 'center',
    zIndex: 5,
  },
  sideBottle: {
    width: 80,
    height: 200,
  },
  centerBottle: {
    width: 120,
    height: 280,
  },
  priceBadge: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 12,
    marginBottom: 8,
  },
  priceBadgeCenter: {
    marginBottom: 16,
  },
  priceBadgeText: {
    fontSize: Typography.sizes.xs,
    fontWeight: Typography.weights.bold,
    color: 'white',
    textTransform: 'uppercase',
  },
  swipeHint: {
    position: 'absolute',
    bottom: 20,
    left: 0,
    right: 0,
    alignItems: 'center',
  },
  swipeHintText: {
    fontSize: Typography.sizes.sm,
    color: 'rgba(255,255,255,0.7)',
    backgroundColor: 'rgba(0,0,0,0.3)',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 16,
  },
  infoSection: {
    flex: 1,
    backgroundColor: '#FAF6F0',
    paddingHorizontal: 24,
    paddingTop: 20,
  },
  dishSection: {
    marginBottom: 20,
  },
  dishLabel: {
    fontSize: Typography.sizes.lg,
    fontWeight: Typography.weights.semibold,
    color: Colors.textPrimary,
    textAlign: 'center',
    marginBottom: 8,
  },
  budgetLabel: {
    fontSize: Typography.sizes.sm,
    color: Colors.textSecondary,
    textAlign: 'center',
  },
  photoConfidence: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 8,
  },
  photoConfidenceText: {
    fontSize: Typography.sizes.xs,
    color: Colors.textSecondary,
    marginLeft: 4,
  },
  wineInfoCard: {
    backgroundColor: 'white',
    borderRadius: 20,
    padding: 20,
    marginBottom: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.08,
    shadowRadius: 20,
    elevation: 5,
  },
  wineHeader: {
    marginBottom: 16,
  },
  wineNameText: {
    fontSize: Typography.sizes.lg,
    fontWeight: Typography.weights.bold,
    color: Colors.textPrimary,
    marginBottom: 4,
  },
  wineProducer: {
    fontSize: Typography.sizes.base,
    color: Colors.textSecondary,
  },
  wineDetails: {
    marginBottom: 16,
  },
  detailRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  detailLabel: {
    fontSize: Typography.sizes.xs,
    fontWeight: Typography.weights.semibold,
    color: Colors.textSecondary,
    textTransform: 'uppercase',
    letterSpacing: 1,
  },
  detailValue: {
    fontSize: Typography.sizes.base,
    color: Colors.textPrimary,
    fontWeight: Typography.weights.medium,
  },
  priceValue: {
    fontSize: Typography.sizes.lg,
    fontWeight: Typography.weights.bold,
    color: Colors.primary,
  },
  reasoningSection: {
    paddingTop: 16,
    borderTopWidth: 1,
    borderTopColor: Colors.softGray,
  },
  reasoningText: {
    fontSize: Typography.sizes.base,
    color: Colors.textPrimary,
    lineHeight: Typography.sizes.base * Typography.lineHeights.relaxed,
  },
  dotsContainer: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 20,
    gap: 8,
  },
  dot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: Colors.textLight,
  },
  activeDot: {
    backgroundColor: Colors.primary,
    width: 24,
    borderRadius: 4,
  },
});