import React, { useState } from 'react';
import { 
  View, 
  Text, 
  StyleSheet, 
  ScrollView, 
  TouchableOpacity,
  Alert,
  Dimensions,
  Image
} from 'react-native';
import { useRouter } from 'expo-router';
import { Camera, User } from 'lucide-react-native';
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
  const { getRecommendations } = useRecommendations();
  const [dishDescription, setDishDescription] = useState('');
  const [budget, setBudget] = useState<number | null>(null);
  const [recommendationLoading, setRecommendationLoading] = useState(false);

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
    // TODO: Implement camera functionality
    Alert.alert('Appareil photo', 'Fonctionnalité bientôt disponible !');
  };

  return (
    <ScrollView style={styles.container} showsVerticalScrollIndicator={false}>
      <View style={styles.header}>
        <View style={styles.headerLeft}>
          <Image 
            source={require('@/assets/images/ChatGPT_Image_6_juil._2025__14_01_43-removebg-preview.png')}
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
            title={recommendationLoading ? "Recommandation en cours..." : "Trouver mes vins"}
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
});