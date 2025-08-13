import { useState } from 'react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/hooks/useAuth';
import type { Database } from '@/lib/supabase';

type Wine = Database['public']['Tables']['wines']['Row'];
type Recommendation = Database['public']['Tables']['recommendations']['Row'];

export interface WineRecommendation {
  id: string;
  name: string;
  producer: string;
  region: string;
  price: number;
  rating: number;
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
  const { user, updateUsageCount } = useAuth();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const getRecommendations = async (
    dishDescription: string,
    budget?: number,
    timestamp?: number,
  ): Promise<WineRecommendation[]> => {
    console.log('🚀 STARTING TEXT_ONLY MODE for:', dishDescription);
    console.log('🔄 getRecommendations - Starting with params:', {
      dishDescription,
      budget,
      timestamp,
      userId: user?.id
    });
    
    setLoading(true);
    setError(null);

    try {
      // First, update popular dishes count
      await updatePopularDish(dishDescription);

      // Get wine recommendations from Edge Function
      const wines = await fetchUnifiedRecommendations({
        mode: 'text_only',
        dish_description: dishDescription,
        user_budget: budget
      });
      
      console.log('🍷 getRecommendations - TEXT_ONLY mode completed, wines:', wines.length);

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
    wineType?: string | null
  ): Promise<WineRecommendation[]> => {
    console.log('📸 STARTING DISH_PHOTO MODE - Photo analysis');
    console.log('📸 Photo base64 length:', photoBase64.length);
    console.log('💰 Photo mode budget:', budget);
    console.log('🍷 Photo mode wine type:', wineType);
    
    setLoading(true);
    setError(null);

    try {
      const wines = await fetchUnifiedRecommendations({
        mode: 'dish_photo',
        dish_image_base64: photoBase64,
        user_budget: budget,
        wine_type_preference: wineType
      });

      console.log('📸 getRecommendationsFromPhoto - DISH_PHOTO mode completed, wines:', wines.length);
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
    console.log('🔍 STARTING RESTAURANT_OCR MODE - Menu OCR analysis');
    console.log('🔍 Menu photo base64 length:', menuPhotoBase64.length);
    console.log('👤 OCR for user:', userId);
    
    setLoading(true);
    setError(null);

    try {
      const result = await fetchUnifiedRecommendations({
        mode: 'restaurant_ocr',
        menu_image_base64: menuPhotoBase64,
        user_id: userId
      });

      console.log('🔍 getRestaurantOCR - RESTAURANT_OCR mode completed');
      console.log('🏪 Restaurant detected:', result.restaurant_name);
      console.log('🍷 Wines extracted:', result.extracted_wines?.length || 0);
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
    availableWines: any[]
  ): Promise<RestaurantRecommendation[]> => {
    console.log('🍽️ STARTING RESTAURANT_RECO MODE - Restaurant recommendations');
    console.log('🍽️ Dish:', dish);
    console.log('🏪 Session ID:', sessionId);
    console.log('🍷 Available wines count:', availableWines.length);
    
    setLoading(true);
    setError(null);

    try {
      const recommendations = await fetchUnifiedRecommendations({
        mode: 'restaurant_reco',
        dish_description: dish,
        restaurant_session_id: sessionId,
        available_wines: availableWines
      });

      console.log('🍽️ getRestaurantRecommendations - RESTAURANT_RECO mode completed');
      console.log('🎯 Restaurant recommendations count:', recommendations.length);
      return recommendations as RestaurantRecommendation[];
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Erreur recommandations restaurant';
      setError(errorMessage);
      throw err;
    } finally {
      setLoading(false);
    }
  };

  const fetchUnifiedRecommendations = async (
    request: { mode: 'text_only'; dish_description: string; user_budget?: number } |
             PhotoRecommendationRequest |
             RestaurantOCRRequest |
             RestaurantRecoRequest
  ): Promise<any> => {
    const startTime = Date.now();
    console.log('🔍 fetchUnifiedRecommendations - Starting API call with mode:', request.mode);
    console.log('⏰ fetchUnifiedRecommendations - Start time:', new Date().toISOString());
    
    // Log request details based on mode
    if (request.mode === 'dish_photo' && 'dish_image_base64' in request) {
      console.log('📸 fetchUnifiedRecommendations - Dish photo mode');
      console.log('📏 fetchUnifiedRecommendations - Base64 image size:', request.dish_image_base64.length, 'characters');
      console.log('💰 fetchUnifiedRecommendations - Budget:', request.user_budget || 'No budget');
    } else if (request.mode === 'restaurant_ocr' && 'menu_image_base64' in request) {
      console.log('🔍 fetchUnifiedRecommendations - Restaurant OCR mode');
      console.log('📏 fetchUnifiedRecommendations - Base64 image size:', request.menu_image_base64.length, 'characters');
      console.log('👤 fetchUnifiedRecommendations - User ID:', request.user_id);
    } else if (request.mode === 'restaurant_reco' && 'available_wines' in request) {
      console.log('🍽️ fetchUnifiedRecommendations - Restaurant reco mode');
      console.log('🍷 fetchUnifiedRecommendations - Available wines count:', request.available_wines.length);
      console.log('🏪 fetchUnifiedRecommendations - Session ID:', request.restaurant_session_id);
    } else if (request.mode === 'text_only') {
      console.log('📝 fetchUnifiedRecommendations - Text only mode');
      console.log('🍽️ fetchUnifiedRecommendations - Dish:', request.dish_description);
      console.log('💰 fetchUnifiedRecommendations - Budget:', request.user_budget || 'No budget');
    }
    
    // Get current session for authorization
    const { data: { session }, error: sessionError } = await supabase.auth.getSession();
    
    if (sessionError || !session?.access_token) {
      console.error('❌ fetchUnifiedRecommendations - Session error:', sessionError);
      throw new Error('Session non valide');
    }

    console.log('🔑 fetchUnifiedRecommendations - Session token available:', !!session?.access_token);

    // Prepare API call
    const apiUrl = `${process.env.EXPO_PUBLIC_SUPABASE_URL}/functions/v1/wine-recommendations`;
    console.log('📍 fetchUnifiedRecommendations - API URL:', apiUrl);
    
    const headers = {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${session.access_token}`,
      'Cache-Control': 'no-cache, no-store, must-revalidate, max-age=0',
      'Pragma': 'no-cache',
      'Expires': '0',
    };
    
    console.log('📋 fetchUnifiedRecommendations - Request headers prepared');
    
    // Calculate request body size
    const requestBodyString = JSON.stringify(request);
    const requestBodySize = new Blob([requestBodyString]).size;
    console.log('📦 fetchUnifiedRecommendations - Request body size:', requestBodySize, 'bytes');
    console.log('📦 fetchUnifiedRecommendations - Request body size:', (requestBodySize / 1024).toFixed(2), 'KB');
    
    if (requestBodySize > 1024 * 1024) { // > 1MB
      console.warn('⚠️ fetchUnifiedRecommendations - Large request body detected:', (requestBodySize / 1024 / 1024).toFixed(2), 'MB');
    }
    
    try {
      console.log('🌐 fetchUnifiedRecommendations - Making fetch request...');
      const fetchStartTime = Date.now();
      
      const response = await fetch(apiUrl, {
        method: 'POST',
        headers,
        body: requestBodyString
      });
      
      const fetchEndTime = Date.now();
      const fetchTime = fetchEndTime - fetchStartTime;
      const totalTime = fetchEndTime - startTime;
      
      console.log('📊 fetchUnifiedRecommendations - Response status:', response.status);
      console.log('📊 fetchUnifiedRecommendations - Response status text:', response.statusText);
      console.log('⏱️ fetchUnifiedRecommendations - Fetch time:', fetchTime + 'ms');
      console.log('⏱️ fetchUnifiedRecommendations - Total time:', totalTime + 'ms');
      console.log('📡 fetchUnifiedRecommendations - Response headers:', Object.fromEntries(response.headers.entries()));
      
      if (!response.ok) {
        console.error('❌ fetchUnifiedRecommendations - Response not OK');
        let errorText;
        try {
          errorText = await response.text();
          console.error('❌ fetchUnifiedRecommendations - Error response body:', errorText);
        } catch (textError) {
          console.error('❌ fetchUnifiedRecommendations - Could not read error response:', textError);
          errorText = 'Could not read error response';
        }
        throw new Error(`API Error: ${response.status} ${response.statusText} - ${errorText}`);
      }
      
      console.log('✅ fetchUnifiedRecommendations - Response OK, parsing JSON...');
      let apiResult;
      try {
        apiResult = await response.json();
        console.log('✅ fetchUnifiedRecommendations - JSON parsed successfully');
      } catch (jsonError) {
        console.error('❌ fetchUnifiedRecommendations - JSON parsing error:', jsonError);
        const responseText = await response.text();
        console.error('❌ fetchUnifiedRecommendations - Raw response text:', responseText);
        throw new Error(`JSON parsing error: ${jsonError.message}`);
      }
      
      console.log('🎯 fetchUnifiedRecommendations - API Response for mode', request.mode + ':');
      console.log('🎯 fetchUnifiedRecommendations - Response keys:', Object.keys(apiResult));
      
      // Log response size
      const responseSize = JSON.stringify(apiResult).length;
      console.log('📦 fetchUnifiedRecommendations - Response size:', responseSize, 'characters');
      console.log('📦 fetchUnifiedRecommendations - Response size:', (responseSize / 1024).toFixed(2), 'KB');
      
      // Check if we got the new algorithm response
      if (apiResult.algorithm) {
        console.log('🤖 Algorithm version detected:', apiResult.algorithm);
      } else {
        console.log('⚠️ NO ALGORITHM VERSION in response - using fallback?');
      }
      
      // Handle different response formats based on mode
      if (request.mode === 'restaurant_ocr') {
        console.log('🔍 Processing restaurant_ocr response');
        console.log('🔍 fetchUnifiedRecommendations - OCR session_id:', apiResult.session_id);
        console.log('🔍 fetchUnifiedRecommendations - OCR restaurant_name:', apiResult.restaurant_name);
        console.log('🔍 fetchUnifiedRecommendations - OCR extracted_wines count:', apiResult.extracted_wines?.length || 0);
        return {
          id: apiResult.session_id,
          restaurant_name: apiResult.restaurant_name,
          extracted_wines: apiResult.extracted_wines,
          confidence_score: apiResult.confidence_score
        };
      } else if (request.mode === 'restaurant_reco') {
        console.log('🍽️ Processing restaurant_reco response');
        console.log('🍽️ fetchUnifiedRecommendations - Restaurant recommendations count:', apiResult.recommendations?.length || 0);
        return apiResult.recommendations || [];
      } else {
        console.log('🍷 Processing', request.mode, 'recommendations response');
        const recommendations = apiResult.recommendations || apiResult;
        
        if (!Array.isArray(recommendations) || recommendations.length === 0) {
          console.error('❌ Invalid recommendations format:', typeof recommendations, recommendations);
          throw new Error('Aucune recommandation reçue de l\'API');
        }
        
        console.log('✅ Final recommendations count for', request.mode + ':', recommendations.length);
        if (recommendations.length > 0) {
          console.log(`🍷 ${request.mode} First recommendation sample:`, {
            name: recommendations[0].name,
            producer: recommendations[0].producer,
            price: recommendations[0].price_estimate || recommendations[0].price,
            category: recommendations[0].category,
            color: recommendations[0].color,
            reasoning: recommendations[0].reasoning?.substring(0, 50) + '...'
          });
        }
        
        return recommendations;
      }
      
      console.log('✅ fetchUnifiedRecommendations - API CALL SUCCESSFUL for mode:', request.mode, '- Total time:', totalTime + 'ms');
      
    } catch (apiError) {
      const errorTime = Date.now() - startTime;
      console.error('💥 fetchUnifiedRecommendations - API call failed for mode', request.mode + ':', apiError);
      console.error('💥 fetchUnifiedRecommendations - Error occurred after:', errorTime + 'ms');
      console.error('🔍 Error details:', {
        message: apiError.message,
        stack: apiError.stack,
        name: apiError.name,
        cause: apiError.cause
      });
      
      // Fallback to database if API fails
      if (request.mode === 'text_only') {
        console.log('🗄️ fetchUnifiedRecommendations - Falling back to database for text_only mode');
        return await fetchWineRecommendationsFromDatabase(request.dish_description, request.user_budget);
      } else {
        console.log('❌ No fallback available for mode:', request.mode);
        throw apiError;
      }
    }
  };

  const fetchWineRecommendationsFromDatabase = async (
    dishDescription: string,
    budget?: number
  ): Promise<WineRecommendation[]> => {
    console.log('🗄️ fetchWineRecommendationsFromDatabase - Using database fallback for:', dishDescription);
    console.log('💰 fetchWineRecommendationsFromDatabase - Budget filter:', budget);
    
    let query = supabase
      .from('wines')
      .select('*')
      .not('price_estimate', 'is', null)
      .order('global_wine_score', { ascending: false });

    // Apply budget filter if provided
    if (budget) {
      console.log('💰 fetchWineRecommendationsFromDatabase - Applying budget filter:', budget);
      query = query.lte('price_estimate', budget);
    }

    const { data: wines, error } = await query.limit(50);
    
    console.log('🗄️ fetchWineRecommendationsFromDatabase - Database query result:', {
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
      
      console.log(`🍷 fetchWineRecommendationsFromDatabase - Recommendation ${index + 1}:`, recommendation);
      return recommendation;
    });
    
    console.log('✅ DATABASE FALLBACK - Final recommendations count:', recommendations.length);
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
        console.error('❌ Analytics error:', error);
        // Don't throw error - analytics failure shouldn't break the flow
      }
    } catch (error) {
      console.error('❌ Analytics error:', error);
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
        console.error('❌ Save recommendation error:', error);
        throw error; // Propagate error to make it visible
      }
    } catch (error) {
      console.error('❌ Save recommendation error:', error);
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
      console.error('Error fetching popular dish:', fetchError);
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
      console.error('❌ Get recommendation history error:', error);
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
    console.log('🔍 getWineCardScan appelé avec image de taille:', imageBase64.length);
    console.log('👤 getWineCardScan pour user:', userId);
    
    if (!imageBase64) {
      throw new Error('Image base64 requise');
    }
    
    if (!userId) {
      throw new Error('User ID requis');
    }
    
    try {
      console.log('🚀 getWineCardScan - Appel fetchUnifiedRecommendations avec mode restaurant_ocr');
      
      const result = await fetchUnifiedRecommendations({
        mode: 'restaurant_ocr',
        menu_image_base64: imageBase64,
        user_id: userId
      });
      
      console.log('✅ getWineCardScan - Résultat OCR reçu:', {
        session_id: result.id,
        restaurant_name: result.restaurant_name,
        wines_count: result.extracted_wines?.length || 0
      });
      
      return result;
    } catch (error) {
      console.error('❌ getWineCardScan - Erreur:', error);
      console.error('🔍 getWineCardScan - Error details:', {
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
    getWineCardScan,
    getRecommendationHistory,
    loading,
    error,
  };
}