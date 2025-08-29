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
import { tempStore } from '@/utils/tempStore';

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
    restaurantName = '',
    sessionId = ''
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
    sessionId?: string;
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
      if (recommendationsParam && recommendationsParam !== '[]') {
        const parsedRecommendations = JSON.parse(recommendationsParam);
        setRecommendations(parsedRecommendations);
      } else if (sessionId) {
        // Try to get from temp store
        const tempData = tempStore.get(sessionId);
        if (tempData?.recommendations) {
          setRecommendations(tempData.recommendations);
        } else {
          // Fallback to API call
          const newRecommendations = await getRecommendations(
            dish,
            budget ? parseInt(budget) : undefined
          );
          setRecommendations(newRecommendations);
        }
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
  const getHeaderGradient = (wine: any) => {
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

  // Fonction pour obtenir le badge de prix
  const getPriceBadge = (wine: WineRecommendation, allWines: WineRecommendation[]) => {
    // Fonction helper pour récupérer le prix selon le mode
    const getPrice = (w: any) => {
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
      return { text: t('recommendations.economical'), color: '#4CAF50' };
    } else if (winePrice === prices[2]) {
      return { text: t('recommendations.premium'), color: '#D4AF37' };
    } else {
      return { text: t('recommendations.superior'), color: '#6B2B3A' };
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
          colors={getHeaderGradient(wine)}
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
                { backgroundColor: getPriceBadge(prevWineData, recommendations)?.color }
              ]}>
                <Text style={styles.priceBadgeText}>
                  {getPriceBadge(prevWineData, recommendations)?.text}
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
                { backgroundColor: getPriceBadge(wine, recommendations)?.color }
              ]}>
                <Text style={styles.priceBadgeText}>
                  {getPriceBadge(wine, recommendations)?.text}
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
                { backgroundColor: getPriceBadge(nextWineData, recommendations)?.color }
              ]}>
                <Text style={styles.priceBadgeText}>
                  {getPriceBadge(nextWineData, recommendations)?.text}
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
        {showSwipeHint && recommendations.length > 1 && (
          <View style={styles.swipeHint}>
            <Text style={styles.swipeHintText}>
              {t('recommendations.swipeHint')}
            </Text>
          </View>
        )}

        {/* Dots de navigation */}
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

      {/* SECTION INFOS - 35% */}
      <View style={styles.infoSection}>
        <ScrollView showsVerticalScrollIndicator={false}>
          {/* Titre du plat */}
          <View style={styles.dishHeader}>
            <Text style={styles.dishTitle}>
              {t('recommendations.forDish', { dish })}
            </Text>
            {restaurantName && (
              <Text style={styles.restaurantName}>
                Chez {restaurantName}
              </Text>
            )}
            {photoMode === 'true' && visionConfidence && (
              <View style={styles.photoConfidence}>
                <Camera size={16} color={Colors.textSecondary} />
                <Text style={styles.photoConfidenceText}>
                  Photo analysée ({visionConfidence}% confiance)
                </Text>
              </View>
            )}
          </View>

          {/* Infos du vin */}
          <View style={styles.wineInfo}>
            <View style={styles.infoRow}>
              <Text style={styles.infoLabel}>{t('recommendations.region')}</Text>
              <Text style={styles.infoValue}>
                {wine.region || 'France'}
                {wine.appellation && ` • ${wine.appellation}`}
              </Text>
            </View>

            <View style={styles.infoRow}>
              <Text style={styles.infoLabel}>{t('recommendations.price')}</Text>
              <Text style={styles.infoValue}>
                €{(() => {
                  // Mode restaurant : prix de la carte
                  if (wine.price_bottle) return wine.price_bottle;
                  if (wine.price_glass) return `${wine.price_glass} (verre)`;
                  // Mode normal : prix estimé
                  const price = wine.price_estimate || wine.price || 0;
                  return Number.isInteger(price) ? price.toString() : price.toFixed(2);
                })()}
              </Text>
            </View>

            <View style={styles.infoRow}>
              <Text style={styles.infoLabel}>{t('recommendations.type')}</Text>
              <Text style={styles.infoValue}>
                {getWineColor(wine)}
              </Text>
            </View>
          </View>

          {/* Reasoning */}
          <View style={styles.reasoningSection}>
            <Text style={styles.reasoningTitle}>Pourquoi ce vin ?</Text>
            <Text style={styles.reasoningText}>
              {wine.reasoning || 'Ce vin a été sélectionné pour son excellent accord avec votre plat.'}
            </Text>
          </View>

          {/* Producteur */}
          <View style={styles.producerSection}>
            <Text style={styles.producerTitle}>Producteur</Text>
            <Text style={styles.producerText}>
              {wine.producer || 'Producteur non spécifié'}
            </Text>
          </View>
        </ScrollView>
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
    marginTop: 16,
    fontSize: 16,
    color: Colors.textSecondary,
  },
  errorContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#FAF6F0',
    padding: 20,
  },
  errorText: {
    fontSize: 18,
    color: Colors.textSecondary,
    textAlign: 'center',
    marginBottom: 20,
  },
  retryButton: {
    backgroundColor: Colors.primary,
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 8,
  },
  retryButtonText: {
    color: 'white',
    fontSize: 16,
    fontWeight: '600',
  },
  headerSection: {
    height: height * 0.27,
    position: 'relative',
  },
  headerGradient: {
    flex: 1,
    paddingTop: 50,
    paddingHorizontal: 20,
  },
  backButton: {
    position: 'absolute',
    top: 50,
    left: 20,
    zIndex: 10,
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: 'rgba(255,255,255,0.2)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  headerContent: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingTop: 20,
  },
  wineName: {
    fontSize: 24,
    fontWeight: 'bold',
    color: 'white',
    textAlign: 'center',
    marginBottom: 8,
    paddingHorizontal: 20,
  },
  vintage: {
    fontSize: 18,
    color: 'white',
    opacity: 0.9,
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
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
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
  },
  sideBottle: {
    width: 60,
    height: 180,
  },
  centerBottle: {
    width: 90,
    height: 240,
  },
  priceBadge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
    marginBottom: 8,
  },
  priceBadgeCenter: {
    marginBottom: 12,
  },
  priceBadgeText: {
    color: 'white',
    fontSize: 10,
    fontWeight: '600',
    textAlign: 'center',
  },
  swipeHint: {
    position: 'absolute',
    bottom: 60,
    left: 0,
    right: 0,
    alignItems: 'center',
  },
  swipeHintText: {
    fontSize: 14,
    color: Colors.textSecondary,
    backgroundColor: 'rgba(255,255,255,0.9)',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
  },
  dotsContainer: {
    position: 'absolute',
    bottom: 20,
    left: 0,
    right: 0,
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 8,
  },
  dot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: 'rgba(255,255,255,0.5)',
  },
  activeDot: {
    backgroundColor: 'white',
    width: 24,
  },
  infoSection: {
    flex: 1,
    backgroundColor: 'white',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingHorizontal: 24,
    paddingTop: 24,
    marginTop: -20,
  },
  dishHeader: {
    marginBottom: 24,
  },
  dishTitle: {
    fontSize: Typography.sizes.xl,
    fontWeight: Typography.weights.bold,
    color: Colors.textPrimary,
    marginBottom: 4,
  },
  restaurantName: {
    fontSize: Typography.sizes.base,
    color: Colors.primary,
    fontWeight: Typography.weights.medium,
    marginBottom: 8,
  },
  photoConfidence: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 4,
  },
  photoConfidenceText: {
    fontSize: Typography.sizes.xs,
    color: Colors.textSecondary,
    marginLeft: 6,
  },
  wineInfo: {
    marginBottom: 24,
  },
  infoRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: Colors.softGray,
  },
  infoLabel: {
    fontSize: Typography.sizes.sm,
    fontWeight: Typography.weights.semibold,
    color: Colors.textSecondary,
    textTransform: 'uppercase',
    letterSpacing: 1,
  },
  infoValue: {
    fontSize: Typography.sizes.base,
    fontWeight: Typography.weights.medium,
    color: Colors.textPrimary,
    textAlign: 'right',
    flex: 1,
    marginLeft: 16,
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
  producerSection: {
    marginBottom: 24,
  },
  producerTitle: {
    fontSize: Typography.sizes.lg,
    fontWeight: Typography.weights.bold,
    color: Colors.textPrimary,
    marginBottom: 12,
  },
  producerText: {
    fontSize: Typography.sizes.base,
    color: Colors.textPrimary,
  },
});