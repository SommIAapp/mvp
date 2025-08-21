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
  const [dishImage, setDishImage] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [scanProgress, setScanProgress] = useState(0);
  const [scanMessage, setScanMessage] = useState('');
  const [isScanning, setIsScanning] = useState(false);
  const [recoProgress, setRecoProgress] = useState(0);
  const [recoMessage, setRecoMessage] = useState('');
  const [isGettingRecommendations, setIsGettingRecommendations] = useState(false);
  const [appState, setAppState] = useState(AppState.currentState);
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
          [{ resize: { width: 800 } }],
          { 
            compress: 0.5, // Compression agressive
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
      
      setScanMessage('Analyse de la carte en cours...');

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
      console.error('💥 handleScanCard - Erreur capturée:', error);
      console.error('🔍 handleScanCard - Type d\'erreur:', error.constructor.name);
      console.error('🔍 handleScanCard - Message:', error.message);
      
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
    console.log('🖼️ handlePickFromGallery - Début de la sélection galerie');
    
    try {
      setIsScanning(true);
      setScanProgress(0);
      setScanMessage('Initialisation...');
      
      // Vérifier les permissions
      console.log('🔐 handlePickFromGallery - Vérification des permissions galerie...');
      setScanProgress(10);
      setScanMessage('Vérification des permissions...');
      
      const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (status !== 'granted') {
        console.error('❌ handlePickFromGallery - Permission galerie refusée');
        Alert.alert('Permission refusée', 'L\'accès à la galerie est nécessaire');
        return;
      }
      console.log('✅ handlePickFromGallery - Permissions galerie accordées');

      setScanProgress(20);
      setScanMessage('Ouverture de la galerie...');
      
      console.log('🖼️ handlePickFromGallery - Lancement de la galerie...');
      
      // Sélection avec qualité optimisée
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsEditing: true,
        aspect: [4, 3],
        quality: 0.7, // Réduire dès la sélection
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
      const uri = result.assets[0].uri;
      
      setScanProgress(30);
      setScanMessage('Préparation de l\'image...');

      // NOUVELLE COMPRESSION OPTIMISÉE
      // Créer une session restaurant à partir du cache
      const cachedSession = {
        id: cached.sessionId,
        restaurant_name: cached.restaurantName,
        extracted_wines: cached.wines,
        confidence_score: 0.9,
        session_active: true,
      };
      
      setCurrentSession(cachedSession);
      let compressedResult = await ImageManipulator.manipulateAsync(
        uri,
        [{ resize: { width: 800 } }],
        { 
          compress: 0.5, // Compression agressive
          format: ImageManipulator.SaveFormat.JPEG,
        [{ text: 'Parfait!', onPress: () => setStep('dish') }]
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

      console.log('✅ handlePickFromGallery - Image compressée et prête pour analyse');
      
      setScanProgress(50);
      setScanMessage('Envoi vers l\'analyse OCR...');
      
      // Simuler progression pendant l'analyse
      const galleryProgressTimer = setInterval(() => {
        setScanProgress(prev => {
          if (prev < 85) return prev + 5;
          return prev;
        });
      }, 1000);
      
      setScanMessage('Analyse de la carte en cours...');

      console.log('🚀 handlePickFromGallery - Envoi vers scanWineCard...');
      const restaurantSession = await scanWineCard(base64);
      
      clearInterval(galleryProgressTimer);
      
      setScanProgress(100);
      setScanMessage('Analyse terminée!');
      
      // Attendre un peu pour montrer 100% puis continuer
      setTimeout(() => {
        setStep('dish');
      }, 1000);

    } catch (error: any) {
      console.error('💥 handlePickFromGallery - Erreur capturée:', error);
      console.error('🔍 handlePickFromGallery - Type d\'erreur:', error.constructor.name);
      console.error('🔍 handlePickFromGallery - Message:', error.message);
      
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
  
  // Overlay de progression pour le scan
  if (isScanning) {
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
        
        <View style={styles.loadingOverlay}>
          <View style={styles.loadingContent}>
            <Text style={styles.loadingTitle}>Analyse de la carte</Text>
            <ProgressBar 
              progress={scanProgress} 
              message={scanMessage}
              color="#6B2B3A"
            />
            <TouchableOpacity 
              style={styles.cancelButton}
              onPress={() => {
                setIsScanning(false);
                setScanProgress(0);
                setScanMessage('');
              }}
            >
              <Text style={styles.cancelText}>Annuler</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    );
  }

  const handleGetRecommendations = async () => {
    // Debug logs sécurisés
    console.log('🔍 Checking recommendation quota...');
    logProfile('Profile quota check', profile);
    console.log('Can make recommendation:', canMakeRecommendation());
    
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

    if (!dishDescription.trim() && !dishImage) {
      Alert.alert('Erreur', 'Décris ton plat ou prends-le en photo');
      return;
    }

    try {
      setIsGettingRecommendations(true);
      setRecoProgress(0);
      setRecoMessage('');
      
      // Étape 1: Validation (20%)
      setRecoProgress(20);
      setRecoMessage('Validation du plat...');
      await new Promise(resolve => setTimeout(resolve, 300));
      
      const budgetValue = selectedBudget ? parseInt(selectedBudget.replace('€', '').replace('+', '')) : undefined;
      let results;
      
      // Étape 2: Analyse (40%)
      setRecoProgress(40);
      setRecoMessage('Analyse du plat et des préférences...');
      await new Promise(resolve => setTimeout(resolve, 500));
      
      // Étape 3: Recherche (60-90%)
      const recoProgressTimer = setInterval(() => {
        setRecoProgress(prev => {
          if (prev < 90) return prev + 5;
          return prev;
        });
      }, 800);
      
      setRecoMessage('Recherche des meilleurs accords...');
      
      if (dishImage) {
        // Si on a une image, utilise getRecommendationsFromPhoto
        // Récupérer le base64 de l'image
        const imageResult = await ImageManipulator.manipulateAsync(
          dishImage,
          [{ resize: { width: 600 } }],
          { 
            compress: 0.4,
            format: ImageManipulator.SaveFormat.JPEG,
            base64: true
          }
        );
        
        if (imageResult.base64) {
          results = await getRecommendationsFromPhoto(
            imageResult.base64,
            budgetValue,
            selectedWineType  // Passe le wine type ici aussi
          );
        }
      } else {
        // Sinon utilise le texte
        results = await getRestaurantRecommendations(
          dishDescription,
          currentSession?.id,    // 2ème paramètre = sessionId (OBLIGATOIRE)
          budgetValue,          // 3ème paramètre = budget
          selectedWineType      // 4ème paramètre = wineType
        );
      }
      
      clearInterval(recoProgressTimer);
      
      // Étape 4: Finalisation (100%)
      setRecoProgress(100);
      setRecoMessage('Préparation des recommandations...');
      await new Promise(resolve => setTimeout(resolve, 500));
      
      // Navigation vers les recommandations
      router.push({
        pathname: '/recommendations',
        params: {
          mode: 'restaurant',
          dish: dishImage ? 'Photo de plat' : dishDescription,
          budget: budgetValue?.toString() || '0',
          wineType: selectedWineType || 'all',
          recommendations: JSON.stringify(results),
          restaurantName: currentSession?.restaurant_name || 'Restaurant',
          photoMode: dishImage ? 'true' : 'false',
          fromHistory: 'false',
          visionConfidence: '0',
        }
      });
    } catch (error: any) {
      console.error('Error getting recommendations:', error);
      Alert.alert('Erreur', error.message || 'Impossible de générer les recommandations');
    } finally {
      setTimeout(() => {
        setIsGettingRecommendations(false);
        setRecoProgress(0);
        setRecoMessage('');
      }, 500);
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
            const { status } = await ImagePicker.requestCameraPermissionsAsync();
            
            if (status !== 'granted') {
              Alert.alert('Permission requise', 'L\'accès à la caméra est nécessaire.');
              return;
            }

            const result = await ImagePicker.launchCameraAsync({
              mediaTypes: ImagePicker.MediaTypeOptions.Images,
              allowsEditing: true,
              aspect: [4, 3],
              quality: 0.8,
              base64: true,
            });

            if (!result.canceled) {
              setDishImage(result.assets[0].uri);
            }
          }
        },
        { 
          text: '🖼️ Choisir depuis galerie', 
          onPress: async () => {
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

            if (!result.canceled) {
              setDishImage(result.assets[0].uri);
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
            <View style={styles.scanSection}>
              <View style={styles.scanCard}>
                <Text style={styles.scanTitle}>
                  Scannez la carte des vins du restaurant
                </Text>
                
                <View style={styles.scanButtons}>
                  <Button
                    title="📸 Prendre une photo"
                    onPress={handleScanCard}
                    variant="primary"
                    disabled={restaurantLoading}
                  />
                  
                  <Button
                    title="🖼️ Choisir depuis galerie"
                    onPress={handlePickFromGallery}
                    variant="secondary"
                    disabled={restaurantLoading}
                  />
                </View>
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
            {/* Input premium flottant */}
            <View style={styles.inputCard}>
              {dishImage ? (
                <View style={styles.imageContainer}>
                  <Image source={{ uri: dishImage }} style={styles.dishImage} />
                  <TouchableOpacity 
                    style={styles.removeImageButton}
                    onPress={() => setDishImage(null)}
                  >
                    <X size={20} color="white" />
                  </TouchableOpacity>
                </View>
              ) : (
                <>
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
                </>
              )}
            </View>

            {/* Section budget élégante */}
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

            {/* CTA Premium */}
            <TouchableOpacity 
              style={[styles.ctaButton, isGettingRecommendations && styles.ctaButtonDisabled]}
              onPress={handleGetRecommendations}
              disabled={isGettingRecommendations || (!dishDescription.trim() && !dishImage)}
            >
              <Text style={styles.ctaText}>
                {isGettingRecommendations ? "Analyse en cours..." : "Voir les recommandations"}
              </Text>
            </TouchableOpacity>
          </View>
        </ScrollView>
        
        {/* Overlay de progression pour les recommandations */}
        {isGettingRecommendations && (
          <View style={styles.loadingOverlay}>
            <View style={styles.loadingContent}>
              <Text style={styles.loadingTitle}>Recherche des accords parfaits</Text>
              <ProgressBar 
                progress={recoProgress} 
                message={recoMessage}
                color="#6B2B3A"
              />
              <TouchableOpacity 
                style={styles.cancelButton}
                onPress={() => {
                  setIsGettingRecommendations(false);
                  setRecoProgress(0);
                  setRecoMessage('');
                }}
              >
                <Text style={styles.cancelText}>Annuler</Text>
              </TouchableOpacity>
            </View>
          </View>
        )}
      </View>
    );
  }

  // Fallback - should not reach here
  return null;
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
    marginHorizontal: 20,
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
    marginBottom: 20,
    marginTop: 20,
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
    marginTop: 20,
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
    marginTop: 12,
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
    marginTop: 28,
    marginBottom: 40,
    backgroundColor: '#6B2B3A',
    paddingVertical: 18,
    paddingHorizontal: 32,
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
  ctaButtonDisabled: {
    opacity: 0.6,
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
  imageContainer: {
    width: '100%',
    height: 120,
    position: 'relative',
  },
  dishImage: {
    width: '100%',
    height: '100%',
    borderRadius: 16,
  },
  removeImageButton: {
    position: 'absolute',
    top: 8,
    right: 8,
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0,0,0,0.7)',
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 1000,
  },
  loadingContent: {
    backgroundColor: 'white',
    borderRadius: 20,
    padding: 30,
    marginHorizontal: 40,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 10,
    elevation: 10,
  },
  loadingTitle: {
    fontSize: 20,
    fontWeight: '600',
    color: '#333',
    marginBottom: 10,
  },
  cancelButton: {
    marginTop: 20,
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 20,
    backgroundColor: '#F5F5F5',
  },
  cancelText: {
    fontSize: 16,
    color: '#666',
    fontWeight: '500',
  },
});