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

export function useRecommendations() {
  const { user, updateUsageCount } = useAuth();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const getRecommendations = async (
    dishDescription: string,
    budget?: number,
  ): Promise<WineRecommendation[]> => {
    setLoading(true);
    setError(null);

    try {
      // First, update popular dishes count
      await updatePopularDish(dishDescription);

      // Get wine recommendations based on dish and budget
      const wines = await fetchWineRecommendations(dishDescription, budget);

      // Save recommendation to history first
      if (user) {
        await saveRecommendationToHistory(user.id, dishDescription, budget, wines);
        
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
    wines: WineRecommendation[]
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

  const fetchWineRecommendations = async (
    dishDescription: string,
    budget?: number
  ): Promise<WineRecommendation[]> => {
    let query = supabase
      .from('wines')
      .select('*')
      .not('price_estimate', 'is', null)
      .order('global_wine_score', { ascending: false });

    // Apply budget filter if provided
    if (budget) {
      query = query.lte('price_estimate', budget);
    }

    const { data: wines, error } = await query.limit(50);

    if (error) throw error;
    if (!wines || wines.length === 0) {
      throw new Error('Aucun vin trouvé pour ces critères');
    }

    // Transform database wines to recommendation format
    const recommendations = wines.slice(0, 3).map((wine, index) => {
      const category = getCategoryFromPrice(wine.price_estimate || 0);
      const color = mapWineColor(wine.color);
      
      return {
        id: wine.id,
        name: wine.name,
        producer: wine.producer || 'Producteur inconnu',
        region: wine.region || 'Région inconnue',
        price: wine.price_estimate || 0,
        rating: wine.global_wine_score || 80,
        category,
        color,
        reasoning: generateReasoning(dishDescription, wine, category),
        grapeVarieties: wine.grape_varieties || [],
        foodPairings: wine.food_pairings || [],
        vintage: wine.vintage || undefined,
        appellation: wine.appellation || undefined,
      };
    });

    return recommendations;
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

  const saveRecommendation = async (
    userId: string,
    dishDescription: string,
    budget: number | undefined,
    wines: WineRecommendation[]
  ) => {
    // This function is deprecated - use saveRecommendationToHistory instead
    const { error } = await supabase
      .from('recommendations')
      .insert({
        user_id: userId,
        dish_description: dishDescription,
        user_budget: budget || null,
        recommended_wines: wines,
      });

    if (error) {
      console.error('Error saving recommendation:', error);
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
    getRecommendationHistory,
    loading,
    error,
  };
}