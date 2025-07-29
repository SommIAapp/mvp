import React, { useState, useEffect } from 'react';
import { 
  View, 
  Text, 
  StyleSheet, 
  ScrollView, 
  TouchableOpacity,
  Alert,
  Dimensions,
  Image,
} from 'react-native';
import { useRouter } from 'expo-router';
import { Camera, User, Image as ImageIcon } from 'lucide-react-native';
import * as ImagePicker from 'expo-image-picker';
import { Colors } from '@/constants/Colors';
import { Typography } from '@/constants/Typography';
import { Button } from '@/components/Button';
import { Input } from '@/components/Input';
import { LoadingSpinner } from '@/components/LoadingSpinner';
import { useAuth } from '@/hooks/useAuth';
import { useRecommendations } from '@/hooks/useRecommendations';

const { width } = Dimensions.get('window');

const BUDGET_OPTIONS = [5, 10, 20, 30];

export default function HomeScreen() {
  const router = useRouter();
  const { user, profile, loading, canMakeRecommendation, updateUsageCount } = useAuth();
  const { getRecommendations, getRecommendationsFromPhoto } = useRecommendations();
  const [dishDescription, setDishDescription] = useState('');
  const [budget, setBudget] = useState<number | null>(null);
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

  const handleGetRecommendations = async () => {
    console.log('🎯 handleGetRecommendations - Starting recommendation request');
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
        budget,
        userId: user?.id
      });
      
      const recommendations = await getRecommendations(
        dishDescription,
        budget || undefined
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
          budget: budget?.toString() || '',
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

  const handleSuggestionPress = (suggestion: string) => {
    setDishDescription(suggestion);
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
    console.log('📸 handlePhotoRecommendations - Starting photo recommendation request');
    
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
      
      const recommendations = await getRecommendationsFromPhoto(
        result.assets[0].base64,
        budget || undefined
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
          budget: budget?.toString() || '',
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
    console.log('🖼️ handleGalleryRecommendations - Starting gallery recommendation request');
    
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
      
      const recommendations = await getRecommendationsFromPhoto(
        result.assets[0].base64,
        budget || undefined
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
          budget: budget?.toString() || '',
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
    <ScrollView style={styles.container} showsVerticalScrollIndicator={false}>
      <View style={styles.header}>
        <View style={styles.headerLeft}>
          <Image
            source={require('../../assets/images/sommia-logo.png')}
            style={styles.logoImage}
            resizeMode="contain"
          />
          <Text style={styles.logo}>SOMMIA</Text>
        </View>
        <TouchableOpacity 
          style={styles.profileButton}
          onPress={() => router.push('/(tabs)/profile')}
        >
          <User size={24} color={Colors.primary} />
        </TouchableOpacity>
      </View>

      <View style={styles.content}>
        <View style={styles.greetingSection}>
          <Text style={styles.greeting}>
            Bonjour {profile?.full_name || user?.email?.split('@')[0]}, que manges-tu ?
          </Text>
          <Text style={styles.photoHint}>
            💡 Nouveau : Prenez une photo de votre plat pour des recommandations ultra-précises !
          </Text>
        </View>

        <View style={styles.inputSection}>
          <View style={styles.inputCard}>
            <Input
              placeholder="Décris ton plat ou prends une photo..."
              value={dishDescription}
              onChangeText={setDishDescription}
              multiline
              numberOfLines={3}
              maxLength={200}
            />
            <TouchableOpacity 
              style={styles.cameraButton}
              onPress={handleCameraPress}
            >
              <Camera size={24} color={Colors.accent} />
            </TouchableOpacity>
          </View>
        </View>

        <View style={styles.photoModeSection}>
          <Text style={styles.photoModeTitle}>Mode Photo</Text>
          <Text style={styles.photoModeDescription}>
            Laissez l'IA analyser votre plat directement
          </Text>
          
          <View style={styles.photoButtons}>
            <TouchableOpacity 
              style={styles.photoModeButton}
              onPress={handlePhotoRecommendations}
              disabled={recommendationLoading}
            >
              <Camera size={24} color={Colors.accent} />
              <Text style={styles.photoModeButtonText}>Photographier</Text>
            </TouchableOpacity>
            
            <TouchableOpacity 
              style={styles.photoModeButton}
              onPress={handleGalleryRecommendations}
              disabled={recommendationLoading}
            >
              <ImageIcon size={24} color={Colors.accent} />
              <Text style={styles.photoModeButtonText}>Galerie</Text>
            </TouchableOpacity>
          </View>
        </View>

        <View style={styles.budgetSection}>
          <Text style={styles.sectionTitle}>Budget par bouteille (optionnel)</Text>
          <View style={styles.budgetOptions}>
            {BUDGET_OPTIONS.map((option) => (
              <TouchableOpacity
                key={option}
                style={[
                  styles.budgetOption,
                  budget === option && styles.budgetOptionSelected,
                ]}
                onPress={() => setBudget(budget === option ? null : option)}
              >
                <Text
                  style={[
                    styles.budgetOptionText,
                    budget === option && styles.budgetOptionTextSelected,
                  ]}
                >
                  €{option}
                </Text>
              </TouchableOpacity>
            ))}
            <TouchableOpacity
              style={[
                styles.budgetOption,
                budget && budget > 50 && styles.budgetOptionSelected,
              ]}
              onPress={() => setBudget(budget && budget > 50 ? null : 100)}
            >
              <Text
                style={[
                  styles.budgetOptionText,
                  budget && budget > 50 && styles.budgetOptionTextSelected,
                ]}
              >
                €50+
              </Text>
            </TouchableOpacity>
          </View>
        </View>

        <View style={styles.ctaSection}>
          <Button
            title={recommendationLoading ? "Recommandation en cours..." : "Trouver mes vins (texte)"}
            style={styles.modeIndicator}
            onPress={handleGetRecommendations}
            variant="primary"
            size="large"
            fullWidth
            loading={recommendationLoading}
          />
        </View>
      </View>
    </ScrollView>
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
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 24,
    paddingTop: 60,
    paddingBottom: 24,
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  logoImage: {
    width: 32,
    height: 32,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: Colors.primary,
    borderRadius: 16, // Make it circular
    borderWidth: 1, // Add border
    borderColor: Colors.primary, // Border color
  },
  logo: {
    fontSize: Typography.sizes.xl,
    fontWeight: Typography.weights.bold,
    color: Colors.primary,
    marginLeft: 12,
    letterSpacing: 1,
  },
  profileButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: Colors.softGray,
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: Colors.darkGray,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 2,
  },
  content: {
    flex: 1,
    paddingHorizontal: 24,
  },
  greetingSection: {
    marginBottom: 32,
  },
  greeting: {
    fontSize: Typography.sizes.lg,
    fontWeight: Typography.weights.medium,
    color: Colors.textPrimary,
    lineHeight: Typography.sizes.lg * Typography.lineHeights.relaxed,
    marginBottom: 8,
  },
  photoHint: {
    fontSize: Typography.sizes.sm,
    color: Colors.secondary,
    fontWeight: Typography.weights.medium,
    textAlign: 'center',
    fontStyle: 'italic',
  },
  inputSection: {
    marginBottom: 32,
  },
  inputCard: {
    backgroundColor: Colors.softGray,
    borderRadius: 16,
    padding: 20,
    position: 'relative',
    shadowColor: Colors.darkGray,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 3,
  },
  cameraButton: {
    position: 'absolute',
    top: 20,
    right: 20,
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: Colors.primary,
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: Colors.darkGray,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
    elevation: 4,
  },
  photoModeSection: {
    marginBottom: 32,
    backgroundColor: Colors.softGray,
    borderRadius: 16,
    padding: 20,
    shadowColor: Colors.darkGray,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 3,
  },
  photoModeTitle: {
    fontSize: Typography.sizes.base,
    fontWeight: Typography.weights.semibold,
    color: Colors.textPrimary,
    marginBottom: 8,
    textAlign: 'center',
  },
  photoModeDescription: {
    fontSize: Typography.sizes.sm,
    color: Colors.textSecondary,
    textAlign: 'center',
    marginBottom: 16,
  },
  photoButtons: {
    flexDirection: 'row',
    gap: 12,
  },
  photoModeButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: Colors.primary,
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 12,
    shadowColor: Colors.darkGray,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
    elevation: 4,
  },
  photoModeButtonText: {
    fontSize: Typography.sizes.sm,
    fontWeight: Typography.weights.semibold,
    color: Colors.accent,
    marginLeft: 8,
  },
  budgetSection: {
    marginBottom: 40,
  },
  sectionTitle: {
    fontSize: Typography.sizes.base,
    fontWeight: Typography.weights.semibold,
    color: Colors.textPrimary,
    marginBottom: 16,
  },
  budgetOptions: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
  },
  budgetOption: {
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 24,
    borderWidth: 1,
    borderColor: Colors.textLight,
    backgroundColor: Colors.accent,
    shadowColor: Colors.darkGray,
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 1,
  },
  budgetOptionSelected: {
    borderColor: Colors.primary,
    backgroundColor: Colors.primary,
    shadowColor: Colors.primary,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
    elevation: 3,
  },
  budgetOptionText: {
    fontSize: Typography.sizes.sm,
    fontWeight: Typography.weights.medium,
    color: Colors.textPrimary,
  },
  budgetOptionTextSelected: {
    color: Colors.accent,
  },
  ctaSection: {
    paddingBottom: 32,
  },
  modeIndicator: {
    // Style for the main button to indicate text mode
  },
});