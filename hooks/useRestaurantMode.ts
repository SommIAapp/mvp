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
  const { getRestaurantOCR, getRestaurantRecommendations: getUnifiedRestaurantRecommendations, getWineCardScan } = useRecommendations();
  const [currentSession, setCurrentSession] = useState<RestaurantSession | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Export setCurrentSession for external use
  const setCurrentSessionExternal = (session: RestaurantSession | null) => {
    setCurrentSession(session);
  };

  // SCANNER CARTE