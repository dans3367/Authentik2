import { FormTheme, CustomColors } from '@/types/form-builder';
import { Button } from '@/components/ui/button';
import { Check, Palette } from 'lucide-react';
import { ColorCustomizer } from '@/components/form-builder/color-customizer';

interface StyleStepProps {
  themes: FormTheme[];
  selectedTheme: FormTheme | null;
  onSelectTheme: (theme: FormTheme) => void;
  onCustomizeColors?: (colors: CustomColors) => void;
  onResetColors?: () => void;
}

export function StyleStep({ themes, selectedTheme, onSelectTheme, onCustomizeColors, onResetColors }: StyleStepProps) {
  const customTheme = themes.find(t => t.id === 'custom');
  const otherThemes = themes.filter(t => t.id !== 'custom');
  const isCustomSelected = selectedTheme?.id === 'custom';

  return (
    <div className="flex flex-col bg-neutral-50">
      <div className="bg-white/95 backdrop-blur-sm border-b border-slate-200/60 px-6 py-5 shadow-sm">
        <div className="max-w-4xl mx-auto">
          <h2 className="text-2xl font-bold text-slate-800 mb-2">Choose Your Form Style</h2>
          <p className="text-slate-600">Select a visual theme that matches your brand and preferences</p>
        </div>
      </div>

      <div className="p-6">
        <div className="max-w-4xl mx-auto">
          {/* Custom Theme Card - Full Width at Top */}
          {customTheme && (
            <div className="mb-6">
              <div
                className={`relative group cursor-pointer transition-all duration-200 ${
                  isCustomSelected
                    ? 'ring-2 ring-blue-500 ring-offset-2'
                    : 'hover:shadow-lg'
                }`}
                onClick={() => onSelectTheme(customTheme)}
              >
                <div className="bg-white rounded-xl shadow-md overflow-hidden border border-slate-200">
                  <div className="flex items-center justify-between p-6 border-b border-dashed border-slate-200 bg-gradient-to-r from-slate-50 via-white to-slate-50">
                    <div className="flex items-center gap-4">
                      <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-blue-500 via-purple-500 to-pink-500 flex items-center justify-center shadow-lg">
                        <Palette className="w-6 h-6 text-white" />
                      </div>
                      <div>
                        <h3 className="text-lg font-bold text-slate-800">Custom Theme</h3>
                        <p className="text-sm text-slate-500">Design your own — pick every color, font, and detail</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-3">
                      {isCustomSelected && onCustomizeColors && onResetColors && (
                        <div onClick={(e) => e.stopPropagation()}>
                          <ColorCustomizer
                            theme={selectedTheme!}
                            onColorsChange={onCustomizeColors}
                            onResetColors={onResetColors}
                          />
                        </div>
                      )}
                      {isCustomSelected && (
                        <div className="w-8 h-8 bg-blue-500 rounded-full flex items-center justify-center shadow-lg">
                          <Check className="w-5 h-5 text-white" />
                        </div>
                      )}
                    </div>
                  </div>
                  {isCustomSelected && selectedTheme?.customColors && (
                    <div className="px-6 py-4 bg-slate-50/50">
                      <div className="flex items-center gap-3 flex-wrap">
                        <span className="text-xs font-medium text-slate-500 uppercase tracking-wider">Active colors:</span>
                        {[
                          { label: 'Background', color: selectedTheme.customColors.background },
                          { label: 'Header', color: selectedTheme.customColors.header },
                          { label: 'Text', color: selectedTheme.customColors.text },
                          { label: 'Button', color: selectedTheme.customColors.button },
                          { label: 'Label', color: selectedTheme.customColors.label },
                          { label: 'Input BG', color: selectedTheme.customColors.inputBackground },
                          { label: 'Input Border', color: selectedTheme.customColors.inputBorder },
                          { label: 'Input Text', color: selectedTheme.customColors.inputText },
                        ].filter(s => s.color).map((swatch) => (
                          <div key={swatch.label} className="flex items-center gap-1.5">
                            <div
                              className="w-5 h-5 rounded border border-slate-200 shadow-sm"
                              style={{ backgroundColor: swatch.color }}
                            />
                            <span className="text-xs text-slate-600">{swatch.label}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* Preset Themes Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
            {otherThemes.map((theme) => (
              <div
                key={theme.id}
                className={`relative group cursor-pointer transition-all duration-200 ${
                  selectedTheme?.id === theme.id
                    ? 'ring-2 ring-blue-500 ring-offset-2'
                    : 'hover:shadow-lg hover:scale-105'
                }`}
                onClick={() => onSelectTheme(theme)}
              >
                <div className="bg-white rounded-xl shadow-md overflow-hidden border border-slate-200">
                  {/* Preview */}
                  <div className={`h-40 ${theme.preview} relative flex items-center justify-center overflow-hidden`}>
                    {selectedTheme?.id === theme.id && (
                      <div className="absolute top-3 right-3 w-8 h-8 bg-white/90 backdrop-blur-sm rounded-full flex items-center justify-center shadow-lg">
                        <Check className="w-5 h-5 text-green-600" />
                      </div>
                    )}

                    {/* Theme-specific preview content */}
                    <div className="text-center px-4">
                      {theme.id === 'neon' && (
                        <div className="text-cyan-400 font-bold text-lg tracking-wider drop-shadow-lg">
                          CYBER<span className="text-green-400">FORM</span>
                        </div>
                      )}
                      {theme.id === 'nature' && (
                        <div className="text-white font-semibold text-lg">
                          🌿 Natural Forms 🌿
                        </div>
                      )}
                      {theme.id === 'luxury' && (
                        <div className="text-yellow-400 font-light text-lg tracking-widest font-serif">
                          LUXURY DESIGN
                        </div>
                      )}
                      {theme.id === 'retro' && (
                        <div className="text-white font-black text-lg tracking-wider transform -skew-x-12 uppercase">
                          80S STYLE
                        </div>
                      )}
                      {theme.id === 'cosmic' && (
                        <div className="text-purple-300 font-bold text-lg tracking-wider drop-shadow-lg">
                          <span className="text-cyan-400">✦</span> COSMIC <span className="text-pink-400">✦</span>
                        </div>
                      )}
                      {theme.id === 'brutalist' && (
                        <div className="text-white font-black text-lg tracking-wider uppercase border-4 border-white px-4 py-2">
                          BRUTALIST
                        </div>
                      )}
                      {theme.id === 'pastel-dream' && (
                        <div className="text-purple-600 font-medium text-lg tracking-wide">
                          ✨ Pastel Dreams ✨
                        </div>
                      )}
                      {theme.id === 'ocean-breeze' && (
                        <div className="text-white font-bold text-lg tracking-wide drop-shadow-lg">
                          <span className="text-cyan-100">~</span> Ocean Breeze <span className="text-cyan-100">~</span>
                        </div>
                      )}
                      {theme.id === 'sunset-warmth' && (
                        <div className="text-white font-bold text-lg tracking-wide drop-shadow-lg">
                          Sunset Warmth
                        </div>
                      )}
                      {theme.id === 'monospace-terminal' && (
                        <div className="text-green-400 font-mono font-bold text-lg tracking-widest">
                          &gt;_ TERMINAL
                        </div>
                      )}
                      {theme.id === 'silk' && (
                        <div className="text-stone-600 font-serif font-light text-lg tracking-wide">
                          Silk
                        </div>
                      )}
                      {theme.id === 'professional' && (
                        <div className="text-blue-600 font-semibold text-lg">
                          PROFESSIONAL
                        </div>
                      )}
                      {theme.id === 'neo-modern' && (
                        <div className="text-green-400 font-mono font-bold text-lg tracking-wider">
                          &gt; NEO_MODERN.exe
                        </div>
                      )}
                      {theme.id === 'modern-bold' && (
                        <div className="text-white font-black text-xl tracking-wider drop-shadow-lg">
                          MODERN BOLD
                        </div>
                      )}
                      {theme.id === 'aurora' && (
                        <div className="text-white font-extrabold text-lg tracking-wide">
                          Aurora
                        </div>
                      )}
                      {theme.id === 'minimal' && (
                        <div className="text-gray-800 font-light text-lg tracking-wide">
                          MINIMAL
                        </div>
                      )}
                      {theme.id === 'art-deco' && (
                        <div className="text-[#c9a84c] font-serif font-bold text-lg uppercase tracking-[0.3em]">
                          ART DECO
                        </div>
                      )}
                      {theme.id === 'vapor' && (
                        <div className="font-bold text-lg tracking-wider bg-gradient-to-r from-[#ff2d95] via-[#ff71ce] to-[#01cdfe] bg-clip-text text-transparent">
                          VAPOR
                        </div>
                      )}
                      {!['neon', 'nature', 'luxury', 'retro', 'cosmic', 'brutalist', 'pastel-dream', 'ocean-breeze', 'sunset-warmth', 'monospace-terminal', 'silk', 'professional', 'neo-modern', 'minimal', 'modern-bold', 'aurora', 'art-deco', 'vapor'].includes(theme.id) && (
                        <>
                          <div className="text-white font-semibold opacity-90 text-lg">{theme.name}</div>
                          <div className="text-white text-sm opacity-60 mt-1">Theme Preview</div>
                        </>
                      )}
                    </div>
                  </div>

                  {/* Content */}
                  <div className="p-6">
                    <h3 className="text-lg font-semibold text-slate-800 mb-2">{theme.name}</h3>
                    <p className="text-sm text-slate-600 mb-4">{theme.description}</p>

                    {/* Enhanced sample form preview */}
                    <div className="space-y-3 p-4 bg-slate-50 rounded-lg border overflow-hidden">
                      <div className="space-y-1">
                        <div className="text-xs font-medium text-slate-700">Name</div>
                        <div className={`h-8 px-3 flex items-center text-xs ${
                          theme.id === 'neon' ? 'bg-gray-900 border-2 border-cyan-400 text-cyan-100' :
                          theme.id === 'nature' ? 'bg-white border-2 border-green-300 rounded-2xl' :
                          theme.id === 'luxury' ? 'bg-purple-800/50 border border-yellow-400 text-white' :
                          theme.id === 'retro' ? 'bg-yellow-50 border-3 border-orange-400' :
                          theme.id === 'elegant' ? 'bg-gray-800 border border-gray-600 text-white rounded-lg' :
                          theme.id === 'playful' ? 'bg-pink-50 border-3 border-pink-300 rounded-2xl' :
                          theme.id === 'modern' ? 'bg-white/80 border-2 border-gray-200 rounded-xl backdrop-blur-sm' :
                          theme.id === 'professional' ? 'bg-white border border-gray-300 rounded-md' :
                          theme.id === 'cosmic' ? 'bg-black/40 border border-purple-500/40 text-purple-200 rounded-lg' :
                          theme.id === 'brutalist' ? 'bg-white border-4 border-black' :
                          theme.id === 'pastel-dream' ? 'bg-white/70 border-2 border-purple-200 rounded-2xl' :
                          theme.id === 'neo-modern' ? 'bg-black/50 border border-green-400/30 text-green-100 font-mono' :
                          theme.id === 'modern-bold' ? 'bg-gradient-to-r from-white to-gray-50 border-3 border-orange-500/30 text-gray-900 font-semibold rounded-2xl shadow-lg' :
                          theme.id === 'ocean-breeze' ? 'bg-white/70 border-2 border-cyan-200 rounded-2xl backdrop-blur-sm' :
                          theme.id === 'sunset-warmth' ? 'bg-white/80 border-2 border-amber-200 rounded-xl' :
                          theme.id === 'art-deco' ? 'bg-[#0f1a2e] border-2 border-[#c9a84c]/40 text-[#d4c5a0] font-serif' :
                          theme.id === 'vapor' ? 'bg-[#120826] border border-[#b967ff]/40 rounded-lg text-[#ff71ce]' :
                          'bg-white border border-gray-300 rounded-lg'
                        }`}>
                          <div className={theme.id === 'neon' || theme.id === 'luxury' || theme.id === 'elegant' || theme.id === 'cosmic' || theme.id === 'neo-modern' || theme.id === 'art-deco' || theme.id === 'vapor' ? 'text-gray-300' : theme.id === 'brutalist' || theme.id === 'modern-bold' ? 'text-black' : 'text-slate-400'}>
                            Enter your name
                          </div>
                        </div>
                      </div>
                      <div className="space-y-1">
                        <div className="text-xs font-medium text-slate-700">Email</div>
                        <div className={`h-8 px-3 flex items-center text-xs ${
                          theme.id === 'neon' ? 'bg-gray-900 border-2 border-green-400 text-green-100' :
                          theme.id === 'nature' ? 'bg-white border-2 border-emerald-300 rounded-2xl' :
                          theme.id === 'luxury' ? 'bg-purple-800/50 border border-yellow-400 text-white' :
                          theme.id === 'retro' ? 'bg-yellow-50 border-3 border-pink-400' :
                          theme.id === 'elegant' ? 'bg-gray-800 border border-gray-600 text-white rounded-lg' :
                          theme.id === 'playful' ? 'bg-pink-50 border-3 border-purple-300 rounded-2xl' :
                          theme.id === 'modern' ? 'bg-white/80 border-2 border-gray-200 rounded-xl backdrop-blur-sm' :
                          theme.id === 'professional' ? 'bg-white border border-gray-300 rounded-md' :
                          theme.id === 'cosmic' ? 'bg-black/40 border border-purple-500/40 text-purple-200 rounded-lg' :
                          theme.id === 'brutalist' ? 'bg-white border-4 border-black' :
                          theme.id === 'pastel-dream' ? 'bg-white/70 border-2 border-purple-200 rounded-2xl' :
                          theme.id === 'neo-modern' ? 'bg-black/50 border border-green-400/30 text-green-100 font-mono' :
                          theme.id === 'modern-bold' ? 'bg-gradient-to-r from-white to-gray-50 border-3 border-orange-500/30 text-gray-900 font-semibold rounded-2xl shadow-lg' :
                          theme.id === 'ocean-breeze' ? 'bg-white/70 border-2 border-cyan-200 rounded-2xl backdrop-blur-sm' :
                          theme.id === 'sunset-warmth' ? 'bg-white/80 border-2 border-amber-200 rounded-xl' :
                          theme.id === 'art-deco' ? 'bg-[#0f1a2e] border-2 border-[#c9a84c]/40 text-[#d4c5a0] font-serif' :
                          theme.id === 'vapor' ? 'bg-[#120826] border border-[#b967ff]/40 rounded-lg text-[#ff71ce]' :
                          'bg-white border border-gray-300 rounded-lg'
                        }`}>
                          <div className={theme.id === 'neon' || theme.id === 'luxury' || theme.id === 'elegant' || theme.id === 'cosmic' || theme.id === 'neo-modern' || theme.id === 'art-deco' || theme.id === 'vapor' ? 'text-gray-300' : theme.id === 'brutalist' || theme.id === 'modern-bold' ? 'text-black' : 'text-slate-400'}>
                            Enter your email
                          </div>
                        </div>
                      </div>
                      <div className={`h-8 flex items-center justify-center text-xs font-medium ${
                        theme.id === 'neon' ? 'bg-gradient-to-r from-cyan-400 to-green-400 text-black rounded-lg' :
                        theme.id === 'nature' ? 'bg-gradient-to-r from-green-600 to-emerald-600 text-white rounded-2xl' :
                        theme.id === 'luxury' ? 'bg-gradient-to-r from-yellow-400 to-yellow-500 text-purple-900 rounded-lg' :
                        theme.id === 'retro' ? 'bg-gradient-to-r from-orange-500 to-pink-500 text-white' :

                        theme.id === 'elegant' ? 'bg-gradient-to-r from-yellow-400 to-yellow-500 text-gray-900 rounded-lg' :
                        theme.id === 'playful' ? 'bg-gradient-to-r from-pink-500 to-purple-600 text-white rounded-2xl' :
                        theme.id === 'modern' ? 'bg-gradient-to-r from-blue-600 to-purple-600 text-white rounded-xl' :
                        theme.id === 'professional' ? 'bg-blue-600 text-white rounded-md' :
                        theme.id === 'cosmic' ? 'bg-gradient-to-r from-purple-500 to-pink-500 text-white rounded-lg' :
                        theme.id === 'brutalist' ? 'bg-black text-white border-4 border-black' :
                        theme.id === 'pastel-dream' ? 'bg-gradient-to-r from-purple-400 to-pink-400 text-white rounded-2xl' :
                        theme.id === 'neo-modern' ? 'bg-gradient-to-r from-green-600 to-emerald-600 text-black font-mono border border-green-400/50' :
                        theme.id === 'modern-bold' ? 'bg-gradient-to-r from-orange-500 via-red-500 to-purple-600 text-white font-black text-xs uppercase tracking-widest rounded-2xl shadow-2xl border-2 border-white/20' :
                        theme.id === 'ocean-breeze' ? 'bg-gradient-to-r from-cyan-500 via-teal-500 to-blue-600 text-white rounded-2xl' :
                        theme.id === 'sunset-warmth' ? 'bg-gradient-to-r from-amber-500 via-orange-500 to-rose-500 text-white rounded-xl' :
                        theme.id === 'art-deco' ? 'bg-[#c9a84c] text-[#0c1525] font-serif font-bold uppercase tracking-[0.2em] border-2 border-[#c9a84c]' :
                        theme.id === 'vapor' ? 'bg-gradient-to-r from-[#ff2d95] via-[#b967ff] to-[#01cdfe] text-white font-bold tracking-wider rounded-lg' :
                        'bg-gray-900 text-white rounded-lg'
                      }`}>
                        Submit
                      </div>
                    </div>


                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
