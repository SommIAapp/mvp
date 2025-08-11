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
  TextInput,
} from 'react-native';
import { useRouter } from 'expo-router';
import { Camera, Upload, Check, Wine, User, RotateCcw } from 'lucide-react-native';
import * as ImagePicker from 'expo-image-picker';
import * as ImageManipulator from 'expo-image-manipulator';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { LinearGradient } from 'expo-linear-gradient';
import Svg, { Path } from 'react-native-svg';
import { Colors } from '@/constants/Colors';
import { Typography } from '@/constants/Typography';
import { Button } from '@/components/Button';
import { Input } from '@/components/Input';
import { LoadingSpinner } from '@/components/LoadingSpinner';
import { useAuth } from '@/hooks/useAuth';
import { useRestaurantMode, UserCancellationError } from '@/hooks/useRestaurantMode';
import { tempStore } from '@/utils/tempStore';

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
    loading: restaurantLoading,
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
    console.log('📸 handleScanCard - Début de la prise de photo');
    
    try {
      // Vérifier les permissions
      console.log('🔐 handleScanCard - Vérification des permissions caméra...');
      const { status } = await ImagePicker.requestCameraPermissionsAsync();
      if (status !== 'granted') {
        console.error('❌ handleScanCard - Permission caméra refusée');
        Alert.alert('Permission refusée', 'L\'accès à la caméra est nécessaire');
        return;
      }
      console.log('✅ handleScanCard - Permissions caméra accordées');

      console.log('📱 handleScanCard - Lancement de la caméra...');
      
      // Photo SANS base64 pour éviter le crash Android
      const result = await ImagePicker.launchCameraAsync({
        allowsEditing: true,
        aspect: [4, 3],
        quality: 0.5,
        base64: false, // CRITICAL: false ici pour éviter crash Android !
      });

      if (result.canceled) {
        console.log('📸 handleScanCard - User cancelled photo');
        return;
      }
      
      if (!result.assets[0]) {
        console.error('❌ handleScanCard - Pas d\'asset dans le résultat');
        throw new Error('Aucune image capturée');
      }

      console.log('✅ handleScanCard - Photo prise avec succès');
      console.log('📏 handleScanCard - URI de l\'image:', result.assets[0].uri);

      // Afficher un loading pendant le traitement
      Alert.alert('Traitement', 'Analyse de la carte en cours...', [], { cancelable: false });

      console.log('🔄 handleScanCard - Compression et conversion base64...');
      // Base64 avec ImageManipulator SEULEMENT (plus sûr pour Android)
      const manipResult = await ImageManipulator.manipulateAsync(
        result.assets[0].uri,
        [{ resize: { width: 600 } }], // Réduire à 600px max pour éviter crash
        { 
          compress: 0.4, // Compression plus forte
          format: ImageManipulator.SaveFormat.JPEG,
          base64: true // base64 ICI seulement
        }
      );
      
      if (!manipResult.base64) {
        console.error('❌ handleScanCard - Pas de base64 après manipulation');
        throw new Error('Impossible de convertir l\'image');
      }

      console.log('✅ handleScanCard - Image compressée');
      console.log('📏 handleScanCard - Taille base64:', manipResult.base64.length, 'caractères');
      console.log('📏 handleScanCard - Taille base64:', (manipResult.base64.length / 1024).toFixed(2), 'KB');

      console.log('🚀 handleScanCard - Envoi vers scanWineCard...');
      const restaurantSession = await scanWineCard(manipResult.base64);
      
      Alert.alert(
        'Carte analysée !', 
        `${restaurantSession.extracted_wines.length} vins détectés chez ${restaurantSession.restaurant_name}`,
        [{ text: 'Continuer', onPress: () => setStep('dish') }]
      );

    } catch (error: any) {
      console.error('💥 handleScanCard - Erreur capturée:', error);
      console.error('🔍 handleScanCard - Type d\'erreur:', error.constructor.name);
      console.error('🔍 handleScanCard - Message:', error.message);
      if (error.stack) {
        console.error('🔍 handleScanCard - Stack:', error.stack);
      }
      
      // Don't show alert for user cancellations
      if (!(error instanceof UserCancellationError)) {
        Alert.alert('Erreur', `Impossible de traiter la photo: ${error.message}`);
      }
    }
  };

  const handlePickFromGallery = async () => {
    console.log('🖼️ handlePickFromGallery - Début de la sélection galerie');
    
    try {
      // Vérifier les permissions
      console.log('🔐 handlePickFromGallery - Vérification des permissions galerie...');
      const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (status !== 'granted') {
        console.error('❌ handlePickFromGallery - Permission galerie refusée');
        Alert.alert('Permission refusée', 'L\'accès à la galerie est nécessaire');
        return;
      }
      console.log('✅ handlePickFromGallery - Permissions galerie accordées');

      console.log('🖼️ handlePickFromGallery - Lancement de la galerie...');
      
      // Sélection SANS base64 pour éviter le crash Android
      const result = await ImagePicker.launchImageLibraryAsync({
        allowsEditing: true,
        aspect: [4, 3],
        quality: 0.5,
        base64: false, // CRITICAL: false ici pour éviter crash Android !
      });

      if (result.canceled) {
        console.log('🖼️ handlePickFromGallery - User cancelled selection');
        return;
      }

      if (!result.assets[0]) {
        console.error('❌ handlePickFromGallery - Pas d\'asset dans le résultat');
        throw new Error('Aucune image sélectionnée');
      }

      console.log('✅ handlePickFromGallery - Image sélectionnée avec succès');
      console.log('📏 handlePickFromGallery - URI de l\'image:', result.assets[0].uri);
      
      // Afficher un loading pendant le traitement
      Alert.alert('Traitement', 'Analyse de la carte en cours...', [], { cancelable: false });

      console.log('🔄 handlePickFromGallery - Compression et conversion base64...');
      // Base64 avec ImageManipulator SEULEMENT (plus sûr pour Android)
      const manipResult = await ImageManipulator.manipulateAsync(
        result.assets[0].uri,
        [{ resize: { width: 600 } }], // Réduire à 600px max pour éviter crash
        { 
          compress: 0.4, // Compression plus forte
          format: ImageManipulator.SaveFormat.JPEG,
          base64: true // base64 ICI seulement
        }
      );

      if (!manipResult.base64) {
        console.error('❌ handlePickFromGallery - Pas de base64 après manipulation');
        throw new Error('Impossible de convertir l\'image');
      }

      console.log('✅ handlePickFromGallery - Image compressée');
      console.log('📏 handlePickFromGallery - Taille base64:', manipResult.base64.length, 'caractères');
      console.log('📏 handlePickFromGallery - Taille base64:', (manipResult.base64.length / 1024).toFixed(2), 'KB');

      console.log('🚀 handlePickFromGallery - Envoi vers scanWineCard...');
      const restaurantSession = await scanWineCard(manipResult.base64);
      
      Alert.alert(
        'Carte analysée !', 
        `${restaurantSession.extracted_wines.length} vins détectés chez ${restaurantSession.restaurant_name}`,
        [{ text: 'Continuer', onPress: () => setStep('dish') }]
      );

    } catch (error: any) {
      console.error('💥 handlePickFromGallery - Erreur capturée:', error);
      console.error('🔍 handlePickFromGallery - Type d\'erreur:', error.constructor.name);
      console.error('🔍 handlePickFromGallery - Message:', error.message);
      if (error.stack) {
        console.error('🔍 handlePickFromGallery - Stack:', error.stack);
      }
      
      // Don't show alert for user cancellations
      if (!(error instanceof UserCancellationError)) {
        Alert.alert('Erreur', `Impossible de traiter la photo: ${error.message}`);
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
        {/* Header avec gradient et vague */}
        <View style={styles.headerSection}>
          <LinearGradient
            colors={['#6B2B3A', '#8B4B5A']}
            style={styles.headerGradient}
          >
            {/* Logo SOMMIA centré */}
            <Text style={styles.headerTitle}>SOMMIA</Text>
            
            {/* Avatar à droite */}
            <TouchableOpacity 
              style={styles.avatarButton}
              onPress={() => router.push('/(tabs)/profile')}
            >
              <User size={24} color="white" />
            </TouchableOpacity>
            
            {/* Titre Mode Restaurant */}
            <Text style={styles.modeTitle}>Mode Restaurant</Text>
            <Text style={styles.modeSubtitle}>
              Scanne la carte des vins de ton restaurant
            </Text>
          </LinearGradient>
          
          {/* Vague */}
          <Svg
            height="25"
            width="100%"
            viewBox="0 0 400 25"
            style={styles.wave}
            preserveAspectRatio="none"
          >
            <Path
              d="M0,12 Q100,0 200,8 T400,12 L400,25 L0,25 Z"
              fill="#FAF6F0"
            />
          </Svg>
        </View>

        <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
          {/* Card scanner premium */}
          <View style={styles.scannerCard}>
            <View style={styles.cameraIcon}>
              <Camera size={40} color="#6B2B3A" />
            </View>
            <Text style={styles.cardTitle}>
              Photographier la carte des vins
            </Text>
            <Text style={styles.cardDescription}>
              L'IA identifiera tous les vins disponibles
            </Text>
            
            <TouchableOpacity 
              style={styles.primaryButton}
              onPress={handleScanCard}
              disabled={restaurantLoading}
            >
              <Text style={styles.primaryButtonText}>
                {restaurantLoading ? "Analyse en cours..." : "Scanner la carte"}
              </Text>
            </TouchableOpacity>
            
            <TouchableOpacity 
              style={styles.secondaryButton}
              onPress={handlePickFromGallery}
              disabled={restaurantLoading}
            >
              <Text style={styles.secondaryButtonText}>
                Choisir depuis la galerie
              </Text>
            </TouchableOpacity>
          </View>

          {/* Section "ou" */}
          <Text style={styles.orText}>ou</Text>

          {/* Input pour décrire le plat */}
          <View style={styles.inputCard}>
            <TextInput
              style={styles.input}
              placeholder="Décris ton plat pour l'accord parfait"
              placeholderTextColor="#999"
              value={dishDescription}
              onChangeText={setDishDescription}
              multiline
              numberOfLines={2}
              maxLength={200}
            />
            <TouchableOpacity style={styles.cameraButton}>
              <Camera size={24} color="white" />
            </TouchableOpacity>
          </View>

          {/* CTA pour recommandations directes */}
          {dishDescription.trim() && (
            <TouchableOpacity 
              style={styles.ctaButton}
              onPress={handleGetRecommendations}
              disabled={restaurantLoading}
            >
              <Text style={styles.ctaText}>
                {restaurantLoading ? "Recherche en cours..." : "Trouver l'accord parfait"}
              </Text>
            </TouchableOpacity>
          )}

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
              title={restaurantLoading ? "Recherche en cours..." : "Trouver l'accord parfait"}
              onPress={handleGetRecommendations}
              variant="primary"
              size="large"
              fullWidth
              loading={restaurantLoading}
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
                title={restaurantLoading ? "Analyse en cours..." : "Scanner la carte"}
                onPress={handleNewSearch}
                variant="primary"
                size="medium"
                loading={restaurantLoading}
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
    backgroundColor: '#FAF6F0',
  },
  headerSection: {
    position: 'relative',
  },
  headerGradient: {
    paddingTop: 60,
    paddingHorizontal: 20,
    paddingBottom: 25,
  },
  headerTitle: {
    fontSize: 36,
    fontWeight: '700',
    color: 'white',
    textAlign: 'center',
    letterSpacing: 1.5,
    marginTop: 50,
    marginBottom: 20,
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
  modeTitle: {
    fontSize: 24,
    fontWeight: '600',
    color: 'white',
    textAlign: 'center',
    marginBottom: 8,
  },
  modeSubtitle: {
    fontSize: 16,
    color: 'rgba(255,255,255,0.8)',
    textAlign: 'center',
    paddingHorizontal: 40,
    marginBottom: 30,
  },
  wave: {
    position: 'absolute',
    bottom: -1,
    left: 0,
    right: 0,
  },
  content: {
    flex: 1,
    marginTop: -20,
  },
  scannerCard: {
    backgroundColor: 'white',
    marginHorizontal: 20,
    marginTop: 40,
    borderRadius: 24,
    padding: 32,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.08,
    shadowRadius: 20,
    elevation: 5,
  },
  cameraIcon: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: '#FAF6F0',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 24,
  },
  cardTitle: {
    fontSize: 20,
    fontWeight: '600',
    color: '#2C2C2C',
    textAlign: 'center',
    marginBottom: 8,
  },
  cardDescription: {
    fontSize: 16,
    color: '#666',
    textAlign: 'center',
    lineHeight: 24,
    marginBottom: 24,
  },
  primaryButton: {
    backgroundColor: '#6B2B3A',
    paddingVertical: 18,
    paddingHorizontal: 40,
    borderRadius: 26,
    marginTop: 8,
    shadowColor: '#6B2B3A',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.3,
    shadowRadius: 16,
    elevation: 8,
    width: '100%',
    alignItems: 'center',
  },
  primaryButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: 'white',
  },
  secondaryButton: {
    borderWidth: 2,
    borderColor: '#6B2B3A',
    paddingVertical: 16,
    paddingHorizontal: 40,
    borderRadius: 26,
    marginTop: 16,
    backgroundColor: 'transparent',
    width: '100%',
    alignItems: 'center',
  },
  secondaryButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#6B2B3A',
  },
  orText: {
    textAlign: 'center',
    marginVertical: 24,
    fontSize: 16,
    color: '#999',
    fontWeight: '500',
  },
  inputCard: {
    backgroundColor: 'white',
    marginHorizontal: 20,
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
  ctaButton: {
    marginHorizontal: 20,
    marginTop: 24,
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