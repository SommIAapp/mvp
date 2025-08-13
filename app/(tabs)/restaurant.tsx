import React, { useState, useEffect, useRef } from 'react';
import { useLocalSearchParams } from 'expo-router';
import { 
  View, 
  Text, 
  StyleSheet, 
  ScrollView, 
  TouchableOpacity,
  TextInput,
  Alert,
  Image,
  Dimensions,
  AppState,
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

  const WINE_TYPES = [
    { id: 'rouge', label: 'Rouge', color: '#6B2B3A' },
    { id: 'blanc', label: 'Blanc', color: '#D4C5A0' },
    { id: 'rose', label: 'Rosé', color: '#F5B5A3' },
    { id: 'champagne', label: 'Champagne', color: '#D4AF37' },
  ];

  const [dishDescription, setDishDescription] = useState('');
  const [step, setStep] = useState<RestaurantStep>('scan');
  const [recommendations, setRecommendations] = useState<any[]>([]);
  const [selectedBudget, setSelectedBudget] = useState<string | null>(null);
  const [selectedWineType, setSelectedWineType] = useState<string | null>(null);
  const [appState, setAppState] = useState(AppState.currentState);
  const hasNavigatedRef = useRef(false);
  const hasLoadedFromHistoryRef = useRef(false);

  const BUDGET_OPTIONS = ['€10', '€20', '€30', '€50+'];

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
    // Vérification du quota ici
    if (!canMakeRecommendation()) {
      console.log('🚫 Restaurant - Quota exceeded, showing paywall');
      
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

    if (!dishDescription.trim()) {
      Alert.alert('Erreur', 'Veuillez décrire votre plat');
      return;
    }

    try {
      const budgetValue = selectedBudget ? parseInt(selectedBudget.replace('€', '').replace('+', '')) : undefined;
      const results = await getRestaurantRecommendations(dishDescription);
      
      // Naviguer vers la page recommendations au lieu de step results
      router.push({
        pathname: '/recommendations',
        params: {
          mode: 'restaurant',
          dish: dishDescription,
          budget: budgetValue?.toString() || '',
          wineType: selectedWineType || '',
          recommendations: JSON.stringify(results),
          restaurantName: currentSession?.restaurant_name || '',
        }
      });
    } catch (error: any) {
      Alert.alert('Erreur', error.message);
    }
  };

  const handleCameraPress = () => {
    Alert.alert(
      'Mode Photo',
      'Comment souhaitez-vous ajouter votre photo ?',
      [
        { text: 'Annuler', style: 'cancel' },
        { 
          text: '📸 Prendre une photo', 
          onPress: async () => {
            // Utilise la logique existante pour la photo
            await handleScanCard();
          }
        },
        { 
          text: '🖼️ Choisir depuis galerie', 
          onPress: async () => {
            // Logique pour choisir depuis la galerie
            const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
            
            if (status !== 'granted') {
              Alert.alert('Permission requise', 'L\'accès à la galerie est nécessaire.');
              return;
            }

            const result = await ImagePicker.launchImageLibraryAsync({
              mediaTypes: ImagePicker.MediaTypeOptions.Images,
              allowsEditing: true,
              aspect: [4, 3],
              quality: 0.8,
              base64: true,
            });

            if (!result.canceled && result.assets[0].base64) {
              // Traiter l'image comme pour un scan de plat
              // Tu peux adapter selon tes besoins
            }
          }
        },
      ]
    );
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
        <View style={styles.headerSection}>
          <LinearGradient
            colors={['#6B2B3A', '#8B4B5A']}
            style={styles.headerGradient}
          >
            {/* SOMMIA centré */}
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
          <View style={styles.scanContainer}>
            <View style={styles.scanCard}>
              <Text style={styles.scanTitle}>Photographier la carte des vins</Text>
              <View style={styles.scanButtons}>
                <Button
                  title={restaurantLoading ? "Analyse en cours..." : "Scanner la carte"}
                  onPress={handleScanCard}
                  variant="primary"
                  size="large"
                  fullWidth
                  loading={restaurantLoading}
                />
                
                <Button
                  title="Choisir depuis la galerie"
                  onPress={handlePickFromGallery}
                  variant="outline"
                  size="medium"
                  fullWidth
                  loading={restaurantLoading}
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
        <View style={styles.headerSection}>
          <LinearGradient
            colors={['#6B2B3A', '#8B4B5A']}
            style={styles.headerGradient}
          >
            {/* SOMMIA centré */}
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
          <View style={styles.dishSection}>
            <Text style={styles.stepTitle}>Que mangez-vous ce soir ?</Text>
            <Text style={styles.stepSubtitle}>
              {currentSession.extracted_wines.length} vins disponibles chez {currentSession.restaurant_name}
            </Text>
            
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

            {/* Section type de vin */}
            <View style={styles.wineTypeSection}>
              <Text style={styles.sectionTitle}>Type de vin préféré</Text>
              <Text style={styles.sectionSubtitle}>Optionnel</Text>
              
              <View style={styles.wineTypeGrid}>
                {WINE_TYPES.map(type => (
                  <TouchableOpacity
                    key={type.id}
                    style={[
                      styles.wineTypePill,
                      selectedWineType === type.id && styles.wineTypePillActive,
                      selectedWineType === type.id && { backgroundColor: type.color }
                    ]}
                    onPress={() => setSelectedWineType(selectedWineType === type.id ? null : type.id)}
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
            </View>

            {/* CTA Premium */}
            <TouchableOpacity 
              style={styles.ctaButton}
              onPress={handleGetRecommendations}
              disabled={!dishDescription.trim()}
            >
              <Text style={styles.ctaText}>
                {restaurantLoading ? "Recommandation en cours..." : "Obtenir des recommandations"}
              </Text>
            </TouchableOpacity>
          </View>
        </ScrollView>
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
          {/* SOMMIA centré */}
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

      <ScrollView style={styles.content}>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#FAF6F0',
  },
  
  // Header Premium
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
    marginTop: 50,
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
  
  scanContainer: {
    flex: 1,
    justifyContent: 'center',
    paddingVertical: 60,
    minHeight: 400,
  },
  
  scanSection: {
    marginBottom: 32,
  },
  scanCard: {
    backgroundColor: 'white',
    borderRadius: 24,
    padding: 24,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.08,
    shadowRadius: 20,
    elevation: 5,
  },
  scanTitle: {
    fontSize: Typography.sizes.lg,
    fontWeight: Typography.weights.bold,
    color: Colors.textPrimary,
    marginBottom: 40,
    textAlign: 'center',
  },
  scanButtons: {
    width: '100%',
    gap: 12,
  },
  dishSection: {
    paddingHorizontal: 20,
    gap: 24,
  },
  stepTitle: {
    fontSize: Typography.sizes.xl,
    fontWeight: Typography.weights.bold,
    color: Colors.textPrimary,
    textAlign: 'center',
    marginBottom: 8,
  },
  stepSubtitle: {
    fontSize: Typography.sizes.base,
    color: Colors.textSecondary,
    textAlign: 'center',
    marginBottom: 24,
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
    color: Colors.textPrimary,
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
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
});