import { useState, useEffect, useRef, useMemo } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import {
  User,
  Mail,
  Lock,
  ArrowLeft,
  CheckCircle2,
  AlertCircle,
  HelpCircle,
  RefreshCw,
  Eye,
  EyeOff,
  ShieldCheck,
  Phone,
} from 'lucide-react';
import { Button, Input, Badge } from '../../components/shared';
import forgotPasswordApi from '../../services/forgotPasswordApi';

const STEPS = {
  IDENTIFY: 1,
  CONFIRM_SEND: 2,
  NO_EMAIL: 2.5,
  INPUT_OTP: 3,
  RESET_PASSWORD: 4,
  SUCCESS: 5,
};

export default function ForgotPasswordPage() {
  const navigate = useNavigate();

  // Wizard Step State
  const [currentStep, setCurrentStep] = useState(STEPS.IDENTIFY);

  // Form Inputs
  const [identifier, setIdentifier] = useState('');
  const [accountInfo, setAccountInfo] = useState(null);
  const [selectedChannel, setSelectedChannel] = useState('whatsapp'); // 'whatsapp' | 'email'
  const [otpDigits, setOtpDigits] = useState(['', '', '', '', '', '']);
  const [resetToken, setResetToken] = useState(null);
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);

  // Status & Feedback States
  const [isLoading, setIsLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');
  const [cooldown, setCooldown] = useState(0);
  const [remainingAttempts, setRemainingAttempts] = useState(null);

  // OTP input refs (6 boxes)
  const otpInputRefs = useRef([]);

  // Cooldown countdown timer
  useEffect(() => {
    let timer;
    if (cooldown > 0) {
      timer = setInterval(() => {
        setCooldown((prev) => (prev > 0 ? prev - 1 : 0));
      }, 1000);
    }
    return () => clearInterval(timer);
  }, [cooldown]);

  // Auto redirect to login on success step
  useEffect(() => {
    let redirectTimer;
    if (currentStep === STEPS.SUCCESS) {
      redirectTimer = setTimeout(() => {
        navigate('/login', { replace: true });
      }, 4000);
    }
    return () => clearInterval(redirectTimer);
  }, [currentStep, navigate]);

  // Password strength calculator
  const passwordStrength = useMemo(() => {
    if (!newPassword) return 0;
    let score = 0;
    if (newPassword.length >= 8) score += 1;
    if (/[A-Z]/.test(newPassword) || /[0-9]/.test(newPassword)) score += 1;
    if (/[^A-Za-z0-9]/.test(newPassword) && newPassword.length >= 10) score += 1;
    return score;
  }, [newPassword]);

  // Handler Step 1: Check identity
  const handleCheckIdentity = async (e) => {
    e?.preventDefault();
    if (!identifier.trim()) {
      setErrorMessage('ID | Email | No.WA wajib diisi.');
      return;
    }

    setIsLoading(true);
    setErrorMessage('');

    try {
      const res = await forgotPasswordApi.checkIdentity(identifier.trim());
      const data = res?.data || res;
      if (data) {
        setAccountInfo(data);
        const hasChannel = data.has_channel ?? (data.has_email || data.has_phone);
        if (hasChannel) {
          const defaultCh = data.default_channel || (data.has_phone ? 'whatsapp' : 'email');
          setSelectedChannel(defaultCh);
          setCurrentStep(STEPS.CONFIRM_SEND);
        } else {
          setCurrentStep(STEPS.NO_EMAIL);
        }
      }
    } catch (err) {
      setErrorMessage(
        err.message ||
          'ID Pengguna tidak ditemukan. Silakan periksa kembali NIS, NIP, email, atau no. WhatsApp Anda.'
      );
    } finally {
      setIsLoading(false);
    }
  };

  // Handler Step 2: Send OTP
  const handleSendOtp = async (channelToUse = selectedChannel) => {
    setIsLoading(true);
    setErrorMessage('');

    try {
      const res = await forgotPasswordApi.sendOtp(identifier.trim(), channelToUse);
      const cooldownSec = res?.data?.cooldown_seconds || 60;
      setCooldown(cooldownSec);
      setCurrentStep(STEPS.INPUT_OTP);
      setOtpDigits(['', '', '', '', '', '']);
      setTimeout(() => {
        otpInputRefs.current[0]?.focus();
      }, 100);
    } catch (err) {
      if (err.status === 429) {
        setCooldown(err.data?.cooldown_remaining || 60);
      }
      setErrorMessage(
        err.message || 'Gagal mengirim kode verifikasi OTP. Coba lagi nanti.'
      );
    } finally {
      setIsLoading(false);
    }
  };

  // OTP input digits handler
  const handleOtpChange = (index, value) => {
    const cleanVal = value.replace(/\D/g, '');
    const newDigits = [...otpDigits];

    if (cleanVal.length > 1) {
      // Paste handling
      const pasted = cleanVal.slice(0, 6).split('');
      pasted.forEach((char, i) => {
        newDigits[i] = char;
      });
      setOtpDigits(newDigits);
      const nextFocus = Math.min(pasted.length, 5);
      otpInputRefs.current[nextFocus]?.focus();
      return;
    }

    newDigits[index] = cleanVal;
    setOtpDigits(newDigits);

    // Auto advance
    if (cleanVal && index < 5) {
      otpInputRefs.current[index + 1]?.focus();
    }
  };

  const handleOtpKeyDown = (index, e) => {
    if (e.key === 'Backspace' && !otpDigits[index] && index > 0) {
      otpInputRefs.current[index - 1]?.focus();
    }
  };

  // Handler Step 3: Verify OTP
  const handleVerifyOtp = async (e) => {
    e?.preventDefault();
    const code = otpDigits.join('');
    if (code.length !== 6) {
      setErrorMessage('Harap isi lengkap 6 digit kode verifikasi OTP.');
      return;
    }

    setIsLoading(true);
    setErrorMessage('');

    try {
      const res = await forgotPasswordApi.verifyOtp(identifier.trim(), code);
      const token = res?.data?.reset_token;
      if (token) {
        setResetToken(token);
        setCurrentStep(STEPS.RESET_PASSWORD);
      } else {
        setErrorMessage('Token pemulihan tidak diterima dari server.');
      }
    } catch (err) {
      if (err.data?.remaining_attempts !== undefined) {
        setRemainingAttempts(err.data.remaining_attempts);
      }
      setErrorMessage(
        err.message || 'Kode OTP tidak valid atau telah kedaluwarsa. Silakan periksa kembali.'
      );
    } finally {
      setIsLoading(false);
    }
  };

  // Handler Step 4: Reset Password
  const handleResetPassword = async (e) => {
    e?.preventDefault();
    if (!newPassword) {
      setErrorMessage('Kata sandi baru wajib diisi.');
      return;
    }
    if (newPassword.length < 8) {
      setErrorMessage('Kata sandi baru minimal 8 karakter.');
      return;
    }
    if (newPassword !== confirmPassword) {
      setErrorMessage('Konfirmasi kata sandi baru tidak cocok.');
      return;
    }

    setIsLoading(true);
    setErrorMessage('');

    try {
      await forgotPasswordApi.resetPassword({
        identifier: identifier.trim(),
        reset_token: resetToken,
        new_password: newPassword,
        new_password_confirmation: confirmPassword,
      });

      setCurrentStep(STEPS.SUCCESS);
    } catch (err) {
      setErrorMessage(
        err.message || 'Gagal memperbarui kata sandi. Silakan ulangi proses dari awal.'
      );
    } finally {
      setIsLoading(false);
    }
  };

  const renderStepIndicator = () => {
    if (currentStep === STEPS.SUCCESS || currentStep === STEPS.NO_EMAIL) return null;
    const activeIndex =
      currentStep === STEPS.IDENTIFY
        ? 1
        : currentStep === STEPS.CONFIRM_SEND
        ? 2
        : currentStep === STEPS.INPUT_OTP
        ? 3
        : 4;

    return (
      <div className="flex items-center justify-between pb-3 border-b border-[var(--color-border-light)]">
        <div className="flex items-center gap-1.5 font-mono text-xs font-semibold text-[var(--color-text-primary)]">
          <span>Langkah {activeIndex}</span>
          <span className="text-[var(--color-text-muted)]">/</span>
          <span className="text-[var(--color-text-muted)]">4</span>
        </div>
        <div className="flex items-center gap-1.5">
          {[1, 2, 3, 4].map((stepNum) => (
            <span
              key={stepNum}
              className={`h-1.5 rounded-full transition-all duration-200 ${
                stepNum === activeIndex
                  ? 'w-6 bg-[var(--color-action)]'
                  : stepNum < activeIndex
                  ? 'w-3 bg-[var(--color-success-bg)]0'
                  : 'w-2 bg-[var(--color-border-subtle)]'
              }`}
            />
          ))}
        </div>
      </div>
    );
  };

  return (
    <div className="min-h-dvh bg-[var(--color-bg-app)] flex flex-col items-center px-4 py-6 pb-safe overflow-y-auto">
      <div className="w-full max-w-[440px] mx-auto my-auto space-y-4">
        <div className="surface-card p-5 shadow-[var(--shadow-card)] space-y-4">
          {/* Header & Back link */}
          <div className="flex items-center justify-between">
            <Link
              to="/login"
              className="inline-flex items-center gap-1.5 text-xs font-semibold text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)] py-1 min-h-[36px]"
            >
              <ArrowLeft size={16} />
              <span>Kembali ke Login</span>
            </Link>
            <Badge variant="neutral" size="sm" mono>
              Pemulihan Sandi
            </Badge>
          </div>

          {renderStepIndicator()}

          {/* Error Message */}
          {errorMessage && (
            <div
              className="p-3 rounded-[10px] bg-[var(--color-danger-bg)] border border-[var(--color-danger-border)] text-xs text-[var(--color-danger-fg)] flex items-start gap-2 leading-relaxed"
              role="alert"
            >
              <AlertCircle size={16} className="shrink-0 text-[var(--color-danger-fg)] mt-0.5" />
              <span>{errorMessage}</span>
            </div>
          )}

          {/* STEP 1: Cek Identitas */}
          {currentStep === STEPS.IDENTIFY && (
            <form onSubmit={handleCheckIdentity} className="space-y-4">
              <div>
                <h1 className="page-title">
                  Periksa Identitas Akun
                </h1>
                <p className="text-xs text-[var(--color-text-secondary)] mt-1 leading-relaxed">
                  Masukkan NIS (Siswa), NIP (Guru), atau alamat email resmi sekolah Anda untuk mencari akun.
                </p>
              </div>

              <Input
                id="forgot-identifier"
                label="ID | Email | No.WA"
                placeholder="NIS, NIP, Email, atau No. WhatsApp"
                value={identifier}
                onChange={(e) => {
                  setIdentifier(e.target.value);
                  if (errorMessage) setErrorMessage('');
                }}
                icon={User}
                disabled={isLoading}
                autoFocus
                required
              />

              <Button
                type="submit"
                variant="primary"
                size="lg"
                fullWidth
                loading={isLoading}
              >
                Cari Akun Saya
              </Button>
            </form>
          )}

          {/* STEP 2.5: Akun Tidak Memiliki Saluran Pemulihan */}
          {currentStep === STEPS.NO_EMAIL && accountInfo && (
            <div className="space-y-4">
              <div className="w-12 h-12 rounded-full bg-[var(--color-warning-bg)] border border-[var(--color-warning-border)] text-[var(--color-warning-fg)] flex items-center justify-center mx-auto">
                <HelpCircle size={26} />
              </div>

              <div className="text-center space-y-1">
                <h2 className="text-base font-bold text-[var(--color-text-primary)]">
                  Saluran Pemulihan Belum Tertaut
                </h2>
                <p className="text-xs text-[var(--color-text-secondary)]">
                  Akun atas nama <strong className="text-[var(--color-text-primary)]">{accountInfo.user_name}</strong> terdaftar, namun belum memiliki nomor WhatsApp maupun email yang tertaut untuk menerima kode OTP.
                </p>
              </div>

              <div className="p-3.5 bg-[var(--color-bg-app)] border border-[var(--color-border-subtle)] rounded-[10px] text-xs text-[var(--color-text-secondary)] space-y-2">
                <p className="font-semibold text-[var(--color-text-primary)]">Solusi Pemulihan Akun:</p>
                <p className="leading-relaxed">
                  {accountInfo.guidance ||
                    'Silakan kunjungi Ruang Kurikulum / Hubungi Tim Administrator & Waka Kurikulum di sekolah untuk melakukan reset kata sandi secara manual.'}
                </p>
              </div>

              <Button
                type="button"
                variant="outline"
                size="md"
                fullWidth
                onClick={() => {
                  setCurrentStep(STEPS.IDENTIFY);
                  setErrorMessage('');
                }}
              >
                Coba ID Pengguna Lain
              </Button>
            </div>
          )}

          {/* STEP 2: Konfirmasi & Kirim OTP */}
          {currentStep === STEPS.CONFIRM_SEND && accountInfo && (
            <div className="space-y-4">
              <div>
                <h1 className="page-title">
                  Kirim Kode OTP
                </h1>
                <p className="text-xs text-[var(--color-text-secondary)] mt-1 leading-relaxed">
                  Akun ditemukan. Pilih saluran pengiriman kode OTP verifikasi untuk pemulihan kata sandi.
                </p>
              </div>

              <div className="p-3.5 bg-[var(--color-bg-app)] border border-[var(--color-border-subtle)] rounded-[10px] space-y-3">
                <div className="flex justify-between items-center text-xs pb-2 border-b border-[var(--color-border-subtle)]">
                  <span className="text-[var(--color-text-secondary)]">Nama Pemilik Akun</span>
                  <span className="font-semibold text-[var(--color-text-primary)]">{accountInfo.user_name}</span>
                </div>

                <div className="space-y-2">
                  <span className="text-[11px] font-semibold text-[var(--color-text-secondary)] uppercase tracking-wider block">
                    Pilih Saluran Verifikasi:
                  </span>

                  {accountInfo.has_phone && (
                    <label
                      className={`flex items-center justify-between p-3 rounded-[10px] border cursor-pointer transition ${
                        selectedChannel === 'whatsapp'
                          ? 'border-[var(--color-action)] bg-[var(--color-action-soft)]/20'
                          : 'border-[var(--color-border-subtle)] bg-[var(--color-surface)]'
                      }`}
                    >
                      <div className="flex items-center gap-2.5">
                        <input
                          type="radio"
                          name="mobileOtpChannel"
                          value="whatsapp"
                          checked={selectedChannel === 'whatsapp'}
                          onChange={() => setSelectedChannel('whatsapp')}
                          className="accent-[var(--color-action)]"
                        />
                        <Phone size={16} className="text-emerald-500 shrink-0" />
                        <div>
                          <div className="text-xs font-semibold text-[var(--color-text-primary)]">WhatsApp OTP</div>
                          <div className="font-mono text-[11px] text-[var(--color-text-secondary)]">{accountInfo.masked_phone}</div>
                        </div>
                      </div>
                      <Badge variant="success" size="sm">Rekomendasi</Badge>
                    </label>
                  )}

                  {accountInfo.has_email && (
                    <label
                      className={`flex items-center justify-between p-3 rounded-[10px] border cursor-pointer transition ${
                        selectedChannel === 'email'
                          ? 'border-[var(--color-action)] bg-[var(--color-action-soft)]/20'
                          : 'border-[var(--color-border-subtle)] bg-[var(--color-surface)]'
                      }`}
                    >
                      <div className="flex items-center gap-2.5">
                        <input
                          type="radio"
                          name="mobileOtpChannel"
                          value="email"
                          checked={selectedChannel === 'email'}
                          onChange={() => setSelectedChannel('email')}
                          className="accent-[var(--color-action)]"
                        />
                        <Mail size={16} className="text-blue-500 shrink-0" />
                        <div>
                          <div className="text-xs font-semibold text-[var(--color-text-primary)]">Email Resmi</div>
                          <div className="font-mono text-[11px] text-[var(--color-text-secondary)]">{accountInfo.masked_email}</div>
                        </div>
                      </div>
                    </label>
                  )}
                </div>
              </div>

              <Button
                type="button"
                variant="primary"
                size="lg"
                fullWidth
                loading={isLoading}
                onClick={() => handleSendOtp(selectedChannel)}
                className="flex items-center justify-center gap-2"
              >
                {selectedChannel === 'whatsapp' ? <Phone size={16} /> : <Mail size={16} />}
                <span>Kirim Kode OTP ke {selectedChannel === 'whatsapp' ? 'WhatsApp' : 'Email'}</span>
              </Button>

              <button
                type="button"
                className="w-full text-center text-xs text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)] py-1"
                onClick={() => {
                  setCurrentStep(STEPS.IDENTIFY);
                  setErrorMessage('');
                }}
              >
                Bukan akun Anda? Ganti ID Pengguna
              </button>
            </div>
          )}

          {/* STEP 3: Input Kode OTP */}
          {currentStep === STEPS.INPUT_OTP && (
            <form onSubmit={handleVerifyOtp} className="space-y-4">
              <div>
                <h1 className="page-title">
                  Verifikasi Kode OTP
                </h1>
                <p className="text-xs text-[var(--color-text-secondary)] mt-1 leading-relaxed">
                  Masukkan 6 digit kode angka yang telah dikirim ke {selectedChannel === 'whatsapp' ? 'WhatsApp' : 'email'} pemulihan:
                  <strong className="block font-mono text-[var(--color-text-primary)] mt-0.5">
                    {selectedChannel === 'whatsapp' ? accountInfo?.masked_phone : accountInfo?.masked_email}
                  </strong>
                </p>
              </div>

              {/* 6 Digit Input Boxes */}
              <div className="flex justify-between gap-1.5 sm:gap-2">
                {otpDigits.map((digit, idx) => (
                  <input
                    key={idx}
                    ref={(el) => (otpInputRefs.current[idx] = el)}
                    type="text"
                    inputMode="numeric"
                    maxLength={6}
                    value={digit}
                    onChange={(e) => handleOtpChange(idx, e.target.value)}
                    onKeyDown={(e) => handleOtpKeyDown(idx, e)}
                    className="w-12 h-13 sm:w-14 sm:h-14 text-center font-mono text-xl font-bold rounded-[10px] border border-[var(--color-border-strong)] bg-[var(--color-surface)] text-[var(--color-text-primary)] focus:border-[var(--color-action)] focus:ring-2 focus:ring-[var(--color-action-soft)] outline-none transition"
                    disabled={isLoading}
                  />
                ))}
              </div>

              {remainingAttempts !== null && (
                <p className="text-[11px] text-[var(--color-warning-fg)] text-center font-medium">
                  Sisa kesempatan verifikasi: {remainingAttempts} kali
                </p>
              )}

              <Button
                type="submit"
                variant="primary"
                size="lg"
                fullWidth
                loading={isLoading}
                disabled={otpDigits.join('').length !== 6}
              >
                Verifikasi Kode OTP
              </Button>

              {/* Resend Cooldown Button */}
              <div className="text-center pt-1">
                {cooldown > 0 ? (
                  <span className="text-xs text-[var(--color-text-secondary)] font-mono">
                    Kirim ulang kode dalam <strong className="text-[var(--color-text-primary)]">{cooldown} detik</strong>
                  </span>
                ) : (
                  <button
                    type="button"
                    onClick={() => handleSendOtp(selectedChannel)}
                    disabled={isLoading}
                    className="inline-flex items-center gap-1.5 text-xs font-semibold text-[var(--color-text-primary)] hover:text-[var(--color-text-primary)] underline min-h-[36px]"
                  >
                    <RefreshCw size={14} />
                    <span>Kirim Ulang Kode OTP</span>
                  </button>
                )}
              </div>
            </form>
          )}

          {/* STEP 4: Reset Password Baru */}
          {currentStep === STEPS.RESET_PASSWORD && (
            <form onSubmit={handleResetPassword} className="space-y-4">
              <div>
                <h1 className="page-title">
                  Buat Kata Sandi Baru
                </h1>
                <p className="text-xs text-[var(--color-text-secondary)] mt-1 leading-relaxed">
                  Gunakan minimal 8 karakter dengan kombinasi huruf, angka, atau simbol.
                </p>
              </div>

              <div className="space-y-3">
                <div className="relative">
                  <Input
                    id="new-password"
                    type={showPassword ? 'text' : 'password'}
                    label="Kata Sandi Baru"
                    placeholder="Minimal 8 karakter"
                    value={newPassword}
                    onChange={(e) => {
                      setNewPassword(e.target.value);
                      if (errorMessage) setErrorMessage('');
                    }}
                    icon={Lock}
                    disabled={isLoading}
                    required
                  />
                  <button
                    type="button"
                    className="absolute right-3 top-[34px] text-[var(--color-text-muted)] hover:text-[var(--color-text-secondary)] p-1"
                    onClick={() => setShowPassword((prev) => !prev)}
                    aria-label={showPassword ? 'Sembunyikan' : 'Tampilkan'}
                  >
                    {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                  </button>
                </div>

                {/* Password strength bar */}
                {newPassword && (
                  <div className="space-y-1">
                    <div className="flex gap-1 h-1.5 w-full bg-[var(--color-surface-subtle)] rounded-[6px] overflow-hidden">
                      <div
                        className={`transition-all duration-300 ${
                          passwordStrength === 1
                            ? 'w-1/3 bg-[var(--color-danger-bg)]0'
                            : passwordStrength === 2
                            ? 'w-2/3 bg-[var(--color-warning-bg)]0'
                            : passwordStrength === 3
                            ? 'w-full bg-[var(--color-success-bg)]0'
                            : 'w-0'
                        }`}
                      />
                    </div>
                    <span className="text-[10.5px] text-[var(--color-text-muted)] font-mono">
                      {passwordStrength === 1 && 'Kekuatan: Lemah (tambahkan angka/huruf kapital)'}
                      {passwordStrength === 2 && 'Kekuatan: Sedang (tambahkan simbol)'}
                      {passwordStrength === 3 && 'Kekuatan: Kuat'}
                    </span>
                  </div>
                )}

                <Input
                  id="confirm-password"
                  type={showPassword ? 'text' : 'password'}
                  label="Konfirmasi Kata Sandi Baru"
                  placeholder="Ulangi kata sandi baru"
                  value={confirmPassword}
                  onChange={(e) => {
                    setConfirmPassword(e.target.value);
                    if (errorMessage) setErrorMessage('');
                  }}
                  icon={ShieldCheck}
                  disabled={isLoading}
                  required
                />
              </div>

              <Button
                type="submit"
                variant="primary"
                size="lg"
                fullWidth
                loading={isLoading}
              >
                Simpan Kata Sandi Baru
              </Button>
            </form>
          )}

          {/* STEP 5: Success Banner */}
          {currentStep === STEPS.SUCCESS && (
            <div className="text-center py-4 space-y-4">
              <div className="w-14 h-14 rounded-full bg-[var(--color-success-bg)] border border-[var(--color-success-border)] text-[var(--color-success-fg)] flex items-center justify-center mx-auto">
                <CheckCircle2 size={32} />
              </div>

              <div className="space-y-1">
                <h2 className="card-title">
                  Kata Sandi Berhasil Diperbarui!
                </h2>
                <p className="text-xs text-[var(--color-text-secondary)] leading-relaxed">
                  Kata sandi baru Anda telah aktif. Anda dapat menggunakannya untuk login ke aplikasi SCP Mobile sekarang.
                </p>
              </div>

              <Button
                type="button"
                variant="primary"
                size="lg"
                fullWidth
                onClick={() => navigate('/login', { replace: true })}
              >
                Masuk ke Aplikasi
              </Button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
