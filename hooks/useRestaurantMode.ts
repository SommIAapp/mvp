import { useState } from 'react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/hooks/useAuth';

interface ExtractedWine {
  name: string;
  type: 'rouge' | 'blanc' | 'rosé' | 'champagne';
  price_glass?: number;
  price_bottle?: number;
  region?: string;
  confidence?: number;
}

interface RestaurantSession {
  id: string;
  restaurant_name?: string;
  extracted_wines: ExtractedWine[];
  created_at: string;
}

interface RestaurantRecommendation {
  name: string;
  type: string;
  price_bottle?: number;
  price_glass?: number;
  region?: string;
  reasoning: string;
  match_score: number;
}

export function useRestaurantMode() {
  const { user, updateUsageCount } = useAuth();
  const [currentSession, setCurrentSession] = useState<RestaurantSession | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const scanWineCard = async (imageUri: string): Promise<{ 
    session_id: string; 
    restaurant_name?: string; 
    extracted_wines: ExtractedWine[] 
  }> => {
    setLoading(true);
    setError(null);

    try {
      // Get current session for authorization
      const { data: { session }, error: sessionError } = await supabase.auth.getSession();
      
      if (sessionError || !session?.access_token) {
        throw new Error('Session non valide');
      }

      // Convert image to base64
      const response = await fetch(imageUri);
      const blob = await response.blob();
      const base64 = await new Promise<string>((resolve) => {
        const reader = new FileReader();
        reader.onloadend = () => {
          const result = reader.result as string;
          resolve(result.split(',')[1]); // Remove data:image/jpeg;base64, prefix
        };
        reader.readAsDataURL(blob);
      });

      // Call OCR Edge Function
      const apiUrl = `${process.env.EXPO_PUBLIC_SUPABASE_URL}/functions/v1/restaurant-wine-scan`;
      
      const ocrResponse = await fetch(apiUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({
          image_base64: base64,
          user_id: user?.id,
        }),
      });

      if (!ocrResponse.ok) {
        const errorData = await ocrResponse.json();
        throw new Error(errorData.error || 'Erreur lors du traitement de l\'image');
      }

      const result = await ocrResponse.json();
      
      // Save session to state
      const sessionData: RestaurantSession = {
        id: result.session_id,
        restaurant_name: result.restaurant_name,
        extracted_wines: result.extracted_wines || [],
        created_at: new Date().toISOString(),
      };
      
      setCurrentSession(sessionData);
      
      return result;
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Erreur lors du scan';
      setError(errorMessage);
      throw err;
    } finally {
      setLoading(false);
    }
  };

  const getRestaurantRecommendations = async (
    dishDescription: string,
    availableWines: ExtractedWine[],
    budget?: number | null
  ): Promise<RestaurantRecommendation[]> => {
    setLoading(true);
    setError(null);

    try {
      // Get current session for authorization
      const { data: { session }, error: sessionError } = await supabase.auth.getSession();
      
      if (sessionError || !session?.access_token) {
        throw new Error('Session non valide');
      }

      // Call restaurant recommendations Edge Function
      const apiUrl = `${process.env.EXPO_PUBLIC_SUPABASE_URL}/functions/v1/restaurant-recommendations`;
      
      const response = await fetch(apiUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({
          dish_description: dishDescription,
          available_wines: availableWines,
          user_budget: budget,
          restaurant_session_id: currentSession?.id,
          user_id: user?.id,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Erreur lors de la génération des recommandations');
      }

      const result = await response.json();
      const recommendations = result.recommendations || [];

      // Update usage count for non-premium users
      if (user) {
        await updateUsageCount();
        
        // Save restaurant recommendation to history
        await saveRestaurantRecommendation(
          user.id,
          dishDescription,
          availableWines,
          recommendations,
          budget
        );
      }

      return recommendations;
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Erreur lors des recommandations';
      setError(errorMessage);
      throw err;
    } finally {
      setLoading(false);
    }
  };

  const saveRestaurantRecommendation = async (
    userId: string,
    dishDescription: string,
    availableWines: ExtractedWine[],
    recommendations: RestaurantRecommendation[],
    budget?: number | null
  ) => {
    try {
      const { error } = await supabase
        .from('recommendations')
        .insert({
          user_id: userId,
          dish_description: `[Restaurant] ${dishDescription}`,
          user_budget: budget || null,
          recommended_wines: recommendations,
          created_at: new Date().toISOString(),
        });

      if (error) {
        console.error('Error saving restaurant recommendation:', error);
        // Don't throw - this shouldn't break the flow
      }

      // Also log analytics for restaurant mode
      await supabase
        .from('user_analytics')
        .insert({
          user_id: userId,
          action_type: 'restaurant_recommendation',
          metadata: {
            dish_description: dishDescription,
            available_wines_count: availableWines.length,
            recommendations_count: recommendations.length,
            user_budget: budget,
            restaurant_session_id: currentSession?.id,
            timestamp: new Date().toISOString()
          }
        });
    } catch (error) {
      console.error('Error saving restaurant data:', error);
      // Don't throw - analytics failure shouldn't break the flow
    }
  };

  return {
    scanWineCard,
    getRestaurantRecommendations,
    currentSession,
    loading,
    error,
  };
}