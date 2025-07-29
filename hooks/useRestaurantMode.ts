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
  const { getRestaurantOCR, getRestaurantRecommendations: getUnifiedRestaurantRecommendations } = useRecommendations();
  const [currentSession, setCurrentSession] = useState<RestaurantSession | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Export setCurrentSession for external use
  const setCurrentSessionExternal = (session: RestaurantSession | null) => {
    setCurrentSession(session);
  };

  // SCANNER CARTE DES VINS
  const scanWineCard = async (imageUri?: string): Promise<RestaurantSession> => {
    setLoading(true);
    setError(null);

    try {
      let finalImageUri = imageUri;
      
      if (!finalImageUri) {
        // Demander permission caméra
        const { status } = await ImagePicker.requestCameraPermissionsAsync();
        
        if (status !== 'granted') {
          throw new Error('Permission caméra requise');
        }

        // Ouvrir caméra
        const result = await ImagePicker.launchCameraAsync({
          mediaTypes: ImagePicker.MediaTypeOptions.Images,
          allowsEditing: true,
          aspect: [4, 3],
          quality: 0.8,
        });

        if (result.canceled) {
          throw new UserCancellationError('Scan annulé');
        }

        finalImageUri = result.assets[0].uri;
      }

      // Convertir image en base64
      const base64 = await convertImageToBase64(finalImageUri);

      // Utiliser la fonction unifiée pour l'OCR
      console.log('📸 Calling RESTAURANT_OCR mode via unified service...');
      const ocrResult = await getRestaurantOCR(base64, user?.id || '');

      const restaurantSession: RestaurantSession = {
        id: ocrResult.id,
        restaurant_name: ocrResult.restaurant_name,
        extracted_wines: ocrResult.extracted_wines,
        confidence_score: ocrResult.confidence_score,
        session_active: true,
      };

      setCurrentSession(restaurantSession);
      console.log('✅ RESTAURANT_OCR mode completed, session created:', restaurantSession.id);
      
      // Update usage count after successful scan
      if (user) {
        await updateUsageCount();
        console.log('✅ Usage count updated after scan');
      }
      
      return restaurantSession;

    } catch (err) {
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
      setLoading(false);
    }
  };

  // RECOMMANDATIONS BASÉES SUR LA CARTE
  const getRestaurantRecommendations = async (
    dishDescription: string,
    sessionId?: string
  ): Promise<RestaurantRecommendation[]> => {
    if (!currentSession && !sessionId) {
      throw new Error('Aucune session restaurant active');
    }

    setLoading(true);
    setError(null);

    try {
      const session = currentSession || await getSessionById(sessionId!);
      
      // Utiliser la fonction unifiée pour les recommandations restaurant
      console.log('🤖 Calling RESTAURANT_RECO mode via unified service for:', dishDescription);
      const recommendations = await getUnifiedRestaurantRecommendations(
        dishDescription,
        session.id,
        session.extracted_wines
      );
      
      // Sauvegarder recommandation
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
        // Don't throw - this shouldn't break the flow
      }
    } catch (error) {
      console.error('❌ Error saving recommendation:', error);
      // Don't throw - this shouldn't break the flow
    }
  };

  const clearSession = () => {
    setCurrentSession(null);
    setError(null);
  };

  const pickFromGallery = async (): Promise<RestaurantSession> => {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    
    if (status !== 'granted') {
      throw new Error('Permission galerie requise');
    }

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true,
      aspect: [4, 3],
      quality: 0.8,
    });

    if (result.canceled) {
      throw new UserCancellationError('Sélection annulée');
    }

    return await scanWineCard(result.assets[0].uri);
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
    const { data, error } = await supabase
      .from('restaurant_recommendations')
      .select(`
        *,
        restaurant_sessions!inner(
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

    return data || [];
  } catch (error) {
    console.error('❌ Error in getRestaurantRecommendationHistory:', error);
    throw error;
  }
};

// Export the custom error for use in components
export { UserCancellationError };

// UTILITAIRE CONVERSION IMAGE
async function convertImageToBase64(imageUri: string): Promise<string> {
  const response = await fetch(imageUri);
  const blob = await response.blob();
  
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => {
      const result = reader.result as string;
      const base64 = result.split(',')[1]; // Enlever data:image/jpeg;base64,
      resolve(base64);
    };
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  });
}