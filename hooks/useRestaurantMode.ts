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
        
        // Fonction checkOCRStatus locale
        const checkOCRStatus = async (taskId: string) => {
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
              mode: 'check_ocr_status',
              task_id: taskId
            }),
          });

          if (!response.ok) {
            throw new Error('Erreur vérification statut');
          }

          return await response.json();
        };
        
        // Polling pour vérifier le statut
        const pollInterval = 2000; // 2 secondes
        const maxAttempts = 45; // 90 secondes max
        let attempts = 0;
        
        while (attempts < maxAttempts) {
          console.log(`🔄 Vérification statut OCR (${attempts + 1}/${maxAttempts})...`);
          
          try {
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
}