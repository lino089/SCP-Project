import { useState } from 'react';
import { useNavigate, Navigate } from 'react-router-dom';
import { Lock, ShieldAlert, CheckCircle2, AlertCircle } from 'lucide-react';
import { Button, Input, Badge } from '../../components/shared';
import { useAuth } from '../../hooks/useAuth';

export default function ChangePasswordPage() {
  const navigate = useNavigate();
  const { user, isAuthenticated, mustChangePassword, changePassword, getHomeRoute, logout } = useAuth();

  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  const [fieldErrors, setFieldErrors] = useState({});
  const [isSuccess, setIsSuccess] = useState(false);

  // If unauthenticated, redirect to login
  if (!isAuthenticated) {
    return <Navigate to="/login" replace />;
  }

  // If user does not require mandatory password change, redirect to home
  if (!mustChangePassword && !isSuccess) {
    return <Navigate to={getHomeRoute()} replace />;
  }

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
    } else if (newPassword === currentPassword) {
      errors.new_password = ['Kata sandi baru tidak boleh sama dengan kata sandi lama.'];
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
    <div className="min-h-dvh bg-[var(--color-bg-app)] flex flex-col items-center px-4 py-6 pb-safe overflow-y-auto">
      <div className="w-full max-w-[420px] mx-auto my-auto space-y-4">
        <div className="surface-card p-5 shadow-[var(--shadow-card)] space-y-4">
          {/* Header */}
          <div className="flex items-center justify-between border-b border-[var(--color-border-light)] pb-3.5">
            <Badge variant="warning" size="sm">
              <ShieldAlert size={13} className="mr-1" />
              Tindakan Wajib Keamanan
            </Badge>
            <span className="font-mono text-[11px] text-[var(--color-text-muted)]">SCP Security</span>
          </div>

          <div>
            <h1 className="page-title">
              Perbarui Kata Sandi Perdana
            </h1>
            <p className="text-xs text-[var(--color-text-secondary)] mt-1 leading-relaxed">
              Halo <strong className="text-[var(--color-text-primary)]">{user?.name}</strong>, akun Anda saat ini menggunakan kata sandi bawaan sistem. Demi keamanan data akademik, Anda wajib menggantinya sebelum mengakses aplikasi.
            </p>
          </div>

          {isSuccess ? (
            <div className="p-4 bg-[var(--color-success-bg)] border border-[var(--color-success-border)] rounded-[10px] flex items-center gap-3 text-[var(--color-success-fg)] text-xs">
              <CheckCircle2 size={20} className="text-[var(--color-success-fg)] shrink-0" />
              <div>
                <div className="font-semibold text-[var(--color-success-fg)]">Kata Sandi Berhasil Diperbarui!</div>
                <div className="text-[var(--color-success-fg)] mt-0.5">Mengarahkan ke halaman beranda Anda...</div>
              </div>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-3.5">
              {error && (
                <div
                  className="p-3 rounded-[10px] bg-[var(--color-danger-bg)] border border-[var(--color-danger-border)] text-xs text-[var(--color-danger-fg)] flex items-start gap-2 leading-relaxed"
                  role="alert"
                >
                  <AlertCircle size={16} className="shrink-0 text-[var(--color-danger-fg)] mt-0.5" />
                  <span>{error}</span>
                </div>
              )}

              <Input
                id="change-current-password"
                type="password"
                label="Kata Sandi Saat Ini / Bawaan"
                placeholder="Masukkan kata sandi lama"
                value={currentPassword}
                onChange={(e) => {
                  setCurrentPassword(e.target.value);
                  if (fieldErrors.current_password) setFieldErrors({});
                  if (error) setError('');
                }}
                error={fieldErrors.current_password?.[0]}
                icon={Lock}
                disabled={isLoading}
                required
              />

              <Input
                id="change-new-password"
                type="password"
                label="Kata Sandi Baru"
                placeholder="Minimal 8 karakter"
                value={newPassword}
                onChange={(e) => {
                  setNewPassword(e.target.value);
                  if (fieldErrors.new_password) setFieldErrors({});
                  if (error) setError('');
                }}
                error={fieldErrors.new_password?.[0]}
                hint="Gunakan kombinasi huruf, angka, atau simbol"
                icon={Lock}
                disabled={isLoading}
                required
              />

              <Input
                id="change-confirm-password"
                type="password"
                label="Konfirmasi Kata Sandi Baru"
                placeholder="Ulangi kata sandi baru"
                value={confirmPassword}
                onChange={(e) => {
                  setConfirmPassword(e.target.value);
                  if (fieldErrors.new_password_confirmation) setFieldErrors({});
                  if (error) setError('');
                }}
                error={fieldErrors.new_password_confirmation?.[0]}
                icon={Lock}
                disabled={isLoading}
                required
              />

              <div className="space-y-2 pt-2">
                <Button
                  type="submit"
                  variant="primary"
                  size="lg"
                  fullWidth
                  loading={isLoading}
                >
                  Simpan &amp; Lanjutkan ke Beranda
                </Button>

                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  fullWidth
                  onClick={handleCancelLogout}
                  disabled={isLoading}
                  className="text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)]"
                >
                  Batal &amp; Keluar ke Login
                </Button>
              </div>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}
