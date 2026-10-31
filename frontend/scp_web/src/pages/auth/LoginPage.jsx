import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button, Input } from '../../components/shared';
import { useAuth } from '../../hooks/useAuth';
import { ShieldCheck, User, Lock } from 'lucide-react';
import './Login.css';

export default function LoginPage() {
  const navigate = useNavigate();
  const { login, getHomeRoute } = useAuth();

  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  const [fieldErrors, setFieldErrors] = useState({});

  const deviceName = `${navigator.userAgent.includes('Mobile') ? 'Mobile' : 'Web'} Browser (${navigator.platform || 'Desktop'})`;

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
        err.message || 'Kredensial tidak valid. Silakan periksa kembali NIS/NIP dan kata sandi.'
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
            label="ID Pengguna (NIS / NIP / Username)"
            placeholder="Masukkan NIS, NIP, atau username"
            value={username}
            autoComplete="username"
            onChange={(e) => {
              setUsername(e.target.value);
              if (error) setError('');
              if (fieldErrors.username || fieldErrors.nis_nip) setFieldErrors({});
            }}
            error={fieldErrors.username?.[0] || fieldErrors.nis_nip?.[0]}
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

          <div className="login-actions">
            <Button
              type="submit"
              variant="dark"
              size="lg"
              fullWidth
              loading={isLoading}
              icon={ShieldCheck}
            >
              Masuk
            </Button>
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
