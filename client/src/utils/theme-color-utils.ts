import { FormTheme, CustomColors } from '../types/form-builder';

// Simple utility function to apply custom colors to theme styles
export function applyCustomColors(theme: FormTheme, customColors: CustomColors): FormTheme {
  // Clone the theme to avoid mutation
  const customizedTheme: FormTheme = {
    ...theme,
    customColors,
    styles: { ...theme.styles }
  };

  // For now, just store the custom colors with the theme
  // The actual styling will be handled in the component using CSS variables
  return customizedTheme;
}

// Helper function to extract dominant colors from a theme for defaults
export function extractThemeColors(theme: FormTheme): CustomColors {
  let text = '#1F2937'; // Default dark gray for text
  let button = '#3B82F6'; // Default blue for buttons
  let background = '#FFFFFF'; // Default white background
  let header = '#1F2937'; // Default header color
  let font: 'sans' | 'serif' | 'mono' = 'sans'; // Default font
  // New default values
  let label = '#374151'; // Default label color
  let inputBackground = '#FFFFFF'; // Default input background
  let inputBorder = '#D1D5DB'; // Default input border
  let inputText = '#1F2937'; // Default input text
  let borderRadius: 'none' | 'small' | 'medium' | 'large' | 'full' = 'medium';
  let containerShadow: 'none' | 'small' | 'medium' | 'large' = 'medium';
  let progressBar = '#3B82F6'; // Default progress bar color

  // Extract colors based on theme ID patterns
  switch (theme.id) {
    case 'minimal':
      text = '#1F2937';
      header = '#111827';
      button = '#1F2937';
      background = '#FFFFFF';
      font = 'sans';
      label = '#374151';
      inputBackground = '#F9FAFB';
      inputBorder = '#D1D5DB';
      inputText = '#1F2937';
      borderRadius = 'medium';
      containerShadow = 'large';
      progressBar = '#3B82F6';
      break;
    case 'modern':
      text = '#374151';
      header = '#8B5CF6';
      button = '#8B5CF6';
      background = '#F8FAFC';
      font = 'sans';
      label = '#1F2937';
      inputBackground = '#FFFFFF';
      inputBorder = '#E5E7EB';
      inputText = '#1F2937';
      borderRadius = 'large';
      containerShadow = 'large';
      progressBar = '#8B5CF6';
      break;
    case 'professional':
      text = '#1F2937';
      header = '#2563EB';
      button = '#2563EB';
      background = '#FFFFFF';
      font = 'sans';
      label = '#374151';
      inputBackground = '#FFFFFF';
      inputBorder = '#D1D5DB';
      inputText = '#1F2937';
      borderRadius = 'small';
      containerShadow = 'small';
      progressBar = '#2563EB';
      break;
    case 'playful':
      text = '#7C3AED';
      header = '#EC4899';
      button = '#EC4899';
      background = '#FDF2F8';
      font = 'sans';
      label = '#7C3AED';
      inputBackground = '#FDF2F8';
      inputBorder = '#F9A8D4';
      inputText = '#7C3AED';
      borderRadius = 'full';
      containerShadow = 'large';
      progressBar = '#EC4899';
      break;
    case 'elegant':
      text = '#1F2937';
      header = '#4F46E5';
      button = '#4F46E5';
      background = '#FFFFFF';
      font = 'serif';
      label = '#6B7280';
      inputBackground = '#FFFFFF';
      inputBorder = '#E5E7EB';
      inputText = '#1F2937';
      borderRadius = 'medium';
      containerShadow = 'large';
      progressBar = '#4F46E5';
      break;
    case 'neon':
      text = '#00D9FF';
      header = '#00FF88';
      button = '#00FF88';
      background = '#0A0A0A';
      font = 'mono';
      label = '#00D9FF';
      inputBackground = '#111111';
      inputBorder = '#00D9FF';
      inputText = '#00D9FF';
      borderRadius = 'small';
      containerShadow = 'none';
      progressBar = '#00FF88';
      break;
    case 'nature':
      text = '#047857';
      header = '#059669';
      button = '#059669';
      background = '#F0FDF4';
      font = 'sans';
      label = '#047857';
      inputBackground = '#FFFFFF';
      inputBorder = '#86EFAC';
      inputText = '#047857';
      borderRadius = 'full';
      containerShadow = 'medium';
      progressBar = '#059669';
      break;
    case 'luxury':
      text = '#FCD34D';
      header = '#F59E0B';
      button = '#D97706';
      background = '#0F0A02';
      font = 'serif';
      label = '#FCD34D';
      inputBackground = '#1C1917';
      inputBorder = '#D97706';
      inputText = '#FCD34D';
      borderRadius = 'medium';
      containerShadow = 'large';
      progressBar = '#D97706';
      break;
    case 'retro':
      text = '#DC2626';
      header = '#F97316';
      button = '#F97316';
      background = '#FFF7ED';
      font = 'mono';
      label = '#DC2626';
      inputBackground = '#FFFBEB';
      inputBorder = '#F97316';
      inputText = '#DC2626';
      borderRadius = 'none';
      containerShadow = 'none';
      progressBar = '#F97316';
      break;
    case 'cosmic':
      text = '#E9D5FF';
      header = '#A855F7';
      button = '#8B5CF6';
      background = '#0F0F23';
      font = 'sans';
      label = '#E9D5FF';
      inputBackground = '#1E1B4B';
      inputBorder = '#8B5CF6';
      inputText = '#E9D5FF';
      borderRadius = 'medium';
      containerShadow = 'large';
      progressBar = '#8B5CF6';
      break;
    case 'brutalist':
      text = '#000000';
      header = '#000000';
      button = '#000000';
      background = '#FFFFFF';
      font = 'mono';
      label = '#000000';
      inputBackground = '#FFFFFF';
      inputBorder = '#000000';
      inputText = '#000000';
      borderRadius = 'none';
      containerShadow = 'none';
      progressBar = '#000000';
      break;
    case 'pastel-dream':
      text = '#BE185D';
      header = '#EC4899';
      button = '#EC4899';
      background = '#FDF2F8';
      font = 'sans';
      label = '#BE185D';
      inputBackground = '#FFFFFF';
      inputBorder = '#F9A8D4';
      inputText = '#BE185D';
      borderRadius = 'full';
      containerShadow = 'medium';
      progressBar = '#EC4899';
      break;
    case 'neo-modern':
      text = '#10B981';
      header = '#00FF41';
      button = '#00FF41';
      background = '#0A0A0A';
      font = 'mono';
      label = '#10B981';
      inputBackground = '#111111';
      inputBorder = '#10B981';
      inputText = '#10B981';
      borderRadius = 'small';
      containerShadow = 'none';
      progressBar = '#00FF41';
      break;
    case 'modern-bold':
      text = '#1F2937';
      header = '#F97316';
      button = '#F97316';
      background = '#FFFFFF';
      font = 'sans';
      label = '#1F2937';
      inputBackground = '#FFFFFF';
      inputBorder = '#F97316';
      inputText = '#1F2937';
      borderRadius = 'large';
      containerShadow = 'large';
      progressBar = '#F97316';
      break;
    case 'glassmorphism':
      text = '#FFFFFF';
      header = '#FFFFFF';
      button = '#FFFFFF';
      background = '#1E293B';
      font = 'sans';
      label = '#E2E8F0';
      inputBackground = 'rgba(255,255,255,0.15)';
      inputBorder = 'rgba(255,255,255,0.3)';
      inputText = '#FFFFFF';
      borderRadius = 'full';
      containerShadow = 'large';
      progressBar = '#FFFFFF';
      break;
  }

  return { 
    text, button, background, header, font,
    label, inputBackground, inputBorder, inputText,
    borderRadius, containerShadow, progressBar
  };
}

