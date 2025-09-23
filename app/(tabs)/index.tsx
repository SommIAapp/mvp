import React, { useState, useEffect } from 'react';
import { 
  View, 
  Text, 
  StyleSheet, 
  ScrollView, 
  TouchableOpacity,
  Alert,
  Dimensions,
  TextInput,
} from 'react-native';
import { useRouter } from 'expo-router';
import { Camera, User } from 'lucide-react-native';
import * as ImagePicker from 'expo-image-picker';
import { LinearGradient } from 'expo-linear-gradient';
import Svg, { Path } from 'react-native-svg';
import { Colors } from '@/constants/Colors';
import { Typography } from '@/constants/Typography';
import { useTranslation } from '@/hooks/useTranslation';
import { sanitizeForLogging } from '@/utils/secureLogging';
import { LoadingSpinner } from '@/components/LoadingSpinner';
import { useAuth } from '@/hooks/useAuth';
import { useRecommendations } from '@/hooks/useRecommendations';
import { Analytics } from '@/utils/analytics';

const { width } = Dimensions.get('window');

const BUDGET_OPTIONS = ['€10', '€20', '€30', '€50+'];

const WINE_TYPES = [
  { id: 'rouge', label: 'Rouge', color: '#6B2B3A' },
  { id: 'blanc', label: 'Blanc', color: '#D4C5A0' },
  { id: 'rose', label: 'Rosé', color: '#F5B5A3' },
  { id: 'champagne', label: 'Champagne', color: '#D4AF37' },
];

