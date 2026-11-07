import { useState, useEffect, useCallback } from 'react';

const GIS_SCRIPT_ID = 'google-identity-services-script';
const GIS_SCRIPT_URL = 'https://accounts.google.com/gsi/client';

export function useGoogleAuth() {
  const [isLoaded, setIsLoaded] = useState(() => Boolean(window.google?.accounts?.id));
  const [loadError, setLoadError] = useState(null);
  const clientId = import.meta.env.VITE_GOOGLE_CLIENT_ID || '';

  // Load Google Identity Services script dynamically
  useEffect(() => {
    if (window.google?.accounts?.id) {
      return;
    }

    let script = document.getElementById(GIS_SCRIPT_ID);
    if (!script) {
      script = document.createElement('script');
      script.id = GIS_SCRIPT_ID;
      script.src = GIS_SCRIPT_URL;
      script.async = true;
      script.defer = true;
      document.head.appendChild(script);
    }

    const handleLoad = () => setIsLoaded(true);
    const handleError = () => setLoadError('Gagal memuat pustaka Google Identity Services.');

    script.addEventListener('load', handleLoad);
    script.addEventListener('error', handleError);

    return () => {
      script.removeEventListener('load', handleLoad);
      script.removeEventListener('error', handleError);
    };
  }, []);

  /**
   * Render official Google Sign-In button on DOM element
   */
  const renderGoogleButton = useCallback(
    (
      element,
      {
        onSuccess,
        onError,
        text = 'continue_with',
        theme = 'outline',
        size = 'large',
        width = '100%',
      } = {}
    ) => {
      if (!isLoaded || !window.google?.accounts?.id) {
        onError?.(new Error('Google Identity Services belum siap.'));
        return;
      }

      if (!clientId) {
        const error = new Error('VITE_GOOGLE_CLIENT_ID belum dikonfigurasi di file .env.');
        console.error(error);
        onError?.(error);
        return;
      }

      try {
        window.google.accounts.id.initialize({
          client_id: clientId,
          callback: (response) => {
            if (response?.credential) {
              onSuccess?.(response.credential);
            } else {
              onError?.(new Error('Kredensial Google ID Token tidak ditemukan dalam respons.'));
            }
          },
          auto_select: false,
          cancel_on_tap_outside: true,
        });

        if (element) {
          element.innerHTML = '';
          window.google.accounts.id.renderButton(element, {
            type: 'standard',
            theme,
            size,
            text,
            shape: 'rectangular',
            logo_alignment: 'left',
            width: width === '100%' ? 320 : width,
            locale: 'id',
          });
        }
      } catch (err) {
        console.error('[useGoogleAuth] renderGoogleButton error:', err);
        onError?.(err);
      }
    },
    [isLoaded, clientId]
  );

  return {
    isLoaded,
    loadError,
    clientId,
    isConfigured: Boolean(clientId),
    renderGoogleButton,
  };
}

export default useGoogleAuth;
