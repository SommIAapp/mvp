import React, { useState, useEffect } from 'react';
import { 
  View, 
  Text, 
  StyleSheet, 
  TouchableOpacity,
  Dimensions,
  Image,
  ActivityIndicator,
} from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import { ArrowLeft, Camera } from 'lucide-react-native';
import Svg, { Path } from 'react-native-svg';
import { Colors } from '@/constants/Colors';
import { Typography } from '@/constants/Typography';
import { useTranslation } from '@/hooks/useTranslation';
import { useRecommendations, type WineRecommendation } from '@/hooks/useRecommendations';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as StoreReview from 'expo-store-review';

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
  const handleNewScan = async () => {
    console.log('🔍 handleNewScan called');
    
    // Vérifier si c'est la première recommandation
    const isFirstReco = await AsyncStorage.getItem('first_reco_completed') !== 'true';
    console.log('📊 isFirstReco:', isFirstReco);
    
    if (isFirstReco) {
      await AsyncStorage.setItem('first_reco_completed', 'true');
      console.log('✅ Marked as first reco completed');
      
      // IMPORTANT: Naviguer d'abord
      router.replace('/(tabs)');
      
      // PUIS demander le rating après un délai plus long
      setTimeout(async () => {
        console.log('⏰ Timer fired for rating request');
        try {
          const hasAction = await StoreReview.hasAction();
          console.log('📱 StoreReview.hasAction():', hasAction);
          
          if (hasAction) {
            console.log('🎯 Requesting store review...');
            await StoreReview.requestReview();
            console.log('✅ Store review requested');
          } else {
            console.log('❌ StoreReview.hasAction() returned false');
          }
        } catch (error) {
          console.error('❌ Error requesting store review:', error);
        }
      }, 2000); // 2 secondes pour être sûr que la navigation est complète
    } else {
      console.log('❌ Not first reco, navigating directly');
      router.replace('/(tabs)');
    }
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
      return { text: t('recommendations.badges.economic'), color: '#4CAF50' };
    } else if (winePrice === prices[2]) {
      return { text: t('recommendations.badges.premium'), color: '#D4AF37' };
    } else {
      return { text: t('recommendations.badges.superior'), color: '#6B2B3A' };
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
          <Text style={styles.retryButtonText}>{t('recommendations.retry')}</Text>
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

        {/* Indicateur de swipe au premier usage */}
        {recommendations.length > 1 && currentWine === 0 && showSwipeHint && (
          <View style={styles.swipeHint}>
            <Text style={styles.swipeHintText}>
              {t('recommendations.swipeHint')}
            </Text>
          </View>
        )}
      </View>

      {/* DOTS DE NAVIGATION - 5% */}
      <View style={styles.dotsContainer}>
        {recommendations.map((_, index) => (
          <TouchableOpacity
            key={index}
            onPress={() => goToWine(index)}
            style={[
              styles.dot,
              currentWine === index && styles.activeDot,
              currentWine === index && {
                backgroundColor: 
                  getWineColor(wine) === 'rosé' ? '#F5B5A3' : 
                  getWineColor(wine) === 'rouge' ? '#A0616A' : 
                  getWineColor(wine) === 'blanc' ? '#D4C5A0' :
                  getWineColor(wine) === 'sparkling' ? '#D4AF37' : '#D4C5A0'
              }
            ]}
          />
        ))}
      </View>

      {/* INFORMATIONS VIN - 20% */}
      <View style={styles.infoSection}>
        <View>
          <View style={styles.infoCard}>
            <View style={styles.infoGrid}>
              {/* Région */}
              <View style={styles.infoItem}>
                <Text style={styles.infoLabel}>{t('recommendations.region')}</Text>
                <Text style={styles.infoValue}>
                  {wine.region || 'France'}
                </Text>
              </View>

              {/* Prix */}
              <View style={[styles.infoItem, styles.infoItemCenter]}>
                <Text style={styles.infoLabel}>{t('recommendations.price')}</Text>
                <Text style={styles.infoPriceValue}>
                  {(() => {
                    // Mode restaurant : utiliser les vrais prix de la carte
                    if (wine.price_bottle) return Math.round(wine.price_bottle);
                    if (wine.price_glass && !wine.price_bottle) {
                      // Si seulement prix au verre, estimer la bouteille (x5-6)
                      return Math.round(wine.price_glass * 5.5);
                    }
                    // Mode normal : utiliser price_estimate
                    return Math.round(wine.price_estimate || wine.match_score || 30);
                  })()}€
                </Text>
              </View>

              {/* Type */}
              <View style={styles.infoItem}>
                <Text style={styles.infoLabel}>{t('recommendations.type')}</Text>
                <Text style={styles.infoValue}>
                  {wine.type === 'rouge' ? t('recommendations.wineTypes.red') :
                   wine.type === 'blanc' ? t('recommendations.wineTypes.white') :
                   wine.type === 'rosé' ? t('recommendations.wineTypes.rose') :
                   wine.type === 'champagne' ? t('recommendations.wineTypes.champagne') :
                   wine.type === 'pétillant' ? t('recommendations.wineTypes.sparkling') :
                   getWineColor(wine) === 'rouge' ? t('recommendations.wineTypes.red') :
                   getWineColor(wine) === 'blanc' ? t('recommendations.wineTypes.white') :
                   getWineColor(wine) === 'rosé' ? t('recommendations.wineTypes.rose') : t('recommendations.wineTypes.red')}
                </Text>
              </View>
            </View>
            
            {/* Reasoning/Description */}
            {wine.reasoning && (
              <Text style={styles.reasoning} numberOfLines={3}>
                {wine.reasoning}
              </Text>
            )}
          </View>
        </View>
      </View>

      {/* BOUTON NOUVEAU SCAN - 10% */}
      <View style={styles.buttonSection}>
        <TouchableOpacity 
          style={styles.scanButton}
          onPress={handleNewScan}
        >
          <Camera size={20} color="white" />
          <Text style={styles.scanButtonText}>{t('recommendations.newScan')}</Text>
        </TouchableOpacity>
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
    paddingHorizontal: 40,
  },
  errorText: {
    fontSize: 18,
    color: Colors.textSecondary,
    textAlign: 'center',
    marginBottom: 24,
  },
  retryButton: {
    backgroundColor: Colors.primary,
    paddingHorizontal: 32,
    paddingVertical: 16,
    borderRadius: 26,
  },
  retryButtonText: {
    color: 'white',
    fontSize: 16,
    fontWeight: '600',
  },
  
  // Header - 27%
  headerSection: {
    height: height * 0.25,
    position: 'relative',
  },
  headerGradient: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingTop: 60,
    paddingBottom: 50,
  },
  backButton: {
    position: 'absolute',
    top: 50,
    left: 20,
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(255,255,255,0.2)',
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 10,
  },
  headerContent: {
    alignItems: 'center',
    marginTop: 20,
  },
  wineName: {
    fontSize: 28,
    fontWeight: '700',
    color: 'white',
    textAlign: 'center',
    marginBottom: 8,
    paddingHorizontal: 20,
    letterSpacing: -0.5,
    lineHeight: 34,
    minHeight: 68,
  },
  vintage: {
    fontSize: 20,
    color: 'rgba(255,255,255,0.9)',
    fontWeight: '500',
  },
  wave: {
    position: 'absolute',
    bottom: -1,
    left: 0,
    right: 0,
  },

  // Bouteilles - 38%
  bottlesSection: {
    height: height * 0.36,
    position: 'relative',
    justifyContent: 'center',
  },
  touchZone: {
    position: 'absolute',
    top: 0,
    bottom: 0,
    width: width * 0.33,
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
    paddingHorizontal: width < 375 ? 10 : 20,
  },
  sideBottleContainer: {
    flex: 1,
    alignItems: 'center',
    paddingBottom: 20,
  },
  centerBottleContainer: {
    flex: 1.2,
    alignItems: 'center',
    paddingBottom: 20,
  },
  sideBottle: {
    width: width < 375 ? 75 : 85,
    height: width < 375 ? 225 : 255,
    opacity: 0.7,
  },
  centerBottle: {
    width: width < 375 ? 90 : 100,
    height: width < 375 ? 270 : 300,
  },

  // Swipe hint
  swipeHint: {
    position: 'absolute',
    bottom: '45%',
    alignSelf: 'center',
    backgroundColor: 'rgba(0,0,0,0.7)',
    paddingHorizontal: 20,
    paddingVertical: 8,
    borderRadius: 20,
    zIndex: 20,
  },
  swipeHintText: {
    color: 'white',
    fontSize: 14,
  },

  // Dots - 5%
  dotsContainer: {
    height: height * 0.05,
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 12,
  },
  dot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: '#E0D5D0',
  },
  activeDot: {
    width: 20,
    height: 6,
  },

  // Info - 20%
  infoSection: {
    height: height * 0.19,
    paddingHorizontal: 20,
    justifyContent: 'center',
  },
  infoCard: {
    backgroundColor: 'rgba(255,255,255,0.9)',
    borderRadius: 20,
    padding: 20,
  },
  infoGrid: {
    flexDirection: 'row',
    marginBottom: 4,
  },
  infoItem: {
    flex: 1,
    alignItems: 'center',
  },
  infoItemCenter: {
    borderLeftWidth: 1,
    borderRightWidth: 1,
    borderColor: '#E0E0E0',
  },
  infoLabel: {
    fontSize: 11,
    color: '#999',
    letterSpacing: 0.5,
    marginBottom: 4,
    fontWeight: '600',
  },
  infoValue: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
  },
  infoPriceValue: {
    fontSize: 20,
    fontWeight: '700',
    color: '#333',
  },
  reasoning: {
    fontSize: 14,
    color: '#666',
    lineHeight: 20,
    textAlign: 'center',
    marginTop: 12,
    paddingHorizontal: 8,
  },

  // Button - 10%
  buttonSection: {
    height: height * 0.1,
    paddingHorizontal: 20,
    justifyContent: 'center',
    paddingBottom: 20,
  },
  scanButton: {
    backgroundColor: '#6B2B3A',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 16,
    paddingHorizontal: 32,
    borderRadius: 26,
    gap: 12,
    shadowColor: '#6B2B3A',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 12,
    elevation: 5,
  },
  scanButtonText: {
    color: 'white',
    fontSize: 18,
    fontWeight: '600',
  },
  priceBadge: {
    position: 'absolute',
    top: 10,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
    zIndex: 1,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15,
    shadowRadius: 4,
    elevation: 3,
  },
  priceBadgeCenter: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 18,
  },
  priceBadgeText: {
    color: 'white',
    fontSize: 12,
    fontWeight: '700',
    letterSpacing: 0.3,
  },
  categoryBadge: {
    position: 'absolute',
    top: 50,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
    zIndex: 1,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15,
    shadowRadius: 4,
    elevation: 3,
  },
  categoryText: {
    color: 'white',
    fontSize: 11,
    fontWeight: '600',
    letterSpacing: 0.2,
  },
});