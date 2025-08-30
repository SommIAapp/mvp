import { useState, useEffect } from 'react';
import i18n from '@/locales';
import AsyncStorage from '@react-native-async-storage/async-storage';

// Variable globale pour forcer le re-render
let listeners: Array<() => void> = [];

export function useTranslation() {
  const [locale, setLocale] = useState(i18n.locale);

  useEffect(() => {
    // Charger la langue sauvegardée au démarrage
    loadSavedLanguage();
    
    // S'abonner aux changements
    const updateLocale = () => setLocale(i18n.locale);
    listeners.push(updateLocale);
    
    return () => {
      listeners = listeners.filter(l => l !== updateLocale);
    };
  }, []);

  const loadSavedLanguage = async () => {
    try {
      const savedLang = await AsyncStorage.getItem('user_language');
      if (savedLang && (savedLang === 'fr' || savedLang === 'en')) {
        i18n.locale = savedLang;
        setLocale(savedLang);
        notifyListeners();
      }
    } catch (error) {
      console.error('Error loading language:', error);
    }
  };

  const changeLanguage = async (newLocale: string) => {
    i18n.locale = newLocale;
    setLocale(newLocale);
    await AsyncStorage.setItem('user_language', newLocale);
    notifyListeners();
  };

  const notifyListeners = () => {
    listeners.forEach(listener => listener());
  };

  const t = (key: string, options?: any) => {
    return i18n.t(key, options);
  };

  return {
    t,
    locale,
    changeLanguage,
    isRTL: false,
  };
}