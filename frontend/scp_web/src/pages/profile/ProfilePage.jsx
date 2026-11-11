import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  MessageSquare,
  CheckCircle,
  AlertCircle,
  Sun,
  Moon,
  Monitor,
} from 'lucide-react';
import { useAuth } from '../../hooks/useAuth';
import useTheme from '../../hooks/useTheme';
import { useGoogleAuth } from '../../hooks/useGoogleAuth';
import { Button, Input, Badge, Modal } from '../../components/shared';
import { authApi } from '../../services/api';
import './Profile.css';

export default function ProfilePage() {
  const navigate = useNavigate();
  const { user, logout, updateUserProfile, changePassword, hasRole, isKesiswaan } = useAuth();
  const { theme, setTheme } = useTheme();

  // Email verification state
  const [email, setEmail] = useState(user?.email || '');
  const [emailOtpSent, setEmailOtpSent] = useState(false);
  const [emailOtp, setEmailOtp] = useState('');
  const [emailVerified, setEmailVerified] = useState(Boolean(user?.email_verified_at));
  const [emailLoading, setEmailLoading] = useState(false);
  const [emailMsg, setEmailMsg] = useState('');
  const [emailError, setEmailError] = useState('');

  // WhatsApp verification state
  const [waNumber, setWaNumber] = useState(user?.phone_number || '');
  const [waOtpSent, setWaOtpSent] = useState(false);
  const [waOtp, setWaOtp] = useState('');
  const [waSessionToken, setWaSessionToken] = useState('');
  const [waVerified, setWaVerified] = useState(Boolean(user?.phone_verified_at));
  const [waLoading, setWaLoading] = useState(false);
  const [waMsg, setWaMsg] = useState('');
  const [waError, setWaError] = useState('');
  const [unlinkWaModalOpen, setUnlinkWaModalOpen] = useState(false);
  const [unlinkWaPassword, setUnlinkWaPassword] = useState('');
  const [unlinkWaLoading, setUnlinkWaLoading] = useState(false);
  const [unlinkWaError, setUnlinkWaError] = useState('');

  useEffect(() => {
    setEmail(user?.email || '');
    setEmailVerified(Boolean(user?.email_verified_at));
  }, [user?.email, user?.email_verified_at]);

  useEffect(() => {
    setWaNumber(user?.phone_number || '');
    setWaVerified(Boolean(user?.phone_verified_at));
  }, [user?.phone_number, user?.phone_verified_at]);

  // Google Linking state
  const { isLoaded: isGoogleLoaded, renderGoogleButton } = useGoogleAuth();
  const [googleConnected, setGoogleConnected] = useState(Boolean(user?.google_id));
  const [googleMsg, setGoogleMsg] = useState('');
  const [googleError, setGoogleError] = useState('');
  const [unlinkModalOpen, setUnlinkModalOpen] = useState(false);
  const [unlinkPassword, setUnlinkPassword] = useState('');
  const [unlinkLoading, setUnlinkLoading] = useState(false);
  const [unlinkError, setUnlinkError] = useState('');
  const googleBtnRef = useRef(null);

  useEffect(() => {
    setGoogleConnected(Boolean(user?.google_id));
  }, [user?.google_id]);

  const handleLinkGoogle = async (credential) => {
    setGoogleError('');
    setGoogleMsg('');

    try {
      const res = await authApi.linkGoogle(credential);
      const updatedUser = res?.data?.user;
      if (updatedUser) {
        updateUserProfile(updatedUser);
        if (updatedUser.email && !email) {
          setEmail(updatedUser.email);
          setEmailVerified(true);
        }
      }
      setGoogleConnected(true);
      if (googleBtnRef.current) {
        googleBtnRef.current.innerHTML = '';
      }
      setGoogleMsg(res?.message || 'Akun Google berhasil ditautkan ke akun SCP Anda.');
    } catch (err) {
      setGoogleError(err.message || 'Gagal menautkan akun Google. Pastikan akun belum digunakan oleh pengguna lain.');
    }
  };

  const handleUnlinkGoogle = async () => {
    if (!unlinkPassword) {
      setUnlinkError('Kata sandi akun wajib diisi untuk konfirmasi keamanan.');
      return;
    }

    setUnlinkLoading(true);
    setUnlinkError('');

    try {
      const res = await authApi.unlinkGoogle(unlinkPassword);
      updateUserProfile({
        google_id: null,
        google_email: null,
        google_linked_at: null,
      });
      setGoogleConnected(false);
      setUnlinkModalOpen(false);
      setUnlinkPassword('');
      setGoogleMsg(res?.message || 'Tautan akun Google berhasil dilepas.');
    } catch (err) {
      setUnlinkError(err.message || 'Kata sandi tidak valid.');
    } finally {
      setUnlinkLoading(false);
    }
  };

  // Render Google button container when not linked and GIS script is loaded
  useEffect(() => {
    if (!googleConnected && isGoogleLoaded && googleBtnRef.current) {
      googleBtnRef.current.innerHTML = '';
      renderGoogleButton(googleBtnRef.current, {
        onSuccess: handleLinkGoogle,
        onError: (err) => setGoogleError(err.message || 'Gagal menghubungkan akun Google.'),
        text: 'continue_with',
        theme: 'outline',
        size: 'medium',
      });
    } else if (googleConnected && googleBtnRef.current) {
      googleBtnRef.current.innerHTML = '';
    }
  }, [googleConnected, isGoogleLoaded, renderGoogleButton]);

  // Password change state
  const [oldPassword, setOldPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [passwordLoading, setPasswordLoading] = useState(false);
  const [passwordSuccess, setPasswordSuccess] = useState(false);
  const [passwordError, setPasswordError] = useState('');
  const [fieldErrors, setFieldErrors] = useState({});

  const handleSendEmailOtp = async () => {
    if (!email || !/\S+@\S+\.\S+/.test(email)) {
      setEmailError('Alamat email wajib diisi dengan format yang benar.');
      return;
    }
    setEmailLoading(true);
    setEmailError('');
    setEmailMsg('');

    try {
      await authApi.requestEmailOtp(email);
      setEmailOtpSent(true);
      setEmailMsg('Kode OTP 6-digit berhasil dikirim ke email Anda.');
    } catch (err) {
      setEmailError(err.message || 'Gagal mengirim kode OTP ke email. Coba beberapa saat lagi.');
    } finally {
      setEmailLoading(false);
    }
  };

  const handleVerifyEmailOtp = async () => {
    if (emailOtp.trim().length !== 6) {
      setEmailError('Masukkan 6 digit kode OTP verifikasi email dengan benar.');
      return;
    }
    setEmailLoading(true);
    setEmailError('');

    try {
      await authApi.verifyEmailOtp({ email, code: emailOtp.trim() });
      setEmailVerified(true);
      setEmailOtpSent(false);
      setEmailMsg('Email berhasil diverifikasi.');
      updateUserProfile({ email, email_verified_at: new Date().toISOString() });
    } catch (err) {
      setEmailError(err.message || 'Kode verifikasi email tidak valid atau telah kedaluwarsa.');
    } finally {
      setEmailLoading(false);
    }
  };

  const handleSendWaOtp = async () => {
    if (!waNumber || waNumber.trim().length < 9) {
      setWaError('Nomor WhatsApp wajib diisi minimal 9 digit.');
      return;
    }
    setWaLoading(true);
    setWaError('');
    setWaMsg('');

    try {
      const res = await authApi.requestPhoneOtp(waNumber);
      const token = res?.data?.session_token || res?.session_token;
      if (token) {
        setWaSessionToken(token);
      }
      setWaOtpSent(true);
      setWaMsg(res?.message || 'Kode OTP telah dikirim ke nomor WhatsApp Anda.');
    } catch (err) {
      setWaError(err.message || 'Gagal mengirim kode OTP WhatsApp. Periksa kembali nomor Anda.');
    } finally {
      setWaLoading(false);
    }
  };

  const handleVerifyWaOtp = async () => {
    if (waOtp.trim().length !== 6) {
      setWaError('Masukkan 6 digit kode OTP verifikasi WhatsApp dengan benar.');
      return;
    }
    setWaLoading(true);
    setWaError('');

    try {
      const res = await authApi.verifyPhoneOtp({
        phone_number: waNumber,
        code: waOtp.trim(),
        session_token: waSessionToken || undefined,
      });
      setWaVerified(true);
      setWaOtpSent(false);
      setWaOtp('');
      setWaSessionToken('');
      setWaMsg(res?.message || 'Nomor WhatsApp berhasil diverifikasi.');
      const updatedUser = res?.data?.user;
      if (updatedUser) {
        updateUserProfile(updatedUser);
      } else {
        updateUserProfile({ phone_number: waNumber, phone_verified_at: new Date().toISOString() });
      }
    } catch (err) {
      setWaError(err.message || 'Kode verifikasi WhatsApp tidak valid atau telah kedaluwarsa.');
    } finally {
      setWaLoading(false);
    }
  };

  const handleUnlinkWa = async () => {
    if (!unlinkWaPassword) {
      setUnlinkWaError('Kata sandi akun wajib diisi untuk konfirmasi keamanan.');
      return;
    }

    setUnlinkWaLoading(true);
    setUnlinkWaError('');

    try {
      const res = await authApi.unlinkPhone(unlinkWaPassword);
      updateUserProfile({
        phone_number: null,
        phone_verified_at: null,
      });
      setWaNumber('');
      setWaVerified(false);
      setWaOtpSent(false);
      setWaOtp('');
      setWaSessionToken('');
      setUnlinkWaModalOpen(false);
      setUnlinkWaPassword('');
      setWaMsg(res?.message || 'Penautan nomor WhatsApp berhasil dilepas.');
    } catch (err) {
      setUnlinkWaError(err.message || 'Kata sandi saat ini tidak valid.');
    } finally {
      setUnlinkWaLoading(false);
    }
  };

  const handleChangePassword = async (e) => {
    e.preventDefault();
    setPasswordError('');
    setPasswordSuccess(false);
    setFieldErrors({});

    const errors = {};
    if (!oldPassword) errors.current_password = ['Kata sandi saat ini wajib diisi.'];
    if (!newPassword) errors.new_password = ['Kata sandi baru wajib diisi.'];
    else if (newPassword.length < 8) errors.new_password = ['Kata sandi baru minimal 8 karakter.'];
    if (newPassword !== confirmPassword) errors.new_password_confirmation = ['Konfirmasi kata sandi tidak cocok.'];

    if (Object.keys(errors).length > 0) {
      setFieldErrors(errors);
      return;
    }

    setPasswordLoading(true);

    try {
      await changePassword({
        current_password: oldPassword,
        new_password: newPassword,
        new_password_confirmation: confirmPassword,
      });

      setPasswordSuccess(true);
      setOldPassword('');
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

  const handleLogout = async () => {
    await logout();
    navigate('/login');
  };

  const getInitials = (name) => {
    if (!name) return 'SC';
    const parts = name.trim().split(' ');
    return parts.length >= 2 ? (parts[0][0] + parts[1][0]).toUpperCase() : name.slice(0, 2).toUpperCase();
  };

  const getRoleLabel = () => {
    if (hasRole('waka')) return 'Waka Kurikulum';
    if (hasRole('teacher')) return isKesiswaan() ? 'Guru (Kesiswaan)' : 'Guru Mata Pelajaran';
    if (hasRole('student')) return 'Siswa Terdaftar';
    if (hasRole('parent')) return 'Orang Tua / Wali';
    return user?.role || 'Pengguna';
  };

  return (
    <div className="profile-container">
      {/* Page Header */}
      <div className="profile-header">
        <h1 className="profile-title">Profil &amp; Pengaturan Akun</h1>
        <p className="profile-subtitle">
          Kelola informasi identitas akun, verifikasi saluran notifikasi, dan keamanan login.
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left Column: Identity & Role */}
        <div className="lg:col-span-1 space-y-6">

        {/* Kartu Tampilan (Light / Dark / System) */}
        <div className="bg-white border border-gray-200 rounded-lg p-5">
          <h3 className="text-sm font-semibold text-gray-900 mb-1">Tampilan</h3>
          <p className="text-xs text-gray-500 mb-3">
            Pilih tema antarmuka. Preferensi disimpan pada perangkat ini.
          </p>
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
                  className={`flex flex-col items-center gap-1.5 rounded-md border px-2 py-2.5 text-[11px] font-semibold transition-colors ${
                    active
                      ? 'border-[var(--color-accent)] bg-[#FFFDF0] text-gray-900'
                      : 'border-gray-200 bg-white text-gray-600 hover:bg-gray-50'
                  }`}
                >
                  <Icon size={15} />
                  {label}
                </button>
              );
            })}
          </div>
        </div>

          {/* Identity Card */}
          <div className="bg-white border border-gray-200 rounded-lg p-5">
            <div className="flex items-center gap-3.5 mb-4">
              <div className="w-12 h-12 rounded-full bg-gray-100 text-gray-900 border border-gray-200 flex items-center justify-center font-bold text-base font-mono">
                {getInitials(user?.name)}
              </div>
              <div className="min-w-0 flex-1">
                <h2 className="text-sm font-semibold text-gray-900 truncate">{user?.name}</h2>
                <p className="text-xs text-gray-500 truncate">{getRoleLabel()}</p>
                <div className="mt-1">
                  <span className="inline-block px-2 py-0.5 rounded text-[11px] font-mono font-medium bg-gray-100 text-gray-800">
                    ID: {user?.nis_nip || user?.username || '-'}
                  </span>
                </div>
              </div>
            </div>

            <div className="border-t border-gray-100 pt-3.5 space-y-2.5 text-xs">
              <div className="flex justify-between items-center text-gray-600">
                <span>Peran Sistem</span>
                <Badge variant="default">
                  {getRoleLabel()}
                </Badge>
              </div>
              <div className="flex justify-between items-center text-gray-600">
                <span>Status Akun</span>
                <span className="font-medium text-emerald-700 flex items-center gap-1">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 inline-block"></span>
                  Aktif Terverifikasi
                </span>
              </div>
              <div className="flex justify-between items-center text-gray-600">
                <span>Tahun Ajaran</span>
                <span className="font-medium text-gray-900">2026/2027 Ganjil</span>
              </div>
            </div>
          </div>

          {/* Logout Button */}
          <div className="bg-white border border-gray-200 rounded-lg p-4">
            <Button variant="danger" fullWidth onClick={handleLogout}>
              Keluar dari Sistem
            </Button>
          </div>
        </div>

        {/* Right Columns: Verification Channels & Security Settings */}
        <div className="lg:col-span-2 space-y-6">
          {/* Email Verification Section */}
          <div className="bg-white border border-gray-200 rounded-lg p-5 sm:p-6">
            <div className="mb-2">
              <h2 className="text-base font-semibold text-gray-900">Tautan Email Akun</h2>
            </div>
            <p className="text-xs text-gray-500 mb-4">
              Email digunakan untuk menerima bukti transaksi presensi, reset kata sandi, dan rekap
              pembelajaran.
            </p>

            <div className="space-y-3">
              {emailMsg && (
                <div className="p-3 bg-gray-50 border border-gray-200 rounded text-gray-700 text-xs">
                  {emailMsg}
                </div>
              )}
              {emailError && (
                <div className="p-3 bg-red-50 border border-red-200 rounded text-red-600 text-xs">
                  {emailError}
                </div>
              )}

              <div className="flex flex-col sm:flex-row gap-2">
                <div className="flex-1">
                  <Input
                    label="Alamat Email Sekolah / Pribadi"
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="nama@domain.sch.id"
                    disabled={emailVerified}
                  />
                </div>
                {!emailVerified && !emailOtpSent && (
                  <div className="sm:self-end sm:mb-[2px]">
                    <Button
                      variant="secondary"
                      onClick={handleSendEmailOtp}
                      loading={emailLoading}
                    >
                      Kirim Kode
                    </Button>
                  </div>
                )}
              </div>

              {emailOtpSent && !emailVerified && (
                <div className="flex flex-col sm:flex-row gap-2 p-3.5 bg-gray-50 border border-gray-200 rounded-md">
                  <div className="flex-1">
                    <Input
                      label="Masukkan 6 Digit OTP Email"
                      placeholder="Contoh: 849201"
                      value={emailOtp}
                      onChange={(e) => setEmailOtp(e.target.value)}
                    />
                  </div>
                  <div className="sm:self-end sm:mb-[2px]">
                    <Button
                      variant="primary"
                      onClick={handleVerifyEmailOtp}
                      loading={emailLoading}
                    >
                      Verifikasi
                    </Button>
                  </div>
                </div>
              )}

              {emailVerified && (
                <div className="flex items-center gap-2 text-emerald-700 bg-emerald-50 border border-emerald-200 px-3 py-2 rounded text-xs font-medium">
                  <CheckCircle size={15} />
                  <span>Email berhasil diverifikasi sebagai saluran resmi akun.</span>
                </div>
              )}
            </div>
          </div>

          {/* WhatsApp Notification Linking */}
          <div className="bg-white border border-gray-200 rounded-lg p-5 sm:p-6">
            <div className="flex items-center gap-2 mb-2">
              <MessageSquare size={18} className="text-gray-600" />
              <h2 className="text-base font-semibold text-gray-900">
                Nomor WhatsApp Notifikasi
              </h2>
            </div>
            <p className="text-xs text-gray-500 mb-4">
              Digunakan untuk pengiriman notifikasi darurat ketidakhadiran siswa dan persetujuan izin
              secara real-time.
            </p>

            <div className="space-y-3">
              {waMsg && (
                <div className="p-3 bg-gray-50 border border-gray-200 rounded text-gray-700 text-xs">
                  {waMsg}
                </div>
              )}
              {waError && (
                <div className="p-3 bg-red-50 border border-red-200 rounded text-red-600 text-xs">
                  {waError}
                </div>
              )}

              {waVerified ? (
                <div className="flex flex-col sm:flex-row sm:items-center justify-between p-3.5 bg-emerald-50 border border-emerald-200 rounded-lg gap-3">
                  <div className="flex items-center gap-2.5">
                    <span className="status-dot status-dot--success" />
                    <div>
                      <span className="text-xs font-semibold text-emerald-900 block">Nomor WhatsApp Terverifikasi</span>
                      <span className="text-[11px] text-emerald-700 font-mono">
                        {user?.phone_number || waNumber}
                      </span>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 self-end sm:self-auto">
                    <span className="text-[11px] text-emerald-600 font-semibold px-2 py-0.5 bg-emerald-100 rounded">
                      Aktif
                    </span>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => {
                        setUnlinkWaPassword('');
                        setUnlinkWaError('');
                        setUnlinkWaModalOpen(true);
                      }}
                      className="text-red-600 hover:text-red-700 hover:bg-red-50 border-red-200 text-xs py-1 px-2.5 h-auto"
                    >
                      Lepas Penautan
                    </Button>
                  </div>
                </div>
              ) : (
                <>
                  {user?.phone_number && !user?.phone_verified_at && (
                    <div className="p-3 bg-amber-50 border border-amber-200 rounded text-amber-800 text-xs flex items-center gap-2">
                      <AlertCircle size={15} className="flex-shrink-0 text-amber-600" />
                      <span>
                        Nomor ini belum diverifikasi. Silakan klik <strong>Kirim OTP WA</strong> untuk memverifikasi agar nomor dapat digunakan untuk login cepat dan notifikasi darurat.
                      </span>
                    </div>
                  )}

                  <div className="flex flex-col sm:flex-row gap-2">
                    <div className="flex-1">
                      <Input
                        label="Nomor Telepon / WhatsApp Aktif"
                        value={waNumber}
                        onChange={(e) => setWaNumber(e.target.value)}
                        placeholder="08xxxxxxxxxx"
                      />
                    </div>
                    {!waOtpSent && (
                      <div className="sm:self-end sm:mb-[2px]">
                        <Button variant="secondary" onClick={handleSendWaOtp} loading={waLoading}>
                          Kirim OTP WA
                        </Button>
                      </div>
                    )}
                  </div>

                  {waOtpSent && (
                    <div className="flex flex-col sm:flex-row gap-2 p-3.5 bg-gray-50 border border-gray-200 rounded-md">
                      <div className="flex-1">
                        <Input
                          label="Masukkan 6 Digit OTP WhatsApp"
                          placeholder="Contoh: 123456"
                          value={waOtp}
                          onChange={(e) => setWaOtp(e.target.value)}
                        />
                      </div>
                      <div className="flex gap-2 sm:self-end sm:mb-[2px]">
                        <Button variant="primary" onClick={handleVerifyWaOtp} loading={waLoading}>
                          Verifikasi
                        </Button>
                        <Button
                          variant="ghost"
                          onClick={() => {
                            setWaOtpSent(false);
                            setWaOtp('');
                          }}
                          disabled={waLoading}
                        >
                          Batal
                        </Button>
                      </div>
                    </div>
                  )}
                </>
              )}
            </div>
          </div>

          {/* Google SSO Linking */}
          <div className="bg-white border border-gray-200 rounded-lg p-5 sm:p-6">
            <div className="mb-2">
              <h2 className="text-base font-semibold text-gray-900">Tautan Akun Google SSO</h2>
            </div>
            <p className="text-xs text-gray-500 mb-3">
              Tautkan akun Google untuk mempermudah login sekali klik tanpa perlu mengetik kata sandi.
            </p>

            {googleMsg && (
              <div className="p-3 mb-3 bg-emerald-50 border border-emerald-200 rounded text-emerald-700 text-xs flex items-center gap-2">
                <CheckCircle size={15} className="flex-shrink-0" />
                <span>{googleMsg}</span>
              </div>
            )}

            {googleError && (
              <div className="p-3 mb-3 bg-red-50 border border-red-200 rounded text-red-600 text-xs flex items-center gap-2">
                <AlertCircle size={15} className="flex-shrink-0" />
                <span>{googleError}</span>
              </div>
            )}

            {googleConnected ? (
              <div
                key="google-linked-card"
                className="flex flex-col sm:flex-row sm:items-center justify-between p-3.5 bg-emerald-50 border border-emerald-200 rounded-lg gap-3"
              >
                <div className="flex items-center gap-2.5">
                  <span className="status-dot status-dot--success" />
                  <div>
                    <span className="text-xs font-semibold text-emerald-900 block">Akun Google Terhubung</span>
                    <span className="text-[11px] text-emerald-700 font-mono">
                      {user?.google_email || user?.email || 'Akun Google aktif'}
                    </span>
                  </div>
                </div>
                <div className="flex items-center gap-2 self-end sm:self-auto">
                  <span className="text-[11px] text-emerald-600 font-semibold px-2 py-0.5 bg-emerald-100 rounded">
                    Aktif
                  </span>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      setUnlinkPassword('');
                      setUnlinkError('');
                      setUnlinkModalOpen(true);
                    }}
                    className="text-red-600 hover:text-red-700 hover:bg-red-50 border-red-200 text-xs py-1 px-2.5 h-auto"
                  >
                    Lepas Tautan
                  </Button>
                </div>
              </div>
            ) : (
              <div key="google-unlinked-card" className="space-y-3">
                <div className="flex items-center">
                  <div ref={googleBtnRef} className="inline-block min-h-[40px]" />
                </div>
                <p className="text-[11px] text-gray-400">
                  Klik tombol di atas untuk menautkan akun Google Anda ke akun SCP.
                </p>
              </div>
            )}
          </div>

          {/* Change Password Section */}
          <div className="bg-white border border-gray-200 rounded-lg p-5 sm:p-6">
            <div className="mb-2">
              <h2 className="text-base font-semibold text-gray-900">Ubah Kata Sandi</h2>
            </div>
            <p className="text-xs text-gray-500 mb-4">
              Pastikan kata sandi baru Anda minimal 8 karakter dan tidak mudah ditebak.
            </p>

            {passwordSuccess && (
              <div className="p-3 mb-3 bg-emerald-50 border border-emerald-200 rounded text-emerald-700 text-xs flex items-center gap-2">
                <CheckCircle size={15} />
                <span>Kata sandi berhasil diperbarui.</span>
              </div>
            )}

            {passwordError && (
              <div className="p-3 mb-3 bg-red-50 border border-red-200 rounded text-red-600 text-xs">
                {passwordError}
              </div>
            )}

            <form onSubmit={handleChangePassword} className="space-y-3">
              <Input
                type="password"
                label="Kata Sandi Saat Ini"
                value={oldPassword}
                onChange={(e) => setOldPassword(e.target.value)}
                error={fieldErrors.current_password?.[0]}
                placeholder="Masukkan kata sandi lama"
                required
              />

              <Input
                type="password"
                label="Kata Sandi Baru"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                error={fieldErrors.new_password?.[0]}
                placeholder="Minimal 8 karakter"
                required
              />

              <Input
                type="password"
                label="Konfirmasi Kata Sandi Baru"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                error={fieldErrors.new_password_confirmation?.[0]}
                placeholder="Ulangi kata sandi baru"
                required
              />

              <div className="pt-2">
                <Button type="submit" variant="primary" loading={passwordLoading}>
                  Simpan Kata Sandi Baru
                </Button>
              </div>
            </form>
          </div>
        </div>
      </div>

      {/* Modal Konfirmasi Pelepasan Tautan Google (Step-Up Authentication) */}
      <Modal
        isOpen={unlinkModalOpen}
        onClose={() => {
          if (!unlinkLoading) {
            setUnlinkModalOpen(false);
            setUnlinkError('');
            setUnlinkPassword('');
          }
        }}
        title="Lepas Tautan Akun Google"
        size="sm"
        footer={
          <div className="flex justify-end gap-2 w-full">
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                setUnlinkModalOpen(false);
                setUnlinkError('');
                setUnlinkPassword('');
              }}
              disabled={unlinkLoading}
            >
              Batal
            </Button>
            <Button
              variant="danger"
              size="sm"
              onClick={handleUnlinkGoogle}
              loading={unlinkLoading}
            >
              Ya, Lepas Tautan
            </Button>
          </div>
        }
      >
        <div className="space-y-3 py-1">
          <p className="text-xs text-gray-600 leading-relaxed">
            Demi keamanan data akun Anda, masukkan <strong>kata sandi akun SCP</strong> saat ini untuk mengonfirmasi pelepasan tautan akun Google (
            <span className="font-semibold text-gray-800">
              {user?.google_email || user?.email}
            </span>
            ).
          </p>

          {unlinkError && (
            <div className="p-2.5 bg-red-50 border border-red-200 rounded text-xs text-red-600 flex items-center gap-2">
              <AlertCircle size={14} className="flex-shrink-0" />
              <span>{unlinkError}</span>
            </div>
          )}

          <Input
            type="password"
            label="Kata Sandi Akun SCP"
            placeholder="Masukkan kata sandi akun Anda"
            value={unlinkPassword}
            onChange={(e) => {
              setUnlinkPassword(e.target.value);
              if (unlinkError) setUnlinkError('');
            }}
            required
            autoFocus
          />
        </div>
      </Modal>

      {/* Modal Konfirmasi Pelepasan Penautan Nomor WhatsApp */}
      <Modal
        isOpen={unlinkWaModalOpen}
        onClose={() => {
          if (!unlinkWaLoading) {
            setUnlinkWaModalOpen(false);
            setUnlinkWaError('');
            setUnlinkWaPassword('');
          }
        }}
        title="Lepas Penautan Nomor WhatsApp"
        size="sm"
        footer={
          <div className="flex justify-end gap-2 w-full">
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                setUnlinkWaModalOpen(false);
                setUnlinkWaError('');
                setUnlinkWaPassword('');
              }}
              disabled={unlinkWaLoading}
            >
              Batal
            </Button>
            <Button
              variant="danger"
              size="sm"
              onClick={handleUnlinkWa}
              loading={unlinkWaLoading}
            >
              Ya, Lepas Penautan
            </Button>
          </div>
        }
      >
        <div className="space-y-3 py-1">
          <p className="text-xs text-gray-600 leading-relaxed">
            Demi keamanan data akun Anda, masukkan <strong>kata sandi akun SCP</strong> saat ini untuk mengonfirmasi pelepasan nomor WhatsApp (
            <span className="font-semibold text-gray-800">
              {user?.phone_number || waNumber}
            </span>
            ). Setelah dilepas, nomor ini tidak lagi terhubung untuk notifikasi maupun login.
          </p>

          {unlinkWaError && (
            <div className="p-2.5 bg-red-50 border border-red-200 rounded text-xs text-red-600 flex items-center gap-2">
              <AlertCircle size={14} className="flex-shrink-0" />
              <span>{unlinkWaError}</span>
            </div>
          )}

          <Input
            type="password"
            label="Kata Sandi Akun SCP"
            placeholder="Masukkan kata sandi akun Anda"
            value={unlinkWaPassword}
            onChange={(e) => {
              setUnlinkWaPassword(e.target.value);
              if (unlinkWaError) setUnlinkWaError('');
            }}
            required
            autoFocus
          />
        </div>
      </Modal>
    </div>
  );
}
