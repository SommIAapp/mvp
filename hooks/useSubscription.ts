import { useState, useEffect, useCallback } from 'react';
import { Alert, Platform } from 'react-native';
import Purchases, { CustomerInfo, PurchasesPackage } from 'react-native-purchases';
import { useAuth } from './useAuth';
import { supabase } from '@/lib/supabase';

export function useSubscription() {
  const { user } = useAuth();
  const [customerInfo, setCustomerInfo] = useState<CustomerInfo | null>(null);
  const [packages, setPackages] = useState<PurchasesPackage[]>([]);
  const [loading, setLoading] = useState(true);
  const [checkoutLoading, setCheckoutLoading] = useState(false);

  useEffect(() => {
    if (user) {
      initializeRevenueCat();
    } else {
      setLoading(false);
    }
  }, [user]);

  const initializeRevenueCat = async () => {
    if (!user) {
      setLoading(false);
      return;
    }
    
    try {
      // RevenueCat est déjà configuré dans _layout.tsx
      // On se connecte juste avec l'utilisateur
      await Purchases.logIn(user.id);
      
      // Récupérer les offerings
      const offerings = await Purchases.getOfferings();
      if (offerings.current && offerings.current.availablePackages) {
        setPackages(offerings.current.availablePackages);
      }
      
      // Récupérer les infos client
      const info = await Purchases.getCustomerInfo();
      setCustomerInfo(info);
      
      // Écouter les changements
      const listener = (info: CustomerInfo) => {
        setCustomerInfo(info);
      };
      Purchases.addCustomerInfoUpdateListener(listener);
      
      // Cleanup listener
      return () => {
        Purchases.removeCustomerInfoUpdateListener(listener);
      };
    } catch (error) {
      console.error('RevenueCat error:', error);
      // Ne pas faire crasher l'app
      setPackages([]);
      setCustomerInfo(null);
    } finally {
      setLoading(false);
    }
  };

  const purchasePackage = async (packageType: 'weekly' | 'annual') => {
    if (!user) {
      Alert.alert('Erreur', 'Vous devez être connecté pour souscrire');
      return { success: false };
    }

    const packageMap = {
      weekly: packages.find(p => p.identifier === '$rc_weekly'),
      annual: packages.find(p => p.identifier === '$rc_annual')
    };
    
    const selectedPackage = packageMap[packageType];
    if (!selectedPackage) {
      Alert.alert('Erreur', 'Produit non trouvé');
      return { success: false };
    }

    try {
      const { customerInfo } = await Purchases.purchasePackage(selectedPackage);
      setCustomerInfo(customerInfo);
      
      // Mettre à jour le profil Supabase
      await supabase.from('profiles').update({
        subscription_plan: 'premium',
        subscription_updated_at: new Date().toISOString()
      }).eq('id', user.id);
      
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
      return true;
    } catch (error) {
      console.error('Restore error:', error);
      Alert.alert('Erreur', 'Impossible de restaurer les achats');
      return false;
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

  const isPremium = useCallback(() => {
    if (!customerInfo) return false;
    return customerInfo.entitlements.active['premium'] !== undefined;
  }, [customerInfo]);

  const subscription = customerInfo ? {
    id: 'revenucat_sub',
    status: isPremium() ? 'active' : 'canceled',
    current_period_end: customerInfo.latestExpirationDate || null,
  } : null;

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