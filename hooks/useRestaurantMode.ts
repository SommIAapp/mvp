import { useState } from 'react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/hooks/useAuth';
import { useRecommendations } from '@/hooks/useRecommendations';
import * as ImagePicker from 'expo-image-picker';

// Custom error for user cancellations
class UserCancellationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'UserCancellationError';
  }
}

interface RestaurantSession {
  id: string;
  restaurant_name: string;
  extracted_wines: ExtractedWine[];
  confidence_score: number;
  session_active: boolean;
}

interface ExtractedWine {
  id: string;
  name: string;
  type: 'rouge' | 'blanc' | 'rosé' | 'champagne';
  price_glass?: number;
  price_bottle?: number;
  region?: string;
  match_confidence: number;
  suggested_food_pairings?: string[];
  price_range?: string;
}

interface RestaurantRecommendation {
  wine_id: string;
  name: string;
  type: string;
  price_display: string;
  match_score: number;
  reasoning: string;
  restaurant_availability: boolean;
  alternative_if_unavailable?: string;
}

export function useRestaurantMode() {
  const { user, updateUsageCount } = useAuth();
  const { getRestaurantOCR, getRestaurantRecommendations: getUnifiedRestaurantRecommendations, getWineCardScan, checkOCRStatus } = useRecommendations();
  const [currentSession, setCurrentSession] = useState<RestaurantSession | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Export setCurrentSession for external use
  const setCurrentSessionExternal = (session: RestaurantSession | null) => {
    setCurrentSession(session);
  };

  // SCANNER CARTE DES VINS (avec système asynchrone)
  const scanWineCard = async (base64Image: string): Promise<RestaurantSession> => {
    console.log('📸 scanWineCard - Début du scan avec image de taille:', base64Image?.length || 0);
    console.log('👤 scanWineCard - User ID:', user?.id);
    
    setLoading(true);
    setError(null);

    try {
      if (!base64Image) {
        console.error('❌ scanWineCard - Image base64 manquante');
        throw new Error('Image base64 requise');
      }

      if (!user?.id) {
        console.error('❌ scanWineCard - User ID manquant');
        throw new Error('Utilisateur non connecté');
      }

      console.log('🔍 scanWineCard - Appel getWineCardScan...');
      const ocrResult = await getWineCardScan(base64Image, user.id);
      
      // Vérifier si on a reçu un task_id (mode asynchrone)
      if (ocrResult.task_id && !ocrResult.extracted_wines) {
        console.log('📝 Mode asynchrone détecté - Task ID:', ocrResult.task_id);
        
        // Polling pour vérifier le statut
        const pollInterval = 2000; // 2 secondes
        const maxAttempts = 45; // 90 secondes max
        let attempts = 0;
        
        while (attempts < maxAttempts) {
          console.log(`🔄 Vérification statut OCR (${attempts + 1}/${maxAttempts})...`);
          
          try {
           // Utiliser la fonction importée au lieu de la locale
            const statusResponse = await checkOCRStatus(ocrResult.task_id);
            console.log('📊 Statut OCR:', statusResponse.status);
            
            if (statusResponse.status === 'completed') {
              console.log(`✅ OCR terminé avec succès: ${statusResponse.wines_count} vins extraits`);
              
              const restaurantSession: RestaurantSession = {
                id: statusResponse.session_id,
                restaurant_name: statusResponse.restaurant_name,
                extracted_wines: statusResponse.extracted_wines,
                confidence_score: 0.85,
                session_active: true,
              };
              
              setCurrentSession(restaurantSession);
              return restaurantSession;
              
            } else if (statusResponse.status === 'failed') {
              console.error('❌ OCR échoué:', statusResponse.error);
              throw new Error(statusResponse.error || 'Échec de l\'analyse de la carte');
            }
            
            // Attendre avant le prochain check
            await new Promise(resolve => setTimeout(resolve, pollInterval));
            attempts++;
            
          } catch (pollError) {
            console.error('❌ Erreur lors du polling:', pollError);
            // En cas d'erreur de polling, on continue d'essayer
            await new Promise(resolve => setTimeout(resolve, pollInterval));
            attempts++;
          }
        }
        
        // Timeout
        throw new Error('Analyse trop longue. Veuillez réessayer.');
        
      } else {
        // Mode synchrone (ancien comportement)
        console.log('✅ scanWineCard - OCR terminé avec succès (mode synchrone)');
        
        const restaurantSession: RestaurantSession = {
          id: ocrResult.session_id || ocrResult.id,
          restaurant_name: ocrResult.restaurant_name,
          extracted_wines: ocrResult.extracted_wines,
          confidence_score: ocrResult.confidence_score || 0.85,
          session_active: true,
        };

        setCurrentSession(restaurantSession);
        console.log('✅ scanWineCard - Session créée:', restaurantSession.id);
        
        return restaurantSession;
      }

    } catch (err) {
      console.error('💥 scanWineCard - Erreur capturée:', err);
      console.error('🔍 scanWineCard - Type d\'erreur:', err.constructor.name);
      console.error('🔍 scanWineCard - Message:', err.message);
      const errorMessage = err instanceof Error ? err.message : 'Erreur scan';
      
      // Don't treat user cancellation as a critical error
      if (err instanceof UserCancellationError) {
        console.log('ℹ️ User cancelled scan');
        // Don't set error state for cancellations
      } else {
        setError(errorMessage);
        console.error('❌ Scan error:', errorMessage);
      }
      throw err;
    } finally {
      console.log('🏁 scanWineCard - Fin du processus, loading = false');
      setLoading(false);
    }
  };

  // RECOMMANDATIONS BASÉES SUR LA CARTE
  const getRestaurantRecommendations = async (
    dishDescription: string,
    sessionId?: string,
    budget?: number,
    wineType?: string | null
  ): Promise<RestaurantRecommendation[]> => {
    if (!currentSession && !sessionId) {
      throw new Error('Aucune session restaurant active');
    }

   // Vérifier que la session a des vins extraits
   const session = currentSession || await getSessionById(sessionId!);
   
   if (!session.extracted_wines || session.extracted_wines.length === 0) {
     throw new Error('La carte des vins est encore en cours d\'analyse. Veuillez patienter.');
   }

    setLoading(true);
    setError(null);

    try {
      console.log('🤖 Calling RESTAURANT_RECO mode via unified service for:', dishDescription, 'with wine type:', wineType);
      const recommendations = await getUnifiedRestaurantRecommendations(
        dishDescription,
        session.id,
        session.extracted_wines,
        budget,
        wineType
      );
      
      await saveRestaurantRecommendation(session.id, dishDescription, recommendations);
      
      console.log('✅ RESTAURANT_RECO mode completed, recommendations:', recommendations.length);
      
      return recommendations;

    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Erreur recommandations';
      setError(errorMessage);
      console.error('❌ Restaurant recommendations error:', errorMessage);
      throw err;
    } finally {
      setLoading(false);
    }
  };

  // UTILITAIRES
  const getSessionById = async (sessionId: string): Promise<RestaurantSession> => {
    const { data, error } = await supabase
      .from('restaurant_sessions')
      .select('*')
      .eq('id', sessionId)
      .single();

    if (error) {
      console.error('❌ Error fetching session:', error);
      throw error;
    }
    
    return data;
  };

  const saveRestaurantRecommendation = async (
    sessionId: string,
    dishDescription: string,
    recommendations: RestaurantRecommendation[]
  ) => {
    try {
      const { error } = await supabase
        .from('restaurant_recommendations')
        .insert({
          session_id: sessionId,
          user_id: user?.id,
          dish_description: dishDescription,
          recommended_wines: recommendations,
          match_quality: recommendations.length > 0 ? 
            recommendations.reduce((sum, r) => sum + r.match_score, 0) / recommendations.length / 100 : 0.5
        });

      if (error) {
        console.error('❌ Error saving recommendation:', error);
      }
    } catch (error) {
      console.error('❌ Error saving recommendation:', error);
    }
  };

  const clearSession = () => {
    setCurrentSession(null);
    setError(null);
  };

  const pickFromGallery = async (): Promise<RestaurantSession> => {
    throw new Error('Cette fonction doit être appelée depuis le composant avec l\'image base64');
  };

  return {
    currentSession,
    loading,
    error,
    setCurrentSession: setCurrentSessionExternal,
    scanWineCard,
    pickFromGallery,
    getRestaurantRecommendations,
    getRestaurantRecommendationHistory,
    clearSession,
  };
}

