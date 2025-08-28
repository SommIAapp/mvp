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
    } catch (error) {
      console.error('❌ onScanComplete error:', error);
      setError('Erreur lors du traitement de l\'image. Veuillez réessayer.');
    }
  };
}