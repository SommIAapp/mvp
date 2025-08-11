import React, { useState, useEffect } from 'react';
import { 
  View, 
  Text, 
  StyleSheet, 
  TouchableOpacity,
  Dimensions,
  Image,
  ActivityIndicator,
  Animated,
} from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import { ArrowLeft, Camera } from 'lucide-react-native';
import Svg, { Path } from 'react-native-svg';
import { Colors } from '@/constants/Colors';
import { Typography } from '@/constants/Typography';
import { useRecommendations, type WineRecommendation } from '@/hooks/useRecommendations';

const { width, height } = Dimensions.get('window');

export default function RecommendationsScreen() {
  const router = useRouter();
  const { dish, budget, recommendations: recommendationsParam, fromHistory, photoMode, visionConfidence } = useLocalSearchParams<{ 
    dish: string; 
    budget?: string;
    recommendations?: string;
    fromHistory?: string;
    photoMode?: string;
    visionConfidence?: string;
  }>();
  
  const { getRecommendations } = useRecommendations();
  const [recommendations, setRecommendations] = useState<WineRecommendation[]>([]);
  const [loading, setLoading] = useState(true);
  const [currentWine, setCurrentWine] = useState(0);
  const [isTransitioning, setIsTransitioning] = useState(false);
  const [fadeAnim] = useState(new Animated.Value(1));

  useEffect(() => {
    loadRecommendations();
  }, []);

  const loadRecommendations = async () => {
    setLoading(true);
    try {
      if (recommendationsParam) {
        const parsedRecommendations = JSON.parse(recommendationsParam);
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
    switch(color.toLowerCase()) {
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
    
    // Fade out
    Animated.timing(fadeAnim, {
      toValue: 0,
      duration: 150,
      useNativeDriver: true,
    }).start(() => {
      setCurrentWine(index);
      // Fade in
      Animated.timing(fadeAnim, {
        toValue: 1,
        duration: 150,
        useNativeDriver: true,
      }).start(() => {
        setIsTransitioning(false);
      });
    });
  };

  const nextWine = () => {
    const nextIndex = (currentWine + 1) % recommendations.length;
    goToWine(nextIndex);
  };

  const prevWine = () => {
    const prevIndex = (currentWine - 1 + recommendations.length) % recommendations.length;
    goToWine(prevIndex);
  };

  // Nouveau scan
  const handleNewScan = () => {
    router.replace('/(tabs)');
  };

  // Mapping des images CORRIGÉ avec les bons chemins
  const getWineImage = (color: string) => {
    switch(color.toLowerCase()) {
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
        <Text style={styles.loadingText}>Recommandations en cours...</Text>
      </View>
    );
  }

  if (recommendations.length === 0) {
    return (
      <View style={styles.errorContainer}>
        <Text style={styles.errorText}>Aucune recommandation trouvée</Text>
        <TouchableOpacity style={styles.retryButton} onPress={handleNewScan}>
          <Text style={styles.retryButtonText}>Réessayer</Text>
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
          <Animated.View style={[styles.headerContent, { opacity: fadeAnim }]}>
            <Text 
              style={styles.wineName} 
              numberOfLines={2}
              adjustsFontSizeToFit
              minimumFontScale={0.7}
            >
              {getCleanWineName(wine)}
            </Text>
            <Text style={styles.vintage}>{wine.vintage || new Date().getFullYear()}</Text>
          </Animated.View>
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
            <Image
              source={getWineImage(prevWineData.color)}
              style={styles.sideBottle}
              resizeMode="contain"
            />
          </View>

          {/* Bouteille centrale */}
          <View style={styles.centerBottleContainer}>
            <Image
              source={getWineImage(wine.color)}
              style={styles.centerBottle}
              resizeMode="contain"
            />
          </View>

          {/* Bouteille droite */}
          <View style={styles.sideBottleContainer}>
            <Image
              source={getWineImage(nextWineData.color)}
              style={styles.sideBottle}
              resizeMode="contain"
            />
          </View>
        </View>

        {/* Indicateur de swipe au premier usage */}
        {recommendations.length > 1 && currentWine === 0 && (
          <View style={styles.swipeHint}>
            <Text style={styles.swipeHintText}>
              ← Swipe pour voir plus →
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
                  wine.color === 'rosé' ? '#F5B5A3' : 
                  wine.color === 'rouge' ? '#A0616A' : 
                  wine.color === 'blanc' ? '#D4C5A0' :
                  wine.color === 'sparkling' ? '#D4AF37' : '#D4C5A0'
              }
            ]}
          />
        ))}
      </View>

      {/* INFORMATIONS VIN - 20% */}
      <View style={styles.infoSection}>
        <Animated.View style={{ opacity: fadeAnim }}>
          <View style={styles.infoCard}>
            <View style={styles.infoGrid}>
              {/* Région */}
              <View style={styles.infoItem}>
                <Text style={styles.infoLabel}>RÉGION</Text>
                <Text style={styles.infoValue}>{wine.region}</Text>
              </View>

              {/* Prix */}
              <View style={[styles.infoItem, styles.infoItemCenter]}>
                <Text style={styles.infoLabel}>PRIX</Text>
                <Text style={styles.infoPriceValue}>
                  {Math.round(wine.price_estimate || 0)}€
                </Text>
              </View>

              {/* Type */}
              <View style={styles.infoItem}>
                <Text style={styles.infoLabel}>TYPE</Text>
                <Text style={styles.infoValue}>
                  {wine.color === 'rosé' ? 'Rosé' : 
                   wine.color === 'rouge' ? 'Rouge' : 
                   wine.color === 'blanc' ? 'Blanc' : 
                   wine.color === 'sparkling' ? 'Pétillant' : wine.color}
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
        </Animated.View>
      </View>

      {/* BOUTON NOUVEAU SCAN - 10% */}
      <View style={styles.buttonSection}>
        <TouchableOpacity 
          style={styles.scanButton}
          onPress={handleNewScan}
        >
          <Camera size={20} color="white" />
          <Text style={styles.scanButtonText}>Nouveau Scan</Text>
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
    height: height * 0.27,
    position: 'relative',
  },
  headerGradient: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 20,
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
    fontSize: 30,
    fontWeight: '700',
    color: 'white',
    textAlign: 'center',
    marginBottom: 8,
    paddingHorizontal: 30,
    letterSpacing: -0.5,
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
    height: height * 0.38,
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
  },
  centerBottleContainer: {
    flex: 1.2,
    alignItems: 'center',
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
    height: height * 0.2,
    paddingHorizontal: 20,
    justifyContent: 'center',
  },
  infoCard: {
    backgroundColor: 'rgba(255,255,255,0.9)',
    borderRadius: 20,
    padding: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 3,
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
  },
  scanButton: {
    backgroundColor: '#6B2B3A',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 16,
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
});