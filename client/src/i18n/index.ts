import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import LanguageDetector from 'i18next-browser-languagedetector';
import HttpBackend from 'i18next-http-backend';

// Bundle English as an inline fallback so there is never a flash of
// untranslated keys — English is available synchronously on first render.
// Every other language is fetched on demand via i18next-http-backend and
// cached by the browser (Cache-Control / 304).
// English is the source of truth and is bundled from client/src/locales/en (the
// static import below) — it is NOT served from /locales/en. Every OTHER language
// lives in client/public/locales/{lng}/translation.json and is fetched on demand.
// Make English edits in src/locales/en, not public/locales.
import enTranslations from '../locales/en/translation.json';

i18n
  // Load non-bundled languages from /locales/{lng}/translation.json
  .use(HttpBackend)
  // Detect user language
  .use(LanguageDetector)
  // Pass the i18n instance to react-i18next
  .use(initReactI18next)
  // Initialize i18next
  .init({
    // English is bundled; all others are lazy-loaded via HttpBackend
    resources: {
      en: { translation: enTranslations },
    },
    partialBundledLanguages: true,

    // Default language
    fallbackLng: 'en',

    // Debug mode (disable in production)
    debug: process.env.NODE_ENV === 'development',

    // Language detection options
    detection: {
      // Order of language detection methods
      order: ['localStorage', 'navigator', 'htmlTag'],

      // Keys to look for in localStorage
      lookupLocalStorage: 'preferred-language',

      // Cache user language
      caches: ['localStorage'],
    },

    // Where HttpBackend fetches non-bundled translations from.
    // Vite copies client/public/ to the build output automatically.
    backend: {
      loadPath: '/locales/{{lng}}/translation.json',
    },

    interpolation: {
      escapeValue: false, // React already escapes values
    },

    // Separate namespaces for different sections
    defaultNS: 'translation',
    ns: ['translation'],

    // Return key if translation is missing (useful for development)
    returnKeyIfNotFound: true,

    // React integration options
    react: {
      useSuspense: false, // English fallback is synchronous, so no suspense needed
    },

    // Normalize language codes (e.g., en-US -> en) to match available translation files
    load: 'languageOnly',
  });

export default i18n;
