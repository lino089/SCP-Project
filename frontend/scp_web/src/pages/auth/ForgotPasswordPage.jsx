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
} from 'lucide-react';
import { Button, Input } from '../../components/shared';
import forgotPasswordApi from '../../services/forgotPasswordApi';
import './ForgotPassword.css';

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
  const [otpDigits, setOtpDigits] = useState(['', '', '', '', '', '']);
  const [resetToken, setResetToken] = useState(null);
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);

  // States
  const [isLoading, setIsLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');
  const [cooldown, setCooldown] = useState(0);
  const [remainingAttempts, setRemainingAttempts] = useState(null);

  // Refs untuk 6 kotak input OTP
  const otpInputRefs = useRef([]);

  // Cooldown countdown effect
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

  // Validasi Kekuatan Kata Sandi
  const passwordStrength = useMemo(() => {
    if (!newPassword) return 0;
    let score = 0;
    if (newPassword.length >= 8) score += 1;
    if (/[A-Z]/.test(newPassword) || /[0-9]/.test(newPassword)) score += 1;
    if (/[^A-Za-z0-9]/.test(newPassword) && newPassword.length >= 10) score += 1;
    return score;
  }, [newPassword]);

  // Handler Langkah 1: Periksa Identitas Akun
  const handleCheckIdentity = async (e) => {
    e?.preventDefault();
    if (!identifier.trim()) {
      setErrorMessage('ID Pengguna, NIS, NIP, atau Email wajib diisi.');
      return;
    }

    setIsLoading(true);
    setErrorMessage('');

    try {
      const res = await forgotPasswordApi.checkIdentity(identifier.trim());
      if (res?.data) {
        setAccountInfo(res.data);
        if (res.data.has_email) {
          setCurrentStep(STEPS.CONFIRM_SEND);
        } else {
          setCurrentStep(STEPS.NO_EMAIL);
        }
      }
    } catch (err) {
      setErrorMessage(
        err.message || 'ID Pengguna tidak ditemukan. Silakan periksa kembali NIS, NIP, atau email Anda.'
      );
    } finally {
      setIsLoading(false);
    }
  };

  // Handler Langkah 2: Kirim Kode OTP ke Email
  const handleSendOtp = async () => {
    setIsLoading(true);
    setErrorMessage('');

    try {
      const res = await forgotPasswordApi.sendOtp(identifier.trim(), 'email');
      const cooldownSec = res?.data?.cooldown_seconds || 60;
      setCooldown(cooldownSec);
      setCurrentStep(STEPS.INPUT_OTP);
      setOtpDigits(['', '', '', '', '', '']);
      setTimeout(() => {
        otpInputRefs.current[0]?.focus();
      }, 100);
    } catch (err) {
      if (err.status === 429) {
        setCooldown(err.raw?.response?.data?.cooldown_remaining || 60);
      }
      setErrorMessage(err.message || 'Gagal mengirim kode verifikasi ke email. Coba lagi nanti.');
    } finally {
      setIsLoading(false);
    }
  };

  // Handler Input Kotak OTP
  const handleOtpChange = (index, value) => {
    // Hanya izinkan digit angka
    const cleanVal = value.replace(/\D/g, '');
    const newDigits = [...otpDigits];

    if (cleanVal.length > 1) {
      // Penanganan Paste kode 6 digit
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

    // Auto focus ke kotak berikutnya jika terisi
    if (cleanVal && index < 5) {
      otpInputRefs.current[index + 1]?.focus();
    }
  };

  const handleOtpKeyDown = (index, e) => {
    if (e.key === 'Backspace' && !otpDigits[index] && index > 0) {
      otpInputRefs.current[index - 1]?.focus();
    }
  };

  // Handler Langkah 3: Verifikasi Kode OTP
  const handleVerifyOtp = async (e) => {
    e?.preventDefault();
    const fullCode = otpDigits.join('');
    if (fullCode.length !== 6) {
      setErrorMessage('Harap lengkapi 6 digit kode verifikasi OTP.');
      return;
    }

    setIsLoading(true);
    setErrorMessage('');

    try {
      const res = await forgotPasswordApi.verifyOtp(identifier.trim(), fullCode);
      if (res?.data?.reset_token) {
        setResetToken(res.data.reset_token);
        setCurrentStep(STEPS.RESET_PASSWORD);
      }
    } catch (err) {
      if (err.raw?.response?.data?.remaining_attempts !== undefined) {
        setRemainingAttempts(err.raw.response.data.remaining_attempts);
      }
      setErrorMessage(
        err.message || 'Kode verifikasi tidak valid atau telah kedaluwarsa.'
      );
    } finally {
      setIsLoading(false);
    }
  };

  // Handler Langkah 4: Simpan Kata Sandi Baru
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
        err.message || 'Gagal mereset kata sandi. Sesi Anda mungkin telah kedaluwarsa.'
      );
    } finally {
      setIsLoading(false);
    }
  };

  // Tampilan Nomor Indikator Step
  const getStepProgressNumber = () => {
    if (currentStep === STEPS.IDENTIFY) return 1;
    if (currentStep === STEPS.CONFIRM_SEND || currentStep === STEPS.NO_EMAIL) return 2;
    if (currentStep === STEPS.INPUT_OTP) return 3;
    if (currentStep === STEPS.RESET_PASSWORD) return 4;
    return 4;
  };

  return (
    <div className="forgot-password-page">
      <div className="forgot-password-card">
        {/* Header */}
        <div className="forgot-password-header">
          <span className="forgot-password-brand">School Class Progress &middot; SMKN 1 Bantul</span>
          <h1 className="forgot-password-title">Pemulihan Kata Sandi</h1>
          <p className="forgot-password-subtitle">
            {currentStep === STEPS.IDENTIFY && 'Masukkan identitas akun Anda untuk memverifikasi kepemilikan akun.'}
            {currentStep === STEPS.CONFIRM_SEND && 'Konfirmasi pengiriman kode verifikasi ke alamat email terdaftar.'}
            {currentStep === STEPS.NO_EMAIL && 'Informasi pemulihan akun tanpa kontak terdaftar.'}
            {currentStep === STEPS.INPUT_OTP && 'Masukkan 6 digit kode verifikasi yang telah dikirim ke email Anda.'}
            {currentStep === STEPS.RESET_PASSWORD && 'Buat kata sandi baru yang aman untuk akun Anda.'}
            {currentStep === STEPS.SUCCESS && 'Kata sandi berhasil diperbarui.'}
          </p>
        </div>

        {/* Step Indicator (1 s/d 4) */}
        {currentStep !== STEPS.SUCCESS && (
          <div className="forgot-step-indicator">
            {[1, 2, 3, 4].map((stepNum) => {
              const currentProg = getStepProgressNumber();
              const isCompleted = currentProg > stepNum;
              const isActive = currentProg === stepNum;
              return (
                <div key={stepNum} className="forgot-step-item">
                  <div
                    className={`forgot-step-circle ${
                      isActive
                        ? 'forgot-step-circle--active'
                        : isCompleted
                        ? 'forgot-step-circle--completed'
                        : ''
                    }`}
                  >
                    {isCompleted ? '✓' : stepNum}
                  </div>
                  <span
                    className={`forgot-step-label ${
                      isActive ? 'forgot-step-label--active' : ''
                    }`}
                  >
                    {stepNum === 1 && 'Akun'}
                    {stepNum === 2 && 'Email'}
                    {stepNum === 3 && 'OTP'}
                    {stepNum === 4 && 'Sandi Baru'}
                  </span>
                </div>
              );
            })}
          </div>
        )}

        {/* Error Alert */}
        {errorMessage && (
          <div className="forgot-alert forgot-alert--error" role="alert">
            <AlertCircle size={16} className="shrink-0 mt-0.5" />
            <span>{errorMessage}</span>
          </div>
        )}

        {/* ============================================================ */}
        {/* LANGKAH 1: IDENTIFIKASI AKUN                                 */}
        {/* ============================================================ */}
        {currentStep === STEPS.IDENTIFY && (
          <form onSubmit={handleCheckIdentity} className="space-y-4">
            <Input
              label="ID Pengguna / NIS / NIP"
              placeholder="Masukkan NIS (Siswa) atau NIP (Guru/Waka)"
              value={identifier}
              onChange={(e) => {
                setIdentifier(e.target.value);
                if (errorMessage) setErrorMessage('');
              }}
              prefixIcon={User}
              required
              autoFocus
            />

            <Button
              type="submit"
              variant="primary"
              size="lg"
              fullWidth
              loading={isLoading}
            >
              Periksa Akun
            </Button>
          </form>
        )}

        {/* ============================================================ */}
        {/* LANGKAH 2A: AKUN DITEMUKAN & MEMILIKI EMAIL                  */}
        {/* ============================================================ */}
        {currentStep === STEPS.CONFIRM_SEND && accountInfo && (
          <div className="space-y-4">
            <div className="p-3.5 bg-gray-50 border border-gray-200 rounded-lg text-xs space-y-1.5">
              <div className="text-gray-500 font-medium">Nama Pengguna:</div>
              <div className="text-sm font-bold text-gray-900">{accountInfo.user_name}</div>
              <div className="pt-2 border-t border-gray-200 text-gray-500 font-medium">Alamat Email Terdaftar:</div>
              <div className="text-xs font-semibold text-blue-700 bg-blue-50 px-2 py-1 rounded inline-block font-mono">
                {accountInfo.masked_email}
              </div>
            </div>

            <p className="text-xs text-gray-600 leading-relaxed">
              Sistem akan mengirimkan 6 digit kode OTP verifikasi ke alamat email di atas. Kode ini berlaku selama 10 menit.
            </p>

            <Button
              type="button"
              variant="primary"
              size="lg"
              fullWidth
              loading={isLoading}
              onClick={handleSendOtp}
              className="flex items-center justify-center gap-2"
            >
              <Mail size={16} />
              <span>Kirim Kode OTP ke Email</span>
            </Button>

            <button
              type="button"
              onClick={() => {
                setCurrentStep(STEPS.IDENTIFY);
                setErrorMessage('');
              }}
              className="w-full text-center text-xs text-gray-500 hover:text-gray-800 transition py-1"
            >
              Bukan akun Anda? Gunakan ID Pengguna lain
            </button>
          </div>
        )}

        {/* ============================================================ */}
        {/* LANGKAH 2B: FALLBACK AKUN TANPA EMAIL (TEMUAN DATA AKTUAL)   */}
        {/* ============================================================ */}
        {currentStep === STEPS.NO_EMAIL && accountInfo && (
          <div className="space-y-4">
            <div className="forgot-fallback-card">
              <div className="forgot-fallback-header">
                <HelpCircle size={18} className="shrink-0 text-blue-700" />
                <span>Email Belum Tertaut</span>
              </div>
              <p className="forgot-fallback-text mb-2">
                Halo <strong>{accountInfo.user_name}</strong>, akun Anda terdaftar dalam sistem SCP, namun belum memiliki alamat email yang tertaut untuk menerima kode OTP.
              </p>
              <p className="forgot-fallback-text text-xs text-gray-600 bg-white/80 p-2.5 rounded border border-blue-200">
                Silakan hubungi <strong>Waka Kurikulum</strong> atau Administrator sekolah di ruang kurikulum untuk mereset kata sandi Anda secara manual.
              </p>
            </div>

            <Button
              type="button"
              variant="secondary"
              size="lg"
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

        {/* ============================================================ */}
        {/* LANGKAH 3: INPUT KODE VERIFIKASI OTP 6 DIGIT                 */}
        {/* ============================================================ */}
        {currentStep === STEPS.INPUT_OTP && (
          <form onSubmit={handleVerifyOtp} className="space-y-4">
            <div className="text-center">
              <span className="text-xs text-gray-500">
                Kode dikirim ke: <strong className="text-gray-800">{accountInfo?.masked_email}</strong>
              </span>
            </div>

            {/* 6 Kotak Digit OTP */}
            <div className="otp-inputs-grid">
              {otpDigits.map((digit, index) => (
                <input
                  key={index}
                  ref={(el) => (otpInputRefs.current[index] = el)}
                  type="text"
                  inputMode="numeric"
                  maxLength={6}
                  value={digit}
                  onChange={(e) => handleOtpChange(index, e.target.value)}
                  onKeyDown={(e) => handleOtpKeyDown(index, e)}
                  className={`otp-box-input ${errorMessage ? 'otp-box-input--error' : ''}`}
                  autoComplete="off"
                />
              ))}
            </div>

            {remainingAttempts !== null && remainingAttempts > 0 && (
              <div className="text-center text-xs text-amber-600 font-semibold">
                Sisa kesempatan mencoba: {remainingAttempts} kali
              </div>
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

            {/* Tombol Kirim Ulang dengan Cooldown Timer */}
            <div className="text-center pt-2">
              {cooldown > 0 ? (
                <span className="text-xs text-gray-400 font-medium">
                  Kirim ulang kode dalam <strong className="text-blue-600">{cooldown}s</strong>
                </span>
              ) : (
                <button
                  type="button"
                  onClick={handleSendOtp}
                  disabled={isLoading}
                  className="text-xs font-semibold text-blue-600 hover:text-blue-700 hover:underline inline-flex items-center gap-1"
                >
                  <RefreshCw size={12} className={isLoading ? 'animate-spin' : ''} />
                  <span>Kirim Ulang Kode OTP</span>
                </button>
              )}
            </div>
          </form>
        )}

        {/* ============================================================ */}
        {/* LANGKAH 4: BUAT KATA SANDI BARU                              */}
        {/* ============================================================ */}
        {currentStep === STEPS.RESET_PASSWORD && (
          <form onSubmit={handleResetPassword} className="space-y-4">
            <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-lg text-xs text-emerald-800 flex items-center gap-2">
              <ShieldCheck size={16} className="shrink-0 text-emerald-600" />
              <span>Kode OTP terverifikasi. Masukkan kata sandi baru untuk akun Anda.</span>
            </div>

            <div className="relative">
              <Input
                type={showPassword ? 'text' : 'password'}
                label="Kata Sandi Baru"
                placeholder="Minimal 8 karakter"
                value={newPassword}
                onChange={(e) => {
                  setNewPassword(e.target.value);
                  if (errorMessage) setErrorMessage('');
                }}
                prefixIcon={Lock}
                required
                autoFocus
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-3 top-[34px] text-gray-400 hover:text-gray-600"
                tabIndex={-1}
              >
                {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
              </button>
            </div>

            {/* Meter Kekuatan Sandi */}
            {newPassword && (
              <div>
                <div className="password-strength-bar">
                  <div
                    className={`password-strength-segment ${
                      passwordStrength >= 1 ? 'password-strength-segment--weak' : ''
                    }`}
                  />
                  <div
                    className={`password-strength-segment ${
                      passwordStrength >= 2 ? 'password-strength-segment--medium' : ''
                    }`}
                  />
                  <div
                    className={`password-strength-segment ${
                      passwordStrength >= 3 ? 'password-strength-segment--strong' : ''
                    }`}
                  />
                </div>
                <div className="text-[11px] text-gray-500 flex justify-between">
                  <span>Kekuatan sandi:</span>
                  <span className="font-semibold text-gray-700">
                    {passwordStrength === 1 && 'Cukup (Tambahkan angka/simbol)'}
                    {passwordStrength === 2 && 'Bagus'}
                    {passwordStrength >= 3 && 'Sangat Kuat'}
                  </span>
                </div>
              </div>
            )}

            <Input
              type={showPassword ? 'text' : 'password'}
              label="Konfirmasi Kata Sandi Baru"
              placeholder="Ulangi kata sandi baru"
              value={confirmPassword}
              onChange={(e) => {
                setConfirmPassword(e.target.value);
                if (errorMessage) setErrorMessage('');
              }}
              prefixIcon={Lock}
              required
            />

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

        {/* ============================================================ */}
        {/* LANGKAH 5: TAMPILAN SUKSES                                   */}
        {/* ============================================================ */}
        {currentStep === STEPS.SUCCESS && (
          <div className="text-center py-4 space-y-4">
            <div className="w-16 h-16 bg-emerald-100 text-emerald-600 rounded-full flex items-center justify-center mx-auto shadow-inner">
              <CheckCircle2 size={36} />
            </div>

            <div>
              <h2 className="text-lg font-bold text-gray-900">
                Kata Sandi Berhasil Diperbarui!
              </h2>
              <p className="text-xs text-gray-600 mt-1.5 leading-relaxed">
                Seluruh sesi lama pada perangkat lain telah dinonaktifkan demi keamanan. Silakan masuk menggunakan kata sandi baru Anda.
              </p>
            </div>

            <Button
              type="button"
              variant="dark"
              size="lg"
              fullWidth
              onClick={() => navigate('/login', { replace: true })}
            >
              Masuk ke Portal Sekarang
            </Button>

            <p className="text-[11px] text-gray-400">
              Mengalihkan otomatis ke halaman login dalam beberapa detik...
            </p>
          </div>
        )}

        {/* Footer Link: Kembali ke Login */}
        {currentStep !== STEPS.SUCCESS && (
          <div className="forgot-footer-link">
            <Link to="/login">
              <ArrowLeft size={14} />
              <span>Kembali ke Halaman Masuk</span>
            </Link>
          </div>
        )}
      </div>
    </div>
  );
}
