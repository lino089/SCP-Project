import { useState, useEffect, useRef, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Mail,
  MessageSquare,
  Lock,
  LogOut,
  CheckCircle2,
  AlertCircle,
  ShieldCheck,
  Sun,
  Moon,
  Monitor,
} from 'lucide-react';
import { useAuth } from '../../hooks/useAuth';
import useTheme from '../../hooks/useTheme';
import { useGoogleAuth } from '../../hooks/useGoogleAuth';
import {
  Card,
  Input,
  Button,
  Badge,
  PasswordSheet,
  ConfirmSheet,
} from '../../components/shared';
import { authApi } from '../../services/api';
import updaterService from '../../services/updaterService';

export default function ProfilePage() {
  const navigate = useNavigate();
  const { user, logout, updateUserProfile, changePassword, hasRole, isKesiswaan, isWaliKelas } =
    useAuth();
  const { theme, setTheme } = useTheme();

  // Email Verification State (Derived & Editable)
  const [customEmail, setCustomEmail] = useState(null);
  const email = customEmail !== null ? customEmail : (user?.email || '');
  const emailVerified = Boolean(user?.email_verified_at);

  const [emailOtpSent, setEmailOtpSent] = useState(false);
  const [emailOtp, setEmailOtp] = useState('');
  const [emailLoading, setEmailLoading] = useState(false);
  const [emailMsg, setEmailMsg] = useState('');
  const [emailError, setEmailError] = useState('');
  const [emailCooldown, setEmailCooldown] = useState(0);

  // WhatsApp Verification State (Derived & Editable)
  const [customWa, setCustomWa] = useState(null);
  const waNumber = customWa !== null ? customWa : (user?.phone_number || '');
  const waVerified = Boolean(user?.phone_number);

  const [waOtpSent, setWaOtpSent] = useState(false);
  const [waOtp, setWaOtp] = useState('');
  const [waLoading, setWaLoading] = useState(false);
  const [waMsg, setWaMsg] = useState('');
  const [waError, setWaError] = useState('');
  const [waCooldown, setWaCooldown] = useState(0);

  // Google Linking State
  const { isLoaded: isGoogleLoaded, renderGoogleButton } = useGoogleAuth();
  const googleConnected = Boolean(user?.google_id);
  const [googleMsg, setGoogleMsg] = useState('');
  const [googleError, setGoogleError] = useState('');
  const [unlinkSheetOpen, setUnlinkSheetOpen] = useState(false);
  const [unlinkLoading, setUnlinkLoading] = useState(false);
  const googleBtnRef = useRef(null);

  // Password Change State
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [passwordLoading, setPasswordLoading] = useState(false);
  const [passwordSuccess, setPasswordSuccess] = useState(false);
  const [passwordError, setPasswordError] = useState('');
  const [fieldErrors, setFieldErrors] = useState({});

  // Logout Confirmation State
  const [logoutConfirmOpen, setLogoutConfirmOpen] = useState(false);
  const [logoutLoading, setLogoutLoading] = useState(false);

  // OTA Versioning & Update State
  const [versionInfo, setVersionInfo] = useState({ nativeVersion: '1.0.0', bundleVersion: '1.0.0' });
  const [checkingUpdate, setCheckingUpdate] = useState(false);
  const [updateStatusMsg, setUpdateStatusMsg] = useState('');
  const [updateErrorMsg, setUpdateErrorMsg] = useState('');
  const [availableUpdate, setAvailableUpdate] = useState(null);
  const [downloadProgress, setDownloadProgress] = useState(null);
  const [isUpdateReadyToReload, setIsUpdateReadyToReload] = useState(false);

  useEffect(() => {
    updaterService.getCurrentVersionInfo().then(setVersionInfo);
  }, []);

  const handleManualCheckUpdate = async () => {
    setCheckingUpdate(true);
    setUpdateStatusMsg('');
    setUpdateErrorMsg('');
    setAvailableUpdate(null);
    setIsUpdateReadyToReload(false);
    try {
      const res = await updaterService.checkForUpdate();
      if (res.hasUpdate && res.updateInfo) {
        setAvailableUpdate(res);
        setUpdateStatusMsg(`Tersedia pembaruan versi ${res.latestVersion}!`);
      } else {
        setUpdateStatusMsg(res.message || 'Aplikasi Anda sudah menggunakan versi terbaru.');
      }
    } catch (err) {
      setUpdateErrorMsg(err.message || 'Gagal memeriksa pembaruan.');
    } finally {
      setCheckingUpdate(false);
    }
  };

  const handleManualDownloadUpdate = async () => {
    if (!availableUpdate?.updateInfo) return;
    setCheckingUpdate(true);
    setDownloadProgress(0);
    try {
      const bundle = await updaterService.downloadUpdate(
        availableUpdate.updateInfo,
        (p) => setDownloadProgress(p)
      );
      if (bundle?.id) {
        await updaterService.setNextBundle(bundle.id);
        setIsUpdateReadyToReload(true);
        setUpdateStatusMsg('Pembaruan berhasil diunduh. Ketuk "Muat Ulang Sekarang" untuk menerapkan.');
      }
    } catch (err) {
      setUpdateErrorMsg(err.message || 'Gagal mengunduh pembaruan.');
    } finally {
      setCheckingUpdate(false);
      setDownloadProgress(null);
    }
  };

  const handleManualReload = async () => {
    if (!availableUpdate?.updateInfo) return;
    setCheckingUpdate(true);
    try {
      await updaterService.reloadImmediately(availableUpdate.updateInfo.version);
    } catch (err) {
      setUpdateErrorMsg(err.message || 'Gagal memuat ulang bundle.');
      setCheckingUpdate(false);
    }
  };

  // Timers for email and WhatsApp cooldown
  useEffect(() => {
    let timer;
    if (emailCooldown > 0) {
      timer = setInterval(() => setEmailCooldown((prev) => (prev > 0 ? prev - 1 : 0)), 1000);
    }
    return () => clearInterval(timer);
  }, [emailCooldown]);

  useEffect(() => {
    let timer;
    if (waCooldown > 0) {
      timer = setInterval(() => setWaCooldown((prev) => (prev > 0 ? prev - 1 : 0)), 1000);
    }
    return () => clearInterval(timer);
  }, [waCooldown]);

  // Google Sign-In Linking Button mount
  useEffect(() => {
    if (!googleConnected && isGoogleLoaded && googleBtnRef.current) {
      googleBtnRef.current.innerHTML = '';
      renderGoogleButton(googleBtnRef.current, {
        onSuccess: async (idToken) => {
          setGoogleError('');
          setGoogleMsg('');
          try {
            const res = await authApi.linkGoogle(idToken);
            const updatedUser = res?.data?.user;
            if (updatedUser) {
              updateUserProfile(updatedUser);
              if (updatedUser.email && !email) {
                setCustomEmail(updatedUser.email);
              }
            }
            setGoogleMsg(res?.message || 'Akun Google berhasil ditautkan ke akun SCP.');
          } catch (err) {
            setGoogleError(
              err.message || 'Gagal menautkan akun Google. Pastikan akun belum dipakai orang lain.'
            );
          }
        },
        onError: (err) => {
          setGoogleError(err.message || 'Gagal memulai koneksi Google.');
        },
        text: 'continue_with',
        theme: 'outline',
        size: 'medium',
        width: '100%',
      });
    }
  }, [googleConnected, isGoogleLoaded, renderGoogleButton, email, updateUserProfile]);

  // Unlink Google with password confirmation
  const handleUnlinkGoogle = async (password) => {
    setUnlinkLoading(true);
    setGoogleError('');
    setGoogleMsg('');

    try {
      const res = await authApi.unlinkGoogle(password);
      updateUserProfile({
        google_id: null,
        google_email: null,
        google_linked_at: null,
      });
      setUnlinkSheetOpen(false);
      setGoogleMsg(res?.message || 'Tautan akun Google berhasil dilepas.');
    } catch (err) {
      throw new Error(err.message || 'Kata sandi tidak valid.');
    } finally {
      setUnlinkLoading(false);
    }
  };

  // Email OTP Handlers
  const handleSendEmailOtp = async () => {
    if (!email || !/\S+@\S+\.\S+/.test(email)) {
      setEmailError('Format alamat email tidak valid.');
      return;
    }

    setEmailLoading(true);
    setEmailError('');
    setEmailMsg('');

    try {
      const res = await authApi.requestEmailOtp(email.trim());
      setEmailOtpSent(true);
      setEmailCooldown(60);
      setEmailMsg(res?.message || 'Kode verifikasi 6 digit telah dikirim ke email Anda.');
    } catch (err) {
      if (err.status === 429) {
        setEmailCooldown(60);
      }
      setEmailError(err.message || 'Gagal mengirim kode verifikasi ke email.');
    } finally {
      setEmailLoading(false);
    }
  };

  const handleVerifyEmailOtp = async () => {
    if (emailOtp.trim().length !== 6) {
      setEmailError('Masukkan 6 digit kode OTP verifikasi email.');
      return;
    }

    setEmailLoading(true);
    setEmailError('');

    try {
      await authApi.verifyEmailOtp({ email: email.trim(), code: emailOtp.trim() });
      setEmailOtpSent(false);
      setEmailMsg('Email berhasil diverifikasi sebagai saluran resmi akun.');
      updateUserProfile({ email: email.trim(), email_verified_at: new Date().toISOString() });
    } catch (err) {
      setEmailError(err.message || 'Kode verifikasi tidak valid atau telah kedaluwarsa.');
    } finally {
      setEmailLoading(false);
    }
  };

  // WhatsApp OTP Handlers
  const handleSendWaOtp = async () => {
    if (!waNumber || waNumber.trim().length < 9) {
      setWaError('Nomor WhatsApp wajib diisi minimal 9 digit.');
      return;
    }

    setWaLoading(true);
    setWaError('');
    setWaMsg('');

    try {
      const res = await authApi.requestPhoneOtp(waNumber.trim());
      setWaOtpSent(true);
      setWaCooldown(60);
      setWaMsg(res?.message || 'Kode OTP WhatsApp berhasil dikirim ke nomor Anda.');
    } catch (err) {
      if (err.status === 429) {
        setWaCooldown(60);
      }
      setWaError(err.message || 'Gagal mengirim kode OTP WhatsApp. Periksa kembali format nomor.');
    } finally {
      setWaLoading(false);
    }
  };

  const handleVerifyWaOtp = async () => {
    if (waOtp.trim().length !== 6) {
      setWaError('Masukkan 6 digit kode OTP WhatsApp.');
      return;
    }

    setWaLoading(true);
    setWaError('');

    try {
      await authApi.verifyPhoneOtp({ phone_number: waNumber.trim(), code: waOtp.trim() });
      setWaOtpSent(false);
      setWaMsg('Nomor WhatsApp berhasil diverifikasi.');
      updateUserProfile({ phone_number: waNumber.trim() });
    } catch (err) {
      setWaError(err.message || 'Kode OTP WhatsApp tidak valid atau kedaluwarsa.');
    } finally {
      setWaLoading(false);
    }
  };

  // Password Change Handler
  const handleChangePassword = async (e) => {
    e?.preventDefault();
    setPasswordError('');
    setPasswordSuccess(false);
    setFieldErrors({});

    const errors = {};
    if (!currentPassword) errors.current_password = ['Kata sandi saat ini wajib diisi.'];
    if (!newPassword) errors.new_password = ['Kata sandi baru wajib diisi.'];
    else if (newPassword.length < 8) errors.new_password = ['Kata sandi baru minimal 8 karakter.'];
    else if (newPassword === currentPassword) errors.new_password = ['Kata sandi baru tidak boleh sama dengan kata sandi saat ini.'];
    if (newPassword !== confirmPassword) errors.new_password_confirmation = ['Konfirmasi kata sandi tidak cocok.'];

    if (Object.keys(errors).length > 0) {
      setFieldErrors(errors);
      return;
    }

    setPasswordLoading(true);

    try {
      await changePassword({
        current_password: currentPassword,
        new_password: newPassword,
        new_password_confirmation: confirmPassword,
      });

      setPasswordSuccess(true);
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
    } catch (err) {
      if (err.errors) {
        setFieldErrors(err.errors);
      }
      setPasswordError(
        err.message || 'Gagal mengubah kata sandi. Periksa kembali kata sandi saat ini.'
      );
    } finally {
      setPasswordLoading(false);
    }
  };

  const handleLogoutConfirm = async () => {
    setLogoutLoading(true);
    try {
      await logout();
      navigate('/login', { replace: true });
    } finally {
      setLogoutLoading(false);
      setLogoutConfirmOpen(false);
    }
  };

  // User Initials Helper
  const initials = useMemo(() => {
    const name = user?.name || '';
    const parts = name.trim().split(/\s+/);
    if (parts.length >= 2) {
      return (parts[0][0] + parts[1][0]).toUpperCase();
    }
    return name.slice(0, 2).toUpperCase() || 'SC';
  }, [user?.name]);

  const getRoleLabel = () => {
    if (hasRole('waka')) return 'Waka Kurikulum';
    if (isKesiswaan()) return 'Guru Kesiswaan';
    if (isWaliKelas()) return 'Guru / Wali Kelas';
    if (hasRole('teacher')) return 'Guru Mata Pelajaran';
    if (hasRole('student')) return 'Siswa Terdaftar';
    if (hasRole('parent')) return 'Orang Tua / Wali Siswa';
    return user?.role || 'Pengguna Sistem';
  };

  return (
    <div className="space-y-4">
      {/* Kartu Tampilan (Light / Dark / System) */}
      <Card>
        <div className="space-y-3">
          <div>
            <h3 className="section-title">Tampilan</h3>
            <p className="text-[11px] text-[var(--color-text-muted)] mt-0.5">
              Pilih tema antarmuka. Preferensi disimpan pada perangkat ini.
            </p>
          </div>
          <div className="grid grid-cols-3 gap-2">
            {[
              { value: 'light', label: 'Terang', Icon: Sun },
              { value: 'dark', label: 'Gelap', Icon: Moon },
              { value: 'system', label: 'Sistem', Icon: Monitor },
            ].map(({ value, label, Icon }) => {
              const active = theme === value;
              return (
                <button
                  key={value}
                  type="button"
                  onClick={() => setTheme(value)}
                  aria-pressed={active}
                  className={`flex flex-col items-center gap-1.5 rounded-[var(--radius-input)] border px-2 py-2.5 text-[11px] font-semibold ${
                    active
                      ? 'border-[var(--color-brand)] bg-[var(--color-brand-soft)] text-[var(--color-text-primary)]'
                      : 'border-[var(--color-border-subtle)] bg-[var(--color-surface)] text-[var(--color-text-secondary)]'
                  }`}
                >
                  <Icon size={15} />
                  {label}
                </button>
              );
            })}
          </div>
        </div>
      </Card>

      {/* 1. Kartu Identitas Pengguna */}
      <Card
        title="Profil Pengguna"
        subtitle="Identitas akun & peran sistem akademik"
        actions={
          <Badge variant="accent" size="sm">
            {user?.academic_year || '2025/2026 Ganjil'}
          </Badge>
        }
      >
        <div className="space-y-3.5">
          <div className="flex items-center gap-3">
            <div className="w-13 h-13 rounded-full bg-[var(--color-surface-subtle)] text-[var(--color-text-primary)] border border-[var(--color-border-subtle)] flex items-center justify-center font-bold text-lg font-mono shrink-0">
              {initials}
            </div>
            <div className="min-w-0 flex-1">
              <h2 className="text-base font-bold text-[var(--color-text-primary)] leading-tight truncate">
                {user?.name || 'Pengguna SCP'}
              </h2>
              <p className="text-xs text-[var(--color-text-secondary)] truncate mt-0.5">{getRoleLabel()}</p>
              <div className="flex flex-wrap items-center gap-1.5 mt-1.5">
                <Badge variant="code" size="sm" mono>
                  ID: {user?.nis_nip || user?.username || '-'}
                </Badge>
                {user?.gender && (
                  <Badge variant="neutral" size="sm">
                    {user.gender === 'L' ? 'Laki-laki' : 'Perempuan'}
                  </Badge>
                )}
              </div>
            </div>
          </div>

          <div className="border-t border-[var(--color-border-light)] pt-3 space-y-2 text-xs">
            <div className="flex justify-between items-center text-[var(--color-text-secondary)]">
              <span>Peran Sistem</span>
              <span className="font-semibold text-[var(--color-text-primary)]">{getRoleLabel()}</span>
            </div>

            {/* Assignments (Wali Kelas / Kesiswaan) */}
            {user?.assignments && user.assignments.length > 0 && (
              <div className="flex justify-between items-start text-[var(--color-text-secondary)] pt-1 border-t border-dashed border-[var(--color-border-light)]">
                <span>Tugas Tambahan</span>
                <div className="flex flex-col items-end gap-1">
                  {user.assignments.map((asg, idx) => (
                    <Badge key={idx} variant="info" size="sm">
                      {asg.type === 'wali_kelas'
                        ? `Wali Kelas ${asg.class_name || asg.school_class?.name || ''}`
                        : asg.type === 'kesiswaan'
                        ? 'Tim Kesiswaan / BK'
                        : asg.type}
                    </Badge>
                  ))}
                </div>
              </div>
            )}

            {/* Student specific class */}
            {user?.school_class && (
              <div className="flex justify-between items-center text-[var(--color-text-secondary)]">
                <span>Rombel / Kelas</span>
                <span className="font-mono font-bold text-[var(--color-text-primary)]">
                  {user.school_class.name}
                </span>
              </div>
            )}

            {/* Parent specific student */}
            {user?.linked_student && (
              <div className="flex justify-between items-center text-[var(--color-text-secondary)]">
                <span>Siswa Tertaut</span>
                <span className="font-semibold text-[var(--color-text-primary)]">
                  {user.linked_student.name} ({user.linked_student.nis_nip})
                </span>
              </div>
            )}

            <div className="flex justify-between items-center text-[var(--color-text-secondary)]">
              <span>Status Akun</span>
              <span className="font-medium text-[var(--color-success-fg)] flex items-center gap-1.5">
                <span className="w-1.5 h-1.5 rounded-full bg-[var(--color-success-bg)]0 inline-block" />
                Aktif Terverifikasi
              </span>
            </div>
          </div>
        </div>
      </Card>

      {/* 2. Tautkan dan Verifikasi Email */}
      <Card
        title="Alamat Email Akun"
        subtitle="Digunakan untuk pemulihan kata sandi & bukti presensi"
      >
        <div className="space-y-3">
          {emailMsg && (
            <div className="p-3 bg-[var(--color-success-bg)] border border-[var(--color-success-border)] rounded-[10px] text-[var(--color-success-fg)] text-xs flex items-start gap-2">
              <CheckCircle2 size={16} className="shrink-0 mt-0.5" />
              <span>{emailMsg}</span>
            </div>
          )}
          {emailError && (
            <div className="p-3 bg-[var(--color-danger-bg)] border border-[var(--color-danger-border)] rounded-[10px] text-[var(--color-danger-fg)] text-xs flex items-start gap-2">
              <AlertCircle size={16} className="shrink-0 mt-0.5" />
              <span>{emailError}</span>
            </div>
          )}

          <div className="space-y-2">
            <Input
              id="profile-email-input"
              label="Alamat Email Sekolah / Pribadi"
              type="email"
              value={email}
              onChange={(e) => {
                setCustomEmail(e.target.value);
                if (emailError) setEmailError('');
              }}
              placeholder="nama@smkn1bantul.sch.id"
              icon={Mail}
              disabled={emailVerified || emailLoading}
            />

            {!emailVerified && !emailOtpSent && (
              <Button
                variant="outline"
                size="md"
                fullWidth
                onClick={handleSendEmailOtp}
                loading={emailLoading}
                disabled={emailCooldown > 0}
              >
                {emailCooldown > 0
                  ? `Kirim Ulang (${emailCooldown}s)`
                  : 'Kirim Kode OTP Email'}
              </Button>
            )}
          </div>

          {emailOtpSent && !emailVerified && (
            <div className="p-3.5 bg-[var(--color-bg-app)] border border-[var(--color-border-subtle)] rounded-[10px] space-y-2.5">
              <Input
                id="profile-email-otp"
                label="Masukkan 6 Digit OTP Email"
                placeholder="Contoh: 123456"
                value={emailOtp}
                onChange={(e) => setEmailOtp(e.target.value)}
                mono
                maxLength={6}
                disabled={emailLoading}
              />
              <div className="flex gap-2">
                <Button
                  variant="primary"
                  size="md"
                  fullWidth
                  onClick={handleVerifyEmailOtp}
                  loading={emailLoading}
                >
                  Verifikasi Email
                </Button>
                {emailCooldown > 0 && (
                  <span className="text-[11px] font-mono text-[var(--color-text-muted)] self-center shrink-0 px-2">
                    {emailCooldown}s
                  </span>
                )}
              </div>
            </div>
          )}

          {emailVerified && (
            <div className="flex items-center gap-2 text-[var(--color-success-fg)] bg-[var(--color-success-bg)] border border-[var(--color-success-border)] px-3 py-2 rounded-[10px] text-xs font-medium">
              <CheckCircle2 size={16} className="text-[var(--color-success-fg)] shrink-0" />
              <span>Email telah terverifikasi dan aktif sebagai saluran resmi akun.</span>
            </div>
          )}
        </div>
      </Card>

      {/* 3. Tautkan dan Verifikasi WhatsApp */}
      <Card
        title="Nomor WhatsApp Notifikasi"
        subtitle="Digunakan untuk notifikasi presensi & izin darurat"
      >
        <div className="space-y-3">
          {waMsg && (
            <div className="p-3 bg-[var(--color-success-bg)] border border-[var(--color-success-border)] rounded-[10px] text-[var(--color-success-fg)] text-xs flex items-start gap-2">
              <CheckCircle2 size={16} className="shrink-0 mt-0.5" />
              <span>{waMsg}</span>
            </div>
          )}
          {waError && (
            <div className="p-3 bg-[var(--color-danger-bg)] border border-[var(--color-danger-border)] rounded-[10px] text-[var(--color-danger-fg)] text-xs flex items-start gap-2">
              <AlertCircle size={16} className="shrink-0 mt-0.5" />
              <span>{waError}</span>
            </div>
          )}

          <div className="space-y-2">
            <Input
              id="profile-wa-input"
              label="Nomor WhatsApp Aktif"
              type="tel"
              value={waNumber}
              onChange={(e) => {
                setCustomWa(e.target.value);
                if (waError) setWaError('');
              }}
              placeholder="Contoh: 08123456789 atau 628123456789"
              icon={MessageSquare}
              disabled={waVerified || waLoading}
            />

            {!waVerified && !waOtpSent && (
              <Button
                variant="outline"
                size="md"
                fullWidth
                onClick={handleSendWaOtp}
                loading={waLoading}
                disabled={waCooldown > 0}
              >
                {waCooldown > 0
                  ? `Kirim Ulang (${waCooldown}s)`
                  : 'Kirim Kode OTP WhatsApp'}
              </Button>
            )}
          </div>

          {waOtpSent && !waVerified && (
            <div className="p-3.5 bg-[var(--color-bg-app)] border border-[var(--color-border-subtle)] rounded-[10px] space-y-2.5">
              <Input
                id="profile-wa-otp"
                label="Masukkan 6 Digit OTP WhatsApp"
                placeholder="Contoh: 654321"
                value={waOtp}
                onChange={(e) => setWaOtp(e.target.value)}
                mono
                maxLength={6}
                disabled={waLoading}
              />
              <div className="flex gap-2">
                <Button
                  variant="primary"
                  size="md"
                  fullWidth
                  onClick={handleVerifyWaOtp}
                  loading={waLoading}
                >
                  Verifikasi Nomor
                </Button>
                {waCooldown > 0 && (
                  <span className="text-[11px] font-mono text-[var(--color-text-muted)] self-center shrink-0 px-2">
                    {waCooldown}s
                  </span>
                )}
              </div>
            </div>
          )}

          {waVerified && (
            <div className="flex items-center gap-2 text-[var(--color-success-fg)] bg-[var(--color-success-bg)] border border-[var(--color-success-border)] px-3 py-2 rounded-[10px] text-xs font-medium">
              <CheckCircle2 size={16} className="text-[var(--color-success-fg)] shrink-0" />
              <span>Nomor WhatsApp terhubung untuk saluran notifikasi darurat.</span>
            </div>
          )}
        </div>
      </Card>

      {/* 4. Google Account Linking */}
      <Card
        title="Tautan Akun Google SSO"
        subtitle="Login sekali sentuh tanpa perlu mengetik kata sandi"
      >
        <div className="space-y-3">
          {googleMsg && (
            <div className="p-3 bg-[var(--color-success-bg)] border border-[var(--color-success-border)] rounded-[10px] text-[var(--color-success-fg)] text-xs flex items-start gap-2">
              <CheckCircle2 size={16} className="shrink-0 mt-0.5" />
              <span>{googleMsg}</span>
            </div>
          )}
          {googleError && (
            <div className="p-3 bg-[var(--color-danger-bg)] border border-[var(--color-danger-border)] rounded-[10px] text-[var(--color-danger-fg)] text-xs flex items-start gap-2">
              <AlertCircle size={16} className="shrink-0 mt-0.5" />
              <span>{googleError}</span>
            </div>
          )}

          {googleConnected ? (
            <div className="p-3.5 bg-[var(--color-success-bg)] border border-[var(--color-success-border)] rounded-[10px] flex flex-col gap-2.5">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="w-2 h-2 rounded-full bg-[var(--color-success-bg)]0 shrink-0" />
                  <span className="text-xs font-bold text-[var(--color-success-fg)]">
                    Akun Google Terhubung
                  </span>
                </div>
                <Badge variant="success" size="sm">
                  Aktif
                </Badge>
              </div>

              <div className="font-mono text-xs text-[var(--color-success-fg)] break-all">
                {user?.google_email || user?.email || 'Akun Google Tertaut'}
              </div>

              <Button
                variant="outline"
                size="sm"
                className="text-[var(--color-danger-fg)] hover:text-[var(--color-danger-fg)] hover:bg-[var(--color-danger-bg)] border-[var(--color-danger-border)] self-start mt-1"
                onClick={() => setUnlinkSheetOpen(true)}
              >
                Lepas Tautan Google
              </Button>
            </div>
          ) : (
            <div className="space-y-2.5">
              <p className="text-xs text-[var(--color-text-secondary)] leading-relaxed">
                Tautkan akun Google resmi Anda untuk masuk dengan mudah ke aplikasi SCP Mobile.
              </p>
              <div className="w-full flex justify-center min-h-[42px] overflow-hidden rounded-[10px] border border-[var(--color-border-subtle)] p-1">
                <div ref={googleBtnRef} className="w-full flex justify-center" />
              </div>
            </div>
          )}
        </div>
      </Card>

      {/* 5. Ubah Kata Sandi */}
      <Card
        title="Ubah Kata Sandi Akun"
        subtitle="Gunakan minimal 8 karakter yang aman dan kuat"
      >
        <form onSubmit={handleChangePassword} className="space-y-3.5">
          {passwordSuccess && (
            <div className="p-3 bg-[var(--color-success-bg)] border border-[var(--color-success-border)] rounded-[10px] text-[var(--color-success-fg)] text-xs flex items-start gap-2">
              <CheckCircle2 size={16} className="shrink-0 mt-0.5" />
              <span>Kata sandi akun Anda berhasil diperbarui.</span>
            </div>
          )}
          {passwordError && (
            <div className="p-3 bg-[var(--color-danger-bg)] border border-[var(--color-danger-border)] rounded-[10px] text-[var(--color-danger-fg)] text-xs flex items-start gap-2">
              <AlertCircle size={16} className="shrink-0 mt-0.5" />
              <span>{passwordError}</span>
            </div>
          )}

          <Input
            id="profile-current-password"
            type="password"
            label="Kata Sandi Saat Ini"
            placeholder="Masukkan kata sandi saat ini"
            value={currentPassword}
            onChange={(e) => {
              setCurrentPassword(e.target.value);
              if (fieldErrors.current_password) setFieldErrors({});
              if (passwordError) setPasswordError('');
            }}
            error={fieldErrors.current_password?.[0]}
            icon={Lock}
            disabled={passwordLoading}
            required
          />

          <Input
            id="profile-new-password"
            type="password"
            label="Kata Sandi Baru"
            placeholder="Minimal 8 karakter"
            value={newPassword}
            onChange={(e) => {
              setNewPassword(e.target.value);
              if (fieldErrors.new_password) setFieldErrors({});
              if (passwordError) setPasswordError('');
            }}
            error={fieldErrors.new_password?.[0]}
            hint="Gunakan kombinasi huruf, angka, dan simbol"
            icon={Lock}
            disabled={passwordLoading}
            required
          />

          <Input
            id="profile-confirm-password"
            type="password"
            label="Konfirmasi Kata Sandi Baru"
            placeholder="Ulangi kata sandi baru"
            value={confirmPassword}
            onChange={(e) => {
              setConfirmPassword(e.target.value);
              if (fieldErrors.new_password_confirmation) setFieldErrors({});
              if (passwordError) setPasswordError('');
            }}
            error={fieldErrors.new_password_confirmation?.[0]}
            icon={ShieldCheck}
            disabled={passwordLoading}
            required
          />

          <Button
            type="submit"
            variant="primary"
            size="lg"
            fullWidth
            loading={passwordLoading}
          >
            Simpan Kata Sandi Baru
          </Button>
        </form>
      </Card>

      {/* 6. Informasi Sistem & Pembaruan OTA */}
      <Card>
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="section-title">Informasi Sistem & Pembaruan</h3>
            <Badge variant="accent" size="sm">OTA Live</Badge>
          </div>

          <div className="rounded-[10px] bg-[var(--color-bg-subtle)] p-3 text-xs space-y-2">
            <div className="flex justify-between items-center">
              <span className="text-[var(--color-text-secondary)]">Versi Aplikasi (APK):</span>
              <span className="font-mono font-semibold text-[var(--color-text-primary)]">{versionInfo.nativeVersion}</span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-[var(--color-text-secondary)]">Versi Bundle UI (OTA):</span>
              <span className="font-mono font-semibold text-[var(--color-brand)]">v{versionInfo.bundleVersion}</span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-[var(--color-text-secondary)]">Saluran Pembaruan:</span>
              <span className="font-mono text-[var(--color-text-primary)]">production</span>
            </div>
          </div>

          {updateStatusMsg && (
            <div className="p-2.5 rounded-[8px] bg-[var(--color-success-bg)] text-[var(--color-success-fg)] text-xs flex items-center gap-2">
              <CheckCircle2 size={15} className="shrink-0" />
              <span className="leading-relaxed">{updateStatusMsg}</span>
            </div>
          )}

          {updateErrorMsg && (
            <div className="p-2.5 rounded-[8px] bg-[var(--color-danger-bg)] text-[var(--color-danger-fg)] text-xs flex items-center gap-2">
              <AlertCircle size={15} className="shrink-0" />
              <span className="leading-relaxed">{updateErrorMsg}</span>
            </div>
          )}

          {isUpdateReadyToReload ? (
            <Button
              variant="brand"
              size="sm"
              fullWidth
              loading={checkingUpdate}
              onClick={handleManualReload}
            >
              Muat Ulang Sekarang
            </Button>
          ) : availableUpdate ? (
            <Button
              variant="brand"
              size="sm"
              fullWidth
              loading={checkingUpdate}
              onClick={handleManualDownloadUpdate}
            >
              {downloadProgress !== null
                ? `Mengunduh… (${downloadProgress}%)`
                : `Unduh Pembaruan v${availableUpdate.latestVersion}`}
            </Button>
          ) : (
            <Button
              variant="outline"
              size="sm"
              fullWidth
              loading={checkingUpdate}
              onClick={handleManualCheckUpdate}
            >
              Periksa Pembaruan Sistem
            </Button>
          )}
        </div>
      </Card>

      {/* 7. Tombol Logout */}
      <Card>
        <div className="space-y-3">
          <Button
            variant="danger"
            size="lg"
            fullWidth
            icon={LogOut}
            onClick={() => setLogoutConfirmOpen(true)}
          >
            Keluar dari Sistem
          </Button>
          <p className="text-[11px] text-[var(--color-text-muted)] text-center">
            Sesi aktif Anda akan dibersihkan dari perangkat ini.
          </p>
        </div>
      </Card>

      {/* Sheet Konfirmasi Step-Up Auth untuk Lepas Tautan Google */}
      <PasswordSheet
        isOpen={unlinkSheetOpen}
        onClose={() => setUnlinkSheetOpen(false)}
        onConfirm={handleUnlinkGoogle}
        title="Konfirmasi Lepas Tautan Google"
        description="Masukkan kata sandi akun SCP Anda untuk memastikan keamanan sebelum melepas akun Google."
        confirmLabel="Ya, Lepas Tautan"
        loading={unlinkLoading}
      />

      {/* Sheet Konfirmasi Logout */}
      <ConfirmSheet
        isOpen={logoutConfirmOpen}
        onClose={() => setLogoutConfirmOpen(false)}
        onConfirm={handleLogoutConfirm}
        title="Keluar dari Sistem"
        message="Apakah Anda yakin ingin keluar dari akun ini? Anda harus masuk kembali dengan kata sandi atau Google SSO."
        confirmLabel="Ya, Keluar Akun"
        variant="danger"
        loading={logoutLoading}
      />
    </div>
  );
}
