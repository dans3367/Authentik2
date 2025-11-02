import { useCallback } from 'react';
import { useTranslation as useI18next } from 'react-i18next';
import { getTranslatedLabel, hasTranslations, getTranslationCount, getAllTranslations } from '@/utils/translation-utils';

export interface TranslationHookProps {
  currentLanguage?: string;
  defaultLanguage?: string;
}

export function useTranslation(props: TranslationHookProps = {}) {
  const { defaultLanguage = 'en' } = props;
  const { i18n } = useI18next();
  const activeLanguage = (i18n.language || defaultLanguage).split('-')[0];

  // Get the translated label for a form element
  const getLabel = useCallback((
    element: { label: string; labelTranslations?: Record<string, string> },
    languageCode?: string
  ): string => {
    const targetLanguage = (languageCode || activeLanguage).split('-')[0];
    return getTranslatedLabel(element, targetLanguage);
  }, [activeLanguage]);

  // Check if an element has translations
  const hasElementTranslations = useCallback((
    element: { labelTranslations?: Record<string, string> }
  ): boolean => {
    return hasTranslations(element);
  }, []);

  // Get translation count for an element
  const getElementTranslationCount = useCallback((
    element: { labelTranslations?: Record<string, string> }
  ): number => {
    return getTranslationCount(element);
  }, []);

  // Get all translations for an element
  const getElementTranslations = useCallback((
    element: { label: string; labelTranslations?: Record<string, string> }
  ): Record<string, string> => {
    return getAllTranslations(element);
  }, []);

  // Switch the active language via i18n
  const switchLanguage = useCallback(async (languageCode: string) => {
    const code = languageCode.split('-')[0];
    if (i18n.language !== code) {
      await i18n.changeLanguage(code);
    }
  }, [i18n]);

  // Reset to default language via i18n
  const resetLanguage = useCallback(async () => {
    if (i18n.language !== defaultLanguage) {
      await i18n.changeLanguage(defaultLanguage);
    }
  }, [i18n, defaultLanguage]);

  return {
    activeLanguage,
    getLabel,
    hasElementTranslations,
    getElementTranslationCount,
    getElementTranslations,
    switchLanguage,
    resetLanguage,
    isCurrentLanguage: (languageCode: string) => languageCode.split('-')[0] === activeLanguage,
  };
} 
