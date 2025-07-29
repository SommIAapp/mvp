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
    console.log('🚀 STARTING API CALL pour:', dishDescription);
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
      
      console.log('🍷 getRecommendations - Fetched wines:', wines);

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
    budget?: number
  ): Promise<WineRecommendation[]> => {
    console.log('📸 getRecommendationsFromPhoto - Starting photo analysis');
    
    setLoading(true);
    setError(null);

    try {
      const wines = await fetchUnifiedRecommendations({
        mode: 'dish_photo',
        dish_image_base64: photoBase64,
        user_budget: budget
      });

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
    console.log('🔍 getRestaurantOCR - Starting menu OCR analysis');
    
    setLoading(true);
    setError(null);

    try {
      const result = await fetchUnifiedRecommendations({
        mode: 'restaurant_ocr',
        menu_image_base64: menuPhotoBase64,
        user_id: userId
      });

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
    console.log('🍽️ getRestaurantRecommendations - Starting restaurant recommendations');
    
    setLoading(true);
    setError(null);

    try {
      const recommendations = await fetchUnifiedRecommendations({
        mode: 'restaurant_reco',
        dish_description: dish,
        restaurant_session_id: sessionId,
        available_wines: availableWines
      });

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
    console.log('🔍 fetchUnifiedRecommendations - Starting API call with mode:', request.mode);
    
    // Get current session for authorization
    const { data: { session }, error: sessionError } = await supabase.auth.getSession();
    
    if (sessionError || !session?.access_token) {
      console.error('❌ fetchUnifiedRecommendations - Session error:', sessionError);
      throw new Error('Session non valide');
    }

    console.log('🔑 fetchUnifiedRecommendations - Session token available:', !!session?.access_token);

    // Prepare API call
    const apiUrl = `${process.env.EXPO_PUBLIC_SUPABASE_URL}/functions/v1/wine-recommendations`;
    const requestBody = request;
    
    const headers = {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${session.access_token}`,
      'Cache-Control': 'no-cache, no-store, must-revalidate, max-age=0',
      'Pragma': 'no-cache',
      'Expires': '0',
    };
    
    console.log('📍 URL appelée:', apiUrl);
    console.log('📝 Request body:', JSON.stringify(requestBody, null, 2));
    console.log('📋 fetchUnifiedRecommendations - Headers:', JSON.stringify(headers, null, 2));
    console.log('⏰ fetchUnifiedRecommendations - Timestamp:', new Date().toISOString());
    
    try {
      console.log('🌐 fetchUnifiedRecommendations - Making fetch request...');
      
      const response = await fetch(apiUrl, {
        method: 'POST',
        headers,
        body: JSON.stringify(requestBody)
      });
      
      console.log('📊 Response status:', response.status);
      console.log('📡 fetchUnifiedRecommendations - Response headers:', Object.fromEntries(response.headers.entries()));
      
      if (!response.ok) {
        const errorText = await response.text();
        console.error('❌ fetchUnifiedRecommendations - API error:', errorText);
        throw new Error(`API Error: ${response.status} - ${errorText}`);
      }
      
      const apiResult = await response.json();
      console.log('🎯 API Response data:', JSON.stringify(apiResult, null, 2));
      
      // Check if we got the new algorithm response
      if (apiResult.algorithm) {
        console.log('🔍 Algorithm version:', apiResult.algorithm);
        console.log('✅ Using algorithm:', apiResult.algorithm);
      } else {
        console.log('❌ NO ALGORITHM VERSION in response - using fallback?');
      }
      
      // Handle different response formats based on mode
      if (request.mode === 'restaurant_ocr') {
        // OCR mode returns session data
        return {
          id: apiResult.session_id,
          restaurant_name: apiResult.restaurant_name,
          extracted_wines: apiResult.extracted_wines,
          confidence_score: apiResult.confidence_score
        };
      } else if (request.mode === 'restaurant_reco') {
        // Restaurant recommendations mode
        return apiResult.recommendations || [];
      } else {
        // Normal recommendations (text_only, dish_photo)
        const recommendations = apiResult.recommendations || apiResult;
        
        if (!Array.isArray(recommendations) || recommendations.length === 0) {
          console.error('❌ Invalid recommendations format:', typeof recommendations, recommendations);
          throw new Error('Aucune recommandation reçue de l\'API');
        }
        
        console.log('🍷 fetchUnifiedRecommendations - Final recommendations count:', recommendations.length);
        recommendations.forEach((rec, index) => {
          console.log(`🍷 Recommendation ${index + 1}:`, {
            name: rec.name,
            producer: rec.producer,
            price: rec.price_estimate || rec.price,
            category: rec.category,
            color: rec.color,
            reasoning: rec.reasoning?.substring(0, 100) + '...'
          });
        });
        
        return recommendations;
      }
      
      console.log('✅ API CALL SUCCESSFUL - returning', recommendations.length, 'recommendations');
      return recommendations;
      
    } catch (apiError) {
      console.error('💥 fetchUnifiedRecommendations - API call failed:', apiError);
      console.error('🔍 Error details:', {
        message: apiError.message,
        stack: apiError.stack,
        name: apiError.name
      });
      
      // Fallback to database if API fails
      if (request.mode === 'text_only') {
        console.log('🗄️ fetchUnifiedRecommendations - Falling back to database');
        return await fetchWineRecommendationsFromDatabase(request.dish_description, request.user_budget);
      } else {
        // For other modes, don't fallback to database
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

  return {
    getRecommendations,
    getRecommendationsFromPhoto,
    getRestaurantOCR,
    getRestaurantRecommendations,
    getRecommendationHistory,
    loading,
    error,
  };
}