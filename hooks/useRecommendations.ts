import { useState } from 'react';
import { Alert } from 'react-native';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/hooks/useAuth';
import { useNetworkStatus } from './useNetworkStatus';
import type { Database } from '@/lib/supabase';
import { secureLog, secureError, logObjectSize, sanitizeForLogging } from '@/utils/secureLogging';

type Wine = Database['public']['Tables']['wines']['Row'];
type Recommendation = Database['public']['Tables']['recommendations']['Row'];

export interface WineRecommendation {
  id: string;
  name: string;
  producer: string;
  region: string;
  price: number;
  category: 'economique' | 'qualite-prix' | 'premium';
  color: 'rouge' | 'blanc' | 'rose' | 'sparkling';
  reasoning: string;
  grapeVarieties: string[];
  foodPairings: string[];
  vintage?: number;
  appellation?: string;
}

export interface PhotoRecommendationRequest {
  mode: 'dish_photo';
  dish_image_base64: string;
  user_budget?: number;
}

export interface RestaurantOCRRequest {
  mode: 'restaurant_ocr';
  menu_image_base64: string;
  user_id: string;
}

export interface RestaurantRecoRequest {
  mode: 'restaurant_reco';
  dish_description: string;
  restaurant_session_id: string;
  available_wines: any[];
}

export interface RestaurantSession {
  id: string;
  restaurant_name: string;
  extracted_wines: any[];
  confidence_score: number;
}

export interface RestaurantRecommendation {
  wine_id: string;
  name: string;
  type: string;
  price_display: string;
  match_score: number;
  reasoning: string;
  restaurant_availability: boolean;
  alternative_if_unavailable?: string;
}

