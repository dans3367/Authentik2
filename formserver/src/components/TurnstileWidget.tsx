import { useEffect, useRef, useState } from 'react';

declare global {
  interface Window {
    turnstile?: {
      render(container: HTMLElement, params: {
        sitekey: string;
        callback: (token: string) => void;
        'error-callback'?: () => void;
        'expired-callback'?: () => void;
        theme?: 'light' | 'dark' | 'auto';
        size?: 'normal' | 'compact';
      }): string;
      remove(widgetId: string): void;
      reset(widgetId: string): void;
    };
  }
}

interface TurnstileWidgetProps {
  siteKey: string;
  onVerify: (token: string) => void;
  onError?: () => void;
}

export default function TurnstileWidget({ siteKey, onVerify, onError }: TurnstileWidgetProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const widgetIdRef = useRef<string | null>(null);
  const [scriptLoaded, setScriptLoaded] = useState(!!window.turnstile);

  useEffect(() => {
    if (window.turnstile) {
      setScriptLoaded(true);
      return;
    }

    const existing = document.querySelector('script[src*="challenges.cloudflare.com/turnstile"]');
    if (existing) {
      const check = setInterval(() => {
        if (window.turnstile) { setScriptLoaded(true); clearInterval(check); }
      }, 200);
      return () => clearInterval(check);
    }

    const script = document.createElement('script');
    script.src = 'https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit';
    script.async = true;
    script.onload = () => {
      const check = setInterval(() => {
        if (window.turnstile) { setScriptLoaded(true); clearInterval(check); }
      }, 100);
    };
    script.onerror = () => { onError?.(); };
    document.head.appendChild(script);
  }, [onError]);

  useEffect(() => {
    if (!scriptLoaded || !window.turnstile || !containerRef.current) return;
    if (widgetIdRef.current) return;

    widgetIdRef.current = window.turnstile.render(containerRef.current, {
      sitekey: siteKey,
      callback: onVerify,
      'error-callback': onError,
      'expired-callback': onError,
      theme: 'auto',
      size: 'normal',
    });

    return () => {
      if (widgetIdRef.current && window.turnstile) {
        window.turnstile.remove(widgetIdRef.current);
        widgetIdRef.current = null;
      }
    };
  }, [scriptLoaded, siteKey, onVerify, onError]);

  return (
    <div style={{ display: 'flex', justifyContent: 'center', margin: '16px 0' }}>
      <div ref={containerRef} />
    </div>
  );
}
