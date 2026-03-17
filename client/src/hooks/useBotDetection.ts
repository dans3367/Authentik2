import { useEffect, useRef, useState } from 'react';

interface BotDetectionResult {
  isSuspicious: boolean;
}

/**
 * Tracks user interaction signals to detect bot-like behavior.
 * Returns isSuspicious=true when the form has no real human interaction
 * (no mouse movement, no keyboard input, no focus events).
 */
export function useBotDetection(): BotDetectionResult {
  const hasMouseMoved = useRef(false);
  const hasKeyPressed = useRef(false);
  const hasFieldFocused = useRef(false);
  const hasTouched = useRef(false);
  const [, forceUpdate] = useState(0);

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

  // Compute suspicion at call time (when submit is attempted)
  const isSuspicious = !hasMouseMoved.current
    && !hasKeyPressed.current
    && !hasFieldFocused.current
    && !hasTouched.current;

  return { isSuspicious };
}
