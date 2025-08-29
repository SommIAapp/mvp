import { I18n } from 'i18n-js';
import { getLocales } from 'expo-localization';

import fr from './fr.json';
import en from './en.json';

const i18n = new I18n({
  fr,
  en,
});

// Détecte automatiquement la langue du système
const deviceLanguage = getLocales()[0]?.languageCode || 'fr';
i18n.locale = deviceLanguage;
i18n.enableFallback = true;
i18n.defaultLocale = 'fr';

export default i18n;