import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button, Input } from '../../components/shared';
import { useAuth } from '../../hooks/useAuth';
import { ShieldCheck, User, Lock, Sparkles } from 'lucide-react';
import './Login.css';

const DEMO_PRESETS = [
  {
    key: 'waka',
    label: 'Waka Kurikulum',
    desc: 'Pengelolaan kurikulum, jadwal, dan master data',
    username: '12345678',
    password: 'password',
  },
  {
    key: 'teacher',
    label: 'Guru Pengampu / Wali Kelas',
    desc: 'Jadwal mengajar KBM, jurnal harian, dan presensi kelas',
    username: '197803122005011002',
    password: 'password123',
  },
  {
    key: 'kesiswaan',
    label: 'Guru Kesiswaan (Piket)',
    desc: 'Ambil alih kelas guru izin, penampil tugas titipan & piket',
    username: '198211102008011005',
    password: 'password123',
  },
  {
    key: 'student',
    label: 'Siswa',
    desc: 'Presensi harian, kuis AI interaktif, dan pengajuan izin',
    username: '2024001',
    password: 'password123',
  },
  {
    key: 'parent',
    label: 'Orang Tua / Wali',
    desc: 'Monitoring presensi, izin, dan hasil evaluasi anak',
    username: 'W-2024001',
    password: 'password123',
  },
];

export default function LoginPage() {
  const navigate = useNavigate();
  const { login, loginWithDemo, getHomeRoute } = useAuth();

  const [selectedDemo, setSelectedDemo] = useState('waka');
  const [username, setUsername] = useState('12345678');
  const [password, setPassword] = useState('password');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  const [fieldErrors, setFieldErrors] = useState({});

  const deviceName = `${navigator.userAgent.includes('Mobile') ? 'Mobile' : 'Web'} Browser (${navigator.platform || 'Desktop'})`;

  const handleSelectPreset = (preset) => {
    setSelectedDemo(preset.key);
    setUsername(preset.username);
    setPassword(preset.password);
    setError('');
    setFieldErrors({});
  };

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

  const handleQuickDemoLogin = (e) => {
    e.preventDefault();
    loginWithDemo(selectedDemo);
    setTimeout(() => {
      navigate(getHomeRoute(), { replace: true });
    }, 50);
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

        {/* Demo Role Selector */}
        <div className="login-role-section">
          <label className="login-role-label">Pilih Peran Akun (Preset Demo):</label>
          <div className="login-role-list">
            {DEMO_PRESETS.map((preset) => {
              const isActive = selectedDemo === preset.key;
              return (
                <button
                  key={preset.key}
                  type="button"
                  className={`login-role-item ${isActive ? 'login-role-item--active' : ''}`}
                  onClick={() => handleSelectPreset(preset)}
                >
                  <div className="login-role-item__radio">
                    {isActive && <div className="login-role-item__radio-dot" />}
                  </div>
                  <div className="login-role-item__content">
                    <span className="login-role-item__name">{preset.label}</span>
                    <span className="login-role-item__desc">{preset.desc}</span>
                  </div>
                </button>
              );
            })}
          </div>
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
              Masuk dengan Kredensial
            </Button>

            <Button
              type="button"
              variant="secondary"
              size="md"
              fullWidth
              onClick={handleQuickDemoLogin}
              icon={Sparkles}
            >
              Masuk Cepat Mode Demo
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
