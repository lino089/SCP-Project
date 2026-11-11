import { useState, useEffect, useCallback, useRef } from 'react';
import { Capacitor } from '@capacitor/core';
import { SocialLogin } from '@capgo/capacitor-social-login';

const GIS_SCRIPT_ID = 'google-identity-services-script';
const GIS_SCRIPT_URL = 'https://accounts.google.com/gsi/client';

export function useGoogleAuth(legacyOptions = {}) {
  const isNative = Capacitor.isNativePlatform();
  const [isLoaded, setIsLoaded] = useState(() => isNative || Boolean(window.google?.accounts?.id));
  const [loadError, setLoadError] = useState(null);
  const [isGoogleLoading, setIsGoogleLoading] = useState(false);
  const isInitializedRef = useRef(false);

  const clientId =
    import.meta.env.VITE_GOOGLE_CLIENT_ID ||
    '517786684277-4fh8cd7pg4rpk3r3daned77ksj5pgpu1.apps.googleusercontent.com';

  // Native Initialization
  useEffect(() => {
    if (!isNative) return;

    if (!isInitializedRef.current) {
      isInitializedRef.current = true;
      SocialLogin.initialize({
        google: {
          webClientId: clientId,
        },
      })
        .then(() => {
          setIsLoaded(true);
        })
        .catch((err) => {
          console.error('[useGoogleAuth] Native SocialLogin init failed:', err);
          setLoadError(err?.message || 'Gagal menginisialisasi Google Sign-In native.');
        });
    }
  }, [isNative, clientId]);

  // Web GIS Script Loading (Fallback for Web Browser)
  useEffect(() => {
    if (isNative) return;
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
  }, [isNative]);

  /**
   * Native trigger for Google Login
   * @returns {Promise<string>} idToken
   */
  const signInWithGoogle = useCallback(async () => {
    if (!clientId) {
      throw new Error('VITE_GOOGLE_CLIENT_ID belum dikonfigurasi di file .env.');
    }

    setIsGoogleLoading(true);
    try {
      if (isNative) {
        const response = await SocialLogin.login({
          provider: 'google',
          options: {
            style: 'bottom',
            filterByAuthorizedAccounts: false,
          },
        });

        const idToken = response?.result?.idToken;
        if (!idToken) {
          throw new Error('Kredensial Google ID Token tidak ditemukan dalam respons native.');
        }
        return idToken;
      } else {
        throw new Error('Gunakan renderGoogleButton untuk platform web.');
      }
    } catch (err) {
      const errMsg = String(err?.message || err || '');
      if (
        err?.code === 'USER_CANCELLED' ||
        errMsg.toLowerCase().includes('cancel') ||
        errMsg.toLowerCase().includes('batal')
      ) {
        const cancelErr = new Error('Login Google dibatalkan oleh pengguna.');
        cancelErr.code = 'USER_CANCELLED';
        throw cancelErr;
      }

      if (
        errMsg.includes('28444') ||
        errMsg.includes('Developer console is not set up correctly') ||
        errMsg.includes('10:')
      ) {
        const devErr = new Error(
          'Konfigurasi Google Cloud belum lengkap (SHA-1 atau Package ID belum cocok). Silakan periksa kredensial Android di Google Cloud Console.'
        );
        devErr.code = 'DEV_CONSOLE_MISCONFIGURED';
        throw devErr;
      }

      if (
        errMsg.includes('NoCredentialException') ||
        errMsg.includes('No credentials available')
      ) {
        const noCredErr = new Error(
          'Tidak ada akun Google yang tersedia pada perangkat ini. Silakan tambahkan akun Google terlebih dahulu.'
        );
        noCredErr.code = 'NO_CREDENTIALS';
        throw noCredErr;
      }

      console.error('[useGoogleAuth] signInWithGoogle error:', err);
      throw err;
    } finally {
      setIsGoogleLoading(false);
    }
  }, [isNative, clientId]);

  /**
   * Render Google Sign-In button on DOM element
   * Seamlessly handles Native Android (Credential Manager button) & Web (GIS iframe)
   */
  const renderGoogleButton = useCallback(
    (
      element,
      {
        onSuccess,
        onError,
        text = 'signin_with',
        theme = 'outline',
        size = 'large',
        width = '100%',
      } = {}
    ) => {
      if (!element) return;

      if (!clientId) {
        const error = new Error('VITE_GOOGLE_CLIENT_ID belum dikonfigurasi di file .env.');
        console.error(error);
        onError?.(error);
        return;
      }

      // 1. NATIVE ANDROID / IOS BUTTON
      if (isNative) {
        element.innerHTML = '';
        const btn = document.createElement('button');
        btn.type = 'button';
        btn.className =
          'w-full min-h-[44px] flex items-center justify-center gap-3 px-4 py-2.5 rounded-[10px] border border-[var(--color-border-strong,#d1d5db)] bg-white text-[13px] font-medium text-gray-800 shadow-sm active:bg-gray-100 transition-colors cursor-pointer select-none';

        const labelText =
          text === 'signin_with'
            ? 'Masuk dengan Google'
            : text === 'continue_with'
            ? 'Lanjutkan dengan Google'
            : 'Tautkan Akun Google';

        const defaultButtonHtml = `
          <svg class="w-4 h-4 shrink-0" viewBox="0 0 24 24" aria-hidden="true">
            <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
            <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
            <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z"/>
            <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"/>
          </svg>
          <span class="truncate">${labelText}</span>
        `;

        btn.innerHTML = defaultButtonHtml;

        btn.onclick = async (e) => {
          e.preventDefault();
          if (btn.disabled) return;

          btn.disabled = true;
          btn.style.opacity = '0.7';
          btn.innerHTML = `
            <svg class="w-4 h-4 shrink-0 animate-spin text-gray-600" viewBox="0 0 24 24" fill="none">
              <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
              <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z"></path>
            </svg>
            <span class="truncate">Menghubungkan ke Google…</span>
          `;

          try {
            const idToken = await signInWithGoogle();
            if (idToken) {
              onSuccess?.(idToken);
            }
          } catch (err) {
            const isCancelled =
              err?.code === 'USER_CANCELLED' ||
              String(err?.message || '').toLowerCase().includes('cancel') ||
              String(err?.message || '').toLowerCase().includes('batal');

            if (!isCancelled) {
              onError?.(err);
            }
          } finally {
            btn.innerHTML = defaultButtonHtml;
            btn.disabled = false;
            btn.style.opacity = '1';
          }
        };

        element.appendChild(btn);
        return;
      }

      // 2. WEB BROWSER GIS BUTTON
      if (!isLoaded || !window.google?.accounts?.id) {
        onError?.(new Error('Google Identity Services belum siap.'));
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
      } catch (err) {
        console.error('[useGoogleAuth] renderGoogleButton error:', err);
        onError?.(err);
      }
    },
    [isNative, isLoaded, clientId, signInWithGoogle]
  );

  // Legacy caller support (Phase 1)
  const triggerGoogleLogin = useCallback(async () => {
    try {
      const idToken = await signInWithGoogle();
      legacyOptions.onSuccess?.(idToken);
      return idToken;
    } catch (err) {
      if (err?.code !== 'USER_CANCELLED') {
        legacyOptions.onError?.(err?.message || 'Gagal login Google.');
      }
      throw err;
    }
  }, [signInWithGoogle, legacyOptions]);

  return {
    isLoaded,
    loadError,
    clientId,
    isConfigured: Boolean(clientId),
    isNative,
    isGoogleLoading,
    signInWithGoogle,
    triggerGoogleLogin,
    renderGoogleButton,
  };
}

export default useGoogleAuth;
