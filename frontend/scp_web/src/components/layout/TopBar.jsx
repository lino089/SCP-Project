import { useState, useRef, useEffect, useMemo } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { Menu, User, LogOut, Sun, HelpCircle, Bell } from 'lucide-react';
import { useAuth } from '../../hooks/useAuth';
import './TopBar.css';

const getBreadcrumb = (pathname) => {
  if (
    pathname.startsWith('/kurikulum/jadwal/import') ||
    pathname.startsWith('/web/schedule-import') ||
    pathname.startsWith('/web/upload-import') ||
    pathname.startsWith('/web/review-import')
  ) {
    return { category: 'Kurikulum & Jadwal', page: 'Import Jadwal' };
  }
  const routes = {
    '/web/dashboard': { category: 'Kurikulum & Jadwal', page: 'Dashboard' },
    '/web/schedules': { category: 'Kurikulum & Jadwal', page: 'Jadwal Pelajaran' },
    '/kurikulum/jadwal/import': { category: 'Kurikulum & Jadwal', page: 'Import Jadwal' },
    '/web/upload-import': { category: 'Kurikulum & Jadwal', page: 'Import Jadwal' },
    '/web/review-import': { category: 'Kurikulum & Jadwal', page: 'Import Jadwal' },
    '/web/master-data': { category: 'Data & Kesiswaan', page: 'Master Data' },
    '/web/grade-promotion': { category: 'Data & Kesiswaan', page: 'Kenaikan Kelas' },
    '/web/monitoring': { category: 'Data & Kesiswaan', page: 'Monitoring & Rekap' },
    '/teacher/dashboard': { category: 'Menu Guru', page: 'Dashboard' },
    '/teacher/schedule': { category: 'Menu Guru', page: 'Jadwal Mengajar' },
    '/teacher/journal': { category: 'Menu Guru', page: 'Jurnal KBM & Presensi' },
    '/teacher/leave': { category: 'Menu Guru', page: 'Pengajuan Izin' },
    '/teacher/quiz': { category: 'Menu Guru', page: 'Manajemen Kuis AI' },
    '/teacher/permissions': { category: 'Menu Guru', page: 'Verifikasi Perizinan' },
    '/student/home': { category: 'Menu Siswa', page: 'Beranda' },
    '/student/schedule': { category: 'Menu Siswa', page: 'Jadwal Pelajaran' },
    '/student/permissions': { category: 'Menu Siswa', page: 'Pengajuan Perizinan' },
    '/student/quiz': { category: 'Menu Siswa', page: 'Pengerjaan Kuis AI' },
    '/parent/monitoring': { category: 'Menu Orang Tua', page: 'Monitoring Anak' },
    '/profile': { category: 'Pengaturan', page: 'Profil & Akun' },
  };
  return routes[pathname] || { category: 'Sistem', page: 'Akademik' };
};

