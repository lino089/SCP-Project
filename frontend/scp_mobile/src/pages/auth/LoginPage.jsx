import { useState, useEffect, useRef, useCallback } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { User, Lock, AlertCircle } from 'lucide-react';
import { Button, Input, Badge } from '../../components/shared';
import { useAuth } from '../../hooks/useAuth';
import { useGoogleAuth } from '../../hooks/useGoogleAuth';

export default function LoginPage() {
  const navigate = useNavigate();
  const { login, loginWithGoogle, getHomeRoute } = useAuth();
  const { isLoaded: isGoogleLoaded, renderGoogleButton } = useGoogleAuth();

  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  const [fieldErrors, setFieldErrors] = useState({});
  const googleBtnRef = useRef(null);

  const deviceName = `Mobile Browser (${navigator.userAgent.includes('Android') ? 'Android' : navigator.userAgent.includes('iPhone') ? 'iOS' : navigator.platform || 'Smartphone'})`;

  const handleGoogleSuccess = useCallback(async (idToken) => {
    setIsLoading(true);
    setError('');
    setFieldErrors({});

    try {
      const result = await loginWithGoogle(idToken, deviceName);
      if (result?.mustChangePassword) {
        navigate('/change-password', { replace: true });
      } else {
        navigate(getHomeRoute(result?.user), { replace: true });
      }
    } catch (err) {
      if (err.status === 404) {
        setError(
          'Akun Google belum ditautkan ke akun SCP Anda. Silakan login terlebih dahulu menggunakan NIS/NIP & kata sandi, kemudian tautkan akun Google di menu Profil.'
        );
      } else if (err.status === 403) {
        setError('Akun Anda dinonaktifkan atau berada di tempat sampah. Hubungi pihak Waka/Administrator.');
      } else {
        setError(err.message || 'Gagal masuk dengan akun Google. Pastikan akun telah ditautkan.');
      }
    } finally {
      setIsLoading(false);
    }
  }, [loginWithGoogle, deviceName, navigate, getHomeRoute]);

  useEffect(() => {
    if (isGoogleLoaded && googleBtnRef.current) {
      googleBtnRef.current.innerHTML = '';
      renderGoogleButton(googleBtnRef.current, {
        onSuccess: handleGoogleSuccess,
        onError: (err) => {
          console.warn('[LoginPage] Google GIS Error:', err);
        },
        text: 'signin_with',
        theme: 'outline',
        size: 'large',
        width: '100%',
      });
    }
  }, [isGoogleLoaded, renderGoogleButton, handleGoogleSuccess]);

  const handleSubmit = async (e) => {
    e?.preventDefault();
    if (!username.trim() || !password) {
      setError('ID Pengguna dan kata sandi wajib diisi.');
      return;
    }

    setIsLoading(true);
    setError('');
    setFieldErrors({});

    try {
      const result = await login({
        username: username.trim(),
        nis_nip: username.trim(),
        password,
        device_name: deviceName,
      });

      if (result?.mustChangePassword) {
        navigate('/change-password', { replace: true });
      } else {
        navigate(getHomeRoute(result?.user), { replace: true });
      }
    } catch (err) {
      if (err.errors) {
        setFieldErrors(err.errors);
      }
      setError(
        err.message || 'Kredensial tidak valid. Silakan periksa kembali ID Pengguna dan kata sandi.'
      );
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-dvh bg-[var(--color-bg-app)] flex flex-col items-center px-4 py-6 pb-safe overflow-y-auto">
      <div className="w-full max-w-[420px] mx-auto my-auto space-y-4">
        {/* Brand & App Bar */}
        <div className="surface-card p-5 space-y-4">
          <div className="flex items-center justify-between border-b border-[var(--color-border-light)] pb-3.5">
            <div className="flex items-center gap-2.5">
              <div className="icon-tile">
                <span className="w-3 h-3 bg-[var(--color-brand)] rounded-[2px]" />
              </div>
              <div className="min-w-0">
                <h1 className="text-base font-bold text-[var(--color-text-primary)] leading-tight truncate">
                  School Class Progress
                </h1>
                <p className="text-[11px] font-mono text-[var(--color-text-secondary)] uppercase tracking-tight">
                  Mobile Portal Terpadu
                </p>
              </div>
            </div>
            <Badge variant="accent" size="sm" mono>
              v1.0
            </Badge>
          </div>

          <div>
            <h2 className="page-title">
              Masuk ke Akun
            </h2>
            <p className="text-xs text-[var(--color-text-secondary)] mt-0.5 leading-relaxed">
              Gunakan NIS (Siswa), NIP/No. HP (Guru), atau identitas resmi sekolah Anda.
            </p>
          </div>

          {/* Error Banner */}
          {error && (
            <div
              className="p-3 rounded-[10px] bg-[var(--color-danger-bg)] border border-[var(--color-danger-border)] text-xs text-[var(--color-danger-fg)] flex items-start gap-2 leading-relaxed"
              role="alert"
            >
              <AlertCircle size={16} className="shrink-0 text-[var(--color-danger-fg)] mt-0.5" />
              <span>{error}</span>
            </div>
          )}

          {/* Form */}
          <form onSubmit={handleSubmit} className="space-y-3.5 pt-1">
            <Input
              id="mobile-input-username"
              label="ID Pengguna (NIS / NIP / No. WhatsApp)"
              placeholder="NIS, NIP, atau No. HP"
              value={username}
              autoComplete="username"
              onChange={(e) => {
                setUsername(e.target.value);
                if (error) setError('');
                if (fieldErrors.username || fieldErrors.nis_nip || fieldErrors.phone_number) {
                  setFieldErrors({});
                }
              }}
              error={
                fieldErrors.username?.[0] ||
                fieldErrors.nis_nip?.[0] ||
                fieldErrors.phone_number?.[0]
              }
              icon={User}
              disabled={isLoading}
              required
            />

            <Input
              id="mobile-input-password"
              type="password"
              label="Kata Sandi Akun"
              placeholder="Masukkan kata sandi akun"
              value={password}
              autoComplete="current-password"
              onChange={(e) => {
                setPassword(e.target.value);
                if (error) setError('');
                if (fieldErrors.password) setFieldErrors({});
              }}
              error={fieldErrors.password?.[0]}
              icon={Lock}
              disabled={isLoading}
              required
            />

            <div className="flex justify-end pt-0.5">
              <Link
                to="/forgot-password"
                className="text-xs font-semibold text-[var(--color-text-primary)] hover:text-[var(--color-text-primary)] underline underline-offset-2 py-1 min-h-[32px] inline-flex items-center"
              >
                Lupa kata sandi?
              </Link>
            </div>

            <Button
              type="submit"
              variant="primary"
              size="lg"
              fullWidth
              loading={isLoading}
            >
              Masuk Sekarang
            </Button>

            {/* Separator */}
            <div className="relative flex py-2 items-center">
              <div className="grow border-t border-[var(--color-border-subtle)]" />
              <span className="shrink mx-3 text-[11px] font-mono text-[var(--color-text-muted)] uppercase">
                Atau Masuk Dengan
              </span>
              <div className="grow border-t border-[var(--color-border-subtle)]" />
            </div>

            {/* Google SSO Container */}
            <div className="w-full flex justify-center">
              {!isGoogleLoaded && (
                <div className="w-full min-h-[44px] flex items-center justify-center rounded-[10px] border border-[var(--color-border-strong)] bg-[var(--color-surface)] text-[13px] font-medium text-[var(--color-text-secondary)]">
                  Memuat Google Sign-In…
                </div>
              )}
              <div
                ref={googleBtnRef}
                className={[
                  'w-full flex justify-center overflow-hidden rounded-[10px]',
                  isGoogleLoaded ? 'min-h-[44px]' : '',
                ]
                  .filter(Boolean)
                  .join(' ')}
              />
            </div>
          </form>
        </div>

        {/* Device Detection Footer */}
        <div className="text-center text-[11px] text-[var(--color-text-muted)] font-mono">
          Perangkat: <span className="text-[var(--color-text-secondary)] font-medium">{deviceName}</span>
        </div>
      </div>
    </div>
  );
}
