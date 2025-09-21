export { renderSparkleCakeEcard } from './birthday/sparkle-cake';

export type BirthdayTemplateId = 'default' | 'confetti' | 'balloons' | 'custom';

export function renderBirthdayTemplate(
  template: BirthdayTemplateId,
  params: { recipientName?: string; message?: string; imageUrl?: string; brandName?: string; customThemeData?: any }
): string {
  // Handle custom theme with rich styling
  if (template === 'custom' && params.customThemeData) {
    const customData = typeof params.customThemeData === 'string' 
      ? JSON.parse(params.customThemeData) 
      : params.customThemeData;
    
    const title = customData.title || `Happy Birthday${params.recipientName ? ', ' + params.recipientName : ''}!`;
    const message = customData.message || params.message || 'Wishing you a wonderful day!';
    const signature = customData.signature || '';
    
    return `<html>
      <body style="font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; margin: 0; padding: 20px; background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);">
        <div style="max-width: 600px; margin: 0 auto; background: white; border-radius: 12px; overflow: hidden; box-shadow: 0 20px 40px rgba(0,0,0,0.1);">
          ${customData.imageUrl ? `
            <div style="position: relative; height: 200px; background-image: url('${customData.imageUrl}'); background-size: cover; background-position: center;">
              <div style="position: absolute; inset: 0; background: rgba(0,0,0,0.3);"></div>
              <div style="position: absolute; inset: 0; display: flex; align-items: center; justify-content: center;">
                <h1 style="color: white; font-size: 2.5rem; margin: 0; text-shadow: 2px 2px 4px rgba(0,0,0,0.5);">${title}</h1>
              </div>
            </div>
          ` : `
            <div style="background: linear-gradient(135deg, #a8e6cf 0%, #dcedc1 100%); padding: 40px; text-align: center;">
              <h1 style="color: #2d3748; font-size: 2.5rem; margin: 0;">${title}</h1>
            </div>
          `}
          <div style="padding: 30px;">
            <div style="font-size: 1.2rem; line-height: 1.6; color: #4a5568; margin-bottom: 20px;">${message}</div>
            ${signature ? `<div style="margin-top: 30px; padding-top: 20px; border-top: 1px solid #e2e8f0; font-style: italic; color: #718096;">${signature}</div>` : ''}
          </div>
        </div>
      </body>
    </html>`;
  }

  // Simple templates for default themes
  const themeStyles = {
    default: 'background: white; color: #333;',
    confetti: 'background: linear-gradient(135deg, #ffecd2 0%, #fcb69f 100%); color: #333;',
    balloons: 'background: linear-gradient(135deg, #a8edea 0%, #fed6e3 100%); color: #333;'
  };
  
  const headline = `Happy Birthday${params.recipientName ? ', ' + params.recipientName : ''}!`;
  const style = themeStyles[template as keyof typeof themeStyles] || themeStyles.default;
  
  return `<html>
    <body style="font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; margin: 0; padding: 20px; ${style}">
      <div style="max-width: 600px; margin: 0 auto; background: rgba(255,255,255,0.9); border-radius: 12px; padding: 40px; box-shadow: 0 10px 30px rgba(0,0,0,0.1);">
        <h1 style="font-size: 2.5rem; margin: 0 0 20px 0; text-align: center;">${headline}</h1>
        <p style="font-size: 1.2rem; line-height: 1.6; margin: 0; text-align: center;">${params.message || 'Wishing you a wonderful day!'}</p>
      </div>
    </body>
  </html>`;
}


