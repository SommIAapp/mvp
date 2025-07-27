import { useState, useEffect } from 'react';
import { AppState, Alert } from 'react-native';
import * as WebBrowser from 'expo-web-browser';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/hooks/useAuth';

interface SubscriptionData {
  customer_id: string | null;
  subscription_id: string | null;
  subscription_status: string | null;
  price_id: string | null;
  current_period_start: number | null;
  current_period_end: number | null;
  cancel_at_period_end: boolean | null;
  payment_method_brand: string | null;
  payment_method_last4: string | null;
}

export function useSubscription() {
  const { user } = useAuth();
  const [subscription, setSubscription] = useState<SubscriptionData | null>(null);
  const [loading, setLoading] = useState(true);
  const [checkoutLoading, setCheckoutLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (user) {
      fetchSubscription();
    } else {
      setSubscription(null);
      setLoading(false);
    }
  }, [user]);

  // AppState listener to detect when user returns to app
  useEffect(() => {
    if (!checkoutLoading) return;

    const handleAppStateChange = (nextAppState: string) => {
      if (nextAppState === 'active' && checkoutLoading) {
        // User returned to app, check if payment succeeded after a short delay
        setTimeout(async () => {
          await fetchSubscription();
          
          // If still not premium after checking, consider payment cancelled
          if (!isPremium()) {
            setCheckoutLoading(false);
            Alert.alert(
              'Paiement annulé',
              'Pas de souci ! Tu peux réessayer quand tu veux.',
              [{ text: 'OK' }]
            );
          } else {
            setCheckoutLoading(false);
          }
        }, 5000); // Wait 5 seconds for subscription to sync
      }
    };

    const subscription = AppState.addEventListener('change', handleAppStateChange);
    return () => subscription?.remove();
  }, [checkoutLoading]);

  const fetchSubscription = async () => {
    try {
      setLoading(true);
      setError(null);

      const { data, error: fetchError } = await supabase
        .from('stripe_user_subscriptions')
        .select('*')
        .maybeSingle();

      if (fetchError) {
        throw fetchError;
      }

      setSubscription(data);
    } catch (err) {
      console.error('Error fetching subscription:', err);
      setError(err instanceof Error ? err.message : 'Failed to fetch subscription');
    } finally {
      setLoading(false);
    }
  };

  const createCheckoutSession = async (priceId: string, mode: 'subscription' | 'payment' = 'subscription') => {
    setCheckoutLoading(true);
    
    // Automatic timeout after 2 minutes
    const timeoutId = setTimeout(() => {
      setCheckoutLoading(false);
      Alert.alert(
        'Paiement annulé',
        'Le délai de paiement a expiré. Tu peux réessayer quand tu veux !',
        [{ text: 'OK' }]
      );
    }, 120000); // 2 minutes
    
    try {
      if (!user) {
        throw new Error('User must be authenticated');
      }

      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.access_token) {
        throw new Error('No valid session found');
      }

      const response = await fetch(`${process.env.EXPO_PUBLIC_SUPABASE_URL}/functions/v1/stripe-checkout`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({
          price_id: priceId,
          mode,
          success_url: `${window.location.origin}/subscription-success`,
          cancel_url: `${window.location.origin}/subscription`,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to create checkout session');
      }

      const { url } = await response.json();
      
      if (url) {
        await WebBrowser.openBrowserAsync(url);
      } else {
        throw new Error('No checkout URL received');
      }
    } catch (err) {
      console.error('Error creating checkout session:', err);
      clearTimeout(timeoutId);
      setCheckoutLoading(false);
      throw err;
    }
  };

  const cancelCheckout = () => {
    setCheckoutLoading(false);
    Alert.alert(
      'Paiement annulé',
      'Pas de problème ! Tu peux reprendre ton abonnement quand tu veux.',
      [{ text: 'OK' }]
    );
  };

  const isActive = () => {
    return subscription?.subscription_status === 'active' || subscription?.subscription_status === 'trialing';
  };

  const isPremium = () => {
    return isActive() && subscription?.price_id === 'price_1Rixo1EafAFTMvbGEUY381Z2';
  };

  return {
    subscription,
    loading,
    checkoutLoading,
    error,
    createCheckoutSession,
    cancelCheckout,
    fetchSubscription,
    isActive,
    isPremium,
  };
}