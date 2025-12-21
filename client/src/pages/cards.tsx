"use client"

import { useState, useEffect, lazy, Suspense } from "react";
import { useLocation } from "wouter";
import { useLanguage } from "@/hooks/useLanguage";
import { useSetBreadcrumbs } from "@/contexts/PageTitleContext";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Gift, Snowflake, LayoutDashboard } from "lucide-react";

// Lazy load the content components
const BirthdayCardsContent = lazy(() => import("@/components/BirthdayCardsContent").then(mod => ({ default: mod.BirthdayCardsContent })));
const ECardsContent = lazy(() => import("@/components/ECardsContent").then(mod => ({ default: mod.ECardsContent })));

type CardType = "birthday" | "ecard";

const ContentLoader = () => (
  <div className="flex items-center justify-center min-h-[400px]">
    <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600"></div>
  </div>
);

export default function CardsPage() {
  const [location, setLocation] = useLocation();
  const { t } = useLanguage();

  // Set breadcrumbs in header
  useSetBreadcrumbs([
    { label: "Dashboard", href: "/", icon: LayoutDashboard },
    { label: "Cards", icon: Gift }
  ]);

  // Initialize cardType based on URL parameter or default to "birthday"
  const [cardType, setCardType] = useState<CardType>(() => {
    const urlParams = new URLSearchParams(window.location.search);
    const type = urlParams.get('type');
    if (type && ['birthday', 'ecard'].includes(type)) {
      return type as CardType;
    }
    return "birthday";
  });

  // Update URL when card type changes
  useEffect(() => {
    const urlParams = new URLSearchParams(window.location.search);
    const currentType = urlParams.get('type');
    
    if (currentType !== cardType) {
      urlParams.set('type', cardType);
      setLocation(`/cards?${urlParams.toString()}`, { replace: true });
    }
  }, [cardType, setLocation]);

  // Handle browser back/forward button navigation
  useEffect(() => {
    const handlePopState = () => {
      const urlParams = new URLSearchParams(window.location.search);
      const type = urlParams.get('type');
      if (type && ['birthday', 'ecard'].includes(type)) {
        setCardType(type as CardType);
      } else {
        setCardType("birthday");
      }
    };

    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, []);

  const handleCardTypeChange = (type: CardType) => {
    setCardType(type);
  };

  return (
    <div className="min-h-screen bg-white dark:bg-slate-800">
      <div className="max-w-7xl mx-auto p-6 space-y-6">
        {/* Page Header */}
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-3xl font-bold bg-gradient-to-r from-gray-900 to-gray-700 dark:from-white dark:to-gray-200 bg-clip-text text-transparent">
                {t('navigation.cards') || 'e-Cards'}
              </h1>
              <p className="text-gray-600 dark:text-gray-400 mt-1">
                Manage your birthday and e-cards
              </p>
            </div>
            
            {/* Segmented Control */}
            <div className="inline-flex rounded-lg border border-gray-200 bg-gray-50 p-1 shadow-sm">
              <Button
                variant={cardType === "birthday" ? "default" : "ghost"}
                onClick={() => handleCardTypeChange("birthday")}
                className={`
                  flex items-center gap-2 px-4 py-2 rounded-md font-medium transition-all
                  ${cardType === "birthday" 
                    ? "bg-white text-gray-900 shadow-sm" 
                    : "text-gray-600 hover:text-gray-900 hover:bg-gray-100"
                  }
                `}
              >
                <Gift className="h-4 w-4" />
                <span>{t('cards.selector.birthday') || 'Birthday Cards'}</span>
              </Button>
              <Button
                variant={cardType === "ecard" ? "default" : "ghost"}
                onClick={() => handleCardTypeChange("ecard")}
                className={`
                  flex items-center gap-2 px-4 py-2 rounded-md font-medium transition-all
                  ${cardType === "ecard" 
                    ? "bg-white text-gray-900 shadow-sm" 
                    : "text-gray-600 hover:text-gray-900 hover:bg-gray-100"
                  }
                `}
              >
                <Snowflake className="h-4 w-4" />
                <span>{t('cards.selector.ecard') || 'E-Cards'}</span>
              </Button>
            </div>
          </div>

          {/* Add minimal spacer after the header section */}
          <div className="h-3"></div>
        </div>

        {/* Content Area - Render appropriate card content */}
        <Suspense fallback={<ContentLoader />}>
          {cardType === "birthday" ? (
            <BirthdayCardsContent />
          ) : (
            <ECardsContent />
          )}
        </Suspense>
      </div>
    </div>
  );
}

