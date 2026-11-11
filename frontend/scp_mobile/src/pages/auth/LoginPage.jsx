import { useState, useEffect, useRef, useCallback } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { User, Lock, AlertCircle, Phone, KeyRound, Users, ArrowLeft, RotateCw } from 'lucide-react';
import { Button, Input, Badge, BottomSheetModal } from '../../components/shared';
import { useAuth } from '../../hooks/useAuth';
import { useGoogleAuth } from '../../hooks/useGoogleAuth';

export default function LoginPage() {
  const navigate = useNavigate();
  const {
    login,
    loginWithGoogle,
    requestPhoneLoginOtp,
    verifyPhoneLoginOtp,
    selectAccountPhoneLogin,
    getHomeRoute,
  } = useAuth();
  const { isLoaded: isGoogleLoaded, renderGoogleButton } = useGoogleAuth();

  // Mode: 'password' (default) vs 'whatsapp'
  const [loginMethod, setLoginMethod] = useState('password');

  // Password Login State
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  const [fieldErrors, setFieldErrors] = useState({});
  const googleBtnRef = useRef(null);

  // WhatsApp OTP State
  const [otpStep, setOtpStep] = useState('phone'); // 'phone' | 'verify'
  const [phoneNumber, setPhoneNumber] = useState('');
  const [otpCode, setOtpCode] = useState('');
  const [sessionToken, setSessionToken] = useState('');
  const [maskedPhone, setMaskedPhone] = useState('');
  const [cooldown, setCooldown] = useState(0);
  const [isOtpLoading, setIsOtpLoading] = useState(false);
  const [otpSuccessMessage, setOtpSuccessMessage] = useState('');

  // Multi-Account Selection State
  const [isAccountPickerOpen, setIsAccountPickerOpen] = useState(false);
  const [selectionToken, setSelectionToken] = useState('');
  const [accountsList, setAccountsList] = useState([]);
  const [isSelectingAccount, setIsSelectingAccount] = useState(false);

  const deviceName = `Mobile Browser (${navigator.userAgent.includes('Android') ? 'Android' : navigator.userAgent.includes('iPhone') ? 'iOS' : navigator.platform || 'Smartphone'})`;

  // Countdown timer for OTP cooldown
  useEffect(() => {
    if (cooldown <= 0) return;
    const timer = setInterval(() => {
      setCooldown((prev) => (prev > 0 ? prev - 1 : 0));
    }, 1000);
    return () => clearInterval(timer);
  }, [cooldown]);

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
    if (loginMethod === 'password' && isGoogleLoaded && googleBtnRef.current) {
      googleBtnRef.current.innerHTML = '';
      renderGoogleButton(googleBtnRef.current, {
        onSuccess: handleGoogleSuccess,
        onError: (err) => {
          console.error('[LoginPage] Google Login Error:', err);
          setError(
            err?.message ||
              'Gagal masuk dengan Google. Pastikan akun Google Anda aktif di perangkat ini.'
          );
        },
        text: 'signin_with',
        theme: 'outline',
        size: 'large',
        width: '100%',
      });
    }
  }, [loginMethod, isGoogleLoaded, renderGoogleButton, handleGoogleSuccess]);

  // Handle Standard Password Login
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

  // Step 1 WhatsApp: Request OTP
  const handleRequestOtp = async (e) => {
    e?.preventDefault();
    if (!phoneNumber.trim()) {
      setError('Nomor WhatsApp wajib diisi.');
      return;
    }

    setIsOtpLoading(true);
    setError('');
    setOtpSuccessMessage('');

    try {
      const res = await requestPhoneLoginOtp(phoneNumber.trim(), deviceName);
      if (res?.success) {
        setSessionToken(res.data?.session_token);
        setMaskedPhone(res.data?.masked_phone || phoneNumber);
        setCooldown(res.data?.cooldown_seconds || 60);
        setOtpStep('verify');
        setOtpSuccessMessage(res.message || 'Kode OTP telah dikirimkan ke WhatsApp Anda.');
      } else {
        setError(res?.message || 'Gagal mengirimkan kode OTP.');
      }
    } catch (err) {
      setError(err?.message || 'Gagal mengirimkan kode OTP. Pastikan nomor telah terdaftar & terverifikasi.');
    } finally {
      setIsOtpLoading(false);
    }
  };

  // Step 2 WhatsApp: Verify OTP
  const handleVerifyOtp = async (e) => {
    e?.preventDefault();
    if (!otpCode.trim() || otpCode.trim().length !== 6) {
      setError('Masukkan 6 digit kode OTP yang diterima.');
      return;
    }

    setIsOtpLoading(true);
    setError('');
    setOtpSuccessMessage('');

    try {
      const res = await verifyPhoneLoginOtp(sessionToken, otpCode.trim(), deviceName);

      if (res?.multiple_accounts) {
        setAccountsList(res.accounts || []);
        setSelectionToken(res.selection_token);
        setIsAccountPickerOpen(true);
      } else if (res?.user) {
        if (res.must_change_password) {
          navigate('/change-password', { replace: true });
        } else {
          navigate(getHomeRoute(res.user), { replace: true });
        }
      } else {
        throw new Error('Respons login tidak valid.');
      }
    } catch (err) {
      setError(err?.message || 'Kode OTP tidak valid atau telah kedaluwarsa.');
    } finally {
      setIsOtpLoading(false);
    }
  };

  // Step 3 WhatsApp: Select Account (Multi-Account)
  const handleSelectAccount = async (targetUserId) => {
    setIsSelectingAccount(true);
    setError('');

    try {
      const res = await selectAccountPhoneLogin(selectionToken, targetUserId, deviceName);
      setIsAccountPickerOpen(false);

      if (res?.must_change_password) {
        navigate('/change-password', { replace: true });
      } else {
        navigate(getHomeRoute(res?.user), { replace: true });
      }
    } catch (err) {
      setError(err?.message || 'Gagal masuk dengan akun yang dipilih.');
    } finally {
      setIsSelectingAccount(false);
    }
  };

  const getRoleBadgeVariant = (role) => {
    switch (role) {
      case 'admin':
        return 'danger';
      case 'vice_principal':
        return 'accent';
      case 'teacher':
        return 'primary';
      case 'student':
        return 'success';
      case 'parent':
        return 'info';
      default:
        return 'neutral';
    }
  };

  const getRoleLabel = (role) => {
    switch (role) {
      case 'admin':
        return 'Administrator';
      case 'vice_principal':
        return 'Waka Kurikulum';
      case 'teacher':
        return 'Guru Pengampu';
      case 'student':
        return 'Siswa';
      case 'parent':
        return 'Orang Tua / Wali';
      default:
        return role;
    }
  };

  return (
    <div className="min-h-dvh bg-[var(--color-bg-app)] flex flex-col items-center px-4 py-6 pb-safe overflow-y-auto">
      <div className="w-full max-w-[420px] mx-auto my-auto space-y-4">
        {/* Brand & App Bar */}
        <div className="surface-card p-5 space-y-4">
          <div className="flex items-center justify-between gap-3 border-b border-[var(--color-border-light)] pb-3.5">
            <div className="flex min-w-0 items-center gap-2.5">
              <img
                src="/SCP_logo.png"
                alt="Logo School Class Progress"
                width="40"
                height="40"
                className="h-10 w-10 shrink-0 rounded-[10px]"
                decoding="async"
              />
              <h1 className="min-w-0 text-base font-bold leading-tight text-[var(--color-text-primary)]">
                School Class Progress
              </h1>
            </div>
            <Badge variant="accent" size="sm">
              v1.0
            </Badge>
          </div>

          <div>
            <h2 className="page-title">
              Masuk ke Akun
            </h2>
            <p className="text-xs text-[var(--color-text-secondary)] mt-0.5 leading-relaxed">
              Pilih metode masuk yang sesuai dengan akun sekolah Anda.
            </p>
          </div>

          {/* Tab Selector: Sandi vs WhatsApp OTP */}
          <div className="grid grid-cols-2 p-1 bg-[var(--color-surface-subtle)] rounded-[10px] border border-[var(--color-border-light)] gap-1">
            <button
              type="button"
              onClick={() => {
                setLoginMethod('password');
                setError('');
                setOtpSuccessMessage('');
              }}
              className={`py-2 text-xs font-semibold rounded-[8px] transition-all flex items-center justify-center gap-1.5 ${
                loginMethod === 'password'
                  ? 'bg-[var(--color-card)] text-[var(--color-text-primary)] shadow-xs'
                  : 'text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)]'
              }`}
            >
              <Lock size={13} />
              <span>ID & Sandi</span>
            </button>
            <button
              type="button"
              onClick={() => {
                setLoginMethod('whatsapp');
                setError('');
                setOtpSuccessMessage('');
              }}
              className={`py-2 text-xs font-semibold rounded-[8px] transition-all flex items-center justify-center gap-1.5 ${
                loginMethod === 'whatsapp'
                  ? 'bg-[var(--color-card)] text-[var(--color-text-primary)] shadow-xs'
                  : 'text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)]'
              }`}
            >
              <Phone size={13} />
              <span>WhatsApp OTP</span>
            </button>
          </div>

          {/* Success / Info Message */}
          {otpSuccessMessage && (
            <div
              className="p-3 rounded-[10px] bg-emerald-500/10 border border-emerald-500/30 text-xs text-emerald-400 flex items-start gap-2 leading-relaxed"
              role="status"
            >
              <span className="text-sm">💬</span>
              <span>{otpSuccessMessage}</span>
            </div>
          )}

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

          {/* TAB 1: Password Login */}
          {loginMethod === 'password' && (
            <form onSubmit={handleSubmit} className="space-y-3.5 pt-1">
              <Input
                id="mobile-input-username"
                label="ID | Email | No.WA"
                placeholder="NIS, NIP, Email, atau No. WhatsApp"
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
                variant="brand"
                size="lg"
                fullWidth
                loading={isLoading}
              >
                Masuk Sekarang
              </Button>

              {/* Separator */}
              <div className="relative flex py-2 items-center">
                <div className="grow border-t border-[var(--color-border-subtle)]" />
                <span className="shrink mx-3 text-[11px] font-semibold uppercase tracking-[0.06em] text-[var(--color-text-muted)]">
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
          )}

          {/* TAB 2: WhatsApp OTP Login */}
          {loginMethod === 'whatsapp' && (
            <div className="space-y-3.5 pt-1">
              {otpStep === 'phone' ? (
                <form onSubmit={handleRequestOtp} className="space-y-3.5">
                  <Input
                    id="mobile-input-phone"
                    type="tel"
                    label="Nomor WhatsApp Terdaftar"
                    placeholder="Contoh: 081234567890"
                    value={phoneNumber}
                    autoComplete="tel"
                    onChange={(e) => {
                      setPhoneNumber(e.target.value);
                      if (error) setError('');
                    }}
                    icon={Phone}
                    disabled={isOtpLoading}
                    required
                  />
                  <p className="text-[11px] text-[var(--color-text-muted)] leading-relaxed">
                    Kode verifikasi 6 digit akan dikirimkan ke nomor WhatsApp Anda yang telah diverifikasi di sistem.
                  </p>

                  <Button
                    type="submit"
                    variant="brand"
                    size="lg"
                    fullWidth
                    loading={isOtpLoading}
                  >
                    Kirim Kode OTP WhatsApp
                  </Button>
                </form>
              ) : (
                <form onSubmit={handleVerifyOtp} className="space-y-3.5">
                  <div className="p-3 rounded-[10px] bg-[var(--color-surface-subtle)] border border-[var(--color-border-light)] text-xs">
                    <span className="text-[var(--color-text-secondary)]">Kode dikirimkan ke: </span>
                    <strong className="font-mono text-[var(--color-text-primary)]">{maskedPhone}</strong>
                  </div>

                  <Input
                    id="mobile-input-otp"
                    type="text"
                    inputMode="numeric"
                    maxLength={6}
                    label="Kode Verifikasi OTP (6 Digit)"
                    placeholder="123456"
                    value={otpCode}
                    autoComplete="one-time-code"
                    onChange={(e) => {
                      const val = e.target.value.replace(/\D/g, '').slice(0, 6);
                      setOtpCode(val);
                      if (error) setError('');
                    }}
                    icon={KeyRound}
                    disabled={isOtpLoading}
                    className="font-mono text-center tracking-widest text-lg font-bold"
                    required
                  />

                  <Button
                    type="submit"
                    variant="brand"
                    size="lg"
                    fullWidth
                    loading={isOtpLoading}
                    disabled={otpCode.length !== 6}
                  >
                    Verifikasi & Masuk
                  </Button>

                  <div className="flex items-center justify-between pt-1">
                    <button
                      type="button"
                      onClick={() => {
                        setOtpStep('phone');
                        setOtpCode('');
                        setError('');
                        setOtpSuccessMessage('');
                      }}
                      className="text-xs text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)] flex items-center gap-1 py-1"
                    >
                      <ArrowLeft size={13} />
                      <span>Ganti Nomor</span>
                    </button>

                    <button
                      type="button"
                      disabled={cooldown > 0 || isOtpLoading}
                      onClick={handleRequestOtp}
                      className={`text-xs font-semibold flex items-center gap-1 py-1 ${
                        cooldown > 0
                          ? 'text-[var(--color-text-muted)] cursor-not-allowed'
                          : 'text-[var(--color-text-primary)] underline'
                      }`}
                    >
                      <RotateCw size={13} className={isOtpLoading ? 'animate-spin' : ''} />
                      <span>{cooldown > 0 ? `Kirim ulang (${cooldown}s)` : 'Kirim Ulang OTP'}</span>
                    </button>
                  </div>
                </form>
              )}
            </div>
          )}
        </div>

        {/* Device Detection Footer */}
        <div className="text-center text-[11px] text-[var(--color-text-muted)]">
          Perangkat: <span className="text-[var(--color-text-secondary)] font-medium">{deviceName}</span>
        </div>
      </div>

      {/* Account Picker BottomSheet Modal (Jika 1 nomor HP memiliki > 1 akun) */}
      <BottomSheetModal
        isOpen={isAccountPickerOpen}
        onClose={() => {
          if (!isSelectingAccount) setIsAccountPickerOpen(false);
        }}
        title="Pilih Akun Anda"
        subtitle="Nomor WhatsApp ini terhubung ke beberapa akun sekolah."
        size="md"
      >
        <div className="space-y-2.5 py-2">
          {accountsList.map((acc) => (
            <button
              key={acc.id}
              type="button"
              disabled={isSelectingAccount}
              onClick={() => handleSelectAccount(acc.id)}
              className="w-full text-left p-3.5 rounded-[12px] border border-[var(--color-border-light)] bg-[var(--color-card)] hover:bg-[var(--color-surface-hover)] hover:border-[var(--color-brand)] transition-all flex items-center justify-between gap-3 group"
            >
              <div className="min-w-0 space-y-1">
                <div className="flex items-center gap-2">
                  <span className="font-bold text-sm text-[var(--color-text-primary)] truncate">
                    {acc.name}
                  </span>
                  <Badge variant={getRoleBadgeVariant(acc.role)} size="sm">
                    {getRoleLabel(acc.role)}
                  </Badge>
                </div>
                <p className="text-xs text-[var(--color-text-secondary)] font-mono truncate">
                  {acc.detail || acc.username || `ID: ${acc.id}`}
                </p>
              </div>

              <div className="shrink-0 text-xs font-semibold text-[var(--color-brand)] group-hover:translate-x-0.5 transition-transform">
                Masuk &rarr;
              </div>
            </button>
          ))}
        </div>
      </BottomSheetModal>
    </div>
  );
}
