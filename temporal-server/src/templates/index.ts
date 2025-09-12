export { renderSparkleCakeEcard } from './birthday/sparkle-cake';

export type BirthdayTemplateId = 'default' | 'confetti' | 'balloons' | 'sparkle-cake';

export function renderBirthdayTemplate(
  template: BirthdayTemplateId,
  params: { recipientName?: string; message?: string; imageUrl?: string; brandName?: string }
): string {
  if (template === 'sparkle-cake') {
    const { renderSparkleCakeEcard } = require('./birthday/sparkle-cake');
    return renderSparkleCakeEcard({
      recipientName: params.recipientName,
      message: params.message,
      imageUrl: params.imageUrl || 'https://example.com/images/birthday-sparkle.jpg',
    });
  }

  // Simple fallback for other templates for now
  const headline = `Happy Birthday${params.recipientName ? ', ' + params.recipientName : ''}!`;
  return `<html><body style="font-family:Arial,sans-serif; padding:24px;">
    <h1>${headline}</h1>
    <p>${params.message || 'Wishing you a wonderful day!'}</p>
  </body></html>`;
}


