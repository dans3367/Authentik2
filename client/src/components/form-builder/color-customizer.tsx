import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { CustomColors, FormTheme } from '@/types/form-builder';
import { Palette, RotateCcw, Pipette, Type, Paintbrush, Square, FileText, TextCursor, RectangleHorizontal, Radius, Layers, BarChart3 } from 'lucide-react';
import { getThemeGradientPresets } from '@/utils/theme-gradient-presets';
import { extractThemeColors } from '@/utils/theme-color-utils';
import { cn } from '@/lib/utils';

interface ColorCustomizerProps {
  theme: FormTheme;
  onColorsChange: (colors: CustomColors) => void;
  onResetColors: () => void;
}

type ColorType = 'text' | 'background' | 'button' | 'header' | 'label' | 'inputBackground' | 'inputBorder' | 'inputText' | 'progressBar';
type SettingType = 'borderRadius' | 'containerShadow' | 'font';

export function ColorCustomizer({ theme, onColorsChange, onResetColors }: ColorCustomizerProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [activeColorType, setActiveColorType] = useState<ColorType | SettingType>('text');
  const [activeTab, setActiveTab] = useState<'colors' | 'inputs' | 'effects'>('colors');
  
  // Get theme defaults as base colors
  const themeDefaults = extractThemeColors(theme);
  
  // Get current colors (either custom or defaults)
  const currentColors = theme.customColors || themeDefaults;
  const [colors, setColors] = useState<CustomColors>(currentColors);

  // Get theme-specific gradient presets
  const gradientPresets = getThemeGradientPresets(theme.id);

  useEffect(() => {
    // Update colors when theme changes
    const newColors = theme.customColors || extractThemeColors(theme);
    setColors(newColors);
  }, [theme]);

  const handleColorChange = (colorType: keyof Omit<CustomColors, 'font'>, value: string) => {
    const newColors = { ...colors, [colorType]: value };
    // Clear gradient if setting solid color
    if (colorType === 'text' || colorType === 'background' || colorType === 'button' || colorType === 'header') {
      delete newColors[`${colorType}Gradient` as keyof CustomColors];
    }
    setColors(newColors);
    onColorsChange(newColors);
  };

  const handleGradientSelect = (colorType: 'text' | 'background' | 'button' | 'header', gradient: string) => {
    const newColors = { 
      ...colors, 
      [`${colorType}Gradient` as keyof CustomColors]: gradient 
    };
    setColors(newColors);
    onColorsChange(newColors);
  };

  const handleFontChange = (font: 'sans' | 'serif' | 'mono') => {
    const newColors = { ...colors, font };
    setColors(newColors);
    onColorsChange(newColors);
  };

  const handleReset = () => {
    const defaultColors = extractThemeColors(theme);
    setColors(defaultColors);
    onResetColors();
    setIsOpen(false);
  };

  const solidColors: Record<ColorType, string[]> = {
    text: ['#1F2937', '#374151', '#4B5563', '#6B7280', '#111827', '#000000', '#FFFFFF', '#F9FAFB'],
    background: ['#FFFFFF', '#F9FAFB', '#F3F4F6', '#E5E7EB', '#1F2937', '#111827', '#000000', '#FEF3C7'],
    button: ['#3B82F6', '#EF4444', '#10B981', '#F59E0B', '#8B5CF6', '#EC4899', '#14B8A6', '#F97316'],
    header: ['#1F2937', '#3B82F6', '#8B5CF6', '#EC4899', '#10B981', '#F59E0B', '#EF4444', '#6B7280'],
    label: ['#1F2937', '#374151', '#4B5563', '#6B7280', '#111827', '#000000', '#FFFFFF', '#9CA3AF'],
    inputBackground: ['#FFFFFF', '#F9FAFB', '#F3F4F6', '#E5E7EB', '#1F2937', '#111827', '#0A0A0A', '#FEF3C7'],
    inputBorder: ['#D1D5DB', '#E5E7EB', '#9CA3AF', '#6B7280', '#3B82F6', '#8B5CF6', '#EC4899', '#000000'],
    inputText: ['#1F2937', '#374151', '#4B5563', '#6B7280', '#111827', '#000000', '#FFFFFF', '#F9FAFB'],
    progressBar: ['#3B82F6', '#EF4444', '#10B981', '#F59E0B', '#8B5CF6', '#EC4899', '#14B8A6', '#F97316']
  };

  const fonts = [
    { value: 'sans', label: 'Sans Serif', preview: 'Inter, -apple-system, sans-serif' },
    { value: 'serif', label: 'Serif', preview: 'Georgia, Times, serif' },
    { value: 'mono', label: 'Monospace', preview: 'ui-monospace, Consolas, monospace' }
  ];

  // Get active value (gradient or solid color)
  const getActiveValue = (colorType: ColorType) => {
    const gradientKey = `${colorType}Gradient` as keyof CustomColors;
    return colors[gradientKey] || colors[colorType as keyof CustomColors];
  };

  const handleSettingChange = (setting: 'borderRadius' | 'containerShadow', value: string) => {
    const newColors = { ...colors, [setting]: value };
    setColors(newColors);
    onColorsChange(newColors);
  };

  const borderRadiusOptions = [
    { value: 'none', label: 'None', preview: 'rounded-none' },
    { value: 'small', label: 'Small', preview: 'rounded-sm' },
    { value: 'medium', label: 'Medium', preview: 'rounded-md' },
    { value: 'large', label: 'Large', preview: 'rounded-lg' },
    { value: 'full', label: 'Full', preview: 'rounded-full' }
  ];

  const shadowOptions = [
    { value: 'none', label: 'None', preview: 'shadow-none' },
    { value: 'small', label: 'Small', preview: 'shadow-sm' },
    { value: 'medium', label: 'Medium', preview: 'shadow-md' },
    { value: 'large', label: 'Large', preview: 'shadow-lg' }
  ];

  const isColorType = (type: ColorType | SettingType): type is ColorType => {
    return ['text', 'background', 'button', 'header', 'label', 'inputBackground', 'inputBorder', 'inputText', 'progressBar'].includes(type);
  };

  // Create preview styles
  const previewStyles = {
    text: colors.textGradient 
      ? { background: colors.textGradient, WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }
      : { color: colors.text },
    background: colors.backgroundGradient
      ? { background: colors.backgroundGradient }
      : { backgroundColor: colors.background },
    button: colors.buttonGradient
      ? { background: colors.buttonGradient }
      : { backgroundColor: colors.button },
    header: colors.headerGradient
      ? { background: colors.headerGradient, WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }
      : { color: colors.header }
  };

  const colorTypeConfig: Record<ColorType, { label: string; description: string; icon: React.ReactNode }> = {
    text: {
      label: 'Text Color',
      description: 'General text color',
      icon: <Type className="w-5 h-5" />
    },
    header: {
      label: 'Form Title',
      description: 'Main form title',
      icon: <FileText className="w-5 h-5" />
    },
    background: {
      label: 'Background',
      description: 'Form background',
      icon: <Square className="w-5 h-5" />
    },
    button: {
      label: 'Button Color',
      description: 'Submit buttons',
      icon: <Paintbrush className="w-5 h-5" />
    },
    label: {
      label: 'Label Color',
      description: 'Field labels',
      icon: <TextCursor className="w-5 h-5" />
    },
    inputBackground: {
      label: 'Input Background',
      description: 'Input field background',
      icon: <RectangleHorizontal className="w-5 h-5" />
    },
    inputBorder: {
      label: 'Input Border',
      description: 'Input field border',
      icon: <Square className="w-5 h-5" />
    },
    inputText: {
      label: 'Input Text',
      description: 'Text inside inputs',
      icon: <Type className="w-5 h-5" />
    },
    progressBar: {
      label: 'Progress Bar',
      description: 'Progress indicator',
      icon: <BarChart3 className="w-5 h-5" />
    }
  };

  const colorsTab: ColorType[] = ['header', 'text', 'background', 'button'];
  const inputsTab: ColorType[] = ['label', 'inputBackground', 'inputBorder', 'inputText'];
  const effectsTab: (ColorType | SettingType)[] = ['progressBar', 'borderRadius', 'containerShadow'];

  const fontStyles = {
    sans: { fontFamily: 'Inter, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif' },
    serif: { fontFamily: 'Georgia, "Times New Roman", Times, serif' },
    mono: { fontFamily: 'ui-monospace, SFMono-Regular, Consolas, "Liberation Mono", monospace' }
  };

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogTrigger asChild>
        <Button 
          variant="outline" 
          size="default" 
          className="flex items-center gap-2 bg-gradient-to-r from-purple-50 to-pink-50 hover:from-purple-100 hover:to-pink-100 border-purple-200 hover:border-purple-300"
        >
          <div className="flex -space-x-1">
            <div className="w-4 h-4 rounded-full bg-gradient-to-br from-blue-500 to-purple-500" />
            <div className="w-4 h-4 rounded-full bg-gradient-to-br from-pink-500 to-orange-500" />
            <div className="w-4 h-4 rounded-full bg-gradient-to-br from-green-500 to-teal-500" />
          </div>
          <span className="font-medium">Customize Appearance</span>
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-hidden flex flex-col p-0">
        {/* Header with Tabs */}
        <DialogHeader className="px-6 pt-6 pb-0 border-b">
          <DialogTitle className="text-xl mb-4">Customize Appearance</DialogTitle>
          <div className="flex gap-1">
            {[
              { id: 'colors' as const, label: 'Colors', icon: <Palette className="w-4 h-4" /> },
              { id: 'inputs' as const, label: 'Inputs', icon: <RectangleHorizontal className="w-4 h-4" /> },
              { id: 'effects' as const, label: 'Effects', icon: <Layers className="w-4 h-4" /> }
            ].map((tab) => (
              <button
                key={tab.id}
                onClick={() => {
                  setActiveTab(tab.id);
                  // Set default active item for each tab
                  if (tab.id === 'colors') setActiveColorType('header');
                  else if (tab.id === 'inputs') setActiveColorType('label');
                  else setActiveColorType('progressBar');
                }}
                className={cn(
                  "flex items-center gap-2 px-4 py-2 text-sm font-medium rounded-t-lg transition-all",
                  activeTab === tab.id 
                    ? "bg-background border-t border-l border-r -mb-px text-foreground" 
                    : "text-muted-foreground hover:text-foreground hover:bg-muted/50"
                )}
              >
                {tab.icon}
                {tab.label}
              </button>
            ))}
          </div>
        </DialogHeader>
        
        <div className="flex flex-1 overflow-hidden">
          {/* Left Panel - Option Selection */}
          <div className="w-64 border-r bg-muted/30 p-4 space-y-2 overflow-y-auto">
            {/* Tab-specific options */}
            {activeTab === 'colors' && colorsTab.map((type) => (
              <button
                key={type}
                onClick={() => setActiveColorType(type)}
                className={cn(
                  "w-full text-left p-3 rounded-lg transition-all",
                  "hover:bg-accent/50",
                  activeColorType === type && "bg-accent shadow-sm"
                )}
              >
                <div className="flex items-center gap-3">
                  {colorTypeConfig[type].icon}
                  <div>
                    <p className="font-medium text-sm">{colorTypeConfig[type].label}</p>
                    <p className="text-xs text-muted-foreground">{colorTypeConfig[type].description}</p>
                  </div>
                </div>
                <div 
                  className="mt-2 h-2 rounded-full w-full"
                  style={{ backgroundColor: colors[type] || '#ccc' }}
                />
              </button>
            ))}

            {activeTab === 'inputs' && inputsTab.map((type) => (
              <button
                key={type}
                onClick={() => setActiveColorType(type)}
                className={cn(
                  "w-full text-left p-3 rounded-lg transition-all",
                  "hover:bg-accent/50",
                  activeColorType === type && "bg-accent shadow-sm"
                )}
              >
                <div className="flex items-center gap-3">
                  {colorTypeConfig[type].icon}
                  <div>
                    <p className="font-medium text-sm">{colorTypeConfig[type].label}</p>
                    <p className="text-xs text-muted-foreground">{colorTypeConfig[type].description}</p>
                  </div>
                </div>
                <div 
                  className="mt-2 h-2 rounded-full w-full"
                  style={{ backgroundColor: colors[type] || '#ccc' }}
                />
              </button>
            ))}

            {activeTab === 'effects' && (
              <>
                <button
                  onClick={() => setActiveColorType('progressBar')}
                  className={cn(
                    "w-full text-left p-3 rounded-lg transition-all",
                    "hover:bg-accent/50",
                    activeColorType === 'progressBar' && "bg-accent shadow-sm"
                  )}
                >
                  <div className="flex items-center gap-3">
                    <BarChart3 className="w-5 h-5" />
                    <div>
                      <p className="font-medium text-sm">Progress Bar</p>
                      <p className="text-xs text-muted-foreground">Progress indicator color</p>
                    </div>
                  </div>
                  <div 
                    className="mt-2 h-2 rounded-full w-full"
                    style={{ backgroundColor: colors.progressBar || '#3B82F6' }}
                  />
                </button>
                <button
                  onClick={() => setActiveColorType('borderRadius')}
                  className={cn(
                    "w-full text-left p-3 rounded-lg transition-all",
                    "hover:bg-accent/50",
                    activeColorType === 'borderRadius' && "bg-accent shadow-sm"
                  )}
                >
                  <div className="flex items-center gap-3">
                    <Radius className="w-5 h-5" />
                    <div>
                      <p className="font-medium text-sm">Border Radius</p>
                      <p className="text-xs text-muted-foreground">Corner roundness</p>
                    </div>
                  </div>
                  <div className="mt-2 text-xs text-muted-foreground capitalize">
                    {colors.borderRadius || 'medium'}
                  </div>
                </button>
                <button
                  onClick={() => setActiveColorType('containerShadow')}
                  className={cn(
                    "w-full text-left p-3 rounded-lg transition-all",
                    "hover:bg-accent/50",
                    activeColorType === 'containerShadow' && "bg-accent shadow-sm"
                  )}
                >
                  <div className="flex items-center gap-3">
                    <Layers className="w-5 h-5" />
                    <div>
                      <p className="font-medium text-sm">Container Shadow</p>
                      <p className="text-xs text-muted-foreground">Form shadow depth</p>
                    </div>
                  </div>
                  <div className="mt-2 text-xs text-muted-foreground capitalize">
                    {colors.containerShadow || 'medium'}
                  </div>
                </button>
              </>
            )}
            
            {/* Font Option - Always visible */}
            <div className="border-t pt-3 mt-3">
              <div className="p-3">
                <div className="flex items-center gap-3 mb-3">
                  <Type className="w-5 h-5" />
                  <div>
                    <p className="font-medium text-sm">Font Family</p>
                    <p className="text-xs text-muted-foreground">Typography style</p>
                  </div>
                </div>
                <div className="space-y-1">
                  {fonts.map((font) => (
                    <button
                      key={font.value}
                      onClick={() => handleFontChange(font.value as 'sans' | 'serif' | 'mono')}
                      className={cn(
                        "w-full text-left p-2 rounded-md transition-all text-sm",
                        "hover:bg-accent/50",
                        colors.font === font.value && "bg-accent shadow-sm"
                      )}
                      style={fontStyles[font.value as keyof typeof fontStyles]}
                    >
                      {font.label}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          </div>

          {/* Right Panel - Options */}
          <div className="flex-1 p-6 overflow-y-auto">
            {/* Color picker for color types */}
            {isColorType(activeColorType) && (
              <>
                {/* Custom Color Input */}
                <div className="mb-6">
                  <Label className="text-sm font-medium mb-3 block">Custom Color</Label>
                  <div className="flex gap-3">
                    <div className="relative flex-1">
                      <Input
                        type="text"
                        value={colors[activeColorType] || ''}
                        onChange={(e) => handleColorChange(activeColorType, e.target.value)}
                        placeholder="#000000"
                        className="pl-10"
                      />
                      <Pipette className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    </div>
                    <Input
                      type="color"
                      value={colors[activeColorType] || '#000000'}
                      onChange={(e) => handleColorChange(activeColorType, e.target.value)}
                      className="w-20 h-10 cursor-pointer p-1"
                    />
                  </div>
                </div>

                {/* Solid Colors */}
                <div className="mb-6">
                  <Label className="text-sm font-medium mb-3 block">Preset Colors</Label>
                  <div className="grid grid-cols-4 gap-3">
                    {solidColors[activeColorType].map((color: string) => (
                      <button
                        key={color}
                        onClick={() => handleColorChange(activeColorType, color)}
                        className={cn(
                          "h-12 rounded-lg border-2 transition-all",
                          "hover:scale-105 hover:shadow-md",
                          colors[activeColorType] === color
                            ? "border-primary ring-2 ring-primary/20" 
                            : "border-gray-200"
                        )}
                        style={{ backgroundColor: color }}
                        title={color}
                      />
                    ))}
                  </div>
                </div>

                {/* Gradient Presets - only for certain color types */}
                {['text', 'header', 'background', 'button', 'progressBar'].includes(activeColorType) && (
                  <div>
                    <Label className="text-sm font-medium mb-3 block">
                      {theme.name} Gradients
                    </Label>
                    <div className="grid grid-cols-2 gap-3">
                      {gradientPresets[
                        activeColorType === 'text' || activeColorType === 'header' || activeColorType === 'label' 
                          ? 'secondary' 
                          : activeColorType === 'button' || activeColorType === 'progressBar'
                          ? 'primary' 
                          : 'background'
                      ].map((preset) => (
                        <button
                          key={preset.name}
                          onClick={() => handleGradientSelect(activeColorType as 'text' | 'background' | 'button' | 'header', preset.gradient)}
                          className={cn(
                            "p-4 rounded-lg border-2 transition-all text-left",
                            "hover:scale-[1.02] hover:shadow-md",
                            colors[`${activeColorType}Gradient` as keyof CustomColors] === preset.gradient
                              ? "border-primary ring-2 ring-primary/20"
                              : "border-gray-200"
                          )}
                        >
                          <div className={`h-12 rounded-md mb-2 ${preset.preview}`} />
                          <p className="text-sm font-medium">{preset.name}</p>
                        </button>
                      ))}
                    </div>
                  </div>
                )}
              </>
            )}

            {/* Border Radius Options */}
            {activeColorType === 'borderRadius' && (
              <div>
                <Label className="text-sm font-medium mb-3 block">Border Radius</Label>
                <p className="text-sm text-muted-foreground mb-4">Choose the corner roundness for inputs and buttons</p>
                <div className="grid grid-cols-5 gap-3">
                  {borderRadiusOptions.map((option) => (
                    <button
                      key={option.value}
                      onClick={() => handleSettingChange('borderRadius', option.value)}
                      className={cn(
                        "p-4 border-2 transition-all text-center",
                        option.preview,
                        "hover:scale-105 hover:shadow-md",
                        colors.borderRadius === option.value
                          ? "border-primary ring-2 ring-primary/20"
                          : "border-gray-200"
                      )}
                    >
                      <div className={cn("w-full h-8 bg-primary/20 mb-2", option.preview)} />
                      <p className="text-xs font-medium">{option.label}</p>
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* Container Shadow Options */}
            {activeColorType === 'containerShadow' && (
              <div>
                <Label className="text-sm font-medium mb-3 block">Container Shadow</Label>
                <p className="text-sm text-muted-foreground mb-4">Choose the shadow depth for the form container</p>
                <div className="grid grid-cols-4 gap-3">
                  {shadowOptions.map((option) => (
                    <button
                      key={option.value}
                      onClick={() => handleSettingChange('containerShadow', option.value)}
                      className={cn(
                        "p-4 border-2 rounded-lg transition-all text-center",
                        "hover:scale-105",
                        colors.containerShadow === option.value
                          ? "border-primary ring-2 ring-primary/20"
                          : "border-gray-200"
                      )}
                    >
                      <div className={cn("w-full h-12 bg-white rounded-md mb-2", option.preview)} />
                      <p className="text-xs font-medium">{option.label}</p>
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Live Preview */}
        <div className="border-t bg-muted/30 p-6">
          <div className="max-w-md mx-auto">
            <Label className="text-sm font-medium mb-3 block">Preview</Label>
            <div 
              className={cn(
                "p-6",
                colors.borderRadius === 'none' ? 'rounded-none' :
                colors.borderRadius === 'small' ? 'rounded-sm' :
                colors.borderRadius === 'large' ? 'rounded-xl' :
                colors.borderRadius === 'full' ? 'rounded-3xl' : 'rounded-lg',
                colors.containerShadow === 'none' ? 'shadow-none' :
                colors.containerShadow === 'small' ? 'shadow-sm' :
                colors.containerShadow === 'large' ? 'shadow-xl' : 'shadow-md'
              )}
              style={{ 
                ...previewStyles.background, 
                ...fontStyles[colors.font]
              }}
            >
              <h3 className="text-lg font-semibold mb-4" style={previewStyles.header}>
                Sample Form
              </h3>
              <div className="space-y-3">
                <div>
                  <label 
                    className="block text-sm font-medium mb-1" 
                    style={{ color: colors.label || colors.text }}
                  >
                    Your Name
                  </label>
                  <input 
                    type="text" 
                    placeholder="Enter your name"
                    className={cn(
                      "w-full p-2 border",
                      colors.borderRadius === 'none' ? 'rounded-none' :
                      colors.borderRadius === 'small' ? 'rounded-sm' :
                      colors.borderRadius === 'large' ? 'rounded-lg' :
                      colors.borderRadius === 'full' ? 'rounded-full' : 'rounded-md'
                    )}
                    style={{ 
                      borderColor: colors.inputBorder || colors.button,
                      backgroundColor: colors.inputBackground || '#fff',
                      color: colors.inputText || colors.text,
                      ...fontStyles[colors.font] 
                    }}
                  />
                </div>
                {colors.progressBar && (
                  <div className="w-full h-2 bg-gray-200 rounded-full overflow-hidden">
                    <div 
                      className="h-full w-1/2 rounded-full"
                      style={{ backgroundColor: colors.progressBar }}
                    />
                  </div>
                )}
                <button 
                  className={cn(
                    "w-full py-2 px-4 text-white font-medium",
                    colors.borderRadius === 'none' ? 'rounded-none' :
                    colors.borderRadius === 'small' ? 'rounded-sm' :
                    colors.borderRadius === 'large' ? 'rounded-lg' :
                    colors.borderRadius === 'full' ? 'rounded-full' : 'rounded-md'
                  )}
                  style={previewStyles.button}
                >
                  Submit Form
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="flex justify-between items-center px-6 py-4 border-t">
          <Button
            variant="ghost"
            onClick={handleReset}
            className="flex items-center gap-2"
          >
            <RotateCcw className="h-4 w-4" />
            Reset to Defaults
          </Button>
          <Button onClick={() => setIsOpen(false)}>
            Apply Changes
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}