import React, { useState, useEffect } from 'react';
import { 
  View, 
  Text, 
  StyleSheet, 
  TouchableOpacity,
  Alert,
  ScrollView,
  TextInput,
  Dimensions,
  Image,
  ActivityIndicator,
} from 'react-native';
import { useRouter } from 'expo-router';
import { Camera, ImageIcon, Utensils, DollarSign, Wine } from 'lucide-react-native';
import * as ImagePicker from 'expo-image-picker';
import { LinearGradient } from 'expo-linear-gradient';
import Svg, { Path } from 'react-native-svg';
import { Colors } from '@/constants/Colors';
import { Typography } from '@/constants/Typography';
import { useTranslation } from '@/hooks/useTranslation';
import { Button } from '@/components/Button';
import { LoadingSpinner } from '@/components/LoadingSpinner';
import { ProgressBar } from '@/components/ProgressBar';
import { useAuth } from '@/hooks/useAuth';
import { useRestaurantMode } from '@/hooks/useRestaurantMode';
import { getCachedWineCard, setCachedWineCard, cleanOldCache } from '@/utils/wineCardCache';
import { tempStore } from '@/utils/tempStore';

const { width, height } = Dimensions.get('window');

const BUDGET_OPTIONS = ['€10', '€20', '€30', '€50+'];

const WINE_TYPES = [
  { id: 'rouge', label: 'Rouge', color: '#6B2B3A' },
  { id: 'blanc', label: 'Blanc', color: '#D4C5A0' },
  { id: 'rose', label: 'Rosé', color: '#F5B5A3' },
  { id: 'champagne', label: 'Champagne', color: '#D4AF37' },
];

