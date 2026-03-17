import { useEffect, useRef } from 'react';

interface BotDetectionResult {
  isSuspicious: boolean;
}

/**
 * Tracks user interaction signals to detect bot-like behavior.
 * Returns isSuspicious=true when the form has no real human interaction.
 */
export function useBotDetection(): BotDetectionResult {
  const hasMouseMoved = useRef(false);
  const hasKeyPressed = useRef(false);
  const hasFieldFocused = useRef(false);
  const hasTouched = useRef(false);

  useEffect(() => {
    const onMouseMove = () => { hasMouseMoved.current = true; };
    const onKeyDown = () => { hasKeyPressed.current = true; };
    const onFocusIn = () => { hasFieldFocused.current = true; };
    const onTouchStart = () => { hasTouched.current = true; };

    document.addEventListener('mousemove', onMouseMove, { once: true });
    document.addEventListener('keydown', onKeyDown, { once: true });
    document.addEventListener('focusin', onFocusIn, { once: true });
    document.addEventListener('touchstart', onTouchStart, { once: true });

    return () => {
      document.removeEventListener('mousemove', onMouseMove);
      document.removeEventListener('keydown', onKeyDown);
      document.removeEventListener('focusin', onFocusIn);
      document.removeEventListener('touchstart', onTouchStart);
    };
  }, []);

  const isSuspicious = !hasMouseMoved.current
    && !hasKeyPressed.current
    && !hasFieldFocused.current
    && !hasTouched.current;

  return { isSuspicious };
}
