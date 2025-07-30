import React, { useState, useEffect, useRef } from 'react';
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
  AppState,
} from 'react-native';
import { useRouter } from 'expo-router';
import { Camera, Upload, Check, Wine, User, RotateCcw } from 'lucide-react-native';
import * as ImagePicker from 'expo-image-picker';
import * as ImageManipulator from 'expo-image-manipulator';
import { Colors } from '@/constants/Colors';
import { Typography } from '@/constants/Typography';
import { Button } from '@/components/Button';
import { Input } from '@/components/Input';
import { LoadingSpinner } from '@/components/LoadingSpinner';
import { useAuth } from '@/hooks/useAuth';
import { useRestaurantMode, UserCancellationError } from '@/hooks/useRestaurantMode';
import { tempStore } from '@/utils/tempStore';
import { supabase } from '@/lib/supabase';

const { width } = Dimensions.get('window');

type RestaurantStep = 'scan' | 'dish' | 'results';

export default function RestaurantScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{
    fromHistory?: string;
    sessionId?: string;
    dish?: string;
    restaurantName?: string;
  }>();
  const { user, profile, canMakeRecommendation, loading: authLoading } = useAuth();
  const { 
    currentSession,
    loading,
    error,
    setCurrentSession,
    scanWineCard,
    pickFromGallery,
    getRestaurantRecommendations, 
    clearSession
  } = useRestaurantMode();

  const [dishDescription, setDishDescription] = useState('');
  const [step, setStep] = useState<RestaurantStep>('scan');
  const [recommendations, setRecommendations] = useState<any[]>([]);
  const [appState, setAppState] = useState(AppState.currentState);
  const hasNavigatedRef = useRef(false);
  const hasLoadedFromHistoryRef = useRef(false);

  useEffect(() => {
    console.log('🍽️ Restaurant: Component mounted');
    return () => {
      console.log('🍽️ Restaurant: Component unmounted');
    };
  }, []);

  // Vérifier la session au retour de l'appareil photo
  useEffect(() => {
    const subscription = AppState.addEventListener('change', nextAppState => {
      if (appState.match(/inactive|background/) && nextAppState === 'active') {
        console.log('App revenue au premier plan');
        // Rafraîchir la session si nécessaire
        checkAndRefreshSession();
      }
      setAppState(nextAppState);
    });

    return () => {
      subscription?.remove();
    };
  }, [appState]);

  const checkAndRefreshSession = async () => {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) {
      console.log('Tentative de récupération de session...');
      try {
        const { data, error } = await supabase.auth.refreshSession();
        if (error) throw error;
        console.log('Session récupérée avec succès');
      } catch (error) {
        console.error('Impossible de récupérer la session:', error);
        router.replace('/');
      }
    }
  };

  const checkSessionOnFocus = async () => {
    const { data: { session: authSession } } = await supabase.auth.getSession();
    if (!authSession) {
      console.log('Session perdue, tentative de récupération...');
      try {
        await supabase.auth.refreshSession();
      } catch (error) {
        console.error('Impossible de récupérer la session:', error);
      }
    }
  };

  useEffect(() => {
    checkSessionOnFocus();
    if (!authLoading && !canMakeRecommendation() && !hasNavigatedRef.current) {
      hasNavigatedRef.current = true;
      router.push({
        pathname: '/subscription',
        params: { reason: 'daily_limit' }
      });
    }
  }, [authLoading, profile, canMakeRecommendation, router]);

  // Handle loading from history
  useEffect(() => {
    if (params.fromHistory === 'true' && 
        params.sessionId && 
        params.dish && 
        params.restaurantName &&
        !hasLoadedFromHistoryRef.current) {
      
      hasLoadedFromHistoryRef.current = true;
      
      try {
        // Retrieve data from temporary store
        const storedData = tempStore.get(params.sessionId);
        
        if (!storedData || !storedData.recommendations || !storedData.extractedWines) {
          console.error('❌ No stored data found for session:', params.sessionId);
          setStep('scan');
          return;
        }
        
        const { recommendations: parsedRecommendations, extractedWines: parsedExtractedWines } = storedData;
        
        // Clear data from temporary store after use
        tempStore.clear(params.sessionId);
        
        // Set current session with historical data
        const historicalSession: RestaurantSession = {
          id: params.sessionId,
          restaurant_name: params.restaurantName,
          extracted_wines: parsedExtractedWines,
          confidence_score: 0.85, // Default value for historical sessions
          session_active: true,
        };
        
        setCurrentSession(historicalSession);
        setDishDescription(params.dish);
        setRecommendations(parsedRecommendations);
        setStep('results');
        
        console.log('✅ Loaded restaurant session from history:', params.sessionId);
      } catch (error) {
        console.error('❌ Error loading from history:', error);
        // Clear potentially corrupted data
        if (params.sessionId) {
          tempStore.clear(params.sessionId);
        }
        // Fallback to scan step if parsing fails
        setStep('scan');
      }
    }
  }, [params.fromHistory, params.sessionId, params.dish, params.restaurantName, setCurrentSession]);

  const handleScanCard = async () => {
    try {
      // Vérifier les permissions
      const { status } = await ImagePicker.requestCameraPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert('Permission refusée', 'L\'accès à la caméra est nécessaire');
        return;
      }

      if (!canMakeRecommendation()) {
        Alert.alert(
          'Quota dépassé',
          'Tu as atteint ta limite quotidienne. Passe à Premium pour des scans illimités !',
          [
            { text: 'Plus tard', style: 'cancel' },
            { 
              text: 'Voir Premium', 
              onPress: () => router.push({
                pathname: '/subscription',
                params: { reason: 'daily_limit' }
              })
            }
          ]
        );
        return;
      }

      // Sauvegarder l'état de session
      const sessionBefore = await supabase.auth.getSession();
      console.log('Session avant photo:', !!sessionBefore.data.session);

      // Prendre la photo SANS base64 d'abord
      const result = await ImagePicker.launchCameraAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsEditing: true,
        aspect: [4, 3],
        quality: 0.7, // Qualité réduite
        base64: false, // IMPORTANT: Ne pas demander base64 ici
      });

      if (result.canceled) {
        console.log('📸 handleScanCard - User cancelled photo');
        return;
      }

      // Afficher un loading pendant le traitement
      Alert.alert('Traitement', 'Analyse de la carte en cours...', [], { cancelable: false });

      // Compresser et convertir en base64 APRÈS
      const manipResult = await ImageManipulator.manipulateAsync(
        result.assets[0].uri,
        [{ resize: { width: 800 } }], // Réduire largeur max à 800px
        { 
          compress: 0.6, // Compression à 60%
          format: ImageManipulator.SaveFormat.JPEG,
          base64: true // Demander base64 après compression
        }
      );

      // Vérifier la session après traitement
      const sessionAfter = await supabase.auth.getSession();
      if (!sessionAfter.data.session) {
        console.log('Session perdue, tentative de récupération...');
        await supabase.auth.refreshSession();
      }

      // Envoyer l'image compressée
      if (manipResult.base64) {
        console.log('Taille base64:', manipResult.base64.length / 1024, 'KB');
        const restaurantSession = await scanWineCard();
        Alert.alert(
          'Carte analysée !', 
          `${restaurantSession.extracted_wines.length} vins détectés chez ${restaurantSession.restaurant_name}`,
          [{ text: 'Continuer', onPress: () => setStep('dish') }]
        );
      }

    } catch (error: any) {
      console.error('Erreur scan:', error);
      // Don't show alert for user cancellations
      if (!(error instanceof UserCancellationError)) {
        Alert.alert('Erreur', 'Impossible de traiter la photo');
      }
    }
  };

  const handlePickFromGallery = async () => {
    try {
      // Vérifier les permissions
      const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert('Permission refusée', 'L\'accès à la galerie est nécessaire');
        return;
      }

      if (!canMakeRecommendation()) {
        Alert.alert(
          'Quota dépassé',
          'Tu as atteint ta limite quotidienne. Passe à Premium pour des scans illimités !',
          [
            { text: 'Plus tard', style: 'cancel' },
            { 
              text: 'Voir Premium', 
              onPress: () => router.push({
                pathname: '/subscription',
                params: { reason: 'daily_limit' }
              })
            }
          ]
        );
        return;
      }

      // Sauvegarder l'état de session
      const sessionBefore = await supabase.auth.getSession();
      console.log('Session avant sélection:', !!sessionBefore.data.session);

      // Sélectionner depuis la galerie SANS base64 d'abord
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsEditing: true,
        aspect: [4, 3],
        quality: 0.7, // Qualité réduite
        base64: false, // IMPORTANT: Ne pas demander base64 ici
      });

      if (result.canceled) {
        console.log('🖼️ handlePickFromGallery - User cancelled selection');
        return;
      }

      // Afficher un loading pendant le traitement
      Alert.alert('Traitement', 'Analyse de la carte en cours...', [], { cancelable: false });

      // Compresser et convertir en base64 APRÈS
      const manipResult = await ImageManipulator.manipulateAsync(
        result.assets[0].uri,
        [{ resize: { width: 800 } }], // Réduire largeur max à 800px
        { 
          compress: 0.6, // Compression à 60%
          format: ImageManipulator.SaveFormat.JPEG,
          base64: true // Demander base64 après compression
        }
      );

      // Vérifier la session après traitement
      const sessionAfter = await supabase.auth.getSession();
      if (!sessionAfter.data.session) {
        console.log('Session perdue, tentative de récupération...');
        await supabase.auth.refreshSession();
      }

      // Envoyer l'image compressée
      if (manipResult.base64) {
        console.log('Taille base64:', manipResult.base64.length / 1024, 'KB');
        const restaurantSession = await pickFromGallery();
        Alert.alert(
          'Carte analysée !', 
          `${restaurantSession.extracted_wines.length} vins détectés chez ${restaurantSession.restaurant_name}`,
          [{ text: 'Continuer', onPress: () => setStep('dish') }]
        );
      }

    } catch (error: any) {
      console.error('Erreur galerie:', error);
      // Don't show alert for user cancellations
      if (!(error instanceof UserCancellationError)) {
        Alert.alert('Erreur', 'Impossible de traiter la photo');
      }
    }
  };

  const handleScanCardOld = async () => {
    if (!canMakeRecommendation()) {
      Alert.alert(
        'Quota dépassé',
        'Tu as atteint ta limite quotidienne. Passe à Premium pour des scans illimités !',
        [
          { text: 'Plus tard', style: 'cancel' },
          { 
            text: 'Voir Premium', 
            onPress: () => router.push({
              pathname: '/subscription',
              params: { reason: 'daily_limit' }
            })
          }
        ]
      );
      return;
    }

    try {
      // Sauvegarder l'état avant la photo
      const { data: { session: authSession } } = await supabase.auth.getSession();
      if (!authSession) {
        Alert.alert('Erreur', 'Vous devez être connecté');
        return;
      }
      
      // Demander permission caméra
      const { status } = await ImagePicker.requestCameraPermissionsAsync();
      
      if (status !== 'granted') {
        Alert.alert('Permission requise', 'L\'accès à la caméra est nécessaire pour prendre une photo de la carte des vins.');
        return;
      }

      // Prendre la photo avec qualité réduite
      const result = await ImagePicker.launchCameraAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsEditing: true,
        aspect: [4, 3],
        quality: 0.5, // Réduire la qualité pour économiser la mémoire
        base64: true,
      });

      if (result.canceled) {
        console.log('📸 handleScanCard - User cancelled photo');
        return;
      }

      if (!result.assets[0].base64) {
        Alert.alert('Erreur', 'Impossible de traiter l\'image. Veuillez réessayer.');
        return;
      }

      // Vérifier la session après la photo
      const { data: { session: currentAuthSession } } = await supabase.auth.getSession();
      if (!currentAuthSession) {
        console.log('Session perdue après photo, tentative de récupération...');
        try {
          await supabase.auth.refreshSession();
        } catch (error) {
          console.error('Impossible de récupérer la session après photo:', error);
          Alert.alert('Erreur', 'Session expirée. Veuillez vous reconnecter.');
          return;
        }
      }

      // Continuer avec le scan
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

  const handlePickFromGalleryOld = async () => {
    if (!canMakeRecommendation()) {
      Alert.alert(
        'Quota dépassé',
        'Tu as atteint ta limite quotidienne. Passe à Premium pour des scans illimités !',
        [
          { text: 'Plus tard', style: 'cancel' },
          { 
            text: 'Voir Premium', 
            onPress: () => router.push({
              pathname: '/subscription',
              params: { reason: 'daily_limit' }
            })
          }
        ]
      );
      return;
    }

    try {
      // Sauvegarder l'état avant la sélection
      const { data: { session: authSession } } = await supabase.auth.getSession();
      if (!authSession) {
        Alert.alert('Erreur', 'Vous devez être connecté');
        return;
      }
      
      // Demander permission galerie
      const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
      
      if (status !== 'granted') {
        Alert.alert('Permission requise', 'L\'accès à la galerie est nécessaire pour choisir une photo de la carte des vins.');
        return;
      }

      // Sélectionner depuis la galerie avec qualité réduite
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsEditing: true,
        aspect: [4, 3],
        quality: 0.5, // Réduire la qualité pour économiser la mémoire
        base64: true,
      });

      if (result.canceled) {
        console.log('🖼️ handlePickFromGallery - User cancelled selection');
        return;
      }

      if (!result.assets[0].base64) {
        Alert.alert('Erreur', 'Impossible de traiter l\'image. Veuillez réessayer.');
        return;
      }

      // Vérifier la session après la sélection
      const { data: { session: currentAuthSession } } = await supabase.auth.getSession();
      if (!currentAuthSession) {
        console.log('Session perdue après sélection, tentative de récupération...');
        try {
          await supabase.auth.refreshSession();
        } catch (error) {
          console.error('Impossible de récupérer la session après sélection:', error);
          Alert.alert('Erreur', 'Session expirée. Veuillez vous reconnecter.');
          return;
        }
      }

      // Continuer avec le scan
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

  // Show loading while auth is being checked
  if (authLoading) {
    return (
      <View style={styles.container}>
        <View style={styles.loadingContainer}>
          <LoadingSpinner text="Chargement..." />
        </View>
      </View>
    );
  }

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
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
});