export function useRecommendations() {
  const { isConnected } = useNetworkStatus();
  const { user, updateUsageCount } = useAuth();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const getRecommendations = async (
    dishDescription: string,
    budget?: number,
    timestamp?: number,
    wineType?: string | null
  ): Promise<WineRecommendation[]> => {
    // Check connexion d'abord
    if (!isConnected) {
      Alert.alert(
        'Pas de connexion',
        'Une connexion internet est nécessaire pour obtenir des recommandations.',
        [
          { text: 'Annuler', style: 'cancel' },
          { text: 'Réessayer', onPress: () => getRecommendations(dishDescription, budget, timestamp, wineType) }
        ]
      );
      throw new Error('Pas de connexion internet');
    }

    secureLog('🚀 STARTING TEXT_ONLY MODE for dish');
    secureLog('🔄 getRecommendations - Starting with params:', sanitizeForLogging({
      dishDescription,
      budget,
      timestamp,
      userId: user?.id
    }));
    
    setLoading(true);
    setError(null);

    try {
      // First, update popular dishes count
      await updatePopularDish(dishDescription);

      // Get wine recommendations from Edge Function
      const wines = await fetchUnifiedRecommendations({
        mode: 'text_only',
        dish_description: dishDescription,
        user_budget: budget,
        wine_type_preference: wineType || null
      });
      
      if (wines === null) {
        // Ne pas continuer si c'est un plat non reconnu
        return [];
      }
      
      secureLog('🍷 getRecommendations - TEXT_ONLY mode completed, wines:', wines.length);

      // Save recommendation to history first
      if (user) {
        await saveRecommendationToHistory(user.id, dishDescription, budget, wines, 'text_only');
        
        // Update usage count in user_profiles
        await updateUsageCount();
        
        // Log analytics event
        await logRecommendationAnalytics(user.id, dishDescription, budget, wines);
      }

      return wines;
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Une erreur est survenue';
      setError(errorMessage);
      throw err;
    } finally {
      setLoading(false);
    }
  };

  const getRecommendationsFromPhoto = async (
    photoBase64: string,
    budget?: number,
    wineType?: string | null,
    restaurantSessionId?: string
  ): Promise<WineRecommendation[]> => {
    // Check connexion d'abord
    if (!isConnected) {
      Alert.alert(
        'Pas de connexion',
        'Une connexion internet est nécessaire pour analyser votre photo.',
        [
          { text: 'Annuler', style: 'cancel' },
          { text: 'Réessayer', onPress: () => getRecommendationsFromPhoto(photoBase64, budget, wineType) }
        ]
      );
      throw new Error('Pas de connexion internet');
    }

    secureLog('📸 STARTING DISH_PHOTO MODE - Photo analysis');
    logObjectSize('📸 Photo data', photoBase64);
    secureLog('💰 Photo mode budget:', budget);
    secureLog('🍷 Photo mode wine type:', wineType);
    secureLog('🏪 Restaurant session ID:', sanitizeForLogging(restaurantSessionId));
    
    setLoading(true);
    setError(null);

    try {
      // Vérifier si on a une session restaurant active
      const { data: sessionData, error: sessionError } = await supabase
        .from('restaurant_sessions')
        .select('*')
        .eq('session_active', true)
        .eq('user_id', user?.id)
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();
      
      let wines;
      
      if (sessionData && sessionData.extracted_wines && sessionData.extracted_wines.length > 0) {
        secureLog('📍 Mode Restaurant détecté - Analyse photo en 2 étapes');
        secureLog(`🍷 ${sessionData.extracted_wines.length} vins disponibles dans la carte`);
        
        // ÉTAPE 1 : Identifier le plat sur la photo
        secureLog('🔍 Étape 1: Identification du plat...');
        const photoAnalysis = await analyzePhotoForDish(photoBase64);
        
        if (!photoAnalysis.success) {
          secureError('❌ Échec identification plat:', photoAnalysis.error);
          throw new Error(photoAnalysis.error);
        }
        
        secureLog(`✅ Plat identifié: ${photoAnalysis.dish_name} (confiance: ${photoAnalysis.confidence}%)`);
        
        // ÉTAPE 2 : Obtenir les recommendations avec les vins du restaurant uniquement
        secureLog('🍷 Étape 2: Recommendations basées sur la carte du restaurant...');
        wines = await fetchUnifiedRecommendations({
          mode: 'restaurant_reco',
          dish_description: photoAnalysis.dish_name,
          restaurant_session_id: sessionData.id,
          available_wines: sessionData.extracted_wines,
          user_budget: budget,
          wine_type_preference: wineType
        });
        
        // Ajouter le nom du plat identifié aux recommendations
        if (wines && wines.length > 0) {
          wines.forEach(rec => {
            rec.dish_identified = photoAnalysis.dish_name;
            rec.photo_confidence = photoAnalysis.confidence;
          });
        }
      } else {
        // Pas en mode restaurant - utiliser le mode photo normal
        secureLog('🏠 Mode normal (pas de session restaurant active)');
        wines = await fetchUnifiedRecommendations({
          mode: 'dish_photo',
          dish_image_base64: photoBase64,
          user_budget: budget,
          wine_type_preference: wineType
        });
      }

      if (wines === null) {
        // Ne pas continuer si c'est une photo non analysable
        return [];
      }

      secureLog('📸 getRecommendationsFromPhoto - DISH_PHOTO mode completed, wines:', wines.length);
      if (user) {
        await saveRecommendationToHistory(user.id, 'Photo de plat', budget, wines, 'dish_photo');
        await updateUsageCount();
        await logRecommendationAnalytics(user.id, 'Photo de plat', budget, wines);
      }

      return wines;
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Erreur analyse photo';
      setError(errorMessage);
      throw err;
    } finally {
      setLoading(false);
    }
  };

  const getRestaurantOCR = async (
    menuPhotoBase64: string,
    userId: string
  ): Promise<RestaurantSession> => {
    // Check connexion d'abord
    if (!isConnected) {
      Alert.alert(
        'Pas de connexion',
        'Une connexion internet est nécessaire pour analyser la carte des vins.',
        [
          { text: 'Annuler', style: 'cancel' },
          { text: 'Réessayer', onPress: () => getRestaurantOCR(menuPhotoBase64, userId) }
        ]
      );
      throw new Error('Pas de connexion internet');
    }

    secureLog('🔍 STARTING RESTAURANT_OCR MODE - Menu OCR analysis');
    logObjectSize('🔍 Menu photo', menuPhotoBase64);
    secureLog('👤 OCR for user:', sanitizeForLogging(userId));
    
    setLoading(true);
    setError(null);

    try {
      const result = await fetchUnifiedRecommendations({
        mode: 'restaurant_ocr',
        menu_image_base64: menuPhotoBase64,
        user_id: userId
      });

      secureLog('🔍 getRestaurantOCR - RESTAURANT_OCR mode completed');
      secureLog('🏪 Restaurant detected:', result.restaurant_name);
      secureLog('🍷 Wines extracted:', result.extracted_wines?.length || 0);
      // Update usage count for OCR
      if (user) {
        await updateUsageCount();
      }

      return result as RestaurantSession;
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Erreur OCR menu';
      setError(errorMessage);
      throw err;
    } finally {
      setLoading(false);
    }
  };

  const getRestaurantRecommendations = async (
    dish: string,
    sessionId: string,
    availableWines: any[],
    budget?: number,
    wineType?: string | null
  ): Promise<RestaurantRecommendation[]> => {
    // Check connexion d'abord
    if (!isConnected) {
      Alert.alert(
        'Pas de connexion',
        'Une connexion internet est nécessaire pour obtenir des recommandations.',
        [
          { text: 'Annuler', style: 'cancel' },
          { text: 'Réessayer', onPress: () => getRestaurantRecommendations(dish, sessionId, availableWines, budget, wineType) }
        ]
      );
      throw new Error('Pas de connexion internet');
    }

    secureLog('🍽️ STARTING RESTAURANT_RECO MODE - Restaurant recommendations');
    secureLog('🍽️ Dish:', dish);
    secureLog('🏪 Session ID:', sanitizeForLogging(sessionId));
    secureLog('🍷 Available wines count:', availableWines.length);
    secureLog('💰 Budget:', budget);
    secureLog('🍷 Wine type preference:', wineType);
    
    setLoading(true);
    setError(null);

    try {
      // Nettoyer les vins pour éviter les caractères problématiques
      const cleanedWines = availableWines?.map(wine => ({
        ...wine,
        name: wine.name?.replace(/[\n\r\t]/g, ' ').replace(/\s+/g, ' ').trim(),
        producer: wine.producer?.replace(/[\n\r\t]/g, ' ').replace(/\s+/g, ' ').trim(),
        region: wine.region?.replace(/[\n\r\t]/g, ' ').replace(/\s+/g, ' ').trim(),
        price_display: wine.price_display?.replace(/[\n\r\t]/g, ' ').replace(/\s+/g, ' ').trim(),
      })) || [];

      const recommendations = await fetchUnifiedRecommendations({
        mode: 'restaurant_reco',
        dish_description: dish,
        restaurant_session_id: sessionId,
        available_wines: cleanedWines,
        user_budget: budget,
        wine_type_preference: wineType || null
      });

      secureLog('🍽️ getRestaurantRecommendations - RESTAURANT_RECO mode completed');
      secureLog('🎯 Restaurant recommendations count:', recommendations.length);

      // SAUVEGARDER DANS L'HISTORIQUE PRINCIPAL
      if (user && recommendations.length > 0) {
        try {
          secureLog('💾 Saving restaurant recommendation to history...');
          
          // Sauvegarder dans la table recommendations principale
          const { data, error: saveError } = await supabase
            .from('recommendations')
            .insert({
              user_id: user.id,
              dish_description: dish,
              user_budget: budget || null,
              recommended_wines: recommendations, // Directement le tableau
              created_at: new Date().toISOString(),
            })
            .select()
            .single();

          if (saveError) {
            secureError('❌ Error saving restaurant recommendation to history:', saveError);
          } else {
            secureLog('✅ Restaurant recommendation saved to main history with ID:', sanitizeForLogging(data.id));
          }

          // Mettre à jour le compteur d'usage
          await updateUsageCount();
          secureLog('✅ Usage count updated');
          
          // Logger l'analytics
          const standardFormat = recommendations.map(rec => ({
            id: rec.wine_id,
            name: rec.name,
            type: rec.type,
            region: rec.region,
            price_estimate: rec.price_bottle || rec.price_glass || 0,
            rating: rec.match_score || 85,
            category: 'restaurant',
            color: rec.type || 'rouge',
            reasoning: rec.reasoning
          }));
          
          await logRecommendationAnalytics(user.id, dish, budget, standardFormat);
          secureLog('✅ Analytics logged');
          
        } catch (error) {
          secureError('❌ Error in restaurant save process:', error);
          // Ne pas throw pour ne pas casser le flow
        }
      } else {
        secureLog('⚠️ No user or no recommendations to save');
      }

      return recommendations as RestaurantRecommendation[];
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Erreur recommandations restaurant';
      setError(errorMessage);
      throw err;
    } finally {
      setLoading(false);
    }
  };

  // Nouvelle fonction pour identifier le plat sur la photo
  const analyzePhotoForDish = async (imageBase64: string) => {
    try {
      const { data: { session }, error: sessionError } = await supabase.auth.getSession();
      
      if (sessionError || !session?.access_token) {
        throw new Error('Session non valide');
      }

      const response = await fetch(`${process.env.EXPO_PUBLIC_SUPABASE_URL}/functions/v1/wine-recommendations`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({
          mode: 'dish_photo_analysis',
          dish_image_base64: imageBase64
        }),
      });
      
      const data = await response.json();
      
      if (!response.ok || !data.success) {
        return {
          success: false,
          error: data.error || 'Erreur analyse photo'
        };
      }
      
      return {
        success: true,
        dish_name: data.identified_dish,
        confidence: data.vision_confidence
      };
    } catch (error) {
      return {
        success: false,
        error: 'Erreur analyse photo'
      };
    }
  };

  // Fonction helper pour récupérer la session restaurant active
  const getActiveRestaurantSession = async (sessionId?: string) => {
    if (!sessionId && !user?.id) {
      return null;
    }

    try {
      let query = supabase
        .from('restaurant_sessions')
        .select('*')
        .eq('session_active', true);

      if (sessionId) {
        query = query.eq('id', sessionId);
      } else {
        query = query.eq('user_id', user!.id).order('created_at', { ascending: false }).limit(1);
      }

      const { data, error } = await query.maybeSingle();

      if (error) {
        console.error('❌ Error fetching restaurant session:', error);
        return null;
      }

      return data;
    } catch (error) {
      console.error('❌ Error in getActiveRestaurantSession:', error);
      return null;
    }
  };

  const fetchUnifiedRecommendations = async (
    request: { mode: 'text_only'; dish_description: string; user_budget?: number } |
             PhotoRecommendationRequest |
             RestaurantOCRRequest |
             RestaurantRecoRequest
  ): Promise<any> => {
    const startTime = Date.now();
    secureLog('🔍 fetchUnifiedRecommendations - Starting API call with mode:', request.mode);
    secureLog('⏰ fetchUnifiedRecommendations - Start time:', new Date().toISOString());
    
    // Log request details based on mode
    if (request.mode === 'dish_photo' && 'dish_image_base64' in request) {
      secureLog('📸 fetchUnifiedRecommendations - Dish photo mode');
      logObjectSize('📏 fetchUnifiedRecommendations - Photo data', request.dish_image_base64);
      secureLog('💰 fetchUnifiedRecommendations - Budget:', request.user_budget || 'No budget');
    } else if (request.mode === 'restaurant_ocr' && 'menu_image_base64' in request) {
      secureLog('🔍 fetchUnifiedRecommendations - Restaurant OCR mode');
      logObjectSize('📏 fetchUnifiedRecommendations - Menu photo', request.menu_image_base64);
      secureLog('👤 fetchUnifiedRecommendations - User ID:', sanitizeForLogging(request.user_id));
    } else if (request.mode === 'restaurant_reco' && 'available_wines' in request) {
      secureLog('🍽️ fetchUnifiedRecommendations - Restaurant reco mode');
      secureLog('🍷 fetchUnifiedRecommendations - Available wines count:', request.available_wines.length);
      secureLog('🏪 fetchUnifiedRecommendations - Session ID:', sanitizeForLogging(request.restaurant_session_id));
    } else if (request.mode === 'text_only') {
      secureLog('📝 fetchUnifiedRecommendations - Text only mode');
      secureLog('🍽️ fetchUnifiedRecommendations - Dish:', request.dish_description);
      secureLog('💰 fetchUnifiedRecommendations - Budget:', request.user_budget || 'No budget');
    }
    
    // Get current session for authorization
    const { data: { session }, error: sessionError } = await supabase.auth.getSession();
    
    if (sessionError || !session?.access_token) {
      secureError('❌ fetchUnifiedRecommendations - Session error:', sessionError);
      throw new Error('Session non valide');
    }

    secureLog('🔑 fetchUnifiedRecommendations - Session token available:', !!session?.access_token);

    // Prepare API call
    const apiUrl = `${process.env.EXPO_PUBLIC_SUPABASE_URL}/functions/v1/wine-recommendations`;
    secureLog('📍 fetchUnifiedRecommendations - API URL:', apiUrl);
    
    const headers = {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${session.access_token}`,
      'Cache-Control': 'no-cache, no-store, must-revalidate, max-age=0',
      'Pragma': 'no-cache',
      'Expires': '0',
    };
    
    secureLog('📋 fetchUnifiedRecommendations - Request headers prepared');
    
    // Calculate request body size
    const requestBodyString = JSON.stringify(request);
    const requestBodySize = new Blob([requestBodyString]).size;
    logObjectSize('📦 fetchUnifiedRecommendations - Request body', request);
    
    if (requestBodySize > 1024 * 1024) { // > 1MB
      secureLog('⚠️ fetchUnifiedRecommendations - Large request body detected:', (requestBodySize / 1024 / 1024).toFixed(2), 'MB');
    }
    
    try {
      secureLog('🌐 fetchUnifiedRecommendations - Making fetch request...');
      const fetchStartTime = Date.now();
      
      logObjectSize('🔍 DEBUG - Request', request);
      if ('available_wines' in request && request.available_wines) {
        secureLog('🔍 DEBUG - Available wines count:', request.available_wines.length);
      }

      const response = await fetch(apiUrl, {
        method: 'POST',
        headers,
        body: requestBodyString
      });
      
      const fetchEndTime = Date.now();
      const fetchTime = fetchEndTime - fetchStartTime;
      const totalTime = fetchEndTime - startTime;
      
      secureLog('📊 fetchUnifiedRecommendations - Response status:', response.status);
      secureLog('📊 fetchUnifiedRecommendations - Response status text:', response.statusText);
      secureLog('⏱️ fetchUnifiedRecommendations - Fetch time:', fetchTime + 'ms');
      secureLog('⏱️ fetchUnifiedRecommendations - Total time:', totalTime + 'ms');
      
      if (!response.ok) {
        secureError('❌ fetchUnifiedRecommendations - Response not OK');
        let errorText;
        try {
          errorText = await response.text();
          secureError('❌ fetchUnifiedRecommendations - Error response body:', errorText);
        } catch (textError) {
          secureError('❌ fetchUnifiedRecommendations - Could not read error response:', textError);
          errorText = 'Could not read error response';
        }
        throw new Error(`API Error: ${response.status} ${response.statusText} - ${errorText}`);
      }
      
      secureLog('✅ fetchUnifiedRecommendations - Response OK, parsing JSON...');
      let apiResult;
      try {
        apiResult = await response.json();
        secureLog('✅ fetchUnifiedRecommendations - JSON parsed successfully');
      } catch (jsonError) {
        secureError('❌ fetchUnifiedRecommendations - JSON parsing error:', jsonError);
        const responseText = await response.text();
        secureError('❌ fetchUnifiedRecommendations - Raw response text:', responseText);
        throw new Error(`JSON parsing error: ${jsonError.message}`);
      }
      
      secureLog('🎯 fetchUnifiedRecommendations - API Response for mode', request.mode + ':');
      secureLog('🎯 fetchUnifiedRecommendations - Response keys:', Object.keys(apiResult));
      
      // Log response size
      const responseSize = JSON.stringify(apiResult).length;
      logObjectSize('📦 fetchUnifiedRecommendations - Response', apiResult);
      
      // Check if we got the new algorithm response
      if (apiResult.algorithm) {
        secureLog('🤖 Algorithm version detected:', apiResult.algorithm);
      } else {
        secureLog('⚠️ NO ALGORITHM VERSION in response - using fallback?');
      }
      
      // Handle different response formats based on mode
      if (request.mode === 'restaurant_ocr') {
        secureLog('🔍 Processing restaurant_ocr response');
        secureLog('🔍 fetchUnifiedRecommendations - OCR session_id:', sanitizeForLogging(apiResult.session_id));
        secureLog('🔍 fetchUnifiedRecommendations - OCR restaurant_name:', apiResult.restaurant_name);
        secureLog('🔍 fetchUnifiedRecommendations - OCR extracted_wines count:', apiResult.extracted_wines?.length || 0);
        return {
          id: apiResult.session_id,
          restaurant_name: apiResult.restaurant_name,
          extracted_wines: apiResult.extracted_wines,
          confidence_score: apiResult.confidence_score
        };
      } else if (request.mode === 'restaurant_reco') {
        secureLog('🍽️ Processing restaurant_reco response');
        secureLog('🍽️ fetchUnifiedRecommendations - Restaurant recommendations count:', apiResult.recommendations?.length || 0);
        return apiResult.recommendations || [];
      } else {
        secureLog('🍷 Processing', request.mode, 'recommendations response');
        const recommendations = apiResult.recommendations || apiResult;
        
        if (!Array.isArray(recommendations) || recommendations.length === 0) {
          secureError('❌ Invalid recommendations format:', typeof recommendations, recommendations);
          throw new Error('Aucune recommandation reçue de l\'API');
        }
        
        secureLog('✅ Final recommendations count for', request.mode + ':', recommendations.length);
        if (recommendations.length > 0) {
          secureLog(`🍷 ${request.mode} First recommendation sample:`, sanitizeForLogging({
            name: recommendations[0].name,
            producer: recommendations[0].producer,
            price: recommendations[0].price_estimate || recommendations[0].price,
            category: recommendations[0].category,
            color: recommendations[0].color,
            reasoning: recommendations[0].reasoning?.substring(0, 50) + '...'
          }));
        }
        
        return recommendations;
      }
      
      secureLog('✅ fetchUnifiedRecommendations - API CALL SUCCESSFUL for mode:', request.mode, '- Total time:', totalTime + 'ms');
      
    } catch (apiError) {
      const errorTime = Date.now() - startTime;
      secureError('💥 fetchUnifiedRecommendations - API call failed for mode', request.mode + ':', apiError);
      secureError('💥 fetchUnifiedRecommendations - Error occurred after:', errorTime + 'ms');
      
      // Extraire le message d'erreur du body de la réponse
      let errorData = null;
      try {
        // Si l'erreur contient le body JSON de la réponse
        const errorMatch = apiError.message.match(/\{.*\}$/);
        if (errorMatch) {
          errorData = JSON.parse(errorMatch[0]);
        }
      } catch (e) {
        secureLog('Could not parse error data');
      }
      
      // Si c'est une erreur "Plat non reconnu", ne pas faire de fallback
      if (errorData && errorData.error === 'Plat non reconnu') {
        // Utiliser Alert au lieu de throw pour un message user-friendly
        Alert.alert(
          'Plat non reconnu',
          errorData.message || 'Veuillez décrire un plat réel',
          [{ text: 'OK' }]
        );
        return null; // Retourner null pour ne pas continuer
      }
      
      // Si c'est une erreur "Photo non analysable" 
      if (errorData && errorData.error === 'Photo non analysable') {
        Alert.alert(
          'Photo non analysable',
          errorData.message || 'Veuillez prendre une photo plus claire',
          [{ text: 'OK' }]
        );
        return null;
      }
      
      // Pour les autres erreurs (réseau, serveur, etc.), faire le fallback database
      if (request.mode === 'text_only') {
        secureLog('🗄️ fetchUnifiedRecommendations - Falling back to database for text_only mode');
        return await fetchWineRecommendationsFromDatabase(request.dish_description, request.user_budget);
      } else {
        secureLog('❌ No fallback available for mode:', request.mode);
        throw apiError;
      }
    }
  };

  const fetchWineRecommendationsFromDatabase = async (
    dishDescription: string,
    budget?: number
  ): Promise<WineRecommendation[]> => {
    secureLog('🗄️ fetchWineRecommendationsFromDatabase - Using database fallback for:', dishDescription);
    secureLog('💰 fetchWineRecommendationsFromDatabase - Budget filter:', budget);
    
    let query = supabase
      .from('wines')
      .select('*')
      .not('price_estimate', 'is', null)
      .order('global_wine_score', { ascending: false });

    // Apply budget filter if provided
    if (budget) {
      secureLog('💰 fetchWineRecommendationsFromDatabase - Applying budget filter:', budget);
      query = query.lte('price_estimate', budget);
    }

    const { data: wines, error } = await query.limit(50);
    
    secureLog('🗄️ fetchWineRecommendationsFromDatabase - Database query result:', {
      winesCount: wines?.length || 0,
      error: error?.message
    });

    if (error) throw error;
    if (!wines || wines.length === 0) {
      throw new Error('Aucun vin trouvé pour ces critères');
    }

    // Transform database wines to recommendation format
    const recommendations = wines.slice(0, 3).map((wine, index) => {
      const category = getCategoryFromPrice(wine.price_estimate || 0);
      const color = mapWineColor(wine.color);
      
      const recommendation = {
        id: wine.id,
        name: wine.name,
        producer: wine.producer || 'Producteur inconnu',
        region: wine.region || 'Région inconnue',
        price_estimate: wine.price_estimate || 0,
        rating: wine.global_wine_score || 80,
        category,
        color,
        reasoning: generateReasoning(dishDescription, wine, category),
        grapeVarieties: wine.grape_varieties || [],
        foodPairings: wine.food_pairings || [],
        vintage: wine.vintage || undefined,
        appellation: wine.appellation || undefined,
      };
      
      secureLog(`🍷 fetchWineRecommendationsFromDatabase - Recommendation ${index + 1}:`, sanitizeForLogging(recommendation));
      return recommendation;
    });
    
    secureLog('✅ DATABASE FALLBACK - Final recommendations count:', recommendations.length);
    return recommendations;
  };

  const logRecommendationAnalytics = async (
    userId: string,
    dishDescription: string,
    budget: number | undefined,
    wines: WineRecommendation[]
  ) => {
    try {
      const { error } = await supabase
        .from('user_analytics')
        .insert({
          user_id: userId,
          action_type: 'recommendation_made',
          metadata: {
            dish_description: dishDescription,
            user_budget: budget,
            recommended_wine_ids: wines.map(wine => wine.id),
            wine_count: wines.length,
            timestamp: new Date().toISOString()
          }
        });

      if (error) {
        secureError('❌ Analytics error:', error);
        // Don't throw error - analytics failure shouldn't break the flow
      }
    } catch (error) {
      secureError('❌ Analytics error:', error);
      // Don't throw error - analytics failure shouldn't break the flow
    }
  };

  const saveRecommendationToHistory = async (
    userId: string,
    dishDescription: string,
    budget: number | undefined,
    wines: WineRecommendation[],
    mode: string
  ) => {
    try {
      const { error } = await supabase
        .from('recommendations')
        .insert({
          user_id: userId,
          dish_description: dishDescription,
          user_budget: budget || null,
          recommended_wines: wines,
          created_at: new Date().toISOString(),
        });

      if (error) {
        secureError('❌ Save recommendation error:', error);
        throw error; // Propagate error to make it visible
      }
    } catch (error) {
      secureError('❌ Save recommendation error:', error);
      throw error; // Propagate error to make it visible
    }
  };

  const updatePopularDish = async (dishName: string) => {
    const { data: existing, error: fetchError } = await supabase
      .from('popular_dishes')
      .select('*')
      .eq('dish_name', dishName)
      .maybeSingle();

    if (fetchError) {
      secureError('Error fetching popular dish:', fetchError);
      return;
    }

    if (existing) {
      // Update count
      await supabase
        .from('popular_dishes')
        .update({ count_searches: (existing.count_searches || 0) + 1 })
        .eq('id', existing.id);
    } else {
      // Create new entry
      await supabase
        .from('popular_dishes')
        .insert({ dish_name: dishName, count_searches: 1 });
    }
  };

  const getRecommendationHistory = async (userId: string): Promise<Recommendation[]> => {
    const { data, error, count } = await supabase
      .from('recommendations')
      .select('*', { count: 'exact' })
      .eq('user_id', userId)
      .order('created_at', { ascending: false });

    if (error) {
      secureError('❌ Get recommendation history error:', error);
      throw error;
    }

    return data || [];
  };

  const getCategoryFromPrice = (price: number): 'economique' | 'qualite-prix' | 'premium' => {
    if (price <= 15) return 'economique';
    if (price <= 30) return 'qualite-prix';
    return 'premium';
  };

  const mapWineColor = (color: string | null): 'rouge' | 'blanc' | 'rose' | 'sparkling' => {
    switch (color) {
      case 'red': return 'rouge';
      case 'white': return 'blanc';
      case 'rosé': return 'rose';
      case 'sparkling': return 'sparkling';
      default: return 'rouge';
    }
  };

  const generateReasoning = (dish: string, wine: Wine, category: string): string => {
    const reasonings = [
      `Ce ${wine.color === 'red' ? 'rouge' : wine.color === 'white' ? 'blanc' : 'vin'} s'accorde parfaitement avec ${dish} grâce à ses arômes qui complètent les saveurs du plat.`,
      `Un excellent choix ${category} qui équilibre parfaitement les saveurs de ${dish}.`,
      `Ce vin de ${wine.region} apporte la structure idéale pour accompagner ${dish}.`,
      `Les tanins souples de ce vin s'harmonisent parfaitement avec ${dish}.`,
    ];
    
    return reasonings[Math.floor(Math.random() * reasonings.length)];
  };

  // FONCTION POUR SCAN CARTE RESTAURANT
  const getWineCardScan = async (imageBase64: string, userId: string) => {
    secureLog('🔍 getWineCardScan called');
    logObjectSize('🔍 getWineCardScan - Image', imageBase64);
    secureLog('👤 getWineCardScan pour user:', sanitizeForLogging(userId));
    
    if (!imageBase64) {
      throw new Error('Image base64 requise');
    }
    
    if (!userId) {
      throw new Error('User ID requis');
    }
    
    try {
      secureLog('🚀 getWineCardScan - Appel fetchUnifiedRecommendations avec mode restaurant_ocr');
      
      const result = await fetchUnifiedRecommendations({
        mode: 'restaurant_ocr',
        menu_image_base64: imageBase64,
        user_id: userId
      });
      
      secureLog('✅ getWineCardScan - Résultat OCR reçu:', sanitizeForLogging({
        session_id: result.id,
        restaurant_name: result.restaurant_name,
        wines_count: result.extracted_wines?.length || 0
      }));
      
      return result;
    } catch (error) {
      secureError('❌ getWineCardScan - Erreur:', error);
      secureError('🔍 getWineCardScan - Error details:', {
        message: error.message,
        stack: error.stack,
        name: error.name
      });
      throw error;
    }
  };

  return {
    getRecommendations,
    getRecommendationsFromPhoto,
    getRestaurantOCR,
    getRestaurantRecommendations,
    getWineCardScan,
    analyzePhotoForDish,
    getActiveRestaurantSession,
    getRecommendationHistory,
    loading,
    error,
  };
}