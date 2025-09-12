import Purchases from 'react-native-purchases';
import { Platform } from 'react-native';

const REVENUECAT_API_KEY = Platform.OS === 'ios' 
  ? 'appl_wTyEDGymBMkhfAztsEoeVrdWOmm'
  : 'goog_XXXXXXXXXXXXX'; // Ajoutez votre clé Android quand vous l'aurez

export const initializePurchases = async () => {
  try {
    console.log('🚀 Initializing RevenueCat...');
    
    Purchases.setLogLevel(Purchases.LOG_LEVEL.DEBUG);
    
    await Purchases.configure({
      apiKey: REVENUECAT_API_KEY,
      appUserID: null, // RevenueCat génèrera un ID
      observerMode: false,
      useAmazon: false,
    });
    
    console.log('✅ RevenueCat initialized successfully');
  } catch (error) {
    console.error('❌ Error initializing RevenueCat:', error);
  }
};