// Helper function to lighten a color
export function lightenColor(color: string, percent: number = 20): string {
  // Handle gradients by returning a semi-transparent white overlay
  if (color.includes('gradient')) {
    return color;
  }
  
  // Convert hex to RGB
  const hexToRgb = (hex: string): { r: number; g: number; b: number } | null => {
    const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
    return result ? {
      r: parseInt(result[1], 16),
      g: parseInt(result[2], 16),
      b: parseInt(result[3], 16)
    } : null;
  };
  
  // If it's already an rgb/rgba color
  if (color.startsWith('rgb')) {
    const match = color.match(/rgba?\((\d+),\s*(\d+),\s*(\d+)(?:,\s*(\d+(?:\.\d+)?))?\)/);
    if (match) {
      const r = parseInt(match[1]);
      const g = parseInt(match[2]);
      const b = parseInt(match[3]);
      const a = match[4] ? parseFloat(match[4]) : 1;
      
      // Lighten by mixing with white
      const newR = Math.min(255, r + (255 - r) * (percent / 100));
      const newG = Math.min(255, g + (255 - g) * (percent / 100));
      const newB = Math.min(255, b + (255 - b) * (percent / 100));
      
      return `rgba(${Math.round(newR)}, ${Math.round(newG)}, ${Math.round(newB)}, ${a})`;
    }
  }
  
  // Handle hex colors
  const rgb = hexToRgb(color);
  if (rgb) {
    // Lighten by mixing with white
    const newR = Math.min(255, rgb.r + (255 - rgb.r) * (percent / 100));
    const newG = Math.min(255, rgb.g + (255 - rgb.g) * (percent / 100));
    const newB = Math.min(255, rgb.b + (255 - rgb.b) * (percent / 100));
    
    // Convert back to hex
    const toHex = (n: number) => {
      const hex = Math.round(n).toString(16);
      return hex.length === 1 ? '0' + hex : hex;
    };
    
    return `#${toHex(newR)}${toHex(newG)}${toHex(newB)}`;
  }
  
  // Return original color if we can't parse it
  return color;
}