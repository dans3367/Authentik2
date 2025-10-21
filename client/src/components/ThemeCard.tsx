import React, { useMemo } from 'react';

interface Theme {
  id: string;
  legacyId?: string;
  name: string;
  image: string;
  overlay: string;
  decorations: React.ReactNode;
}

interface ThemePreviewData {
  title?: string;
  imageUrl?: string | null;
  [key: string]: any;
}

interface ThemeCardProps {
  theme: Theme;
  themePreviewData: Record<string, ThemePreviewData>;
  parsedCustomThemeData: { themes?: Record<string, any> };
  defaultTitle: string;
  previewLabel: string;
  onCardClick: (themeId: string) => void;
  disabled?: boolean;
}

export const ThemeCard = React.memo(function ThemeCard({
  theme,
  themePreviewData,
  parsedCustomThemeData,
  defaultTitle,
  previewLabel,
  onCardClick,
  disabled = false,
}: ThemeCardProps) {
  const themeId = theme.id;

  // Memoize image URL calculation
  const imageUrl = useMemo(() => {
    // Check for custom image in preview data first
    if (themePreviewData[themeId]?.imageUrl) {
      return themePreviewData[themeId].imageUrl;
    }
    // Then check in saved database data
    if (parsedCustomThemeData?.themes?.[themeId]?.imageUrl) {
      return parsedCustomThemeData.themes[themeId].imageUrl;
    }
    // Fall back to default theme image
    return theme.image;
  }, [themeId, themePreviewData, parsedCustomThemeData, theme.image]);

  // Memoize title calculation
  const title = useMemo(() => {
    return (
      themePreviewData[themeId]?.title ||
      parsedCustomThemeData?.themes?.[themeId]?.title ||
      defaultTitle
    );
  }, [themeId, themePreviewData, parsedCustomThemeData, defaultTitle]);

  return (
    <button
      type="button"
      onClick={() => onCardClick(themeId)}
      disabled={disabled}
      className="relative rounded-xl border border-gray-200 hover:border-gray-300 p-3 text-left transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-600"
    >
      <div className="relative h-40 rounded-lg overflow-hidden">
        <img
          loading="lazy"
          src={imageUrl || theme.image}
          alt={theme.name}
          className="absolute inset-0 h-full w-full object-cover"
        />
        <div className={`absolute inset-0 ${theme.overlay}`} />
        {theme.decorations}
        <div className="absolute inset-0 flex items-center justify-center">
          <div className="text-center">
            <div className="font-bold text-white drop-shadow-lg text-shadow">
              {title}
            </div>
            <div className="text-xs text-white/90 drop-shadow">
              {theme.name} {previewLabel}
            </div>
          </div>
        </div>
      </div>
      <div className="mt-2">
        <span className="text-sm font-medium text-gray-900">{theme.name}</span>
      </div>
    </button>
  );
});
