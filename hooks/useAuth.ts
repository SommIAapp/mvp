import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import type { User } from '@supabase/supabase-js';
import type { Database } from '@/lib/supabase';

type UserProfile = Database['public']['Tables']['user_profiles']['Row'] & {
  trial_start_date: string | null;
  last_daily_reset: string | null;
};

export function useAuth() {
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Get initial session
    const initializeAuth = async () => {
      // Check if Supabase is properly configured
      if (!process.env.EXPO_PUBLIC_SUPABASE_URL || !process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY) {
        console.error('❌ Supabase environment variables not configured');
        setUser(null);
        setProfile(null);
        setLoading(false);
        return;
      }

      try {
        const { data: { session }, error } = await supabase.auth.getSession();
        
        if (error && error.message.includes('Refresh Token Not Found')) {
          // Clear invalid session
          await supabase.auth.signOut();
          setUser(null);
          setProfile(null);
          setLoading(false);
          return;
        }
        
        setUser(session?.user ?? null);
        if (session?.user) {
          fetchProfile(session.user.id);
        } else {
          setLoading(false);
        }
      } catch (error) {
        console.error('Auth initialization error:', error);
        // Clear any potentially corrupted auth state
        await supabase.auth.signOut();
        setUser(null);
        setProfile(null);
        setLoading(false);
      }
    };
    
    initializeAuth();

    // Listen for auth changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event, session) => {
        setUser(session?.user ?? null);
        if (session?.user) {
          await fetchProfile(session.user.id);
        } else {
          setProfile(null);
          setLoading(false);
        }
      }
    );

    return () => subscription.unsubscribe();
  }, []);

  const fetchProfile = async (userId: string) => {
    let finalProfileData: UserProfile | null = null;
    
    try {
      const now = new Date().toISOString();
      
      const { data, error } = await supabase
        .from('user_profiles')
        .select('*')
        .eq('id', userId)
        .maybeSingle();


      if (error) {
        console.error('❌ fetchProfile - Database error:', error);
        throw error;
      }
      
      if (!data) {
        const newProfile = {
          id: userId,
          email: user?.email || '',
          subscription_plan: 'free' as const, // New users start as free (not trial)
          daily_count: 0, // Explicitly set to 0 for new users
          monthly_count: 0,
          trial_start_date: null, // No trial started yet
          last_daily_reset: null,
          created_at: now,
        };


        const { data: createdProfile, error: createError } = await supabase
          .from('user_profiles')
          .upsert(newProfile, {
            onConflict: 'email',
            ignoreDuplicates: false
          })
          .select()
          .maybeSingle();

        if (createError) {
          console.error('❌ fetchProfile - Error creating profile:', createError);
          // Don't throw error, continue with minimal profile
          setProfile({
            ...newProfile,
            id: userId,
          } as UserProfile);
          finalProfileData = {
            ...newProfile,
            id: userId,
          } as UserProfile;
        } else {
          if (createdProfile) {
            setProfile(createdProfile);
            finalProfileData = createdProfile;
          }
        }
      } else {
        // Check if we need to reset daily count
        const today = new Date().toDateString();
        const lastReset = data.last_daily_reset ? new Date(data.last_daily_reset).toDateString() : null;
        
        if (lastReset !== today) {
          // Reset daily count for new day
          const { data: updatedProfile, error: updateError } = await supabase
            .from('user_profiles')
            .update({
              daily_count: 0,
              last_daily_reset: now,
            })
            .eq('id', userId)
            .select()
            .maybeSingle();
            
          if (!updateError && updatedProfile) {
            setProfile(updatedProfile);
            finalProfileData = updatedProfile;
          } else {
            console.error('❌ fetchProfile - Error resetting daily count:', updateError);
            setProfile(data);
            finalProfileData = data;
          }
        } else {
          // Check if free user has non-zero daily count and reset it
          if (data.subscription_plan === 'free' && (data.daily_count || 0) > 0) {
            const { data: updatedProfile, error: updateError } = await supabase
              .from('user_profiles')
              .update({
                daily_count: 0,
                last_daily_reset: now,
              })
              .eq('id', userId)
              .select()
              .maybeSingle();
              
            if (!updateError && updatedProfile) {
              setProfile(updatedProfile);
              finalProfileData = updatedProfile;
            } else {
              console.error('❌ fetchProfile - Error resetting free user daily count:', updateError);
              // Set daily_count to 0 in local state even if DB update failed
              const correctedData = { ...data, daily_count: 0, last_daily_reset: now };
              setProfile(correctedData);
              finalProfileData = correctedData;
            }
          } else {
            setProfile(data);
            finalProfileData = data;
          }
        }
      }
    } catch (error) {
      console.error('💥 fetchProfile - Unexpected error:', error);
      
      // Fail-safe: create minimal profile to allow app to continue
      const minimalProfile = {
        id: userId,
        email: user?.email || '',
        subscription_plan: 'free' as const,
        daily_count: 0,
        monthly_count: 0,
        trial_start_date: null,
        last_daily_reset: null,
        created_at: new Date().toISOString(),
      } as UserProfile;
      
      console.log('🛡️ fetchProfile - Setting minimal profile as fallback:', minimalProfile);
      setProfile(minimalProfile);
      finalProfileData = minimalProfile;
    } finally {
      setLoading(false);
    }
  };

  const signIn = async (email: string, password: string) => {
    const { error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });
    return { error };
  };

  const signUp = async (email: string, password: string, fullName?: string) => {
    const { error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: {
          full_name: fullName,
        },
      },
    });
    return { error };
  };

  const signOut = async () => {
    const { error } = await supabase.auth.signOut();
    return { error };
  };

  const checkDailyQuota = () => {
    if (!profile) {
      return false; // Changed: Don't allow if no profile
    }
    
    // Premium users have unlimited access
    if (profile.subscription_plan === 'premium') {
      return true;
    }
    
    // Trial users get 1 recommendation per day
    if (profile.subscription_plan === 'trial') {
      // Check if trial has expired (7 days)
      if (profile.trial_start_date) {
        const trialStart = new Date(profile.trial_start_date);
        const now = new Date();
        const daysSinceStart = Math.floor((now.getTime() - trialStart.getTime()) / (1000 * 60 * 60 * 24));
        
        if (daysSinceStart >= 7) {
          return false; // Trial expired
        }
      }
      
      // Check daily limit (1 per day for trial users)
      const dailyCount = profile.daily_count || 0;
      const canMakeRecommendation = dailyCount < 1;
      
      return canMakeRecommendation;
    }
    
    // Free users (new accounts) - allow first recommendation to start trial
    if (profile.subscription_plan === 'free') {
      return false; // Changed: Free users must start trial first
    }
    
    return false;
  };

  const canMakeRecommendation = () => {
    const result = checkDailyQuota();
    return result;
  };

  const updateUsageCount = async () => {
    if (!profile || !user) {
      return;
    }
    

    // Ensure we have the latest profile data before updating
    const currentDailyCount = profile.daily_count || 0;
    const now = new Date().toISOString();


    const { error } = await supabase
      .from('user_profiles')
      .update({
        daily_count: currentDailyCount + 1,
        last_daily_reset: now,
      })
      .eq('id', user.id);

    if (error) {
      console.error('❌ updateUsageCount - Database error:', error);
      throw error; // Propagate error instead of just logging
    } else {
      // Update local state with the new count
      setProfile({
        ...profile,
        daily_count: currentDailyCount + 1,
        last_daily_reset: now,
      });
      
    }
  };

  const startFreeTrial = async () => {
    if (!user) {
      console.error('❌ startFreeTrial - No user found');
      return { error: new Error('Utilisateur non connecté') };
    }

    try {
      const now = new Date().toISOString();
      
      const { data: updatedProfile, error } = await supabase
        .from('user_profiles')
        .upsert({
          id: user.id,
          email: user.email || '',
          subscription_plan: 'trial',
          trial_start_date: now,
          daily_count: 0,
          last_daily_reset: now,
        }, {
          onConflict: 'id',
          ignoreDuplicates: false
        })
        .select()
        .maybeSingle();

      if (error) {
        console.error('❌ startFreeTrial - Error:', error);
        throw error;
      }

      if (updatedProfile) {
        setProfile(updatedProfile);
      }
      
      return { error: null };
    } catch (error) {
      console.error('❌ startFreeTrial - Error:', error);
      return { error };
    }
  };
  
  const getTrialDaysRemaining = () => {
    if (!profile || profile.subscription_plan !== 'trial' || !profile.trial_start_date) return 0;
    
    const trialStart = new Date(profile.trial_start_date);
    const now = new Date();
    const daysSinceStart = Math.floor((now.getTime() - trialStart.getTime()) / (1000 * 60 * 60 * 24));
    
    return Math.max(0, 7 - daysSinceStart);
  };
  
  const isTrialExpired = () => {
    if (!profile || profile.subscription_plan !== 'trial') return false;
    return getTrialDaysRemaining() === 0;
  };

  return {
    user,
    profile,
    loading,
    signIn,
    signUp,
    signOut,
    canMakeRecommendation,
    updateUsageCount,
    fetchProfile,
    getTrialDaysRemaining,
    isTrialExpired,
    startFreeTrial,
  };
}