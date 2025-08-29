import { useState, useEffect } from 'react';
import { getLocales } from 'expo-localization';
import i18n from '@/locales';

export function useTranslation() {
  const [locale, setLocale] = useState(i18n.locale);

  useEffect(() => {
    // Écouter les changements de langue système
    const deviceLanguage = getLocales()[0]?.languageCode || 'fr';
    if (deviceLanguage !== locale) {
      i18n.locale = deviceLanguage;
      setLocale(deviceLanguage);
    }
  }, []);

  const t = (key: string, options?: any) => {
    return i18n.t(key, options);
  };

  const changeLanguage = (newLocale: string) => {
    i18n.locale = newLocale;
    setLocale(newLocale);
  };

  return {
    t,
    locale,
    changeLanguage,
    isRTL: false, // French and English are LTR
  };
}