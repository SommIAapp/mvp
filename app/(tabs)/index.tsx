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
import { LoadingSpinner } from '@/components/LoadingSpinner';
import { useAuth } from '@/hooks/useAuth';
import { useRecommendations } from '@/hooks/useRecommendations';

const { width } = Dimensions.get('window');

const BUDGET_OPTIONS = ['€10', '€20', '€30', '€50+'];

export default function HomeScreen() {
  const router = useRouter();
  const { user, profile, loading, canMakeRecommendation, updateUsageCount } = useAuth();
  const { getRecommendations, getRecommendationsFromPhoto } = useRecommendations();
  const [dishDescription, setDishDescription] = useState('');
  const [selectedBudget, setSelectedBudget] = useState<string | null>(null);
  const [recommendationLoading, setRecommendationLoading] = useState(false);

  useEffect(() => {
    console.log('🏡 Home: Component mounted');
    return () => {
      console.log('🏡 Home: Component unmounted');
    };
  }, []);

  // Show loading spinner while profile is being loaded
  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <LoadingSpinner text="Chargement..." />
      </View>
    );
  }

  const firstName = profile?.full_name?.split(' ')[0] || user?.email?.split('@')[0] || 'ami';

  const handleGetRecommendations = async () => {
    console.log('🎯 handleGetRecommendations - Starting TEXT_ONLY recommendation request');
    console.log('👤 handleGetRecommendations - Current user:', user);
    console.log('📋 handleGetRecommendations - Current profile:', profile);
    
    if (!dishDescription.trim()) {
      Alert.alert('Erreur', 'Peux-tu décrire ton plat plus précisément ?');
      return;
    }

    console.log('📊 handleGetRecommendations - Checking quota eligibility');
    console.log('👤 handleGetRecommendations - User:', user?.id);
    console.log('📋 handleGetRecommendations - Profile:', profile);
    
    if (!canMakeRecommendation()) {
      console.log('🚫 handleGetRecommendations - Quota exceeded, showing paywall');
      
      // Determine the reason for showing paywall
      let reason: 'daily_limit' | 'trial_expired' | 'trial_signup' = 'daily_limit';
      
      if (!profile) {
        console.log('📝 handleGetRecommendations - No profile, trial signup needed');
        reason = 'trial_signup';
      } else if (profile.subscription_plan === 'free' && !profile.trial_start_date) {
        console.log('🆓 handleGetRecommendations - Free user, trial signup needed');
        reason = 'trial_signup';
      } else if (profile.subscription_plan === 'trial' && (profile.daily_count || 0) >= 1) {
        console.log('📅 handleGetRecommendations - Trial daily limit reached');
        reason = 'daily_limit';
      } else if (profile.subscription_plan === 'trial' || profile.subscription_plan === 'free') {
        console.log('⏰ handleGetRecommendations - Trial expired');
        reason = 'trial_expired';
      }
      
      console.log('🎯 handleGetRecommendations - Navigating to subscription with reason:', reason);
      router.push({
        pathname: '/subscription',
        params: { reason }
      });
      return;
    }

    console.log('✅ handleGetRecommendations - Quota check passed, proceeding with recommendation');
    setRecommendationLoading(true);

    try {
      console.log('🤖 handleGetRecommendations - Calling AI recommendation service');
      console.log('📝 handleGetRecommendations - Request params:', {
        dishDescription,
        budget: selectedBudget,
        userId: user?.id
      });
      
      const budgetValue = selectedBudget ? parseInt(selectedBudget.replace('€', '').replace('+', '')) : undefined;
      const recommendations = await getRecommendations(
        dishDescription,
        budgetValue
      );

      console.log('✅ handleGetRecommendations - Recommendations received:', recommendations);

      // Update usage count for free users
      if (profile?.subscription_plan !== 'premium') {
        console.log('📈 handleGetRecommendations - Updating usage count');
        try {
          await updateUsageCount();
          console.log('✅ handleGetRecommendations - Usage count updated successfully');
        } catch (usageError) {
          console.error('❌ handleGetRecommendations - Usage count update failed:', usageError);
          Alert.alert('Erreur', `Impossible de mettre à jour le compteur d'utilisation: ${usageError.message}`);
          setRecommendationLoading(false);
          return;
        }
      }

      setRecommendationLoading(false);
      console.log('🎉 handleGetRecommendations - Success! Navigating to results');
      router.push({
        pathname: '/recommendations',
        params: {
          dish: dishDescription,
          budget: budgetValue?.toString() || '',
          recommendations: JSON.stringify(recommendations),
        },
      });
    } catch (error) {
      console.error('💥 handleGetRecommendations - Error:', error);
      console.error('🔍 handleGetRecommendations - Error details:', {
        message: error.message,
        stack: error.stack,
        name: error.name
      });
      setRecommendationLoading(false);
      Alert.alert('Erreur', `Impossible de générer les recommandations: ${error.message}`);
    }
  };

  const handleCameraPress = () => {
    Alert.alert(
      'Mode Photo',
      'Comment souhaitez-vous ajouter votre photo ?',
      [
        { text: 'Annuler', style: 'cancel' },
        { text: '📸 Prendre une photo', onPress: handlePhotoRecommendations },
        { text: '🖼️ Choisir depuis galerie', onPress: handleGalleryRecommendations },
      ]
    );
  };

  const handlePhotoRecommendations = async () => {
    console.log('📸 handlePhotoRecommendations - Starting DISH_PHOTO recommendation request');
    
    if (!canMakeRecommendation()) {
      console.log('🚫 handlePhotoRecommendations - Quota exceeded, showing paywall');
      
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
        Alert.alert('Permission requise', 'L\'accès à la caméra est nécessaire pour prendre une photo de votre plat.');
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
        console.log('📸 handlePhotoRecommendations - User cancelled photo');
        return;
      }

      if (!result.assets[0].base64) {
        Alert.alert('Erreur', 'Impossible de traiter l\'image. Veuillez réessayer.');
        return;
      }

      setRecommendationLoading(true);

      console.log('🤖 handlePhotoRecommendations - Calling photo recommendation service');
      
      const budgetValue = selectedBudget ? parseInt(selectedBudget.replace('€', '').replace('+', '')) : undefined;
      const recommendations = await getRecommendationsFromPhoto(
        result.assets[0].base64,
        budgetValue
      );

      console.log('✅ handlePhotoRecommendations - Photo recommendations received:', recommendations);

      // Update usage count for non-premium users
      if (profile?.subscription_plan !== 'premium') {
        console.log('📈 handlePhotoRecommendations - Updating usage count');
        try {
          await updateUsageCount();
          console.log('✅ handlePhotoRecommendations - Usage count updated successfully');
        } catch (usageError) {
          console.error('❌ handlePhotoRecommendations - Usage count update failed:', usageError);
          Alert.alert('Erreur', `Impossible de mettre à jour le compteur d'utilisation: ${usageError.message}`);
          setRecommendationLoading(false);
          return;
        }
      }

      setRecommendationLoading(false);
      console.log('🎉 handlePhotoRecommendations - Success! Navigating to results');
      router.push({
        pathname: '/recommendations',
        params: {
          dish: 'Photo de plat',
          budget: selectedBudget?.toString() || '',
          recommendations: JSON.stringify(recommendations),
          photoMode: 'true',
        },
      });
    } catch (error) {
      console.error('💥 handlePhotoRecommendations - Error:', error);
      setRecommendationLoading(false);
      Alert.alert('Erreur', `Impossible de générer les recommandations: ${error.message}`);
    }
  };

  const handleGalleryRecommendations = async () => {
    console.log('🖼️ handleGalleryRecommendations - Starting DISH_PHOTO (gallery) recommendation request');
    
    if (!canMakeRecommendation()) {
      console.log('🚫 handleGalleryRecommendations - Quota exceeded, showing paywall');
      
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
        Alert.alert('Permission requise', 'L\'accès à la galerie est nécessaire pour choisir une photo de votre plat.');
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
        console.log('🖼️ handleGalleryRecommendations - User cancelled selection');
        return;
      }

      if (!result.assets[0].base64) {
        Alert.alert('Erreur', 'Impossible de traiter l\'image. Veuillez réessayer.');
        return;
      }

      setRecommendationLoading(true);

      console.log('🤖 handleGalleryRecommendations - Calling photo recommendation service');
      
      const budgetValue = selectedBudget ? parseInt(selectedBudget.replace('€', '').replace('+', '')) : undefined;
      const recommendations = await getRecommendationsFromPhoto(
        result.assets[0].base64,
        budgetValue
      );

      console.log('✅ handleGalleryRecommendations - Photo recommendations received:', recommendations);

      // Update usage count for non-premium users
      if (profile?.subscription_plan !== 'premium') {
        console.log('📈 handleGalleryRecommendations - Updating usage count');
        try {
          await updateUsageCount();
          console.log('✅ handleGalleryRecommendations - Usage count updated successfully');
        } catch (usageError) {
          console.error('❌ handleGalleryRecommendations - Usage count update failed:', usageError);
          Alert.alert('Erreur', `Impossible de mettre à jour le compteur d'utilisation: ${usageError.message}`);
          setRecommendationLoading(false);
          return;
        }
      }

      setRecommendationLoading(false);
      console.log('🎉 handleGalleryRecommendations - Success! Navigating to results');
      router.push({
        pathname: '/recommendations',
        params: {
          dish: 'Photo de plat',
          budget: selectedBudget?.toString() || '',
          recommendations: JSON.stringify(recommendations),
          photoMode: 'true',
        },
      });
    } catch (error) {
      console.error('💥 handleGalleryRecommendations - Error:', error);
      setRecommendationLoading(false);
      Alert.alert('Erreur', `Impossible de générer les recommandations: ${error.message}`);
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
          height="30"
          width="100%"
          viewBox="0 0 400 30"
          style={styles.wave}
          preserveAspectRatio="none"
        >
          <Path
            d="M0,15 Q100,0 200,10 T400,15 L400,30 L0,30 Z"
            fill="#FAF6F0"
          />
        </Svg>
      </View>

      <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
        {/* Input premium flottant */}
        <View style={styles.inputCard}>
          <TextInput
            style={styles.input}
            placeholder="Décris ton plat ou prends-le en photo"
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
          <Text style={styles.sectionTitle}>Budget par bouteille</Text>
          <Text style={styles.sectionSubtitle}>Optionnel</Text>
          
          <View style={styles.budgetGrid}>
            {BUDGET_OPTIONS.map(budget => (
              <TouchableOpacity
                key={budget}
                style={[
                  styles.budgetPill,
                  selectedBudget === budget && styles.budgetPillActive
                ]}
                onPress={() => setSelectedBudget(selectedBudget === budget ? null : budget)}
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
        </View>

        {/* CTA Premium */}
        <TouchableOpacity 
          style={styles.ctaButton}
          onPress={handleGetRecommendations}
          disabled={recommendationLoading}
        >
          <Text style={styles.ctaText}>
            {recommendationLoading ? "Recommandation en cours..." : "Obtenir des recommandations"}
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
    paddingBottom: 30,
    position: 'relative',
  },
  headerTitle: {
    fontSize: 36,
    fontWeight: '700',
    color: 'white',
    textAlign: 'center',
    letterSpacing: 1.5,
    marginTop: 60,
    marginBottom: 40,
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
    borderRadius: 20,
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
  ctaButton: {
    marginHorizontal: 20,
    marginTop: 40,
    marginBottom: 40,
    backgroundColor: '#6B2B3A',
    paddingVertical: 18,
    borderRadius: 26,
    shadowColor: '#6B2B3A',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.3,
    shadowRadius: 16,
    elevation: 8,
    alignItems: 'center',
  },
  ctaText: {
    fontSize: 18,
    fontWeight: '600',
    color: 'white',
  },
});