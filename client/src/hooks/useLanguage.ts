import { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { useMutation } from '@tanstack/react-query';
import { useToast } from '@/hooks/use-toast';
import { useReduxAuth } from '@/hooks/useReduxAuth';
import { apiRequest } from '@/lib/queryClient';

export type SupportedLanguage = 'en' | 'es';

export const SUPPORTED_LANGUAGES = {
  en: 'English',
  es: 'Español',
} as const;

export function useLanguage() {
  const { i18n, t } = useTranslation();
  const { user } = useReduxAuth();
  const { toast } = useToast();
  const [isChanging, setIsChanging] = useState(false);

  const currentLanguage = i18n.language as SupportedLanguage;

  // Initialize language from user preference or localStorage
  useEffect(() => {
    const initializeLanguage = async () => {
      let targetLanguage: SupportedLanguage = 'en';

      // Priority: 1. User database preference, 2. localStorage, 3. browser default
      if (user?.language && Object.keys(SUPPORTED_LANGUAGES).includes(user.language)) {
        targetLanguage = user.language as SupportedLanguage;
      } else {
        const savedLanguage = localStorage.getItem('preferred-language');
        if (savedLanguage && Object.keys(SUPPORTED_LANGUAGES).includes(savedLanguage)) {
          targetLanguage = savedLanguage as SupportedLanguage;
        }
      }

      if (currentLanguage !== targetLanguage) {
        await i18n.changeLanguage(targetLanguage);
      }
    };

    initializeLanguage();
  }, [user?.language, currentLanguage, i18n]);

  // Mutation to update language preference in the database
  const updateLanguageMutation = useMutation({
    mutationFn: async (language: SupportedLanguage) => {
      const response = await apiRequest('PATCH', '/api/user/profile', {
        language,
      });
      return response.json();
    },
    onSuccess: () => {
      toast({
        title: t('toast.success'),
        description: t('toast.languageChanged'),
      });
    },
    onError: (error: any) => {
      toast({
        title: t('toast.error'),
        description: error?.message || 'Failed to update language preference',
        variant: 'destructive',
      });
    },
  });

  const changeLanguage = async (language: SupportedLanguage) => {
    if (language === currentLanguage || isChanging) return;

    setIsChanging(true);

    try {
      // Update i18n immediately for instant UI feedback
      await i18n.changeLanguage(language);
      
      // Update localStorage
      localStorage.setItem('preferred-language', language);
      
      // Update database if user is logged in
      if (user) {
        updateLanguageMutation.mutate(language);
      }
    } catch (error) {
      console.error('Failed to change language:', error);
      toast({
        title: t('toast.error'),
        description: 'Failed to change language',
        variant: 'destructive',
      });
    } finally {
      setIsChanging(false);
    }
  };

  return {
    currentLanguage,
    supportedLanguages: SUPPORTED_LANGUAGES,
    changeLanguage,
    isChanging: isChanging || updateLanguageMutation.isPending,
    t,
  };
}
