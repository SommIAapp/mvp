import { useState, useEffect, useCallback } from 'react';
import { Alert, Platform } from 'react-native';
import Constants from 'expo-constants';
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
    
    // Détecte si on est dans Expo Go
    const isExpoGo = Constants.appOwnership === 'expo';
    
    if (Platform.OS === 'web' || isExpoGo) {
      console.log('RevenueCat non disponible dans cet environnement - utilisation de données mock');
      
      // Créer des packages mock pour le développement
      const mockPackages = [
        {
          identifier: '$rc_weekly',
          product: { priceString: '2,99€ / semaine', price: 2.99 }
        },
        {
          identifier: '$rc_annual',
          product: { priceString: '30€ / an', price: 30 }
        }
      ];
      
      setPackages(mockPackages);
      setLoading(false);
      return;
    }
    
    try {
      // Le reste du code RevenueCat pour les builds natifs...
      Purchases.setLogLevel(LOG_LEVEL.DEBUG);
      
      // Configure avec la clé API
      await Purchases.configure({ apiKey: API_KEY });
      
      await Purchases.logIn(user.id);
      
      const offerings = await Purchases.getOfferings();
      if (offerings.current) {
        setPackages(offerings.current.availablePackages);
      }
      
      const info = await Purchases.getCustomerInfo();
      setCustomerInfo(info);
      
      Purchases.addCustomerInfoUpdateListener(setCustomerInfo);
    } catch (error) {
      console.error('RevenueCat init error:', error);
    } finally {
      setLoading(false);
    }
  };

  const purchasePackage = async (packageType: 'weekly' | 'annual') => {
    const packageMap = {
      weekly: packages.find(p => p.identifier === '$rc_weekly'),
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
      // Si monthly est sélectionné, utilise annual (puisqu'on n'a que weekly et annual)
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
    if (Platform.OS === 'web' || Constants.appOwnership === 'expo') return false;
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