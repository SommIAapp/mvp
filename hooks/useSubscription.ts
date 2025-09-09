import { useState, useEffect, useCallback } from 'react';
import { Alert } from 'react-native';
import Purchases, { 
  CustomerInfo, 
  PurchasesPackage,
  LOG_LEVEL 
} from 'react-native-purchases';
import { useAuth } from './useAuth';
import { supabase } from '@/lib/supabase';

const API_KEY = 'appl_wTyEDGymBMkhfAztsEoeVrdWOmm';

export function useSubscription() {
  const { user } = useAuth();
  const [customerInfo, setCustomerInfo] = useState<CustomerInfo | null>(null);
  const [packages, setPackages] = useState<PurchasesPackage[]>([]);
  const [loading, setLoading] = useState(true);
  const [checkoutLoading, setCheckoutLoading] = useState(false);

  useEffect(() => {
    initializeRevenueCat();
  }, [user]);

  const initializeRevenueCat = async () => {
    if (!user) return;
    
    try {
      Purchases.setLogLevel(LOG_LEVEL.DEBUG);
      await Purchases.configure({ apiKey: API_KEY });
      
      // Identifier l'utilisateur avec Supabase ID
      await Purchases.logIn(user.id);
      
      // Récupérer les offres
      const offerings = await Purchases.getOfferings();
      if (offerings.current) {
        setPackages(offerings.current.availablePackages);
      }
      
      // Récupérer les infos client
      const info = await Purchases.getCustomerInfo();
      setCustomerInfo(info);
      
      // Listener pour les mises à jour
      Purchases.addCustomerInfoUpdateListener(setCustomerInfo);
    } catch (error) {
      console.error('RevenueCat init error:', error);
    } finally {
      setLoading(false);
    }
  };

  const purchasePackage = async (packageType: 'weekly' | 'monthly' | 'annual') => {
    const packageMap = {
      weekly: packages.find(p => p.identifier === '$rc_weekly'),
      monthly: packages.find(p => p.identifier === '$rc_monthly'),
      annual: packages.find(p => p.identifier === '$rc_annual')
    };
    
    const selectedPackage = packageMap[packageType];
    if (!selectedPackage) {
      Alert.alert('Erreur', 'Produit non trouvé');
      return;
    }

    try {
      const { customerInfo } = await Purchases.purchasePackage(selectedPackage);
      setCustomerInfo(customerInfo);
      
      // Mettre à jour le profil Supabase
      await supabase.from('profiles').update({
        subscription_plan: 'premium',
        subscription_updated_at: new Date().toISOString()
      }).eq('id', user?.id);
      
      return { success: true };
    } catch (error: any) {
      if (error.userCancelled) {
        return { success: false, cancelled: true };
      }
      console.error('Purchase error:', error);
      return { success: false, error };
    }
  };

  const restorePurchases = async () => {
    try {
      const customerInfo = await Purchases.restorePurchases();
      setCustomerInfo(customerInfo);
      Alert.alert('Succès', 'Achats restaurés');
    } catch (error) {
      Alert.alert('Erreur', 'Impossible de restaurer les achats');
    }
  };

  const createCheckoutSession = async (planType: string) => {
    setCheckoutLoading(true);
    
    try {
      const packageType = planType === 'weekly' ? 'weekly' : 'annual';
      const result = await purchasePackage(packageType as 'weekly' | 'annual');
      
      if (result?.success) {
        // Navigation gérée par subscription.tsx
      }
    } finally {
      setCheckoutLoading(false);
    }
  };

  const cancelCheckout = () => {
    setCheckoutLoading(false);
  };

  const subscription = customerInfo ? {
    id: 'revenucat_sub',
    status: isPremium() ? 'active' : 'canceled',
    current_period_end: customerInfo.latestExpirationDate || null,
  } : null;

  const isPremium = () => {
    return customerInfo?.entitlements.active['premium'] !== undefined;
  };

  return {
    customerInfo,
    packages,
    loading,
    checkoutLoading,
    isPremium,
    purchasePackage,
    restorePurchases,
    createCheckoutSession,
    cancelCheckout,
    subscription,
  };
}