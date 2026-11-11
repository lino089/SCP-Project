import { useState, useRef, useEffect, useMemo, useCallback } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { Menu, User, LogOut, Sun, Moon, HelpCircle, Bell, AlertTriangle, CheckCircle2 } from 'lucide-react';
import { useAuth } from '../../hooks/useAuth';
import useTheme from '../../hooks/useTheme';
import { notificationApi } from '../../services/notificationApi';
import { unwrapList } from '../../utils/responseHelper';
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
  if (pathname.startsWith('/student/quiz/')) {
    return { category: 'Menu Siswa', page: 'Kuis & Evaluasi' };
  }
  const routes = {
    '/web/dashboard': { category: 'Kurikulum & Jadwal', page: 'Dashboard' },
    '/web/academic-calendar': { category: 'Kurikulum & Jadwal', page: 'Kalender Akademik' },
    '/web/schedules': { category: 'Kurikulum & Jadwal', page: 'Jadwal Pelajaran' },
    '/kurikulum/jadwal/import': { category: 'Kurikulum & Jadwal', page: 'Import Jadwal' },
    '/web/upload-import': { category: 'Kurikulum & Jadwal', page: 'Import Jadwal' },
    '/web/review-import': { category: 'Kurikulum & Jadwal', page: 'Import Jadwal' },
    '/web/master-data': { category: 'Data & Kesiswaan', page: 'Master Data' },
    '/web/grade-promotion': { category: 'Data & Kesiswaan', page: 'Kenaikan Kelas' },
    '/web/alumni': { category: 'Data & Kesiswaan', page: 'Database Alumni' },
    '/web/monitoring': { category: 'Data & Kesiswaan', page: 'Monitoring & Rekap' },
    '/teacher/dashboard': { category: 'Menu Guru', page: 'Dashboard' },
    '/teacher/calendar': { category: 'Menu Guru', page: 'Kalender Akademik' },
    '/teacher/schedule': { category: 'Menu Guru', page: 'Jadwal Mengajar' },
    '/teacher/journal': { category: 'Menu Guru', page: 'Jurnal KBM & Presensi' },
    '/teacher/leave': { category: 'Menu Guru', page: 'Pengajuan Izin' },
    '/teacher/permissions': { category: 'Data & Kesiswaan', page: 'Verifikasi Izin Siswa' },
    '/teacher/leave-approvals': { category: 'Data & Kesiswaan', page: 'Konfirmasi Izin Guru' },
    '/teacher/attendance-recap': { category: 'Menu Guru', page: 'Rekap Presensi Siswa' },
    '/teacher/quiz': { category: 'Menu Guru', page: 'Kuis AI & Bank Soal' },
    '/teacher/quiz/create': { category: 'Menu Guru', page: 'Buat Kuis Baru' },
    '/student/home': { category: 'Menu Siswa', page: 'Beranda' },
    '/student/calendar': { category: 'Menu Siswa', page: 'Kalender Akademik' },
    '/student/schedule': { category: 'Menu Siswa', page: 'Jadwal Pelajaran' },
    '/student/permissions': { category: 'Menu Siswa', page: 'Pengajuan Perizinan' },
    '/student/quiz': { category: 'Menu Siswa', page: 'Kuis & Evaluasi' },
    '/parent/monitoring': { category: 'Menu Orang Tua', page: 'Monitoring Anak' },
    '/parent/calendar': { category: 'Menu Orang Tua', page: 'Kalender Akademik' },
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

  // In-App Notification State & Ref
  const [notificationOpen, setNotificationOpen] = useState(false);
  const notificationRef = useRef(null);
  const [notifications, setNotifications] = useState([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [loadingNotifs, setLoadingNotifs] = useState(false);

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

  // Click outside listener for dropdowns
  useEffect(() => {
    function handleClickOutside(event) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
        setDropdownOpen(false);
      }
      if (notificationRef.current && !notificationRef.current.contains(event.target)) {
        setNotificationOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Fetch notifications
  const fetchNotifications = useCallback(async () => {
    if (!user) return;
    try {
      setLoadingNotifs(true);
      const res = await notificationApi.getNotifications();
      const list = unwrapList(res);
      setNotifications(list);
      setUnreadCount(res.data?.meta?.unread_count ?? list.filter((n) => !n.read_at).length);
    } catch (err) {
      console.debug('Failed loading notifications', err);
    } finally {
      setLoadingNotifs(false);
    }
  }, [user]);

  useEffect(() => {
    fetchNotifications();
    const interval = setInterval(fetchNotifications, 30000);
    return () => clearInterval(interval);
  }, [fetchNotifications]);

  const handleMarkAllRead = async () => {
    try {
      await notificationApi.markAllAsRead();
      setNotifications((prev) =>
        prev.map((n) => ({ ...n, read_at: n.read_at || new Date().toISOString() }))
      );
      setUnreadCount(0);
    } catch (err) {
      console.warn('Gagal menandai semua notifikasi dibaca:', err);
    }
  };

  const handleNotificationClick = async (notif) => {
    try {
      if (!notif.read_at) {
        await notificationApi.markAsRead(notif.id);
        setNotifications((prev) =>
          prev.map((n) => (n.id === notif.id ? { ...n, read_at: new Date().toISOString() } : n))
        );
        setUnreadCount((c) => Math.max(0, c - 1));
      }
    } catch (err) {
      console.warn('Gagal menandai notifikasi dibaca:', err);
    } finally {
      setNotificationOpen(false);
      if (notif.action_url) {
        navigate(notif.action_url, {
          state: notif.data?.schedule_id ? { scheduleId: notif.data.schedule_id } : undefined,
        });
      }
    }
  };

  const formatRelativeTime = (isoString) => {
    if (!isoString) return '';
    const diffSec = Math.floor((new Date() - new Date(isoString)) / 1000);
    if (diffSec < 60) return 'Baru saja';
    const diffMin = Math.floor(diffSec / 60);
    if (diffMin < 60) return `${diffMin}m lalu`;
    const diffHours = Math.floor(diffMin / 60);
    if (diffHours < 24) return `${diffHours}j lalu`;
    const diffDays = Math.floor(diffHours / 24);
    return `${diffDays}h lalu`;
  };

  const handleLogout = async () => {
    setDropdownOpen(false);
    await logout();
    navigate('/login');
  };

  const { isDark, toggleTheme } = useTheme();

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
          <span className="web-topbar__brand-name text-base sm:text-lg font-bold tracking-tight truncate cursor-pointer">
            School Class Progress
          </span>
        </div>

        <div className="hidden lg:flex items-center text-[13px] font-medium select-none ml-1">
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
          {user?.academic_year || '2025/2026 Ganjil'}
        </div>

        {/* Utility Bar */}
        <div className="web-topbar__utility-group flex items-center gap-0.5">
          <button
            type="button"
            className="web-topbar__icon-btn"
            title={isDark ? 'Aktifkan mode terang' : 'Aktifkan mode gelap'}
            aria-label={isDark ? 'Aktifkan mode terang' : 'Aktifkan mode gelap'}
            onClick={toggleTheme}
          >
            {isDark ? <Moon size={16} strokeWidth={1.5} /> : <Sun size={16} strokeWidth={1.5} />}
          </button>
          <button
            type="button"
            className="web-topbar__icon-btn web-topbar__icon-btn--secondary"
            title="Pusat Bantuan &amp; FAQ"
            aria-label="Pusat bantuan"
          >
            <HelpCircle size={16} strokeWidth={1.5} />
          </button>
          {/* Notification Bell with Dropdown Popover */}
          <div className="web-topbar__notification-wrapper" ref={notificationRef}>
            <button
              type="button"
              className="web-topbar__icon-btn relative"
              title="Notifikasi"
              aria-label="Notifikasi"
              aria-expanded={notificationOpen}
              onClick={() => setNotificationOpen(!notificationOpen)}
            >
              <Bell size={16} strokeWidth={1.5} />
              {unreadCount > 0 && (
                <span className="web-topbar__unread-badge">
                  {unreadCount > 9 ? '9+' : unreadCount}
                </span>
              )}
            </button>

            {notificationOpen && (
              <div className="web-topbar__notif-dropdown" role="menu">
                <div className="web-topbar__notif-header">
                  <div className="flex items-center gap-2">
                    <span className="font-semibold text-xs text-gray-900">Notifikasi</span>
                    {unreadCount > 0 && (
                      <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-amber-100 text-amber-800 border border-amber-200">
                        {unreadCount} baru
                      </span>
                    )}
                  </div>
                  {unreadCount > 0 && (
                    <button
                      type="button"
                      className="text-[11px] font-medium text-blue-600 hover:text-blue-700 cursor-pointer"
                      onClick={handleMarkAllRead}
                    >
                      Tandai semua dibaca
                    </button>
                  )}
                </div>

                <div className="web-topbar__notif-list">
                  {loadingNotifs ? (
                    <div className="p-4 text-center text-xs text-gray-400">Memuat notifikasi...</div>
                  ) : notifications.length === 0 ? (
                    <div className="p-6 text-center flex flex-col items-center">
                      <CheckCircle2 size={24} className="text-gray-300 mb-1.5" />
                      <span className="text-xs font-semibold text-gray-700">Tidak ada notifikasi</span>
                      <span className="text-[11px] text-gray-400 mt-0.5">
                        Semua pesan dan pengingat KBM sudah bersih
                      </span>
                    </div>
                  ) : (
                    notifications.map((notif) => {
                      const isUnread = !notif.read_at;
                      return (
                        <div
                          key={notif.id}
                          className={`web-topbar__notif-item ${
                            isUnread ? 'web-topbar__notif-item--unread' : ''
                          }`}
                          onClick={() => handleNotificationClick(notif)}
                          role="button"
                          tabIndex={0}
                        >
                          <div className="web-topbar__notif-item-icon">
                            {notif.type === 'journal_reminder' ? (
                              <AlertTriangle size={15} className="text-amber-600 shrink-0" />
                            ) : (
                              <Bell size={15} className="text-blue-600 shrink-0" />
                            )}
                          </div>
                          <div className="web-topbar__notif-item-content">
                            <div className="web-topbar__notif-item-top">
                              <span className="font-semibold text-xs text-gray-900">
                                {notif.title}
                              </span>
                              {isUnread && <span className="web-topbar__notif-dot" />}
                            </div>
                            <p className="text-[11px] text-gray-600 mt-0.5 line-clamp-2 leading-relaxed">
                              {notif.message}
                            </p>
                            <div className="flex items-center gap-2 mt-1.5 text-[10px] text-gray-400 font-mono">
                              <span>{formatRelativeTime(notif.created_at)}</span>
                              {notif.sender?.name && (
                                <>
                                  <span>&bull;</span>
                                  <span>Dari: {notif.sender.name}</span>
                                </>
                              )}
                            </div>
                          </div>
                        </div>
                      );
                    })
                  )}
                </div>
              </div>
            )}
          </div>
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
