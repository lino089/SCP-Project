import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button, Input } from '../../components/shared';
import { useAuth } from '../../hooks/useAuth';
import { KeyRound, ShieldAlert, CheckCircle2 } from 'lucide-react';
import './ChangePassword.css';

export default function ChangePasswordPage() {
  const navigate = useNavigate();
  const { user, changePassword, getHomeRoute, logout } = useAuth();

  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  const [fieldErrors, setFieldErrors] = useState({});
  const [isSuccess, setIsSuccess] = useState(false);

  const handleSubmit = async (e) => {
    e?.preventDefault();

    // Client-side validations
    const errors = {};
    if (!currentPassword) {
      errors.current_password = ['Kata sandi saat ini wajib diisi.'];
    }
    if (!newPassword) {
      errors.new_password = ['Kata sandi baru wajib diisi.'];
    } else if (newPassword.length < 8) {
      errors.new_password = ['Kata sandi baru minimal 8 karakter.'];
    }
    if (newPassword !== confirmPassword) {
      errors.new_password_confirmation = ['Konfirmasi kata sandi baru tidak cocok.'];
    }

    if (Object.keys(errors).length > 0) {
      setFieldErrors(errors);
      return;
    }

    setIsLoading(true);
    setError('');
    setFieldErrors({});

    try {
      await changePassword({
        current_password: currentPassword,
        new_password: newPassword,
        new_password_confirmation: confirmPassword,
      });

      setIsSuccess(true);
      setTimeout(() => {
        navigate(getHomeRoute(), { replace: true });
      }, 1500);
    } catch (err) {
      if (err.errors) {
        setFieldErrors(err.errors);
      }
      setError(
        err.message || 'Gagal mengubah kata sandi. Pastikan kata sandi saat ini benar.'
      );
    } finally {
      setIsLoading(false);
    }
  };

  const handleCancelLogout = async () => {
    await logout();
    navigate('/login', { replace: true });
  };

  return (
    <div className="change-password-page">
      <div className="change-password-card">
        <div className="change-password-header">
          <div className="change-password-badge">
            <ShieldAlert size={14} />
            <span>Tindakan Wajib Keamanan</span>
          </div>
          <h1 className="change-password-title">Perbarui Kata Sandi Akun</h1>
          <p className="change-password-desc">
            Halo <strong className="text-gray-900">{user?.name}</strong>, akun Anda menggunakan
            kata sandi bawaan sistem. Demi keamanan data akademik, Anda wajib memperbarui kata sandi
            sebelum melanjutkan ke beranda.
          </p>
        </div>

        {isSuccess ? (
          <div className="p-4 bg-emerald-50 border border-emerald-200 rounded-lg flex items-center gap-3 text-emerald-800 text-sm">
            <CheckCircle2 size={20} className="text-emerald-600 flex-shrink-0" />
            <div>
              <div className="font-semibold">Kata Sandi Berhasil Diperbarui!</div>
              <div className="text-xs text-emerald-700">Mengarahkan ke halaman utama...</div>
            </div>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="change-password-form">
            {error && (
              <div className="p-3 bg-red-50 border border-red-200 rounded-md text-red-600 text-xs font-medium">
                {error}
              </div>
            )}

            <Input
              type="password"
              label="Kata Sandi Saat Ini"
              placeholder="Masukkan kata sandi lama / bawaan"
              value={currentPassword}
              onChange={(e) => {
                setCurrentPassword(e.target.value);
                if (fieldErrors.current_password) setFieldErrors({});
              }}
              error={fieldErrors.current_password?.[0]}
              required
            />

            <Input
              type="password"
              label="Kata Sandi Baru (Min. 8 Karakter)"
              placeholder="Masukkan kata sandi baru"
              value={newPassword}
              onChange={(e) => {
                setNewPassword(e.target.value);
                if (fieldErrors.new_password) setFieldErrors({});
              }}
              error={fieldErrors.new_password?.[0]}
              helperText="Gunakan kombinasi huruf, angka, atau simbol"
              required
            />

            <Input
              type="password"
              label="Konfirmasi Kata Sandi Baru"
              placeholder="Ulangi kata sandi baru"
              value={confirmPassword}
              onChange={(e) => {
                setConfirmPassword(e.target.value);
                if (fieldErrors.new_password_confirmation) setFieldErrors({});
              }}
              error={fieldErrors.new_password_confirmation?.[0]}
              required
            />

            <div className="change-password-actions">
              <Button
                type="submit"
                variant="dark"
                size="lg"
                fullWidth
                loading={isLoading}
                icon={KeyRound}
              >
                Simpan &amp; Lanjutkan ke Beranda
              </Button>

              <Button
                type="button"
                variant="ghost"
                size="sm"
                fullWidth
                onClick={handleCancelLogout}
                className="text-gray-500 hover:text-gray-700"
              >
                Batal &amp; Keluar ke Login
              </Button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}
