import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL!;
const supabaseAnonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY!;

export const supabase = createClient(supabaseUrl, supabaseAnonKey);

export type Database = {
  public: {
    Tables: {
      user_profiles: {
        Row: {
          id: string;
          email: string | null;
          subscription_plan: 'trial' | 'premium' | null;
          daily_count: number | null;
          monthly_count: number | null;
          trial_start_date: string | null;
          last_daily_reset: string | null;
          created_at: string | null;
        };
        Insert: {
          id: string;
          email?: string | null;
          subscription_plan?: 'trial' | 'premium' | null;
          daily_count?: number | null;
          monthly_count?: number | null;
          trial_start_date?: string | null;
          last_daily_reset?: string | null;
          created_at?: string | null;
        };
        Update: {
          id?: string;
          email?: string | null;
          subscription_plan?: 'trial' | 'premium' | null;
          daily_count?: number | null;
          monthly_count?: number | null;
          trial_start_date?: string | null;
          last_daily_reset?: string | null;
          created_at?: string | null;
        };
      };
      wines: {
        Row: {
          id: string;
          name: string;
          producer: string | null;
          region: string | null;
          appellation: string | null;
          vintage: number | null;
          color: string | null;
          grape_varieties: string[] | null;
          price_estimate: number | null;
          price_range: string | null;
          global_wine_score: number | null;
          food_pairings: string[] | null;
          description: string | null;
          gws_api_id: string | null;
          created_at: string | null;
        };
        Insert: {
          id?: string;
          name: string;
          producer?: string | null;
          region?: string | null;
          appellation?: string | null;
          vintage?: number | null;
          color?: string | null;
          grape_varieties?: string[] | null;
          price_estimate?: number | null;
          price_range?: string | null;
          global_wine_score?: number | null;
          food_pairings?: string[] | null;
          description?: string | null;
          gws_api_id?: string | null;
          created_at?: string | null;
        };
        Update: {
          id?: string;
          name?: string;
          producer?: string | null;
          region?: string | null;
          appellation?: string | null;
          vintage?: number | null;
          color?: string | null;
          grape_varieties?: string[] | null;
          price_estimate?: number | null;
          price_range?: string | null;
          global_wine_score?: number | null;
          food_pairings?: string[] | null;
          description?: string | null;
          gws_api_id?: string | null;
          created_at?: string | null;
        };
      };
      recommendations: {
        Row: {
          id: string;
          user_id: string | null;
          dish_description: string;
          user_budget: number | null;
          recommended_wines: any;
          created_at: string | null;
        };
        Insert: {
          id?: string;
          user_id?: string | null;
          dish_description: string;
          user_budget?: number | null;
          recommended_wines: any;
          created_at?: string | null;
        };
        Update: {
          id?: string;
          user_id?: string | null;
          dish_description?: string;
          user_budget?: number | null;
          recommended_wines?: any;
          created_at?: string | null;
        };
      };
      popular_dishes: {
        Row: {
          id: string;
          dish_name: string | null;
          count_searches: number | null;
          created_at: string | null;
        };
        Insert: {
          id?: string;
          dish_name?: string | null;
          count_searches?: number | null;
          created_at?: string | null;
        };
        Update: {
          id?: string;
          dish_name?: string | null;
          count_searches?: number | null;
          created_at?: string | null;
        };
      };
      recommendation_feedback: {
        Row: {
          id: string;
          user_id: string | null;
          recommendation_id: string | null;
          wine_id: string | null;
          rating: number | null;
          feedback_text: string | null;
          created_at: string | null;
        };
        Insert: {
          id?: string;
          user_id?: string | null;
          recommendation_id?: string | null;
          wine_id?: string | null;
          rating?: number | null;
          feedback_text?: string | null;
          created_at?: string | null;
        };
        Update: {
          id?: string;
          user_id?: string | null;
          recommendation_id?: string | null;
          wine_id?: string | null;
          rating?: number | null;
          feedback_text?: string | null;
          created_at?: string | null;
        };
      };
    };
    Enums: {
      wine_color: 'fortified' | 'red' | 'rosé' | 'sparkling' | 'white';
      price_range: '0-10' | '10-15' | '15-25' | '25-50' | '50+';
      subscription_plan: 'free' | 'premium';
      query_status: 'failed' | 'retried' | 'success';
    };
  };
};