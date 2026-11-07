import { useState, useRef, useEffect, useMemo } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { User, LogOut, HelpCircle, Bell } from 'lucide-react';
import { useAuth } from '../../hooks/useAuth';
import './MobileTopBar.css';

const getPageMeta = (pathname) => {
  const routes = {
    '/web/dashboard': { category: 'Kurikulum & Jadwal', page: 'Dashboard Waka' },
    '/web/academic-calendar': { category: 'Kurikulum & Jadwal', page: 'Kalender Akademik' },
    '/web/schedules': { category: 'Kurikulum & Jadwal', page: 'Jadwal Pelajaran' },
    '/web/master-data': { category: 'Data & Kesiswaan', page: 'Master Data' },
    '/web/grade-promotion': { category: 'Data & Kesiswaan', page: 'Kenaikan Kelas' },
    '/web/monitoring': { category: 'Data & Kesiswaan', page: 'Monitoring & Rekap' },
    '/teacher/dashboard': { category: 'Menu Guru', page: 'Dashboard' },
    '/teacher/calendar': { category: 'Menu Guru', page: 'Kalender Akademik' },
    '/teacher/schedule': { category: 'Menu Guru', page: 'Jadwal Mengajar' },
    '/teacher/journal': { category: 'Menu Guru', page: 'Jurnal KBM & Presensi' },
    '/teacher/leave': { category: 'Menu Guru', page: 'Pengajuan Izin' },
    '/teacher/quiz': { category: 'Menu Guru', page: 'Manajemen Kuis AI' },
    '/teacher/permissions': { category: 'Menu Guru', page: 'Verifikasi Perizinan' },
    '/student/home': { category: 'Menu Siswa', page: 'Beranda Siswa' },
    '/student/calendar': { category: 'Menu Siswa', page: 'Kalender Kegiatan' },
    '/student/schedule': { category: 'Menu Siswa', page: 'Jadwal Pelajaran' },
    '/student/permissions': { category: 'Menu Siswa', page: 'Pengajuan Perizinan' },
    '/student/quiz': { category: 'Menu Siswa', page: 'Pengerjaan Kuis AI' },
    '/parent/monitoring': { category: 'Menu Orang Tua', page: 'Monitoring Anak' },
    '/parent/calendar': { category: 'Menu Orang Tua', page: 'Kalender Sekolah' },
    '/profile': { category: 'Pengaturan', page: 'Profil & Keamanan' },
  };
  return routes[pathname] || { category: 'School Class Progress', page: 'Sistem Akademik' };
};

export default function MobileTopBar() {
  const navigate = useNavigate();
  const location = useLocation();
  const { user, logout, getHomeRoute, hasRole, isKesiswaan, isWaliKelas } = useAuth();
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const dropdownRef = useRef(null);

  const pageMeta = getPageMeta(location.pathname);

  const userName = user?.name;
  const userInitials = useMemo(() => {
    if (!userName) return 'US';
    const parts = userName.trim().split(/\s+/);
    if (parts.length >= 2) {
      return (parts[0][0] + parts[1][0]).toUpperCase();
    }
    return userName.substring(0, 2).toUpperCase();
  }, [userName]);

  useEffect(() => {
    function handleClickOutside(event) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
        setDropdownOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleLogout = async () => {
    setDropdownOpen(false);
    await logout();
    navigate('/login');
  };

  const getRoleLabel = () => {
    if (hasRole('waka')) return 'Waka Kurikulum';
    if (isKesiswaan()) return 'Guru Kesiswaan';
    if (isWaliKelas()) return 'Wali Kelas';
    if (hasRole('teacher')) return 'Guru';
    if (hasRole('student')) return 'Siswa';
    if (hasRole('parent')) return 'Orang Tua';
    return user?.role || 'Pengguna';
  };

  return (
    <header className="mobile-topbar">
      <div className="mobile-topbar__left">
        <button
          type="button"
          className="mobile-topbar__brand-wordmark"
          onClick={() => navigate(getHomeRoute())}
          title={`${pageMeta.category} — ${pageMeta.page}`}
          aria-label={`Ke Beranda Utama — ${pageMeta.page}`}
        >
          SchoolClassProgress
        </button>
      </div>

      <div className="mobile-topbar__right">
        {/* Role Chip on larger mobile/tablet screens */}
        <div className="mobile-topbar__role-pill">
          <span className="mobile-topbar__role-dot" />
          <span>{getRoleLabel()}</span>
        </div>

        {/* Utility Icons: Help & Notification (Inactive UI elements per Phase 1 confirmation) */}
        <div className="mobile-topbar__utilities">
          <button
            type="button"
            className="mobile-topbar__icon-btn"
            title="Pusat Bantuan (Segera Hadir)"
            aria-label="Pusat Bantuan"
            aria-disabled="true"
          >
            <HelpCircle size={17} strokeWidth={1.75} />
          </button>

          <button
            type="button"
            className="mobile-topbar__icon-btn"
            title="Notifikasi (Segera Hadir)"
            aria-label="Notifikasi"
            aria-disabled="true"
          >
            <Bell size={17} strokeWidth={1.75} />
          </button>
        </div>

        {/* User Avatar Dropdown */}
        <div className="mobile-topbar__profile" ref={dropdownRef}>
          <button
            type="button"
            className="mobile-topbar__avatar-btn"
            onClick={() => setDropdownOpen((prev) => !prev)}
            aria-expanded={dropdownOpen}
            aria-label="Menu profil pengguna"
          >
            <span className="mobile-topbar__avatar font-mono">{userInitials}</span>
          </button>

          {dropdownOpen && (
            <div className="mobile-topbar__dropdown" role="menu">
              <div className="mobile-topbar__dropdown-header">
                <div className="mobile-topbar__user-name">{user?.name || 'Pengguna SCP'}</div>
                <div className="mobile-topbar__user-meta font-mono">
                  ID: {user?.nis_nip || user?.username || '-'}
                </div>
                <div className="mobile-topbar__user-badges">
                  <span className="mobile-topbar__mini-badge">{getRoleLabel()}</span>
                  <span className="mobile-topbar__mini-badge font-mono">
                    {user?.academic_year || '2025/2026'}
                  </span>
                </div>
              </div>

              <button
                type="button"
                className="mobile-topbar__dropdown-item"
                onClick={() => {
                  setDropdownOpen(false);
                  navigate('/profile');
                }}
              >
                <User size={15} strokeWidth={1.75} />
                <span>Profil &amp; Keamanan</span>
              </button>

              <button
                type="button"
                className="mobile-topbar__dropdown-item mobile-topbar__dropdown-item--danger"
                onClick={handleLogout}
              >
                <LogOut size={15} strokeWidth={1.75} />
                <span>Keluar Akun</span>
              </button>
            </div>
          )}
        </div>
      </div>
    </header>
  );
}
