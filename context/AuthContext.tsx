import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { supabase } from '@/lib/supabase';
import type { User } from '@supabase/supabase-js';
import type { Database } from '@/lib/supabase';
import { secureLog, secureError, sanitizeForLogging } from '@/utils/secureLogging';

type UserProfile = Database['public']['Tables']['user_profiles']['Row'] & {
  trial_start_date: string | null;
  last_daily_reset: string | null;
};

interface AuthContextType {
  user: User | null;
  profile: UserProfile | null;
  loading: boolean;
  signIn: (email: string, password: string) => Promise<{ error: any }>;
  signUp: (email: string, password: string, fullName?: string) => Promise<{ error: any }>;
  signOut: () => Promise<{ error: any }>;
  canMakeRecommendation: () => boolean;
  updateUsageCount: () => Promise<void>;
  fetchProfile: (userId: string) => Promise<void>;
  getTrialDaysRemaining: () => number;
  isTrialExpired: () => boolean;
  startFreeTrial: () => Promise<{ error: any }>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

interface AuthProviderProps {
  children: ReactNode;
}

export function AuthProvider({ children }: AuthProviderProps) {
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    secureLog('🔐 AuthProvider: Initializing session...');
    
    // Get initial session
    const initializeAuth = async () => {
      // Check if Supabase is properly configured
      if (!process.env.EXPO_PUBLIC_SUPABASE_URL || !process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY) {
        secureError('❌ Supabase environment variables not configured');
        secureLog('🔐 AuthProvider: Environment variables missing, setting user to null');
        setUser(null);
        setProfile(null);
        setLoading(false);
        return;
      }

      try {
        const { data: { session }, error } = await supabase.auth.getSession();
        secureLog('🔐 AuthProvider: getSession result:', sanitizeForLogging({ 
          session: !!session, 
          user: session?.user?.id, 
          error: error?.message 
        }));
        
        if (error && error.message.includes('Refresh Token Not Found')) {
          secureLog('🔐 AuthProvider: Refresh Token Not Found, signing out.');
          // Clear invalid session
          await supabase.auth.signOut();
          setUser(null);
          setProfile(null);
          setLoading(false);
          return;
        }
        
        setUser(session?.user ?? null);
        if (session?.user) {
          secureLog('🔐 AuthProvider: Valid session found, fetching profile for user:', sanitizeForLogging(session.user.id));
          await fetchProfile(session.user.id);
        } else {
          secureLog('🔐 AuthProvider: No valid session found, setting loading to false');
          setLoading(false);
        }
      } catch (error) {
        secureError('🔐 AuthProvider: Initialization error caught:', error);
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
        secureLog('🔐 AuthProvider: State change detected. Event:', event, 'Session:', !!session, 'User:', sanitizeForLogging(session?.user?.id));
        
        // Log detailed event information when user becomes null
        if (!session?.user) {
          secureLog('🚨 AuthProvider: User became null! Event details:', sanitizeForLogging({
            event,
            hasSession: !!session,
            sessionUser: session?.user?.id || 'null',
            timestamp: new Date().toISOString()
          }));
        }
        
        setUser(session?.user ?? null);
        if (session?.user) {
          secureLog('🔐 AuthProvider: Auth state change - fetching profile for user:', sanitizeForLogging(session.user.id));
          await fetchProfile(session.user.id);
        } else {
          secureLog('🔐 AuthProvider: Auth state change - no session, clearing profile');
          setProfile(null);
          setLoading(false);
        }
      }
    );

    return () => subscription.unsubscribe();
  }, []); // Empty dependency array - only run once on mount

  const fetchProfile = async (userId: string) => {
    secureLog('🔐 AuthProvider: Fetching profile for userId:', sanitizeForLogging(userId));
    let finalProfileData: UserProfile | null = null;
    
    try {
      const now = new Date().toISOString();
      
      secureLog('🔐 AuthProvider: Querying user_profiles for ID:', sanitizeForLogging(userId));
      const { data, error } = await supabase
        .from('user_profiles')
        .select('*')
        .eq('id', userId)
        .maybeSingle();

      secureLog('🔐 AuthProvider: User profile query result:', { data: !!data, error: error?.message });

      if (error) {
        secureError('🔐 AuthProvider: Error fetching profile from DB:', error);
        throw error;
      }
      
      if (!data) {
        secureLog('🔐 AuthProvider: Profile not found, attempting to create new profile.');
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

        secureLog('🔐 AuthProvider: New profile creation result:', { createdProfile: !!createdProfile, createError: createError?.message });
        if (createError) {
          secureError('❌ fetchProfile - Error creating profile:', createError);
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
        secureLog('🔐 AuthProvider: Profile found. Checking daily quota reset logic.');
        // Check if we need to reset daily count
        const today = new Date().toDateString();
        const lastReset = data.last_daily_reset ? new Date(data.last_daily_reset).toDateString() : null;
        
        if (lastReset !== today) {
          secureLog('🔐 AuthProvider: Daily quota needs reset. Last reset:', lastReset, 'Today:', today);
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
            secureLog('🔐 AuthProvider: Daily quota reset successful');
            setProfile(updatedProfile);
            finalProfileData = updatedProfile;
          } else {
            secureError('❌ fetchProfile - Error resetting daily count:', updateError);
            setProfile(data);
            finalProfileData = data;
          }
        } else {
          // Check if free user has non-zero daily count and reset it
          if (data.subscription_plan === 'free' && (data.daily_count || 0) > 0) {
            secureLog('🔐 AuthProvider: Free user has non-zero daily count, resetting to 0');
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
              secureLog('🔐 AuthProvider: Free user daily count reset successful');
              setProfile(updatedProfile);
              finalProfileData = updatedProfile;
            } else {
              secureError('❌ fetchProfile - Error resetting free user daily count:', updateError);
              // Set daily_count to 0 in local state even if DB update failed
              const correctedData = { ...data, daily_count: 0, last_daily_reset: now };
              setProfile(correctedData);
              finalProfileData = correctedData;
            }
          } else {
            secureLog('🔐 AuthProvider: Profile is up to date, no changes needed');
            setProfile(data);
            finalProfileData = data;
          }
        }
      }
    } catch (error) {
      secureError('🔐 AuthProvider: Unexpected error in fetchProfile:', error);
      
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
      
      secureLog('🔐 AuthProvider: Setting minimal profile as fallback:', sanitizeForLogging(minimalProfile));
      setProfile(minimalProfile);
      finalProfileData = minimalProfile;
    } finally {
      secureLog('🔐 AuthProvider: fetchProfile finished. Loading set to false.');
      setLoading(false);
    }
  };

  const signIn = async (email: string, password: string) => {
    secureLog('🔐 AuthProvider: Attempting to sign in with email:', sanitizeForLogging(email));
    const { error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });
    secureLog('🔐 AuthProvider: Sign in result:', { success: !error, error: error?.message });
    return { error };
  };

  const signUp = async (email: string, password: string, fullName?: string) => {
    secureLog('🔐 AuthProvider: Attempting to sign up with email:', sanitizeForLogging(email));
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: {
          full_name: fullName,
        },
      },
    });
    
    if (error) {
      secureError('❌ AuthProvider: Sign up error:', error.message);
      return { error };
    }

    if (data.user) {
      secureLog('🎯 AuthProvider: Starting free trial for new user');
      
      // Attendre un peu pour que le profile soit créé par le trigger
      await new Promise(resolve => setTimeout(resolve, 1000));
      
      try {
        const now = new Date().toISOString();
        
        const { data: updatedProfile, error: trialError } = await supabase
          .from('user_profiles')
          .upsert({
            id: data.user.id,
            email: data.user.email || '',
            subscription_plan: 'trial',
            trial_start_date: now,
            daily_count: 0,
            monthly_count: 0,
            last_daily_reset: now,
            full_name: fullName || null,
          }, {
            onConflict: 'id',
            ignoreDuplicates: false
          })
          .select()
          .single();
        
        if (trialError) {
          secureError('❌ AuthProvider: Failed to start trial:', trialError);
          // Ne pas bloquer la création du compte pour autant
        } else {
          secureLog('✅ AuthProvider: Trial started successfully');
          
          // Mettre à jour le state local immédiatement
          if (updatedProfile) {
            setProfile(updatedProfile);
          }
        }
      } catch (trialError) {
        secureError('❌ AuthProvider: Trial setup exception:', trialError);
        // Ne pas bloquer la création du compte
      }
    }

    logMinimal('🔐 AuthProvider: Sign up result', {
      status: 'success',
      type: 'signup',
      trialStarted: true
    });
    return { error: null };
  };

  const signOut = async () => {
    secureLog('🔐 AuthProvider: Attempting to sign out.');
    const { error } = await supabase.auth.signOut();
    secureLog('🔐 AuthProvider: Sign out result:', { success: !error, error: error?.message });
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
      secureError('❌ updateUsageCount - Database error:', error);
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
      secureError('❌ startFreeTrial - No user found');
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
        secureError('❌ startFreeTrial - Error:', error);
        throw error;
      }

      if (updatedProfile) {
        setProfile(updatedProfile);
      }
      
      return { error: null };
    } catch (error) {
      secureError('❌ startFreeTrial - Error:', error);
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

  // Log current state on every render for debugging
  secureLog('🔐 AuthProvider: Current state -', sanitizeForLogging({
    user: user ? `${user.id} (${user.email})` : 'null',
    profile: profile ? `${profile.subscription_plan} - daily: ${profile.daily_count}` : 'null',
    loading
  }));

  const value: AuthContextType = {
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

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth(): AuthContextType {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}