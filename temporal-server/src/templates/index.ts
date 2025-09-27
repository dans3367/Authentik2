export { renderSparkleCakeEcard } from './birthday/sparkle-cake';

export type BirthdayTemplateId = 'default' | 'confetti' | 'balloons' | 'custom';

export function renderBirthdayTemplate(
  template: BirthdayTemplateId,
  params: { recipientName?: string; message?: string; imageUrl?: string; brandName?: string; customThemeData?: any; senderName?: string }
): string {
  // Handle custom theme with rich styling
  if (template === 'custom' && params.customThemeData) {
    let customData = null;
    
    try {
      const parsedData = typeof params.customThemeData === 'string' 
        ? JSON.parse(params.customThemeData) 
        : params.customThemeData;
      
      // Check if it's the new structure (has themes property)
      if (parsedData.themes && parsedData.themes.custom) {
        customData = parsedData.themes.custom;
      } else if (!parsedData.themes) {
        // Old structure - use directly if no themes property
        customData = parsedData;
      }
    } catch (e) {
      console.warn('Failed to parse customThemeData for custom template:', e);
      return `<html><body><p>Error loading custom theme</p></body></html>`;
    }
    
    if (!customData) {
      return `<html><body><p>No custom theme data found</p></body></html>`;
    }
    
    const title = customData.title || `Happy Birthday${params.recipientName ? ', ' + params.recipientName : ''}!`;
    const message = customData.message || params.message || 'Wishing you a wonderful day!';
    const signature = customData.signature || '';
    
    return `<html>
      <body style="font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; margin: 0; padding: 20px; background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);">
        <div style="max-width: 600px; margin: 0 auto; background: white; border-radius: 12px; overflow: hidden; box-shadow: 0 20px 40px rgba(0,0,0,0.1);">
          <!-- Header Image (standalone) -->
          ${customData.imageUrl ? `
            <div style="height: 200px; background-image: url('${customData.imageUrl}'); background-size: cover; background-position: center; border-radius: 12px 12px 0 0;">
            </div>
          ` : `
            <div style="background: linear-gradient(135deg, #a8e6cf 0%, #dcedc1 100%); height: 200px; border-radius: 12px 12px 0 0;">
            </div>
          `}
          
          <!-- Header Text (separate from image) -->
          <div style="padding: 30px 30px 20px 30px; text-align: center; border-bottom: 1px solid #f0f0f0;">
            <h1 style="color: #2d3748; font-size: 2.5rem; margin: 0; font-weight: bold;">${title}</h1>
          </div>
          <div style="padding: 30px;">
            <div style="font-size: 1.2rem; line-height: 1.6; color: #4a5568; margin-bottom: 20px;">${message}</div>
            ${params.promotionContent ? `<div style="margin-top: 30px; padding: 20px; background: #f7fafc; border-radius: 8px; border-left: 4px solid #667eea;">${params.promotionContent}</div>` : ''}
            ${signature ? `<div style="margin-top: 30px; padding-top: 20px; border-top: 1px solid #e2e8f0; font-style: italic; color: #718096;">${signature}</div>` : ''}
            ${params.senderName ? `<div style="margin-top: 30px; padding-top: 20px; border-top: 1px solid #e2e8f0; text-align: center; color: #718096; font-size: 0.9rem;">Best wishes from ${params.senderName}</div>` : ''}
          </div>
        </div>
      </body>
    </html>`;
  }

  // Default theme header images
  const themeHeaders = {
    default: 'https://images.unsplash.com/photo-1588195538326-c5b1e9f80a1b?q=80&w=2550&auto=format&fit=crop&ixlib=rb-4.1.0&ixid=M3wxMjA3fDB8MHxwaG90by1wYWdlfHx8fGVufDB8fHx8fA%3D%3D',
    confetti: 'https://images.unsplash.com/photo-1530103862676-de8c9debad1d?q=80&w=2550&auto=format&fit=crop&ixlib=rb-4.1.0&ixid=M3wxMjA3fDB8MHxwaG90by1wYWdlfHx8fGVufDB8fHx8fA%3D%3D', // Party/confetti themed
    balloons: 'https://images.unsplash.com/photo-1464349095431-e9a21285b5f3?q=80&w=2550&auto=format&fit=crop&ixlib=rb-4.1.0&ixid=M3wxMjA3fDB8MHxwaG90by1wYWdlfHx8fGVufDB8fHx8fA%3D%3D' // Balloons themed
  };

  const themeColors = {
    default: { primary: '#667eea', secondary: '#764ba2' },
    confetti: { primary: '#ff6b6b', secondary: '#feca57' },
    balloons: { primary: '#54a0ff', secondary: '#5f27cd' }
  };
  
  // Check if there's custom theme data with custom title/signature for this specific theme
  let headline = `Happy Birthday${params.recipientName ? ', ' + params.recipientName : ''}!`;
  let signature = '';
  
  if (params.customThemeData) {
    try {
      const parsedData = typeof params.customThemeData === 'string' 
        ? JSON.parse(params.customThemeData) 
        : params.customThemeData;
      
      let themeSpecificData = null;
      
      // Check if it's the new structure (has themes property)
      if (parsedData.themes && parsedData.themes[template]) {
        themeSpecificData = parsedData.themes[template];
      } else if (!parsedData.themes) {
        // Old structure - use directly if no themes property
        themeSpecificData = parsedData;
      }
      
      if (themeSpecificData) {
        // Use custom title if provided, otherwise use default
        if (themeSpecificData.title) {
          headline = themeSpecificData.title;
        }
        
        // Use custom signature if provided
        if (themeSpecificData.signature) {
          signature = themeSpecificData.signature;
        }
      }
    } catch (e) {
      // If parsing fails, continue with defaults
      console.warn('Failed to parse customThemeData for template:', template, e);
    }
  }
  
  const headerImage = themeHeaders[template as keyof typeof themeHeaders] || themeHeaders.default;
  const colors = themeColors[template as keyof typeof themeColors] || themeColors.default;
  
  return `<html>
    <body style="font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; margin: 0; padding: 20px; background: linear-gradient(135deg, ${colors.primary} 0%, ${colors.secondary} 100%);">
      <div style="max-width: 600px; margin: 0 auto; background: white; border-radius: 12px; overflow: hidden; box-shadow: 0 20px 40px rgba(0,0,0,0.1);">
        <!-- Header Image (standalone) -->
        <div style="height: 200px; background-image: url('${headerImage}'); background-size: cover; background-position: center; border-radius: 12px 12px 0 0;">
        </div>
        
        <!-- Header Text (separate from image) -->
        <div style="padding: 30px 30px 20px 30px; text-align: center; border-bottom: 1px solid #f0f0f0;">
          <h1 style="color: #2d3748; font-size: 2.5rem; margin: 0; font-weight: bold;">${headline}</h1>
        </div>
        <div style="padding: 30px;">
          <div style="font-size: 1.2rem; line-height: 1.6; color: #4a5568; text-align: center; margin-bottom: 20px;">${params.message || 'Wishing you a wonderful day!'}</div>
          ${signature ? `<div style="font-size: 1rem; line-height: 1.5; color: #718096; text-align: center; font-style: italic; margin-top: 20px;">${signature}</div>` : ''}
          ${params.senderName ? `<div style="margin-top: 30px; padding-top: 20px; border-top: 1px solid #e2e8f0; text-align: center; color: #718096; font-size: 0.9rem;">Best wishes from ${params.senderName}</div>` : ''}
        </div>
      </div>
    </body>
  </html>`;
}


