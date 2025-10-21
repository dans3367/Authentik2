"use client"

import { useState, useEffect, lazy, Suspense } from "react";
import { useLocation } from "wouter";
import { useLanguage } from "@/hooks/useLanguage";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Gift, Snowflake } from "lucide-react";

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
    <div className="container mx-auto p-4 sm:p-6 lg:p-8 max-w-7xl space-y-6">
      {/* Card Type Selector - Segmented Control */}
      <Card className="rounded-2xl border border-gray-200 bg-white shadow-sm">
        <CardContent className="p-6">
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
            <div>
              <h1 className="text-2xl font-bold text-gray-900">
                {t('navigation.cards') || 'Cards'}
              </h1>
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
        </CardContent>
      </Card>

      {/* Content Area - Render appropriate card content */}
      <Suspense fallback={<ContentLoader />}>
        {cardType === "birthday" ? (
          <BirthdayCardsContent />
        ) : (
          <ECardsContent />
        )}
      </Suspense>
    </div>
  );
}