export default function RestaurantScreen() {
  const router = useRouter();
  const { t } = useTranslation();
  const { user, canMakeRecommendation } = useAuth();
  const { 
    currentSession, 
    loading, 
    error, 
    scanWineCard, 
    getRestaurantRecommendations,
    clearSession 
  } = useRestaurantMode();

  const [dishDescription, setDishDescription] = useState('');
  const [selectedBudget, setSelectedBudget] = useState<string | null>(null);
  const [selectedWineType, setSelectedWineType] = useState<string | null>(null);
  const [recommendationLoading, setRecommendationLoading] = useState(false);
  const [showBudgetOptions, setShowBudgetOptions] = useState(false);
  const [showWineTypeOptions, setShowWineTypeOptions] = useState(false);
  const [ocrProgress, setOcrProgress] = useState(0);
  const [ocrMessage, setOcrMessage] = useState('');

  useEffect(() => {
    console.log('🍽️ Restaurant: Component mounted');
    
    // Nettoyer le cache au démarrage
    cleanOldCache();
    
    return () => {
      console.log('🍽️ Restaurant: Component unmounted');
    };
  }, []);

  const handleScanWineCard = async () => {
    console.log('📸 handleScanWineCard - Starting wine card scan');
    
    if (!canMakeRecommendation()) {
      console.log('🚫 handleScanWineCard - Quota exceeded, showing paywall');
      router.push({
        pathname: '/quota-exceeded',
      });
      return;
    }

    Alert.alert(
      t('restaurant.scanMenu'),
      t('restaurant.scanInstruction'),
      [
        { text: t('common.cancel'), style: 'cancel' },
        { text: t('restaurant.takePhoto'), onPress: handleTakePhoto },
        { text: t('restaurant.chooseFromGallery'), onPress: handleChooseFromGallery },
      ]
    );
  };

  const handleTakePhoto = async () => {
    try {
      const { status } = await ImagePicker.requestCameraPermissionsAsync();
      
      if (status !== 'granted') {
        Alert.alert(t('common.error'), t('restaurant.errors.cameraPermission'));
        return;
      }

      const result = await ImagePicker.launchCameraAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsEditing: true,
        aspect: [4, 3],
        quality: 0.8,
        base64: true,
      });

      if (result.canceled) {
        console.log('📸 User cancelled photo');
        return;
      }

      if (!result.assets[0].base64) {
        Alert.alert(t('common.error'), t('restaurant.errors.imageProcessing'));
        return;
      }

      await processWineCardImage(result.assets[0].base64);
    } catch (error) {
      console.error('❌ Camera error:', error);
      Alert.alert(t('common.error'), t('restaurant.errors.imageProcessing'));
    }
  };

  const handleChooseFromGallery = async () => {
    try {
      const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
      
      if (status !== 'granted') {
        Alert.alert(t('common.error'), t('restaurant.errors.galleryPermission'));
        return;
      }

      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsEditing: true,
        aspect: [4, 3],
        quality: 0.8,
        base64: true,
      });

      if (result.canceled) {
        console.log('🖼️ User cancelled gallery selection');
        return;
      }

      if (!result.assets[0].base64) {
        Alert.alert(t('common.error'), t('restaurant.errors.imageProcessing'));
        return;
      }

      await processWineCardImage(result.assets[0].base64);
    } catch (error) {
      console.error('❌ Gallery error:', error);
      Alert.alert(t('common.error'), t('restaurant.errors.imageProcessing'));
    }
  };

  const processWineCardImage = async (base64Image: string) => {
    console.log('🔍 processWineCardImage - Starting OCR process');
    
    try {
      // Vérifier le cache d'abord
      const cached = await getCachedWineCard(base64Image);
      
      if (cached) {
        console.log('📦 Cache hit! Using cached wine card data');
        Alert.alert(
          'Carte reconnue !',
          `Cette carte de ${cached.restaurantName} a déjà été analysée. Utilisation des données en cache.`,
          [{ text: 'OK' }]
        );
        
        // Utiliser les données en cache
        const session = {
          id: cached.sessionId,
          restaurant_name: cached.restaurantName,
          extracted_wines: cached.wines,
          confidence_score: 0.9,
          session_active: true,
        };
        
        // Pas besoin d'appeler setCurrentSession car on utilise le hook
        return;
      }
      
      // Pas de cache, procéder au scan
      console.log('🔍 No cache found, proceeding with OCR scan');
      setOcrProgress(10);
      setOcrMessage(t('restaurant.analyzing'));
      
      const session = await scanWineCard(base64Image);
      
      if (session) {
        console.log('✅ Wine card scan successful');
        setOcrProgress(100);
        setOcrMessage('Analyse terminée !');
        
        // Mettre en cache pour la prochaine fois
        await setCachedWineCard(
          base64Image,
          session.id,
          session.restaurant_name,
          session.extracted_wines
        );
        
        // Reset progress after a short delay
        setTimeout(() => {
          setOcrProgress(0);
          setOcrMessage('');
        }, 1000);
      }
    } catch (error) {
      console.error('❌ processWineCardImage error:', error);
      setOcrProgress(0);
      setOcrMessage('');
      
      if (error.message?.includes('User cancelled')) {
        // Don't show error for user cancellation
        return;
      }
      
      Alert.alert(t('common.error'), error.message || t('restaurant.errors.imageProcessing'));
    }
  };

  const handleGetRestaurantRecommendations = async () => {
    console.log('🍽️ handleGetRestaurantRecommendations - Starting restaurant recommendations');
    
    if (!dishDescription.trim()) {
      Alert.alert(t('common.error'), t('restaurant.errors.describeDish'));
      return;
    }

    if (!currentSession) {
      Alert.alert(t('common.error'), t('restaurant.errors.noWines'));
      return;
    }

    setRecommendationLoading(true);

    try {
      const budgetValue = selectedBudget ? parseInt(selectedBudget.replace('€', '').replace('+', '')) : undefined;
      
      console.log('🤖 Calling restaurant recommendations with:', {
        dish: dishDescription,
        sessionId: currentSession.id,
        budget: budgetValue,
        wineType: selectedWineType
      });
      
      const recommendations = await getRestaurantRecommendations(
        dishDescription,
        currentSession.id,
        budgetValue,
        selectedWineType
      );

      console.log('✅ Restaurant recommendations received:', recommendations.length);

      // Store in temp store for navigation
      const sessionId = `restaurant_${Date.now()}`;
      tempStore.set(sessionId, { recommendations });

      setRecommendationLoading(false);
      
      router.push({
        pathname: '/recommendations',
        params: {
          dish: dishDescription,
          budget: budgetValue?.toString() || '',
          wineType: selectedWineType || '',
          mode: 'restaurant',
          restaurantName: currentSession.restaurant_name,
          sessionId,
        },
      });
    } catch (error) {
      console.error('💥 handleGetRestaurantRecommendations - Error:', error);
      setRecommendationLoading(false);
      Alert.alert(t('common.error'), error.message || 'Impossible de générer les recommandations');
    }
  };

  const handleNewScan = () => {
    clearSession();
    setDishDescription('');
    setSelectedBudget(null);
    setSelectedWineType(null);
  };

  if (loading || ocrProgress > 0) {
    return (
      <View style={styles.container}>
        <View style={styles.headerSection}>
          <LinearGradient
            colors={['#6B2B3A', '#8B4B5A']}
            style={styles.headerGradient}
          >
            <Text style={styles.headerTitle}>{t('restaurant.title')}</Text>
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
          {ocrProgress > 0 ? (
            <ProgressBar 
              progress={ocrProgress} 
              message={ocrMessage}
              color={Colors.primary}
            />
          ) : (
            <LoadingSpinner text={t('restaurant.analyzing')} />
          )}
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
          <Text style={styles.headerTitle}>{t('restaurant.title')}</Text>
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

      <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
        {!currentSession ? (
          // État initial - Scan de carte
          <View style={styles.scanSection}>
            <View style={styles.scanCard}>
              <View style={styles.scanIcon}>
                <Camera size={48} color={Colors.primary} />
              </View>
              
              <Text style={styles.scanTitle}>{t('restaurant.scanMenu')}</Text>
              <Text style={styles.scanDescription}>
                {t('restaurant.scanInstruction')}
              </Text>
              
              <Button
                title={t('restaurant.takePhoto')}
                onPress={handleScanWineCard}
                variant="primary"
                size="large"
                fullWidth
              />
            </View>
          </View>
        ) : (
          // État avec session active - Formulaire de recommandation
          <View style={styles.recommendationSection}>
            {/* Résumé de la session */}
            <View style={styles.sessionSummary}>
              <View style={styles.sessionHeader}>
                <Utensils size={24} color={Colors.primary} />
                <Text style={styles.sessionTitle}>
                  {currentSession.restaurant_name}
                </Text>
              </View>
              
              <Text style={styles.sessionSubtitle}>
                {t('restaurant.winesDetected', { count: currentSession.extracted_wines?.length || 0 })}
              </Text>
              
              <TouchableOpacity 
                style={styles.newScanButton}
                onPress={handleNewScan}
              >
                <Text style={styles.newScanText}>{t('restaurant.newScan')}</Text>
              </TouchableOpacity>
            </View>

            {/* Formulaire de plat */}
            <View style={styles.dishForm}>
              <Text style={styles.formTitle}>{t('restaurant.whatAreYouEating')}</Text>
              
              <TextInput
                style={styles.dishInput}
                placeholder={t('restaurant.describeDish')}
                placeholderTextColor={Colors.textLight}
                value={dishDescription}
                onChangeText={setDishDescription}
                multiline
                numberOfLines={2}
                maxLength={200}
              />
            </View>

            {/* Section budget */}
            <View style={styles.budgetSection}>
              <TouchableOpacity 
                style={styles.sectionHeader}
                onPress={() => setShowBudgetOptions(!showBudgetOptions)}
              >
                <View>
                  <Text style={styles.sectionTitle}>{t('restaurant.budgetPerBottle')}</Text>
                  <Text style={styles.sectionSubtitle}>
                    {selectedBudget || t('restaurant.optional')}
                  </Text>
                </View>
                <View style={styles.chevronContainer}>
                  <Text style={styles.chevron}>
                    {showBudgetOptions ? '−' : '+'}
                  </Text>
                </View>
              </TouchableOpacity>
              
              {showBudgetOptions && (
                <View style={styles.budgetGrid}>
                  {BUDGET_OPTIONS.map(budget => (
                    <TouchableOpacity
                      key={budget}
                      style={[
                        styles.budgetPill,
                        selectedBudget === budget && styles.budgetPillActive
                      ]}
                      onPress={() => {
                        setSelectedBudget(selectedBudget === budget ? null : budget);
                        setShowBudgetOptions(false);
                      }}
                    >
                      <Text style={[
                        styles.budgetText,
                        selectedBudget === budget && styles.budgetTextActive
                      ]}>
                        {budget}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>
              )}
            </View>

            {/* Section type de vin */}
            <View style={styles.wineTypeSection}>
              <TouchableOpacity 
                style={styles.sectionHeader}
                onPress={() => setShowWineTypeOptions(!showWineTypeOptions)}
              >
                <View>
                  <Text style={styles.sectionTitle}>{t('restaurant.wineTypePreferred')}</Text>
                  <Text style={styles.sectionSubtitle}>
                    {selectedWineType ? WINE_TYPES.find(type => type.id === selectedWineType)?.label : t('restaurant.optional')}
                  </Text>
                </View>
                <View style={styles.chevronContainer}>
                  <Text style={styles.chevron}>
                    {showWineTypeOptions ? '−' : '+'}
                  </Text>
                </View>
              </TouchableOpacity>
              
              {showWineTypeOptions && (
                <View style={styles.wineTypeGrid}>
                  {WINE_TYPES.map(type => (
                    <TouchableOpacity
                      key={type.id}
                      style={[
                        styles.wineTypePill,
                        selectedWineType === type.id && styles.wineTypePillActive,
                        selectedWineType === type.id && { backgroundColor: type.color }
                      ]}
                      onPress={() => {
                        setSelectedWineType(selectedWineType === type.id ? null : type.id);
                        setShowWineTypeOptions(false);
                      }}
                    >
                      <Text style={[
                        styles.wineTypeText,
                        selectedWineType === type.id && styles.wineTypeTextActive
                      ]}>
                        {type.label}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>
              )}
            </View>

            {/* Bouton de recommandation */}
            <Button
              title={recommendationLoading ? t('restaurant.analyzing') : t('restaurant.getMyRecommendations')}
              onPress={handleGetRestaurantRecommendations}
              variant="primary"
              size="large"
              fullWidth
              loading={recommendationLoading}
            />
          </View>
        )}
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
    paddingHorizontal: 24,
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
  },
  wave: {
    position: 'absolute',
    bottom: -1,
    left: 0,
    right: 0,
  },
  content: {
    flex: 1,
    paddingHorizontal: 24,
    paddingTop: 20,
  },
  scanSection: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 40,
  },
  scanCard: {
    backgroundColor: 'white',
    borderRadius: 24,
    padding: 32,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.12,
    shadowRadius: 24,
    elevation: 8,
    width: '100%',
    maxWidth: 320,
  },
  scanIcon: {
    width: 96,
    height: 96,
    borderRadius: 48,
    backgroundColor: Colors.softGray,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 24,
  },
  scanTitle: {
    fontSize: Typography.sizes.xl,
    fontWeight: Typography.weights.bold,
    color: Colors.textPrimary,
    textAlign: 'center',
    marginBottom: 12,
  },
  scanDescription: {
    fontSize: Typography.sizes.base,
    color: Colors.textSecondary,
    textAlign: 'center',
    lineHeight: Typography.sizes.base * Typography.lineHeights.relaxed,
    marginBottom: 32,
  },
  recommendationSection: {
    paddingBottom: 40,
  },
  sessionSummary: {
    backgroundColor: 'white',
    borderRadius: 20,
    padding: 20,
    marginBottom: 24,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.08,
    shadowRadius: 20,
    elevation: 5,
  },
  sessionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  sessionTitle: {
    fontSize: Typography.sizes.lg,
    fontWeight: Typography.weights.bold,
    color: Colors.textPrimary,
    marginLeft: 12,
  },
  sessionSubtitle: {
    fontSize: Typography.sizes.base,
    color: Colors.textSecondary,
    marginBottom: 16,
  },
  newScanButton: {
    alignSelf: 'flex-start',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 16,
    backgroundColor: Colors.softGray,
  },
  newScanText: {
    fontSize: Typography.sizes.sm,
    color: Colors.primary,
    fontWeight: Typography.weights.semibold,
  },
  dishForm: {
    backgroundColor: 'white',
    borderRadius: 20,
    padding: 20,
    marginBottom: 24,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.08,
    shadowRadius: 20,
    elevation: 5,
  },
  formTitle: {
    fontSize: Typography.sizes.lg,
    fontWeight: Typography.weights.bold,
    color: Colors.textPrimary,
    marginBottom: 16,
  },
  dishInput: {
    borderWidth: 1,
    borderColor: Colors.softGray,
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 12,
    fontSize: Typography.sizes.base,
    color: Colors.textPrimary,
    backgroundColor: Colors.accent,
    minHeight: 80,
    textAlignVertical: 'top',
  },
  budgetSection: {
    marginBottom: 24,
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 16,
    paddingHorizontal: 20,
    backgroundColor: 'white',
    borderRadius: 20,
    marginBottom: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.04,
    shadowRadius: 8,
    elevation: 2,
  },
  chevronContainer: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#F5F5F5',
    justifyContent: 'center',
    alignItems: 'center',
  },
  chevron: {
    fontSize: 20,
    color: '#6B2B3A',
    fontWeight: '600',
  },
  sectionTitle: {
    fontSize: Typography.sizes.base,
    fontWeight: Typography.weights.semibold,
    color: Colors.textPrimary,
  },
  sectionSubtitle: {
    fontSize: Typography.sizes.sm,
    color: Colors.textSecondary,
    marginTop: 2,
  },
  budgetGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
  },
  budgetPill: {
    backgroundColor: 'white',
    paddingVertical: 12,
    paddingHorizontal: 20,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: Colors.softGray,
    minWidth: '30%',
    flex: 1,
    maxWidth: '48%',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.04,
    shadowRadius: 8,
    elevation: 2,
  },
  budgetPillActive: {
    backgroundColor: Colors.primary,
    borderColor: Colors.primary,
  },
  budgetText: {
    fontSize: Typography.sizes.base,
    fontWeight: Typography.weights.medium,
    color: Colors.textPrimary,
  },
  budgetTextActive: {
    color: Colors.accent,
  },
  wineTypeSection: {
    marginBottom: 32,
  },
  wineTypeGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
    justifyContent: 'space-between',
  },
  wineTypePill: {
    backgroundColor: 'white',
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: Colors.softGray,
    width: '48%',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.04,
    shadowRadius: 8,
    elevation: 2,
  },
  wineTypePillActive: {
    borderColor: 'transparent',
  },
  wineTypeText: {
    fontSize: Typography.sizes.base,
    fontWeight: Typography.weights.medium,
    color: Colors.textPrimary,
  },
  wineTypeTextActive: {
    color: Colors.accent,
    fontWeight: Typography.weights.semibold,
  },
});