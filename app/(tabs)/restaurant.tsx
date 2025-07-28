import React, { useState } from 'react';
import { useLocalSearchParams } from 'expo-router';
import { 
  View, 
  Text, 
  StyleSheet, 
  ScrollView, 
  TouchableOpacity,
  Alert,
  Image,
  Dimensions,
} from 'react-native';
import { useRouter } from 'expo-router';
import { Camera, Upload, Check, Wine, User, RotateCcw } from 'lucide-react-native';
import * as ImagePicker from 'expo-image-picker';
import { Colors } from '@/constants/Colors';
import { Typography } from '@/constants/Typography';
import { Button } from '@/components/Button';
import { Input } from '@/components/Input';
import { LoadingSpinner } from '@/components/LoadingSpinner';
import { useAuth } from '@/hooks/useAuth';
import { useRestaurantMode, UserCancellationError } from '@/hooks/useRestaurantMode';

const { width } = Dimensions.get('window');

type RestaurantStep = 'scan' | 'dish' | 'results';

export default function RestaurantScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{
    fromHistory?: string;
    dish?: string;
    recommendations?: string;
    restaurantName?: string;
  }>();
  const { user, profile, canMakeRecommendation } = useAuth();
  const { 
    currentSession,
    loading,
    error,
    scanWineCard,
    pickFromGallery,
    getRestaurantRecommendations, 
    clearSession
  } = useRestaurantMode();

  const [dishDescription, setDishDescription] = useState('');
  const [step, setStep] = useState<RestaurantStep>('scan');
  const [recommendations, setRecommendations] = useState<any[]>([]);

  const handleScanCard = async () => {
    if (!canMakeRecommendation()) {
      router.push({
        pathname: '/subscription',
        params: { reason: 'daily_limit' }
      });
      return;
    }

    try {
      const session = await scanWineCard();
      Alert.alert(
        'Carte analysée !', 
        `${session.extracted_wines.length} vins détectés chez ${session.restaurant_name}`,
        [{ text: 'Continuer', onPress: () => setStep('dish') }]
      );
    } catch (error: any) {
      // Don't show alert for user cancellations
      if (!(error instanceof UserCancellationError)) {
        Alert.alert('Erreur', error.message);
      }
    }
  };

  const handlePickFromGallery = async () => {
    if (!canMakeRecommendation()) {
      router.push({
        pathname: '/subscription',
        params: { reason: 'daily_limit' }
      });
      return;
    }

    try {
      const session = await pickFromGallery();
      Alert.alert(
        'Carte analysée !', 
        `${session.extracted_wines.length} vins détectés chez ${session.restaurant_name}`,
        [{ text: 'Continuer', onPress: () => setStep('dish') }]
      );
    } catch (error: any) {
      // Don't show alert for user cancellations
      if (!(error instanceof UserCancellationError)) {
        Alert.alert('Erreur', error.message);
      }
    }
  };

  const handleGetRecommendations = async () => {
    if (!dishDescription.trim()) {
      Alert.alert('Erreur', 'Veuillez décrire votre plat');
      return;
    }

    try {
      const results = await getRestaurantRecommendations(dishDescription);
      setRecommendations(results);
      setStep('results');
    } catch (error: any) {
      Alert.alert('Erreur', error.message);
    }
  };

  const handleNewSearch = () => {
    setStep('scan');
    setDishDescription('');
    setRecommendations([]);
    clearSession();
  };

  // ÉCRAN 1: SCAN CARTE
  if (step === 'scan') {
    return (
      <View style={styles.container}>
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

        <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
          <View style={styles.pageHeader}>
            <Text style={styles.title}>Mode Restaurant</Text>
            <Text style={styles.subtitle}>Scannez la carte des vins de votre restaurant</Text>
          </View>

          <View style={styles.scanSection}>
            <View style={styles.scanCard}>
              <Camera size={64} color={Colors.primary} strokeWidth={1} />
              <Text style={styles.scanTitle}>Photographier la carte des vins</Text>
              <Text style={styles.scanSubtitle}>
                L'IA va extraire automatiquement tous les vins disponibles
              </Text>
              
              <View style={styles.scanButtons}>
                <Button
                  title={loading ? "Analyse en cours..." : "Scanner la carte"}
                  onPress={handleScanCard}
                  variant="primary"
                  size="large"
                  fullWidth
                  loading={loading}
                />
                
                <Button
                  title="Choisir depuis la galerie"
                  onPress={handlePickFromGallery}
                  variant="outline"
                  size="medium"
                  fullWidth
                  loading={loading}
                />
              </View>
            </View>
          </View>

          {error && (
            <View style={styles.errorCard}>
              <Text style={styles.errorText}>{error}</Text>
            </View>
          )}
        </ScrollView>
      </View>
    );
  }

  // ÉCRAN 2: DESCRIPTION PLAT
  if (step === 'dish' && currentSession) {
    return (
      <View style={styles.container}>
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

        <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
          <View style={styles.pageHeader}>
            <View style={styles.sessionInfo}>
              <Check size={20} color={Colors.success} />
              <Text style={styles.sessionText}>
                {currentSession.extracted_wines.length} vins • {currentSession.restaurant_name}
              </Text>
            </View>
          </View>

          <View style={styles.dishSection}>
            <Text style={styles.stepTitle}>Que mangez-vous ce soir ?</Text>
            
            <Input
              placeholder="Décrivez votre plat..."
              value={dishDescription}
              onChangeText={setDishDescription}
              multiline
              numberOfLines={3}
              maxLength={200}
            />

            <Button
              title={loading ? "Recherche en cours..." : "Trouver l'accord parfait"}
              onPress={handleGetRecommendations}
              variant="primary"
              size="large"
              fullWidth
              loading={loading}
              disabled={!dishDescription.trim()}
            />
          </View>
        </ScrollView>
      </View>
    );
  }

  // ÉCRAN 3: RÉSULTATS
  if (step === 'results') {
    return (
      <View style={styles.container}>
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

        <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
          <View style={styles.pageHeader}>
            <Text style={styles.title}>Vos accords parfaits</Text>
            <Text style={styles.subtitle}>
              Pour {dishDescription}
              {params.fromHistory === 'true' && params.restaurantName && (
                <Text style={styles.restaurantContext}> • Chez {params.restaurantName}</Text>
              )}
            </Text>
          </View>

          <View style={styles.resultsSection}>
            {recommendations.map((wine, index) => (
              <View key={index} style={styles.recommendationCard}>
                <View style={styles.wineHeader}>
                  <Wine size={24} color={Colors.primary} />
                  <Text style={styles.wineName}>{wine.name}</Text>
                </View>
                
                <Text style={styles.winePrice}>{wine.price_display}</Text>
                <Text style={styles.reasoning}>{wine.reasoning}</Text>
                
                <Button
                  title="Demander au serveur"
                  onPress={() => Alert.alert('Super choix !', `"Pourriez-vous nous servir le ${wine.name} s'il vous plaît ?"`)}
                  variant="outline"
                  size="medium"
                  fullWidth
                />
              </View>
            ))}

            <View style={styles.newSearchSection}>
              <Button
                title="Nouvelle recherche"
                onPress={handleNewSearch}
                variant="primary"
                size="medium"
                fullWidth
              />
            </View>
          </View>
        </ScrollView>
      </View>
    );
  }

  return (
    <View style={styles.container}>
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

      <ScrollView style={styles.content}>
        <View style={styles.pageHeader}>
          <Text style={styles.title}>Mode Restaurant</Text>
          <Text style={styles.subtitle}>Commencez par scanner une carte des vins</Text>
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
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
  pageHeader: {
    alignItems: 'center',
    paddingVertical: 32,
  },
  title: {
    fontSize: Typography.sizes.xxl,
    fontWeight: Typography.weights.bold,
    color: Colors.textPrimary,
    marginBottom: 8,
  },
  subtitle: {
    fontSize: Typography.sizes.base,
    color: Colors.textSecondary,
    textAlign: 'center',
  },
  restaurantContext: {
    fontSize: Typography.sizes.base,
    color: Colors.primary,
    fontWeight: Typography.weights.medium,
  },
  scanSection: {
    marginBottom: 32,
  },
  scanCard: {
    backgroundColor: Colors.softGray,
    borderRadius: 16,
    padding: 32,
    alignItems: 'center',
    shadowColor: Colors.darkGray,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 3,
  },
  scanTitle: {
    fontSize: Typography.sizes.lg,
    fontWeight: Typography.weights.bold,
    color: Colors.textPrimary,
    marginTop: 16,
    marginBottom: 8,
    textAlign: 'center',
  },
  scanSubtitle: {
    fontSize: Typography.sizes.base,
    color: Colors.textSecondary,
    textAlign: 'center',
    marginBottom: 24,
  },
  scanButtons: {
    width: '100%',
    gap: 12,
  },
  sessionInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.softGray,
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
  },
  sessionText: {
    fontSize: Typography.sizes.sm,
    color: Colors.textPrimary,
    marginLeft: 8,
  },
  dishSection: {
    gap: 24,
  },
  stepTitle: {
    fontSize: Typography.sizes.lg,
    fontWeight: Typography.weights.bold,
    color: Colors.textPrimary,
    marginBottom: 16,
    textAlign: 'center',
  },
  resultsSection: {
    paddingBottom: 32,
  },
  recommendationCard: {
    backgroundColor: Colors.softGray,
    borderRadius: 16,
    padding: 20,
    marginBottom: 16,
    shadowColor: Colors.darkGray,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 3,
  },
  wineHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  wineName: {
    fontSize: Typography.sizes.lg,
    fontWeight: Typography.weights.bold,
    color: Colors.textPrimary,
    marginLeft: 12,
    flex: 1,
  },
  winePrice: {
    fontSize: Typography.sizes.xl,
    fontWeight: Typography.weights.bold,
    color: Colors.primary,
    marginBottom: 12,
  },
  reasoning: {
    fontSize: Typography.sizes.base,
    color: Colors.textSecondary,
    lineHeight: Typography.sizes.base * 1.5,
    marginBottom: 16,
  },
  errorCard: {
    backgroundColor: Colors.error,
    borderRadius: 12,
    padding: 16,
    marginTop: 16,
  },
  errorText: {
    color: Colors.accent,
    fontSize: Typography.sizes.base,
    textAlign: 'center',
  },
  newSearchSection: {
    marginBottom: 24,
  },
});