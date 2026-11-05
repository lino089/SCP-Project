import { useState, useEffect, useRef } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { Button, Input } from '../../components/shared';
import { useAuth } from '../../hooks/useAuth';
import { useGoogleAuth } from '../../hooks/useGoogleAuth';
import { User, Lock } from 'lucide-react';
import './Login.css';

export default function LoginPage() {
  const navigate = useNavigate();
  const { login, loginWithGoogle, getHomeRoute } = useAuth();
  const { isLoaded: isGoogleLoaded, renderGoogleButton } = useGoogleAuth();

  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  const [fieldErrors, setFieldErrors] = useState({});
  const googleLoginBtnRef = useRef(null);

  const deviceName = `${navigator.userAgent.includes('Mobile') ? 'Mobile' : 'Web'} Browser (${navigator.platform || 'Desktop'})`;

  const handleGoogleSuccess = async (credential) => {
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
  };

  useEffect(() => {
    if (isGoogleLoaded && googleLoginBtnRef.current) {
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
  }, [isGoogleLoaded, renderGoogleButton]);

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

  return (
    <div className="login-page">
      <div className="login-card">
        {/* Header */}
        <div className="login-header">
          <span className="login-brand-text">School Class Progress</span>
          <h1 className="login-title">Masuk ke Portal</h1>
          <p className="login-subtitle">
            Sistem Informasi KBM, Presensi, dan Pengelolaan Jadwal Terpadu.
          </p>
        </div>

        {/* Error Banner */}
        {error && (
          <div className="login-error" role="alert">
            {error}
          </div>
        )}

        {/* Login Form */}
        <form onSubmit={handleSubmit} className="login-form">
          <Input
            label="ID Pengguna"
            placeholder="Masukkan NIS (Siswa), No. Telepon (Guru), atau NIP"
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

        {/* Device Information */}
        <div className="login-device-info">
          Perangkat terdeteksi: <strong className="font-mono text-gray-400">{deviceName}</strong>
        </div>
      </div>
    </div>
  );
}
