import React from 'react';
import { cn } from '@/lib/utils';

interface RateScaleProps {
  min?: number;
  max?: number;
  value?: number;
  onChange?: (value: number) => void;
  className?: string;
  disabled?: boolean;
  labels?: string[];
  variant?: 'numbers' | 'stars' | 'faces';
}

export function RateScale({
  min = 1,
  max = 10,
  value = 1,
  onChange,
  className,
  disabled = false,
  labels = [],
  variant = 'numbers'
}: RateScaleProps) {
  // Ensure values are within valid range (1-10)
  const safeMin = Math.max(1, Math.min(10, min));
  const safeMax = Math.max(safeMin, Math.min(10, max));
  const safeValue = Math.max(safeMin, Math.min(safeMax, value));

  const handleRating = (rating: number) => {
    if (!disabled && onChange) {
      onChange(rating);
    }
  };

  const getRatingContent = (rating: number) => {
    switch (variant) {
      case 'stars':
        return '⭐';
      case 'faces':
        const faceIndex = Math.floor(((rating - safeMin) / (safeMax - safeMin)) * 4);
        const faces = ['😢', '😕', '😐', '🙂', '😊'];
        return faces[Math.min(faceIndex, faces.length - 1)];
      case 'numbers':
      default:
        return rating.toString();
    }
  };

  const getButtonClasses = (rating: number) => {
    const isActive = rating <= safeValue;
    
    switch (variant) {
      case 'stars':
        return cn(
          "text-2xl transition-all transform hover:scale-110",
          isActive ? "opacity-100" : "opacity-30",
          disabled && "opacity-50 cursor-not-allowed"
        );
      case 'faces':
        return cn(
          "text-2xl transition-all transform hover:scale-110",
          isActive ? "opacity-100" : "opacity-30",
          disabled && "opacity-50 cursor-not-allowed"
        );
      case 'numbers':
      default:
        return cn(
          "w-8 h-8 rounded-full border-2 transition-colors text-sm font-medium",
          "hover:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500",
          isActive
            ? "bg-blue-500 border-blue-500 text-white"
            : "bg-white border-gray-300 text-gray-600",
          disabled && "opacity-50 cursor-not-allowed"
        );
    }
  };

  return (
    <div className={cn("flex items-center space-x-2", className)}>
      {Array.from({ length: safeMax - safeMin + 1 }, (_, i) => {
        const rating = safeMin + i;
        return (
          <div key={rating} className="flex flex-col items-center">
            <button
              type="button"
              onClick={() => handleRating(rating)}
              disabled={disabled}
              className={getButtonClasses(rating)}
            >
              {getRatingContent(rating)}
            </button>
            {labels[i] && (
              <span className="text-xs text-gray-500 mt-1">{labels[i]}</span>
            )}
          </div>
        );
      })}
    </div>
  );
}

export default RateScale;