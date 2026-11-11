import { NavLink, useLocation } from 'react-router-dom';
import {
  LayoutDashboard,
  Calendar,
  Layers,
  Eye,
  MoreHorizontal,
  BookOpen,
  FileQuestion,
  Home,
  FileText,
  User,
} from 'lucide-react';
import { useAuth } from '../../hooks/useAuth';
import './MobileBottomNav.css';

/**
 * MobileBottomNav — Role-Adaptive Bottom Tab Navigation
 * Strict adherence: Waka Data Import routes are EXCLUDED on Mobile.
 */
export default function MobileBottomNav({ onOpenMore, isMoreOpen = false }) {
  const location = useLocation();
  const { hasRole } = useAuth();

  const getPrimaryTabs = () => {
    if (hasRole('waka')) {
      return [
        {
          id: 'waka-dashboard',
          label: 'Dashboard',
          to: '/web/dashboard',
          icon: LayoutDashboard,
        },
        {
          id: 'waka-schedules',
          label: 'Jadwal',
          to: '/web/schedules',
          icon: Calendar,
        },
        {
          id: 'waka-master',
          label: 'Master Data',
          to: '/web/master-data',
          icon: Layers,
        },
        {
          id: 'waka-monitoring',
          label: 'Monitoring',
          to: '/web/monitoring',
          icon: Eye,
        },
        {
          id: 'more',
          label: 'Lainnya',
          isDrawerTrigger: true,
          icon: MoreHorizontal,
          activePaths: ['/web/academic-calendar', '/web/grade-promotion', '/profile'],
        },
      ];
    }

    if (hasRole('teacher')) {
      return [
        {
          id: 'teacher-dashboard',
          label: 'Dashboard',
          to: '/teacher/dashboard',
          icon: LayoutDashboard,
        },
        {
          id: 'teacher-schedule',
          label: 'Jadwal',
          to: '/teacher/schedule',
          icon: Calendar,
        },
        {
          id: 'teacher-journal',
          label: 'Jurnal KBM',
          to: '/teacher/journal',
          icon: BookOpen,
        },
        {
          id: 'teacher-quiz',
          label: 'Kuis',
          to: '/teacher/quiz',
          icon: FileQuestion,
        },
        {
          id: 'more',
          label: 'Lainnya',
          isDrawerTrigger: true,
          icon: MoreHorizontal,
          activePaths: [
            '/teacher/leave',
            '/teacher/calendar',
            '/teacher/permissions',
            '/web/monitoring',
            '/profile',
          ],
        },
      ];
    }

    if (hasRole('student')) {
      return [
        {
          id: 'student-home',
          label: 'Beranda',
          to: '/student/home',
          icon: Home,
        },
        {
          id: 'student-schedule',
          label: 'Jadwal',
          to: '/student/schedule',
          icon: Calendar,
        },
        {
          id: 'student-permissions',
          label: 'Perizinan',
          to: '/student/permissions',
          icon: FileText,
        },
        {
          id: 'student-quiz',
          label: 'Kuis',
          to: '/student/quiz',
          icon: FileQuestion,
        },
        {
          id: 'student-calendar',
          label: 'Kalender',
          to: '/student/calendar',
          icon: Calendar,
        },
      ];
    }

    if (hasRole('parent')) {
      return [
        {
          id: 'parent-monitoring',
          label: 'Monitoring',
          to: '/parent/monitoring',
          icon: Eye,
        },
        {
          id: 'parent-calendar',
          label: 'Kalender',
          to: '/parent/calendar',
          icon: Calendar,
        },
        {
          id: 'parent-profile',
          label: 'Profil Akun',
          to: '/profile',
          icon: User,
        },
      ];
    }

    return [];
  };

  const tabs = getPrimaryTabs();
  if (tabs.length === 0) return null;

  return (
    <nav className="mobile-bottom-nav" aria-label="Navigasi Utama Mobile">
      <div className="mobile-bottom-nav__inner">
        {tabs.map((tab) => {
          const Icon = tab.icon;

          if (tab.isDrawerTrigger) {
            const isDrawerRouteActive =
              isMoreOpen ||
              (tab.activePaths &&
                tab.activePaths.some((p) => location.pathname.startsWith(p)));

            return (
              <button
                key={tab.id}
                type="button"
                className={[
                  'mobile-bottom-nav__item',
                  isDrawerRouteActive && 'mobile-bottom-nav__item--active',
                ]
                  .filter(Boolean)
                  .join(' ')}
                onClick={onOpenMore}
                aria-expanded={isMoreOpen}
              >
                <span className="mobile-bottom-nav__indicator" />
                <Icon size={20} strokeWidth={1.75} />
                <span className="mobile-bottom-nav__label">{tab.label}</span>
              </button>
            );
          }

          return (
            <NavLink
              key={tab.id}
              to={tab.to}
              className={({ isActive }) =>
                [
                  'mobile-bottom-nav__item',
                  isActive && 'mobile-bottom-nav__item--active',
                ]
                  .filter(Boolean)
                  .join(' ')
              }
            >
              {({ isActive }) => (
                <>
                  <span className="mobile-bottom-nav__indicator" />
                  <Icon size={20} strokeWidth={1.75} aria-hidden="true" />
                  <span
                    className="mobile-bottom-nav__label"
                    aria-current={isActive ? 'page' : undefined}
                  >
                    {tab.label}
                  </span>
                </>
              )}
            </NavLink>
          );
        })}
      </div>
    </nav>
  );
}
