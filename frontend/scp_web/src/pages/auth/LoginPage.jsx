import { useState, useEffect, useRef, useCallback } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { Button, Input, Modal, Badge } from '../../components/shared';
import { useAuth } from '../../hooks/useAuth';
import { useGoogleAuth } from '../../hooks/useGoogleAuth';
import { User, Lock, ArrowLeft, Phone, KeyRound, RotateCw } from 'lucide-react';
import './Login.css';

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

  // Mode: 'password' vs 'whatsapp'
  const [loginMethod, setLoginMethod] = useState('password');

  // Password Login State
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  const [fieldErrors, setFieldErrors] = useState({});
  const googleLoginBtnRef = useRef(null);

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

  const deviceName = `${navigator.userAgent.includes('Mobile') ? 'Mobile' : 'Web'} Browser (${navigator.platform || 'Desktop'})`;

  // Countdown timer for OTP cooldown
  useEffect(() => {
    if (cooldown <= 0) return;
    const timer = setInterval(() => {
      setCooldown((prev) => (prev > 0 ? prev - 1 : 0));
    }, 1000);
    return () => clearInterval(timer);
  }, [cooldown]);

  const handleGoogleSuccess = useCallback(async (credential) => {
    setIsLoading(true);
    setError('');
    setFieldErrors({});

    try {
      const result = await loginWithGoogle(credential, deviceName);
      if (result?.mustChangePassword) {
        navigate('/change-password', { replace: true });
      } else {
        navigate(getHomeRoute(), { replace: true });
      }
    } catch (err) {
      if (err.status === 404) {
        setError(
          'Akun Google belum terhubung ke akun SCP Anda. Silakan login menggunakan NIS/NIP & kata sandi terlebih dahulu, kemudian hubungkan akun Google di menu profil.'
        );
      } else {
        setError(
          err.message || 'Gagal masuk menggunakan akun Google. Pastikan akun telah terhubung.'
        );
      }
    } finally {
      setIsLoading(false);
    }
  }, [loginWithGoogle, deviceName, navigate, getHomeRoute]);

  useEffect(() => {
    if (loginMethod === 'password' && isGoogleLoaded && googleLoginBtnRef.current) {
      renderGoogleButton(googleLoginBtnRef.current, {
        onSuccess: handleGoogleSuccess,
        onError: (err) => {
          console.warn('[LoginPage] Google button error:', err);
        },
        text: 'signin_with',
        theme: 'outline',
        size: 'large',
        width: '100%',
      });
    }
  }, [loginMethod, isGoogleLoaded, renderGoogleButton, handleGoogleSuccess]);

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
        password,
        device_name: deviceName,
      });

      if (result?.mustChangePassword) {
        navigate('/change-password', { replace: true });
      } else {
        navigate(getHomeRoute(), { replace: true });
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
          navigate(getHomeRoute(), { replace: true });
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
        navigate(getHomeRoute(), { replace: true });
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
    <div className="login-page">
      <div className="login-card">
        {/* Navigasi Kembali ke Beranda */}
        <div className="login-top-bar">
          <button
            type="button"
            onClick={() => navigate('/')}
            className="login-back-btn"
            title="Kembali ke Beranda Utama"
          >
            <ArrowLeft size={14} />
            <span>Kembali ke Beranda</span>
          </button>
        </div>

        {/* Header */}
        <div className="login-header">
          <span className="login-brand-text">School Class Progress</span>
          <h1 className="login-title">Masuk ke Portal</h1>
          <p className="login-subtitle">
            Sistem Informasi KBM, Presensi, dan Pengelolaan Jadwal Terpadu.
          </p>
        </div>

        {/* Tab Switcher: Sandi vs WhatsApp OTP */}
        <div className="grid grid-cols-2 p-1 bg-[var(--color-surface-subtle)] rounded-lg border border-[var(--color-border-light)] gap-1 mb-4">
          <button
            type="button"
            onClick={() => {
              setLoginMethod('password');
              setError('');
              setOtpSuccessMessage('');
            }}
            className={`py-2 text-xs font-semibold rounded-md transition-all flex items-center justify-center gap-1.5 ${
              loginMethod === 'password'
                ? 'bg-[var(--color-card)] text-[var(--color-text-primary)] shadow-sm'
                : 'text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)]'
            }`}
          >
            <Lock size={13} />
            <span>ID Pengguna & Sandi</span>
          </button>
          <button
            type="button"
            onClick={() => {
              setLoginMethod('whatsapp');
              setError('');
              setOtpSuccessMessage('');
            }}
            className={`py-2 text-xs font-semibold rounded-md transition-all flex items-center justify-center gap-1.5 ${
              loginMethod === 'whatsapp'
                ? 'bg-[var(--color-card)] text-[var(--color-text-primary)] shadow-sm'
                : 'text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)]'
            }`}
          >
            <Phone size={13} />
            <span>WhatsApp OTP</span>
          </button>
        </div>

        {/* Success / Info Banner */}
        {otpSuccessMessage && (
          <div className="p-3 mb-3 rounded-lg bg-emerald-500/10 border border-emerald-500/30 text-xs text-emerald-400 flex items-center gap-2">
            <span>💬</span>
            <span>{otpSuccessMessage}</span>
          </div>
        )}

        {/* Error Banner */}
        {error && (
          <div className="login-error" role="alert">
            {error}
          </div>
        )}

        {/* TAB 1: Password Login Form */}
        {loginMethod === 'password' && (
          <form onSubmit={handleSubmit} className="login-form">
            <Input
              label="ID | Email | No.WA"
              placeholder="Masukkan NIS, NIP, Email, atau No. WhatsApp"
              value={username}
              autoComplete="username"
              onChange={(e) => {
                setUsername(e.target.value);
                if (error) setError('');
                if (fieldErrors.username || fieldErrors.nis_nip || fieldErrors.phone_number) setFieldErrors({});
              }}
              error={fieldErrors.username?.[0] || fieldErrors.nis_nip?.[0] || fieldErrors.phone_number?.[0]}
              prefixIcon={User}
              required
            />

            <Input
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
              prefixIcon={Lock}
              required
            />

            <div className="flex justify-end pt-1 pb-2">
              <Link
                to="/forgot-password"
                className="text-xs font-semibold text-blue-600 hover:text-blue-700 hover:underline transition"
              >
                Lupa kata sandi?
              </Link>
            </div>

            <div className="login-actions">
              <Button
                type="submit"
                variant="primary"
                size="lg"
                fullWidth
                loading={isLoading}
              >
                Masuk
              </Button>

              <div className="login-divider">
                <span>atau</span>
              </div>

              <div className="google-login-container">
                <div ref={googleLoginBtnRef} className="flex justify-center w-full min-h-[44px]" />
              </div>
            </div>
          </form>
        )}

        {/* TAB 2: WhatsApp OTP Form */}
        {loginMethod === 'whatsapp' && (
          <div className="space-y-4 pt-1">
            {otpStep === 'phone' ? (
              <form onSubmit={handleRequestOtp} className="space-y-4">
                <Input
                  type="tel"
                  label="Nomor WhatsApp Terverifikasi"
                  placeholder="Contoh: 081234567890"
                  value={phoneNumber}
                  autoComplete="tel"
                  onChange={(e) => {
                    setPhoneNumber(e.target.value);
                    if (error) setError('');
                  }}
                  prefixIcon={Phone}
                  disabled={isOtpLoading}
                  required
                />
                <p className="text-xs text-[var(--color-text-secondary)] leading-relaxed">
                  Kode verifikasi 6 digit akan dikirimkan ke nomor WhatsApp Anda yang telah diverifikasi di profil SCP.
                </p>

                <Button
                  type="submit"
                  variant="primary"
                  size="lg"
                  fullWidth
                  loading={isOtpLoading}
                >
                  Kirim Kode OTP WhatsApp
                </Button>
              </form>
            ) : (
              <form onSubmit={handleVerifyOtp} className="space-y-4">
                <div className="p-3 rounded-lg bg-[var(--color-surface-subtle)] border border-[var(--color-border-light)] text-xs">
                  <span className="text-[var(--color-text-secondary)]">Kode dikirimkan ke: </span>
                  <strong className="font-mono text-[var(--color-text-primary)]">{maskedPhone}</strong>
                </div>

                <Input
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
                  prefixIcon={KeyRound}
                  disabled={isOtpLoading}
                  className="font-mono text-center tracking-widest text-lg font-bold"
                  required
                />

                <Button
                  type="submit"
                  variant="primary"
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
                        : 'text-blue-500 hover:underline'
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

        {/* Device Information */}
        <div className="login-device-info">
          Perangkat terdeteksi: <strong className="font-mono text-gray-400">{deviceName}</strong>
        </div>

        {/* Footer Navigation Kembali ke Beranda */}
        <div className="login-footer-nav">
          <Link to="/" className="login-footer-back-link">
            <ArrowLeft size={13} />
            <span>Kembali ke Beranda Utama</span>
          </Link>
        </div>
      </div>

      {/* Modal Account Picker (Jika nomor HP memiliki multi-akun) */}
      <Modal
        isOpen={isAccountPickerOpen}
        onClose={() => {
          if (!isSelectingAccount) setIsAccountPickerOpen(false);
        }}
        title="Pilih Akun Anda"
        subtitle="Nomor WhatsApp ini terhubung ke beberapa akun sekolah."
        size="sm"
      >
        <div className="space-y-2.5 py-2">
          {accountsList.map((acc) => (
            <button
              key={acc.id}
              type="button"
              disabled={isSelectingAccount}
              onClick={() => handleSelectAccount(acc.id)}
              className="w-full text-left p-3.5 rounded-xl border border-[var(--color-border-light)] bg-[var(--color-card)] hover:bg-[var(--color-surface-hover)] hover:border-blue-500 transition-all flex items-center justify-between gap-3 group"
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

              <div className="shrink-0 text-xs font-semibold text-blue-500 group-hover:translate-x-0.5 transition-transform">
                Masuk &rarr;
              </div>
            </button>
          ))}
        </div>
      </Modal>
    </div>
  );
}
