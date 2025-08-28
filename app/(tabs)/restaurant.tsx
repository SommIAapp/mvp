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
import { Camera, Upload, Check, Wine, User, RotateCcw, X } from 'lucide-react-native';
import * as ImagePicker from 'expo-image-picker';
import * as ImageManipulator from 'expo-image-manipulator';
import * as FileSystem from 'expo-file-system';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { LinearGradient } from 'expo-linear-gradient';
import Svg, { Path } from 'react-native-svg';
import { useRecommendations } from '@/hooks/useRecommendations';
import { Colors } from '@/constants/Colors';
import { Typography } from '@/constants/Typography';
import { Button } from '@/components/Button';
import { Input } from '@/components/Input';
import { LoadingSpinner } from '@/components/LoadingSpinner';
import { ProgressBar } from '@/components/ProgressBar';
import { useAuth } from '@/hooks/useAuth';
import { useRestaurantMode, UserCancellationError } from '@/hooks/useRestaurantMode';
import { sanitizeForLogging, logProfile, logUser } from '@/utils/secureLogging';
import { tempStore } from '@/utils/tempStore';
import { getCachedWineCard, setCachedWineCard, cleanOldCache } from '@/utils/wineCardCache';
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
  const { getRecommendations, getRecommendationsFromPhoto } = useRecommendations();
  const { 
    currentSession,
    loading: restaurantLoading,
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
  const [dishImage, setDishImage] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [scanProgress, setScanProgress] = useState(0);
  const [scanMessage, setScanMessage] = useState('');
  const [isScanning, setIsScanning] = useState(false);
  const [recoProgress, setRecoProgress] = useState(0);
  const [recoMessage, setRecoMessage] = useState('');
  const [isGettingRecommendations, setIsGettingRecommendations] = useState(false);
  const [appState, setAppState] = useState(AppState.currentState);
  const [error, setError] = useState<string | null>(null);
  const hasNavigatedRef = useRef(false);
  const hasLoadedFromHistoryRef = useRef(false);
  const [showBudgetOptions, setShowBudgetOptions] = useState(false);
  const [showWineTypeOptions, setShowWineTypeOptions] = useState(false);

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
    try {
      setIsScanning(true);
      setError(null);
      console.log('📸 handleScanCard - Début de la prise de photo');

      // Vérifier les permissions
      console.log('🔐 handleScanCard - Vérification des permissions caméra...');
      const { status } = await ImagePicker.requestCameraPermissionsAsync();
      
      if (status !== 'granted') {
        Alert.alert('Permission refusée', 'L\'accès à la caméra est nécessaire pour scanner la carte des vins.');
        return;
      }

      console.log('✅ handleScanCard - Permissions caméra accordées');
      console.log('📱 handleScanCard - Lancement de la caméra...');

      // Prendre la photo
      const result = await ImagePicker.launchCameraAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsEditing: false,
        quality: 0.7, // Réduire dès la capture
      });

      if (!result.canceled && result.assets && result.assets[0]) {
        console.log('✅ handleScanCard - Photo prise avec succès');
        const uri = result.assets[0].uri;
        
        // NOUVELLE COMPRESSION OPTIMISÉE
        console.log('🔄 handleScanCard - Compression optimisée de l\'image...');
        
        // Première compression à 800px
        let compressedResult = await ImageManipulator.manipulateAsync(
          uri,
          [{ resize: { width: 1000 } }],
          { 
            compress: 0.6,
            format: ImageManipulator.SaveFormat.JPEG 
          }
        );
        
        // Convertir en base64
        let base64 = await FileSystem.readAsStringAsync(compressedResult.uri, {
          encoding: FileSystem.EncodingType.Base64,
        });
        
        console.log('📏 Taille après première compression:', (base64.length / 1024).toFixed(2), 'KB');
        
        // Si toujours trop gros, recompresser
        if (base64.length > 40000) { // 40KB max
          console.log('🔄 Recompression nécessaire...');
          compressedResult = await ImageManipulator.manipulateAsync(
            uri,
            [{ resize: { width: 600 } }], // Plus petit
            { 
              compress: 0.4, // Encore plus compressé
              format: ImageManipulator.SaveFormat.JPEG 
            }
          );
          
          base64 = await FileSystem.readAsStringAsync(compressedResult.uri, {
            encoding: FileSystem.EncodingType.Base64,
          });
          
          console.log('📏 Taille finale après recompression:', (base64.length / 1024).toFixed(2), 'KB');
        }
        
        // Si ENCORE trop gros, dernière tentative
        if (base64.length > 40000) {
          console.log('⚠️ Dernière compression agressive...');
          compressedResult = await ImageManipulator.manipulateAsync(
            uri,
            [{ resize: { width: 480 } }],
            { 
              compress: 0.3,
              format: ImageManipulator.SaveFormat.JPEG 
            }
          );
          
          base64 = await FileSystem.readAsStringAsync(compressedResult.uri, {
            encoding: FileSystem.EncodingType.Base64,
          });
          
          console.log('📏 Taille minimale atteinte:', (base64.length / 1024).toFixed(2), 'KB');
        }
        
        console.log('🚀 handleScanCard - Envoi vers scanWineCard...');
        await onScanComplete(base64);
      } else {
        console.log('❌ handleScanCard - Photo annulée');
      }
    } catch (error) {
      console.error('❌ handleScanCard error:', error);
      setError('Erreur lors de la prise de photo. Veuillez réessayer.');
      Alert.alert('Erreur', 'Impossible de prendre la photo. Veuillez réessayer.');
    } finally {
      setTimeout(() => {
        setIsScanning(false);
        setScanProgress(0);
        setScanMessage('');
      }, 1000);
    }
  };

  // Nouvelle fonction pour traiter le scan (avec ou sans cache)
  const onScanComplete = async (imageBase64: string) => {
    try {
      setScanProgress(0);
      setScanMessage('Initialisation...');
      
      // Nettoyer le vieux cache périodiquement (10% de chance)
      if (Math.random() < 0.1) {
        cleanOldCache().catch(console.error);
      }
      
      // Étape 1: Vérifier le cache (0-20%)
      setScanProgress(10);
      setScanMessage('Vérification du cache...');
      
      const cached = await getCachedWineCard(imageBase64);
      
      if (cached) {
        // Animation rapide jusqu'à 100%
        setScanProgress(50);
        setScanMessage('Carte trouvée dans le cache!');
        await new Promise(resolve => setTimeout(resolve, 300));
        
        setScanProgress(100);
        setScanMessage('Chargement des données...');
        
        // Créer une session restaurant à partir du cache
        const cachedSession = {
          id: cached.sessionId,
          restaurant_name: cached.restaurantName,
          extracted_wines: cached.wines,
          confidence_score: 0.9,
          session_active: true,
        };
        
        setCurrentSession(cachedSession);
        
        await new Promise(resolve => setTimeout(resolve, 500));
        
        Alert.alert(
          '✨ Carte reconnue!',
          `${cached.restaurantName}\n${cached.wines.length} vins disponibles\n(Chargé depuis le cache)`,
          [{ text: 'Parfait!', onPress: () => setStep('dish') }]
        );
        
        return;
      }
      
      // Pas en cache, continuer avec l'OCR
      setScanProgress(20);
      setScanMessage('Préparation de l\'analyse...');
      await new Promise(resolve => setTimeout(resolve, 300));

      if (!user) {
        throw new Error('Utilisateur non connecté');
      }
      
      setScanProgress(30);
      setScanMessage('Envoi vers l\'analyse OCR...');
      
      // Simuler une progression pendant l'attente
      const scanProgressInterval = setInterval(() => {
        setScanProgress(prev => {
          if (prev < 85) return prev + 3;
          return prev;
        });
      }, 1000);
      
      setScanMessage('Analyse de la carte en cours, cela peut prendre quelques instants...');

      console.log('🚀 onScanComplete - Envoi vers scanWineCard...');
      const restaurantSession = await scanWineCard(imageBase64);
      
      clearInterval(scanProgressInterval);
      
      setScanProgress(100);
      setScanMessage('Analyse terminée!');
      
      // Attendre un peu pour montrer 100% puis continuer
      setTimeout(() => {
        setStep('dish');
      }, 1000);

    } catch (error: any) {
      console.error('💥 onScanComplete - Erreur capturée:', error);
      console.error('🔍 onScanComplete - Type d\'erreur:', error.constructor.name);
      console.error('🔍 onScanComplete - Message:', error.message);
      
      // Don't show alert for user cancellations
      if (!(error instanceof UserCancellationError)) {
        Alert.alert('Erreur', `Impossible de traiter la photo: ${error.message}`);
      }
    } finally {
      setIsScanning(false);
      setScanProgress(0);
      setScanMessage('');
    }
  };

  const handlePickFromGallery = async () => {
    try {
      setIsScanning(true);
      setError(null);
      console.log('🖼️ handlePickFromGallery - Début de la sélection galerie');

      // Vérifier les permissions
      const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
      
      if (status !== 'granted') {
        Alert.alert('Permission refusée', 'L\'accès à la galerie est nécessaire pour choisir une photo de la carte des vins.');
        return;
      }

      // Sélectionner depuis la galerie
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsEditing: false,
        quality: 0.7,
      });

      if (!result.canceled && result.assets && result.assets[0]) {
        console.log('✅ handlePickFromGallery - Photo sélectionnée avec succès');
        const uri = result.assets[0].uri;
        
        // Compression optimisée (même logique que caméra)
        console.log('🔄 handlePickFromGallery - Compression optimisée de l\'image...');
        
        let compressedResult = await ImageManipulator.manipulateAsync(
          uri,
          [{ resize: { width: 1000 } }],
          { 
            compress: 0.6,
            format: ImageManipulator.SaveFormat.JPEG 
          }
        );
        
        let base64 = await FileSystem.readAsStringAsync(compressedResult.uri, {
          encoding: FileSystem.EncodingType.Base64,
        });
        
        console.log('📏 Taille après première compression:', (base64.length / 1024).toFixed(2), 'KB');
        
        if (base64.length > 40000) {
          console.log('🔄 Recompression nécessaire...');
          compressedResult = await ImageManipulator.manipulateAsync(
            uri,
            [{ resize: { width: 600 } }],
            { 
              compress: 0.4,
              format: ImageManipulator.SaveFormat.JPEG 
            }
          );
          
          base64 = await FileSystem.readAsStringAsync(compressedResult.uri, {
            encoding: FileSystem.EncodingType.Base64,
          });
          
          console.log('📏 Taille finale après recompression:', (base64.length / 1024).toFixed(2), 'KB');
        }
        
        if (base64.length > 40000) {
          console.log('⚠️ Dernière compression agressive...');
          compressedResult = await ImageManipulator.manipulateAsync(
            uri,
            [{ resize: { width: 480 } }],
            { 
              compress: 0.3,
              format: ImageManipulator.SaveFormat.JPEG 
            }
          );
          
          base64 = await FileSystem.readAsStringAsync(compressedResult.uri, {
            encoding: FileSystem.EncodingType.Base64,
          });
          
          console.log('📏 Taille minimale atteinte:', (base64.length / 1024).toFixed(2), 'KB');
        }
        
        console.log('🚀 handlePickFromGallery - Envoi vers scanWineCard...');
        await onScanComplete(base64);
      } else {
        console.log('❌ handlePickFromGallery - Sélection annulée');
      }
    } catch (error) {
      console.error('❌ handlePickFromGallery error:', error);
      setError('Erreur lors de la sélection de photo. Veuillez réessayer.');
      Alert.alert('Erreur', 'Impossible de sélectionner la photo. Veuillez réessayer.');
    } finally {
      setTimeout(() => {
        setIsScanning(false);
        setScanProgress(0);
        setScanMessage('');
      }, 1000);
    }
  };

  const handleGetRecommendations = async () => {
    // Vérifier que la session a des vins extraits
    if (!currentSession?.extracted_wines || currentSession.extracted_wines.length === 0) {
      Alert.alert(
        'Carte en cours d\'analyse',
        'La carte des vins est encore en cours d\'analyse. Veuillez patienter quelques instants.',
        [{ text: 'OK' }]
      );
      return;
    }

    if (!dishDescription.trim()) {
      Alert.alert('Erreur', 'Veuillez décrire votre plat');
      return;
    }

    if (!canMakeRecommendation()) {
      console.log('🚫 handleGetRecommendations - Quota exceeded, showing paywall');
      
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

    setIsGettingRecommendations(true);
    setRecoProgress(0);
    setRecoMessage('Analyse de votre plat...');

    try {
      // Simuler progression
      const progressInterval = setInterval(() => {
        setRecoProgress(prev => {
          if (prev < 80) return prev + 10;
          return prev;
        });
      }, 500);

      const budgetValue = selectedBudget ? parseInt(selectedBudget.replace('€', '').replace('+', '')) : undefined;
      
      console.log('🤖 handleGetRecommendations - Calling restaurant recommendations');
      const restaurantRecommendations = await getRestaurantRecommendations(
        dishDescription,
        currentSession.id,
        budget,
        selectedWineType
      );

      clearInterval(progressInterval);
      setRecoProgress(100);
      setRecoMessage('Recommandations prêtes!');

      console.log('✅ handleGetRecommendations - Recommendations received:', restaurantRecommendations.length);

      setRecommendations(restaurantRecommendations);
      
      // Attendre un peu puis naviguer
      setTimeout(() => {
        setStep('results');
      }, 1000);

    } catch (error) {
      console.error('❌ handleGetRecommendations error:', error);
      Alert.alert('Erreur', `Impossible de générer les recommandations: ${error.message}`);
    } finally {
      setIsGettingRecommendations(false);
      setRecoProgress(0);
      setRecoMessage('');
    }
  };

  const handleViewResults = () => {
    if (!currentSession || !recommendations.length) {
      Alert.alert('Erreur', 'Aucune recommandation disponible');
      return;
    }

    // Store data in temporary store for navigation
    tempStore.set(currentSession.id, {
      recommendations,
      extractedWines: currentSession.extracted_wines,
    });

    router.push({
      pathname: '/recommendations',
      params: {
        dish: dishDescription,
        budget: selectedBudget?.replace('€', '') || '',
        wineType: selectedWineType || '',
        recommendations: JSON.stringify(recommendations),
        mode: 'restaurant',
        restaurantName: currentSession.restaurant_name,
      },
    });
  };

  const handleNewScan = () => {
    clearSession();
    setStep('scan');
    setDishDescription('');
    setSelectedBudget(null);
    setSelectedWineType(null);
    setRecommendations([]);
  };

  // ÉCRANS DE RENDU

  // Écran de scan
  if (step === 'scan') {
    return (
      <View style={styles.container}>
        <View style={styles.headerSection}>
          <LinearGradient
            colors={['#6B2B3A', '#8B4B5A']}
            style={styles.headerGradient}
          >
            <Text style={styles.headerTitle}>SOMMIA</Text>
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
          {isScanning ? (
            <View style={styles.scanningContainer}>
              <ProgressBar 
                progress={scanProgress} 
                message={scanMessage}
                color="#6B2B3A"
              />
            </View>
          ) : (
            <>
              <View style={styles.instructionCard}>
                <Text style={styles.instructionTitle}>
                  Scanner la carte des vins
                </Text>
                <Text style={styles.instructionText}>
                  Prends une photo de la carte des vins du restaurant pour obtenir des recommandations personnalisées
                </Text>
              </View>

              <View style={styles.scanOptions}>
                <TouchableOpacity 
                  style={styles.scanButton}
                  onPress={handleScanCard}
                >
                  <Camera size={32} color="white" />
                  <Text style={styles.scanButtonText}>Prendre une photo</Text>
                </TouchableOpacity>

                <TouchableOpacity 
                  style={styles.galleryButton}
                  onPress={handlePickFromGallery}
                >
                  <Upload size={24} color="#6B2B3A" />
                  <Text style={styles.galleryButtonText}>Choisir depuis galerie</Text>
                </TouchableOpacity>
              </View>
            </>
          )}
        </ScrollView>
      </View>
    );
  }

  // Écran d'attente si session mais pas encore de vins
  if (step === 'dish' && currentSession && (!currentSession.extracted_wines || currentSession.extracted_wines.length === 0)) {
    return (
      <View style={styles.container}>
        <View style={styles.headerSection}>
          <LinearGradient
            colors={['#6B2B3A', '#8B4B5A']}
            style={styles.headerGradient}
          >
            <Text style={styles.headerTitle}>SOMMIA</Text>
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
        
        <View style={styles.loadingContainer}>
          <LoadingSpinner text="Finalisation de l'analyse de la carte..." />
          <Text style={[styles.sectionSubtitle, { marginTop: 20 }]}>
            Cela peut prendre jusqu'à 30 secondes
          </Text>
        </View>
      </View>
    );
  }

  // Écran de saisie du plat
  if (step === 'dish' && currentSession && currentSession.extracted_wines && currentSession.extracted_wines.length > 0) {
    return (
      <View style={styles.container}>
        <View style={styles.headerSection}>
          <LinearGradient
            colors={['#6B2B3A', '#8B4B5A']}
            style={styles.headerGradient}
          >
            <TouchableOpacity 
              style={styles.backButton}
              onPress={handleNewScan}
            >
              <RotateCcw size={24} color="white" />
            </TouchableOpacity>
            <Text style={styles.headerTitle}>SOMMIA</Text>
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
          {isGettingRecommendations ? (
            <View style={styles.recommendationContainer}>
              <ProgressBar 
                progress={recoProgress} 
                message={recoMessage}
                color="#6B2B3A"
              />
            </View>
          ) : (
            <>
              <View style={styles.restaurantInfo}>
                <Check size={24} color={Colors.success} />
                <Text style={styles.restaurantName}>
                  {currentSession.restaurant_name}
                </Text>
                <Text style={styles.wineCount}>
                  {currentSession.extracted_wines.length} vins détectés
                </Text>
              </View>

              <View style={styles.dishInputCard}>
                <Text style={styles.dishInputTitle}>Que manges-tu ?</Text>
                <TextInput
                  style={styles.dishInput}
                  placeholder="Décris ton plat..."
                  placeholderTextColor="#999"
                  value={dishDescription}
                  onChangeText={setDishDescription}
                  multiline
                  numberOfLines={3}
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
                    <Text style={styles.sectionTitle}>Budget par bouteille</Text>
                    <Text style={styles.sectionSubtitle}>
                      {selectedBudget || 'Optionnel'}
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
                    <Text style={styles.sectionTitle}>Type de vin préféré</Text>
                    <Text style={styles.sectionSubtitle}>
                      {selectedWineType ? WINE_TYPES.find(t => t.id === selectedWineType)?.label : 'Optionnel'}
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

              <TouchableOpacity 
                style={styles.getRecommendationsButton}
                onPress={handleGetRecommendations}
              >
                <Text style={styles.getRecommendationsText}>
                  Obtenir mes recommandations
                </Text>
              </TouchableOpacity>
            </>
          )}
        </ScrollView>
      </View>
    );
  }

  // Écran de résultats
  if (step === 'results' && recommendations.length > 0) {
    return (
      <View style={styles.container}>
        <View style={styles.headerSection}>
          <LinearGradient
            colors={['#6B2B3A', '#8B4B5A']}
            style={styles.headerGradient}
          >
            <TouchableOpacity 
              style={styles.backButton}
              onPress={handleNewScan}
            >
              <RotateCcw size={24} color="white" />
            </TouchableOpacity>
            <Text style={styles.headerTitle}>SOMMIA</Text>
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
          <View style={styles.resultsHeader}>
            <Text style={styles.resultsTitle}>Recommandations</Text>
            <Text style={styles.resultsSubtitle}>
              Pour {dishDescription} chez {currentSession.restaurant_name}
            </Text>
          </View>

          <TouchableOpacity 
            style={styles.viewResultsButton}
            onPress={handleViewResults}
          >
            <Text style={styles.viewResultsText}>
              Voir les {recommendations.length} recommandations
            </Text>
          </TouchableOpacity>
        </ScrollView>
      </View>
    );
  }

  return null;
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
    paddingHorizontal: 24,
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
  backButton: {
    position: 'absolute',
    top: 60,
    left: 20,
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: 'rgba(255,255,255,0.2)',
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 1,
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
    paddingHorizontal: 20,
    paddingTop: 20,
  },
  scanningContainer: {
    marginTop: 50,
  },
  instructionCard: {
    backgroundColor: 'white',
    borderRadius: 20,
    padding: 24,
    marginBottom: 32,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.08,
    shadowRadius: 20,
    elevation: 5,
  },
  instructionTitle: {
    fontSize: Typography.sizes.xl,
    fontWeight: Typography.weights.bold,
    color: Colors.textPrimary,
    marginBottom: 12,
    textAlign: 'center',
  },
  instructionText: {
    fontSize: Typography.sizes.base,
    color: Colors.textSecondary,
    textAlign: 'center',
    lineHeight: Typography.sizes.base * Typography.lineHeights.relaxed,
  },
  scanOptions: {
    gap: 16,
  },
  scanButton: {
    backgroundColor: '#6B2B3A',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 18,
    paddingHorizontal: 32,
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
  galleryButton: {
    backgroundColor: 'white',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 18,
    paddingHorizontal: 32,
    borderRadius: 26,
    borderWidth: 2,
    borderColor: '#6B2B3A',
    gap: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 3,
  },
  galleryButtonText: {
    color: '#6B2B3A',
    fontSize: 18,
    fontWeight: '600',
  },
  restaurantInfo: {
    backgroundColor: 'white',
    borderRadius: 20,
    padding: 20,
    marginBottom: 24,
    flexDirection: 'row',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.08,
    shadowRadius: 20,
    elevation: 5,
  },
  restaurantName: {
    fontSize: Typography.sizes.lg,
    fontWeight: Typography.weights.bold,
    color: Colors.textPrimary,
    marginLeft: 12,
    flex: 1,
  },
  wineCount: {
    fontSize: Typography.sizes.sm,
    color: Colors.textSecondary,
    marginLeft: 12,
  },
  dishInputCard: {
    backgroundColor: 'white',
    borderRadius: 20,
    padding: 24,
    marginBottom: 24,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.08,
    shadowRadius: 20,
    elevation: 5,
  },
  dishInputTitle: {
    fontSize: Typography.sizes.lg,
    fontWeight: Typography.weights.bold,
    color: Colors.textPrimary,
    marginBottom: 16,
    textAlign: 'center',
  },
  dishInput: {
    fontSize: 16,
    color: '#333',
    minHeight: 80,
    textAlignVertical: 'top',
    borderWidth: 1,
    borderColor: '#E0E0E0',
    borderRadius: 12,
    padding: 16,
    backgroundColor: '#F9F9F9',
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
    fontSize: 18,
    fontWeight: '600',
    color: '#2C2C2C',
    marginBottom: 4,
  },
  sectionSubtitle: {
    fontSize: 14,
    color: '#999',
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
  getRecommendationsButton: {
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
  getRecommendationsText: {
    color: 'white',
    fontSize: 18,
    fontWeight: '600',
  },
  recommendationContainer: {
    marginTop: 50,
  },
  resultsHeader: {
    backgroundColor: 'white',
    borderRadius: 20,
    padding: 24,
    marginBottom: 24,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.08,
    shadowRadius: 20,
    elevation: 5,
  },
  resultsTitle: {
    fontSize: Typography.sizes.xl,
    fontWeight: Typography.weights.bold,
    color: Colors.textPrimary,
    marginBottom: 8,
    textAlign: 'center',
  },
  resultsSubtitle: {
    fontSize: Typography.sizes.base,
    color: Colors.textSecondary,
    textAlign: 'center',
  },
  viewResultsButton: {
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
  viewResultsText: {
    color: 'white',
    fontSize: 18,
    fontWeight: '600',
  },
});