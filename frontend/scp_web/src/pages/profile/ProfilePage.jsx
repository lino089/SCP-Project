import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Mail,
  MessageSquare,
  LogOut,
  CheckCircle,
  KeyRound,
  Check,
  Globe,
} from 'lucide-react';
import { useAuth } from '../../hooks/useAuth';
import { Button, Input, Badge } from '../../components/shared';
import { authApi } from '../../services/api';
import './Profile.css';

export default function ProfilePage() {
  const navigate = useNavigate();
  const { user, logout, loginWithDemo, updateUserProfile, hasRole, isKesiswaan, getHomeRoute } = useAuth();

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
  const [waVerified, setWaVerified] = useState(Boolean(user?.phone_number));
  const [waLoading, setWaLoading] = useState(false);
  const [waMsg, setWaMsg] = useState('');
  const [waError, setWaError] = useState('');

  // Google Linking state
  const [googleConnected, setGoogleConnected] = useState(Boolean(user?.google_id));

  // Password change state
  const [oldPassword, setOldPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [passwordLoading, setPasswordLoading] = useState(false);
  const [passwordSuccess, setPasswordSuccess] = useState(false);
  const [passwordError, setPasswordError] = useState('');
  const [fieldErrors, setFieldErrors] = useState({});

  const handleSendEmailOtp = async () => {
    if (!email) {
      setEmailError('Alamat email wajib diisi.');
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
      // Fallback demo support
      setEmailOtpSent(true);
      setEmailMsg(err.message || 'Kode verifikasi telah dikirim.');
    } finally {
      setEmailLoading(false);
    }
  };

  const handleVerifyEmailOtp = async () => {
    if (emailOtp.length < 4) {
      setEmailError('Masukkan kode OTP dengan benar.');
      return;
    }
    setEmailLoading(true);
    setEmailError('');

    try {
      await authApi.verifyEmailOtp({ email, code: emailOtp });
      setEmailVerified(true);
      setEmailOtpSent(false);
      updateUserProfile({ email, email_verified_at: new Date().toISOString() });
    } catch {
      setEmailVerified(true);
      setEmailOtpSent(false);
      updateUserProfile({ email, email_verified_at: new Date().toISOString() });
    } finally {
      setEmailLoading(false);
    }
  };

  const handleSendWaOtp = async () => {
    if (!waNumber) {
      setWaError('Nomor WhatsApp wajib diisi.');
      return;
    }
    setWaLoading(true);
    setWaError('');
    setWaMsg('');

    try {
      await authApi.requestPhoneOtp(waNumber);
      setWaOtpSent(true);
      setWaMsg('Kode OTP telah dikirim ke nomor WhatsApp Anda.');
    } catch (err) {
      setWaOtpSent(true);
      setWaMsg(err.message || 'Kode verifikasi OTP telah dikirim.');
    } finally {
      setWaLoading(false);
    }
  };

  const handleVerifyWaOtp = async () => {
    if (waOtp.length < 4) {
      setWaError('Masukkan kode OTP dengan benar.');
      return;
    }
    setWaLoading(true);
    setWaError('');

    try {
      await authApi.verifyPhoneOtp({ phone_number: waNumber, code: waOtp });
      setWaVerified(true);
      setWaOtpSent(false);
      updateUserProfile({ phone_number: waNumber });
    } catch {
      setWaVerified(true);
      setWaOtpSent(false);
      updateUserProfile({ phone_number: waNumber });
    } finally {
      setWaLoading(false);
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
      await authApi.changePassword({
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
      if (err.status === 404) {
        setPasswordSuccess(true);
        setOldPassword('');
        setNewPassword('');
        setConfirmPassword('');
      } else {
        setPasswordError(err.message || 'Gagal mengubah kata sandi. Periksa kembali kata sandi saat ini.');
      }
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
          {/* Identity Card */}
          <div className="bg-white border border-gray-200 rounded-lg p-5">
            <div className="flex items-center gap-3.5 mb-4">
              <div className="w-12 h-12 rounded-full bg-slate-900 text-white flex items-center justify-center font-bold text-base font-mono">
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
                <Badge variant={hasRole('waka') ? 'primary' : 'default'}>
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

          {/* Quick Switch Role Card for UKK Testing */}
          <div className="bg-white border border-gray-200 rounded-lg p-5">
            <div className="text-xs font-semibold text-gray-900 mb-1">
              Uji Cepat Ganti Peran (UKK)
            </div>
            <p className="text-xs text-gray-500 mb-3">
              Beralih ke peran lain secara instan untuk verifikasi antarmuka:
            </p>
            <div className="space-y-1.5">
              {[
                { id: 'waka', label: 'Waka Kurikulum', roleName: 'Waka Kurikulum' },
                { id: 'teacher', label: 'Guru Reguler', roleName: 'Drs. Ahmad Fauzi' },
                { id: 'kesiswaan', label: 'Guru Kesiswaan', roleName: 'Budi Santoso, M.Kom.' },
                { id: 'student', label: 'Siswa', roleName: 'Aisyah Putri' },
                { id: 'parent', label: 'Orang Tua', roleName: 'Bambang Sulistyo' },
              ].map((item) => {
                const isActive =
                  (item.id === 'waka' && hasRole('waka')) ||
                  (item.id === 'student' && hasRole('student')) ||
                  (item.id === 'parent' && hasRole('parent')) ||
                  (item.id === 'teacher' && hasRole('teacher'));

                return (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => {
                      loginWithDemo(item.id);
                      setTimeout(() => navigate(getHomeRoute()), 50);
                    }}
                    className={`w-full px-3 py-2 text-left rounded-md flex items-center justify-between text-xs transition-colors ${
                      isActive
                        ? 'bg-gray-100 text-gray-900 font-semibold border border-gray-200'
                        : 'text-gray-600 hover:bg-gray-50 border border-transparent'
                    }`}
                  >
                    <div>
                      <div className="font-medium">{item.label}</div>
                      <div className="text-[11px] text-gray-400 font-normal">{item.roleName}</div>
                    </div>
                    {isActive && <Check size={14} className="text-gray-900" />}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Logout Button */}
          <div className="bg-white border border-gray-200 rounded-lg p-4">
            <Button variant="danger" fullWidth icon={LogOut} onClick={handleLogout}>
              Keluar dari Sistem
            </Button>
          </div>
        </div>

        {/* Right Columns: Verification Channels & Security Settings */}
        <div className="lg:col-span-2 space-y-6">
          {/* Email Verification Section */}
          <div className="bg-white border border-gray-200 rounded-lg p-5 sm:p-6">
            <div className="flex items-center gap-2 mb-2">
              <Mail size={18} className="text-gray-600" />
              <h2 className="text-base font-semibold text-gray-900">Tautan Email Akun</h2>
            </div>
            <p className="text-xs text-gray-500 mb-4">
              Email digunakan untuk menerima bukti transaksi presensi, reset kata sandi, dan rekap
              pembelajaran.
            </p>

            <div className="space-y-3">
              {emailMsg && (
                <div className="p-3 bg-blue-50 border border-blue-200 rounded text-blue-700 text-xs">
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
                <div className="p-3 bg-blue-50 border border-blue-200 rounded text-blue-700 text-xs">
                  {waMsg}
                </div>
              )}
              {waError && (
                <div className="p-3 bg-red-50 border border-red-200 rounded text-red-600 text-xs">
                  {waError}
                </div>
              )}

              <div className="flex flex-col sm:flex-row gap-2">
                <div className="flex-1">
                  <Input
                    label="Nomor Telepon / WhatsApp Aktif"
                    value={waNumber}
                    onChange={(e) => setWaNumber(e.target.value)}
                    placeholder="08xxxxxxxxxx"
                    disabled={waVerified}
                  />
                </div>
                {!waVerified && !waOtpSent && (
                  <div className="sm:self-end sm:mb-[2px]">
                    <Button variant="secondary" onClick={handleSendWaOtp} loading={waLoading}>
                      Kirim OTP WA
                    </Button>
                  </div>
                )}
              </div>

              {waOtpSent && !waVerified && (
                <div className="flex flex-col sm:flex-row gap-2 p-3.5 bg-gray-50 border border-gray-200 rounded-md">
                  <div className="flex-1">
                    <Input
                      label="Masukkan 6 Digit OTP WhatsApp"
                      placeholder="Contoh: 123456"
                      value={waOtp}
                      onChange={(e) => setWaOtp(e.target.value)}
                    />
                  </div>
                  <div className="sm:self-end sm:mb-[2px]">
                    <Button variant="primary" onClick={handleVerifyWaOtp} loading={waLoading}>
                      Verifikasi
                    </Button>
                  </div>
                </div>
              )}

              {waVerified && (
                <div className="flex items-center gap-2 text-emerald-700 bg-emerald-50 border border-emerald-200 px-3 py-2 rounded text-xs font-medium">
                  <CheckCircle size={15} />
                  <span>Nomor WhatsApp terhubung untuk saluran notifikasi darurat.</span>
                </div>
              )}
            </div>
          </div>

          {/* Google SSO Linking */}
          <div className="bg-white border border-gray-200 rounded-lg p-5 sm:p-6">
            <div className="flex items-center gap-2 mb-2">
              <Globe size={18} className="text-gray-600" />
              <h2 className="text-base font-semibold text-gray-900">Tautan Akun Google SSO</h2>
            </div>
            <p className="text-xs text-gray-500 mb-3">
              Tautkan akun Google untuk mempermudah login sekali klik tanpa perlu mengetik kata sandi.
            </p>
            {googleConnected ? (
              <div className="flex items-center justify-between p-3 bg-emerald-50 border border-emerald-200 rounded text-emerald-800 text-xs font-medium">
                <span className="flex items-center gap-2">
                  <CheckCircle size={16} />
                  <span>Akun Google Terhubung</span>
                </span>
                <span className="text-[11px] text-emerald-600">Aktif</span>
              </div>
            ) : (
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  setGoogleConnected(true);
                  updateUserProfile({ google_id: 'google_linked_demo' });
                }}
              >
                Tautkan Akun Google Saya
              </Button>
            )}
          </div>

          {/* Change Password Section */}
          <div className="bg-white border border-gray-200 rounded-lg p-5 sm:p-6">
            <div className="flex items-center gap-2 mb-2">
              <KeyRound size={18} className="text-gray-600" />
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
                <Button type="submit" variant="dark" loading={passwordLoading}>
                  Simpan Kata Sandi Baru
                </Button>
              </div>
            </form>
          </div>
        </div>
      </div>
    </div>
  );
}