// RÉCUPÉRER L'HISTORIQUE DES RECOMMANDATIONS RESTAURANT
export const getRestaurantRecommendationHistory = async (userId: string) => {
  try {
    console.log('📚 Loading restaurant recommendations for user:', userId);
    
    const { data, error } = await supabase
      .from('restaurant_recommendations')
      .select(`
        *,
        restaurant_sessions!inner(
          id,
          restaurant_name,
          extracted_wines
        )
      `)
      .eq('user_id', userId)
      .order('created_at', { ascending: false });

    if (error) {
      console.error('❌ Error fetching restaurant history:', error);
      throw error;
    }

    console.log('📚 Restaurant recommendations raw data:', data);

    const transformedData = data?.map(item => ({
      id: item.id,
      dish_description: item.dish_description,
      recommended_wines: item.recommended_wines,
      created_at: item.created_at,
      user_id: item.user_id,
      user_budget: null,
      type: 'restaurant',
      restaurant_sessions: {
        restaurant_name: item.restaurant_sessions?.restaurant_name || 'Restaurant',
        extracted_wines: item.restaurant_sessions?.extracted_wines || []
      }
    })) || [];

    console.log('📚 Restaurant recommendations transformed:', transformedData.length);
    
    return transformedData;
  } catch (error) {
    console.error('❌ Error in getRestaurantRecommendationHistory:', error);
    return [];
  }
};

// Export the custom error for use in components
export { UserCancellationError };