export default function TopBar({ onToggleSidebar }) {
  const navigate = useNavigate();
  const location = useLocation();
  const { user, logout, getHomeRoute, hasRole, isKesiswaan } = useAuth();
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const dropdownRef = useRef(null);

  const breadcrumb = getBreadcrumb(location.pathname);

  // Dynamic avatar initials helper
  const userName = user?.name;
  const userInitials = useMemo(() => {
    if (!userName) return 'US';
    const parts = userName.trim().split(/\s+/);
    if (parts.length >= 2) {
      return (parts[0][0] + parts[1][0]).toUpperCase();
    }
    return userName.substring(0, 2).toUpperCase();
  }, [userName]);

  // Click outside listener for dropdown
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

  const handleToggleTheme = () => {
    document.documentElement.classList.toggle('dark');
  };

  const getRoleLabel = () => {
    if (hasRole('waka')) return 'Waka Kurikulum';
    if (isKesiswaan()) return 'Guru Kesiswaan';
    if (hasRole('teacher')) return 'Guru';
    if (hasRole('student')) return 'Siswa';
    if (hasRole('parent')) return 'Orang Tua';
    return user?.role || 'Pengguna';
  };

  return (
    <header className="web-topbar">
      <div className="web-topbar__left">
        <button
          type="button"
          className="web-topbar__menu-btn"
          onClick={onToggleSidebar}
          aria-label="Toggle navigasi menu"
        >
          <Menu size={18} strokeWidth={1.5} />
        </button>

        <div
          className="web-topbar__brand"
          onClick={() => navigate(getHomeRoute())}
          onKeyDown={(e) => {
            if (e.key === 'Enter' || e.key === ' ') {
              e.preventDefault();
              navigate(getHomeRoute());
            }
          }}
          role="button"
          tabIndex={0}
        >
          <span className="web-topbar__brand-name text-base sm:text-lg font-bold tracking-tight truncate max-w-[180px] sm:max-w-none cursor-pointer">
            School Class Progress
          </span>
        </div>

        <div className="hidden md:flex items-center text-[13px] font-medium select-none ml-1">
          <span className="text-gray-300 mx-2 font-normal">/</span>
          <span className="text-gray-500 font-normal">{breadcrumb.category}</span>
          <span className="text-gray-300 mx-1.5 font-normal">/</span>
          <span className="text-gray-900 font-semibold">{breadcrumb.page}</span>
        </div>
      </div>

      <div className="web-topbar__right">
        {/* Role Chip */}
        <div className="web-topbar__role-chip hidden sm:inline-flex items-center gap-1.5 px-2.5 py-1 rounded bg-gray-50 border border-gray-200 text-gray-800 text-[11.5px] font-medium">
          <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
          <span>{getRoleLabel()}</span>
        </div>

        {/* Academic Year & Semester Badge */}
        <div className="web-topbar__academic-badge hidden md:inline-flex items-center px-2.5 py-1 rounded border border-gray-200 bg-white text-gray-700 text-[11.5px] font-mono font-medium">
          2025/2026 Ganjil
        </div>

        {/* Utility Bar */}
        <div className="web-topbar__utility-group flex items-center gap-0.5">
          <button
            type="button"
            className="web-topbar__icon-btn"
            title="Toggle Tema"
            aria-label="Toggle tema"
            onClick={handleToggleTheme}
          >
            <Sun size={16} strokeWidth={1.5} />
          </button>
          <button
            type="button"
            className="web-topbar__icon-btn"
            title="Pusat Bantuan &amp; FAQ"
            aria-label="Pusat bantuan"
          >
            <HelpCircle size={16} strokeWidth={1.5} />
          </button>
          <button
            type="button"
            className="web-topbar__icon-btn"
            title="Notifikasi"
            aria-label="Notifikasi"
          >
            <Bell size={16} strokeWidth={1.5} />
          </button>
        </div>

        {/* User Profile Avatar Trigger */}
        <div className="web-topbar__profile-wrapper" ref={dropdownRef}>
          <button
            type="button"
            className="web-topbar__profile-trigger"
            onClick={() => setDropdownOpen(!dropdownOpen)}
            aria-expanded={dropdownOpen}
            aria-label="Menu profil pengguna"
          >
            <div className="web-topbar__avatar">{userInitials}</div>
          </button>

          {dropdownOpen && (
            <div className="web-topbar__dropdown" role="menu">
              <div className="p-3 border-b border-gray-100 mb-1">
                <div className="text-xs font-semibold text-gray-900 truncate">{user?.name}</div>
                <div className="text-[11px] font-mono text-gray-500 mt-0.5">
                  ID: {user?.nis_nip || user?.username || '-'}
                </div>
              </div>

              <button
                type="button"
                className="web-topbar__dropdown-item"
                onClick={() => {
                  setDropdownOpen(false);
                  navigate('/profile');
                }}
              >
                <User size={14} strokeWidth={1.5} />
                <span>Profil &amp; Keamanan</span>
              </button>

              <button
                type="button"
                className="web-topbar__dropdown-item text-red-600 hover:bg-red-50 hover:text-red-700"
                onClick={handleLogout}
              >
                <LogOut size={14} strokeWidth={1.5} />
                <span>Keluar Akun</span>
              </button>
            </div>
          )}
        </div>
      </div>
    </header>
  );
}