export default function HomeScreen() {
  const router = useRouter();
  const { t } = useTranslation();
  const { user, profile, loading, canMakeRecommendation, updateUsageCount } = useAuth();
  const { getRecommendations, getRecommendationsFromPhoto } = useRecommendations();
  const [dishDescription, setDishDescription] = useState('');
  const [selectedBudget, setSelectedBudget] = useState<string | null>(null);
  const [selectedWineType, setSelectedWineType] = useState<string | null>(null);
  const [recommendationLoading, setRecommendationLoading] = useState(false);
  const [showBudgetOptions, setShowBudgetOptions] = useState(false);
  const [showWineTypeOptions, setShowWineTypeOptions] = useState(false);

  useEffect(() => {
    if (__DEV__) {
      console.log('🏡 Home: Component mounted');
    }
    return () => {
      if (__DEV__) {
        console.log('🏡 Home: Component unmounted');
      }
    };
  }, []);

  // Show loading spinner while profile is being loaded
  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <LoadingSpinner text={t('home.loading')} />
      </View>
    );
  }

  const firstName = profile?.full_name?.split(' ')[0] || user?.email?.split('@')[0] || 'ami';

  const handleGetRecommendations = async () => {
    if (!dishDescription.trim()) {
      Alert.alert(t('home.error'), t('home.describeDishError'));
      return;
    }

    if (!canMakeRecommendation()) {
      // Determine the reason for showing paywall
      let reason: 'daily_limit' | 'trial_expired' | 'trial_signup' = 'daily_limit';
      
      if (!profile) {
        reason = 'trial_signup';
      } else if (profile.subscription_plan === 'free' && !profile.trial_start_date) {
        reason = 'trial_signup';
      } else if (profile.subscription_plan === 'trial' && (profile.daily_count || 0) >= 1) {
        reason = 'daily_limit';
      } else if (profile.subscription_plan === 'trial' || profile.subscription_plan === 'free') {
        reason = 'trial_expired';
      }
      
      router.push({
        pathname: '/subscription',
        params: { reason }
      });
      return;
    }

    setRecommendationLoading(true);

    try {
      const budgetValue = selectedBudget ? parseInt(selectedBudget.replace('€', '').replace('+', '')) : undefined;
      // Track recommendation event
      Analytics.track('Recommendation Made', { 
        mode: 'text',
        budget: selectedBudget,
        wineType: selectedWineType 
      });
      const recommendations = await getRecommendations(
        dishDescription,
        budgetValue,
        undefined, // timestamp
        selectedWineType
      );


      // Vérifier qu'on a bien des recommendations
      if (!recommendations || recommendations.length === 0) {
        setRecommendationLoading(false); // IMPORTANT : Remettre le bouton à l'état normal
        return; // Ne pas continuer
      }
      // Update usage count for free users
      if (profile?.subscription_plan !== 'premium') {
        try {
          await updateUsageCount();
        } catch (usageError) {
          console.error('❌ handleGetRecommendations - Usage count update failed:', usageError);
          Alert.alert(t('home.error'), `${t('home.usageUpdateError')}: ${usageError.message}`);
          setRecommendationLoading(false);
          return;
        }
      }

      setRecommendationLoading(false);
      router.push({
        pathname: '/recommendations',
        params: {
          dish: dishDescription,
          budget: budgetValue?.toString() || '',
          wineType: selectedWineType || '',
          recommendations: JSON.stringify(recommendations),
        },
      });
    } catch (error) {
      console.error('💥 handleGetRecommendations - Error:', error);
      setRecommendationLoading(false);
      // L'erreur a déjà été gérée dans useRecommendations
    } finally {
      // Toujours remettre à false à la fin (sauf si navigation réussie)
      // Note: si navigation réussie, le composant sera démonté donc pas besoin
    }
  };

  const handleCameraPress = () => {
    Alert.alert(
      t('home.photoMode'),
      t('home.photoModeDescription'),
      [
        { text: t('home.cancel'), style: 'cancel' },
        { text: t('home.takePhoto'), onPress: handlePhotoRecommendations },
        { text: t('home.chooseFromGallery'), onPress: handleGalleryRecommendations },
      ]
    );
  };

  const handlePhotoRecommendations = async () => {
    if (!canMakeRecommendation()) {
      let reason: 'daily_limit' | 'trial_expired' | 'trial_signup' = 'daily_limit';
      
      if (!profile) {
        reason = 'trial_signup';
      } else if (profile.subscription_plan === 'free' && !profile.trial_start_date) {
        reason = 'trial_signup';
      } else if (profile.subscription_plan === 'trial' && (profile.daily_count || 0) >= 1) {
        reason = 'daily_limit';
      } else if (profile.subscription_plan === 'trial' || profile.subscription_plan === 'free') {
        reason = 'trial_expired';
      }
      
      router.push({
        pathname: '/subscription',
        params: { reason }
      });
      return;
    }

    try {
      // Request camera permissions
      const { status } = await ImagePicker.requestCameraPermissionsAsync();
      
      if (status !== 'granted') {
        Alert.alert(t('home.permissionRequired'), t('home.cameraPermission'));
        return;
      }

      // Launch camera
      const result = await ImagePicker.launchCameraAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsEditing: true,
        aspect: [4, 3],
        quality: 0.8,
        base64: true,
      });

      if (result.canceled) {
        return;
      }

      if (!result.assets[0].base64) {
        Alert.alert(t('home.error'), t('home.imageProcessError'));
        return;
      }

      setRecommendationLoading(true);

      const budgetValue = selectedBudget ? parseInt(selectedBudget.replace('€', '').replace('+', '')) : undefined;
      // Track photo recommendation event
      Analytics.track('Recommendation Made', { 
        mode: 'photo_camera',
        budget: selectedBudget,
        wineType: selectedWineType 
      });
      const recommendations = await getRecommendationsFromPhoto(
        result.assets[0].base64,
        budgetValue,
        selectedWineType
      );


      // Update usage count for non-premium users
      if (profile?.subscription_plan !== 'premium') {
        try {
          await updateUsageCount();
        } catch (usageError) {
          console.error('❌ handlePhotoRecommendations - Usage count update failed:', usageError);
          Alert.alert(t('home.error'), `${t('home.usageUpdateError')}: ${usageError.message}`);
          setRecommendationLoading(false);
          return;
        }
      }

      setRecommendationLoading(false);
      router.push({
        pathname: '/recommendations',
        params: {
          dish: t('home.dishLabel'),
          budget: selectedBudget?.toString() || '',
          wineType: selectedWineType || '',
          recommendations: JSON.stringify(recommendations),
          photoMode: 'true',
        },
      });
    } catch (error) {
      console.error('💥 handlePhotoRecommendations - Error:', error);
      setRecommendationLoading(false);
      Alert.alert(t('home.error'), `${t('home.recommendationError')}: ${error.message}`);
    }
  };

  const handleGalleryRecommendations = async () => {
    if (!canMakeRecommendation()) {
      let reason: 'daily_limit' | 'trial_expired' | 'trial_signup' = 'daily_limit';
      
      if (!profile) {
        reason = 'trial_signup';
      } else if (profile.subscription_plan === 'free' && !profile.trial_start_date) {
        reason = 'trial_signup';
      } else if (profile.subscription_plan === 'trial' && (profile.daily_count || 0) >= 1) {
        reason = 'daily_limit';
      } else if (profile.subscription_plan === 'trial' || profile.subscription_plan === 'free') {
        reason = 'trial_expired';
      }
      
      router.push({
        pathname: '/subscription',
        params: { reason }
      });
      return;
    }

    try {
      // Request media library permissions
      const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
      
      if (status !== 'granted') {
        Alert.alert(t('home.permissionRequired'), t('home.galleryPermission'));
        return;
      }

      // Launch image library
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsEditing: true,
        aspect: [4, 3],
        quality: 0.8,
        base64: true,
      });

      if (result.canceled) {
        return;
      }

      if (!result.assets[0].base64) {
        Alert.alert(t('home.error'), t('home.imageProcessError'));
        return;
      }

      setRecommendationLoading(true);

      const budgetValue = selectedBudget ? parseInt(selectedBudget.replace('€', '').replace('+', '')) : undefined;
      // Track gallery recommendation event
      Analytics.track('Recommendation Made', { 
        mode: 'photo_gallery',
        budget: selectedBudget,
        wineType: selectedWineType 
      });
      const recommendations = await getRecommendationsFromPhoto(
        result.assets[0].base64,
        budgetValue,
        selectedWineType
      );


      // Update usage count for non-premium users
      if (profile?.subscription_plan !== 'premium') {
        try {
          await updateUsageCount();
        } catch (usageError) {
          console.error('❌ handleGalleryRecommendations - Usage count update failed:', usageError);
          Alert.alert(t('home.error'), `${t('home.usageUpdateError')}: ${usageError.message}`);
          setRecommendationLoading(false);
          return;
        }
      }

      setRecommendationLoading(false);
      router.push({
        pathname: '/recommendations',
        params: {
          dish: t('home.dishLabel'),
          budget: selectedBudget?.toString() || '',
          wineType: selectedWineType || '',
          recommendations: JSON.stringify(recommendations),
          photoMode: 'true',
        },
      });
    } catch (error) {
      console.error('💥 handleGalleryRecommendations - Error:', error);
      setRecommendationLoading(false);
      Alert.alert(t('home.error'), `${t('home.recommendationError')}: ${error.message}`);
    }
  };

  return (
    <View style={styles.container}>
      {/* Header avec gradient et vague */}
      <View style={styles.headerSection}>
        <LinearGradient
          colors={['#6B2B3A', '#8B4B5A']}
          style={styles.headerGradient}
        >
          {/* Titre SOMMIA centré */}
          <Text style={styles.headerTitle}>SOMMIA</Text>
          
          {/* Avatar à droite */}
          <TouchableOpacity 
            style={styles.avatarButton}
            onPress={() => router.push('/(tabs)/profile')}
          >
            <User size={24} color="white" />
          </TouchableOpacity>
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

      <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
        {/* Input premium flottant */}
        <View style={styles.inputCard}>
          <TextInput
            style={styles.input}
            placeholder={t('home.dishPlaceholder')}
            placeholderTextColor="#999"
            value={dishDescription}
            onChangeText={setDishDescription}
            multiline
            numberOfLines={2}
            maxLength={200}
          />
          <TouchableOpacity 
            style={styles.cameraButton}
            onPress={handleCameraPress}
          >
            <Camera size={24} color="white" />
          </TouchableOpacity>
        </View>

        {/* Section budget élégante */}
        <View style={styles.budgetSection}>
          <TouchableOpacity 
            style={styles.sectionHeader}
            onPress={() => setShowBudgetOptions(!showBudgetOptions)}
          >
            <View>
              <Text style={styles.sectionTitle}>{t('home.budgetSection')}</Text>
              <Text style={styles.sectionSubtitle}>
                {selectedBudget || t('home.budgetOptional')}
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
              <Text style={styles.sectionTitle}>{t('home.wineTypeSection')}</Text>
              <Text style={styles.sectionSubtitle}>
                {selectedWineType ? WINE_TYPES.find(type => type.id === selectedWineType)?.label : t('home.wineTypeOptional')}
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

        {/* CTA Premium */}
        <TouchableOpacity 
          style={styles.ctaButton}
          onPress={handleGetRecommendations}
          disabled={recommendationLoading}
        >
          <Text style={styles.ctaText}>
            {recommendationLoading ? t('home.gettingRecommendations') : t('home.getRecommendations')}
          </Text>
        </TouchableOpacity>
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
  headerSection: {
    position: 'relative',
  },
  headerGradient: {
    paddingTop: 60,
    paddingHorizontal: 20,
    paddingBottom: 50,
    position: 'relative',
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
  avatarButton: {
    position: 'absolute',
    top: 60,
    right: 20,
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: 'rgba(255,255,255,0.2)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  wave: {
    position: 'absolute',
    bottom: -1,
    left: 0,
    right: 0,
  },
  content: {
    flex: 1,
    marginTop: -20, // Pour chevaucher légèrement la vague
  },
  inputCard: {
    backgroundColor: 'white',
    marginHorizontal: 20,
    marginTop: 50,
    borderRadius: 24,
    padding: 16,
    flexDirection: 'row',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.08,
    shadowRadius: 20,
    elevation: 5,
  },
  input: {
    flex: 1,
    fontSize: 16,
    color: '#333',
    minHeight: 48,
    textAlignVertical: 'top',
  },
  cameraButton: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: '#6B2B3A',
    justifyContent: 'center',
    alignItems: 'center',
    marginLeft: 12,
  },
  budgetSection: {
    marginTop: 32,
    paddingHorizontal: 20,
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
    fontSize: 20,
    fontWeight: '600',
    color: '#2C2C2C',
    marginBottom: 4,
  },
  sectionSubtitle: {
    fontSize: 14,
    color: '#999',
    marginBottom: 16,
  },
  budgetGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
  },
  budgetPill: {
    backgroundColor: 'white',
    paddingVertical: 14,
    paddingHorizontal: 24,
    borderRadius: 26,
    borderWidth: 1,
    borderColor: '#E0E0E0',
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
    backgroundColor: '#6B2B3A',
    borderColor: '#6B2B3A',
  },
  budgetText: {
    fontSize: 16,
    fontWeight: '500',
    color: '#333',
  },
  budgetTextActive: {
    color: 'white',
  },
  wineTypeSection: {
    marginTop: 32,
    paddingHorizontal: 20,
  },
  wineTypeGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
    justifyContent: 'space-between',
  },
  wineTypePill: {
    backgroundColor: 'white',
    paddingVertical: 14,
    paddingHorizontal: 20,
    borderRadius: 26,
    borderWidth: 1,
    borderColor: '#E0E0E0',
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
    fontSize: 16,
    fontWeight: '500',
    color: '#333',
  },
  wineTypeTextActive: {
    color: 'white',
    fontWeight: '600',
  },
  ctaButton: {
    marginHorizontal: 20,
    marginTop: 40,
    marginBottom: 40,
    backgroundColor: '#6B2B3A',
    paddingVertical: 18,
    paddingHorizontal: 32,
    borderRadius: 26,
    shadowColor: '#6B2B3A',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 12,
    elevation: 5,
    alignItems: 'center',
  },
  ctaText: {
    fontSize: 18,
    fontWeight: '600',
    color: 'white',
  },
});