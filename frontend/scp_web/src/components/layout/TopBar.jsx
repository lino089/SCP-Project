import { useState, useRef, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { Menu, ChevronDown, User, LogOut, Check } from 'lucide-react';
import { useAuth } from '../../hooks/useAuth';
import './TopBar.css';

const getBreadcrumb = (pathname) => {
  if (pathname.startsWith('/web/review-import')) {
    return { category: 'Kurikulum & Jadwal', page: 'Review Import' };
  }
  const routes = {
    '/web/dashboard': { category: 'Kurikulum & Jadwal', page: 'Dashboard' },
    '/web/schedules': { category: 'Kurikulum & Jadwal', page: 'Jadwal Pelajaran' },
    '/web/upload-import': { category: 'Kurikulum & Jadwal', page: 'Import Jadwal PDF' },
    '/web/review-import': { category: 'Kurikulum & Jadwal', page: 'Review Import' },
    '/web/master-data': { category: 'Data & Kesiswaan', page: 'Master Data' },
    '/web/grade-promotion': { category: 'Data & Kesiswaan', page: 'Kenaikan Kelas' },
    '/web/monitoring': { category: 'Data & Kesiswaan', page: 'Monitoring & Rekap' },
    '/teacher/schedule': { category: 'Menu Guru', page: 'Jadwal Mengajar' },
    '/teacher/journal': { category: 'Menu Guru', page: 'Jurnal KBM & Presensi' },
    '/teacher/quiz': { category: 'Menu Guru', page: 'Manajemen Kuis AI' },
    '/teacher/permissions': { category: 'Menu Guru', page: 'Verifikasi Perizinan' },
    '/student/home': { category: 'Menu Siswa', page: 'Beranda & Presensi' },
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
  const { user, logout, loginWithDemo, getHomeRoute, hasRole, isKesiswaan } = useAuth();
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const dropdownRef = useRef(null);

  const breadcrumb = getBreadcrumb(location.pathname);

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

  const handleSelectDemoRole = (roleKey) => {
    loginWithDemo(roleKey);
    setDropdownOpen(false);
    setTimeout(() => {
      navigate(getHomeRoute());
    }, 50);
  };

  const getInitials = (name) => {
    if (!name) return 'SC';
    const parts = name.trim().split(' ');
    if (parts.length >= 2) {
      return (parts[0][0] + parts[1][0]).toUpperCase();
    }
    return name.slice(0, 2).toUpperCase();
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
          <Menu size={18} />
        </button>

        <div
          className="web-topbar__brand"
          onClick={() => navigate(getHomeRoute())}
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
        <div className="web-topbar__role-chip hidden sm:inline-flex items-center gap-1.5 px-2.5 py-1 rounded bg-gray-100 text-gray-800 text-[11.5px] font-medium">
          <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
          <span>{getRoleLabel()}</span>
        </div>

        <div className="web-topbar__profile-wrapper" ref={dropdownRef}>
          <button
            type="button"
            className="web-topbar__profile-trigger"
            onClick={() => setDropdownOpen(!dropdownOpen)}
            aria-expanded={dropdownOpen}
          >
            <div className="web-topbar__avatar">{getInitials(user?.name)}</div>
            <span className="text-xs font-medium text-gray-700 hidden lg:inline max-w-[120px] truncate">
              {user?.name || 'Akun'}
            </span>
            <ChevronDown size={14} className="text-gray-400" />
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
                <User size={14} />
                <span>Profil &amp; Keamanan</span>
              </button>

              {/* Demo Role Quick Switcher for UKK Evaluator */}
              <div className="p-2 border-t border-b border-gray-100 my-1 bg-gray-50/70 rounded">
                <div className="text-[10px] font-semibold text-gray-400 uppercase tracking-wider mb-1 px-1">
                  Uji Cepat Peran (UKK)
                </div>
                {[
                  { id: 'waka', label: 'Waka Kurikulum' },
                  { id: 'teacher', label: 'Guru' },
                  { id: 'kesiswaan', label: 'Guru Kesiswaan' },
                  { id: 'student', label: 'Siswa' },
                  { id: 'parent', label: 'Orang Tua' },
                ].map((item) => {
                  const isActive =
                    (item.id === 'waka' && hasRole('waka')) ||
                    (item.id === 'student' && hasRole('student')) ||
                    (item.id === 'parent' && hasRole('parent')) ||
                    (item.id === 'kesiswaan' && isKesiswaan()) ||
                    (item.id === 'teacher' && hasRole('teacher') && !isKesiswaan());

                  return (
                    <button
                      key={item.id}
                      type="button"
                      className="w-full flex items-center justify-between px-2 py-1 text-xs text-gray-700 hover:bg-white rounded transition-colors text-left"
                      onClick={() => handleSelectDemoRole(item.id)}
                    >
                      <span>{item.label}</span>
                      {isActive && <Check size={12} className="text-gray-900 font-bold" />}
                    </button>
                  );
                })}
              </div>

              <button
                type="button"
                className="web-topbar__dropdown-item text-red-600 hover:bg-red-50 hover:text-red-700"
                onClick={handleLogout}
              >
                <LogOut size={14} />
                <span>Keluar Akun</span>
              </button>
            </div>
          )}
        </div>
      </div>
    </header>
  );
}
