import React, { useEffect, useRef, useState } from 'react';

interface GoogleSignInButtonProps {
  onEmailReceived: (email: string, firstName?: string, lastName?: string) => void;
  onError: (error: string) => void;
  formId: string;
  disabled?: boolean;
  language?: string;
}

interface GoogleCredentialResponse {
  credential: string;
  select_by: string;
}

const GoogleSignInButton: React.FC<GoogleSignInButtonProps> = ({
  onEmailReceived,
  onError,
  formId,
  disabled = false,
  language = 'en',
}) => {
  const buttonRef = useRef<HTMLDivElement>(null);
  const [loading, setLoading] = useState(false);
  const [googleClientId, setGoogleClientId] = useState<string | null>(null);
  const [initialized, setInitialized] = useState(false);

  useEffect(() => {
    fetch('/api/forms/google-client-id')
      .then((res) => res.json())
      .then((data) => {
        if (data.clientId) {
          setGoogleClientId(data.clientId);
        }
      })
      .catch(() => {});
  }, []);

  useEffect(() => {
    if (!googleClientId || !buttonRef.current || initialized) return;

    let retryCount = 0;
    const maxRetries = 25;
    const initializeGoogle = () => {
      if (!window.google?.accounts?.id) {
        retryCount++;
        if (retryCount >= maxRetries) return;
        setTimeout(initializeGoogle, 200);
        return;
      }

      window.google.accounts.id.initialize({
        client_id: googleClientId,
        callback: handleCredentialResponse,
        auto_select: false,
        cancel_on_tap_outside: true,
      });

      if (buttonRef.current) {
        window.google.accounts.id.renderButton(buttonRef.current, {
          type: 'standard',
          theme: 'outline',
          size: 'large',
          text: 'signup_with',
          shape: 'rectangular',
          width: 320,
          locale: language,
        });
      }

      setInitialized(true);
    };

    initializeGoogle();
  }, [googleClientId, initialized, language]);

  const handleCredentialResponse = async (response: GoogleCredentialResponse) => {
    setLoading(true);
    try {
      const verifyRes = await fetch('/api/forms/google-signin', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          credential: response.credential,
          formId,
        }),
      });

      if (!verifyRes.ok) {
        const errorData = await verifyRes.json().catch(() => ({}));
        throw new Error(errorData.error || 'Failed to verify Google sign-in');
      }

      const data = await verifyRes.json();

      if (data.email) {
        onEmailReceived(data.email, data.firstName, data.lastName);
      } else {
        throw new Error('Could not extract email from Google sign-in');
      }
    } catch (err: any) {
      onError(err.message || 'Google sign-in failed');
    } finally {
      setLoading(false);
    }
  };

  if (!googleClientId) return null;

  const dividerText = language === 'es' ? 'o regístrate con Google' : 'or sign up with Google';

  return (
    <div className="space-y-4">
      <div className="relative">
        <div className="absolute inset-0 flex items-center">
          <div className="w-full border-t border-gray-300"></div>
        </div>
        <div className="relative flex justify-center text-sm">
          <span className="px-3 bg-white text-gray-500">{dividerText}</span>
        </div>
      </div>

      <div className="flex flex-col items-center">
        {loading ? (
          <div className="flex items-center space-x-2 py-3 px-6 border border-gray-300 rounded-md bg-gray-50">
            <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-blue-600"></div>
            <span className="text-sm text-gray-600">
              {language === 'es' ? 'Procesando...' : 'Processing...'}
            </span>
          </div>
        ) : (
          <div
            ref={buttonRef}
            className={disabled ? 'opacity-50 pointer-events-none' : ''}
          />
        )}
      </div>
    </div>
  );
};

export default GoogleSignInButton;
