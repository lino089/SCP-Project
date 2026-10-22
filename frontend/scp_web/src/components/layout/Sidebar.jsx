import { useState } from 'react';
import { NavLink, useNavigate } from 'react-router-dom';
import {
  Calendar,
  Layers,
  ChevronDown,
  LogOut,
  X,
  BookOpen,
  FileQuestion,
  FileText,
  Home,
  UserCheck,
  Eye,
  User,
} from 'lucide-react';
import { useAuth } from '../../hooks/useAuth';
import './Sidebar.css';

export default function Sidebar({ isOpen = false, onClose }) {
  const navigate = useNavigate();
  const { user, hasRole, isKesiswaan, logout } = useAuth();

  // Accordion state for Waka Kurikulum menu groups
  const [openGroups, setOpenGroups] = useState({
    academic: true,
    data: true,
  });

  const toggleGroup = (key) => {
    setOpenGroups((prev) => ({ ...prev, [key]: !prev[key] }));
  };

  const handleLogout = async () => {
    onClose?.();
    await logout();
    navigate('/login');
  };

  const renderNavLinks = () => {
    if (hasRole('waka')) {
      return (
        <>
          {/* GROUP 1: Kurikulum & Jadwal */}
          <div className="web-sidebar__group">
            <button
              type="button"
              className="web-sidebar__group-header"
              onClick={() => toggleGroup('academic')}
            >
              <div className="web-sidebar__group-title">
                <Calendar size={16} strokeWidth={1.5} className="web-sidebar__group-icon" />
                <span>Kurikulum &amp; Jadwal</span>
              </div>
              <ChevronDown
                size={14}
                strokeWidth={1.5}
                className={`web-sidebar__group-chevron ${openGroups.academic ? 'web-sidebar__group-chevron--open' : ''}`}
              />
            </button>

            {openGroups.academic && (
              <div className="web-sidebar__submenu">
                <NavLink
                  to="/web/dashboard"
                  className={({ isActive }) =>
                    `web-sidebar__sublink ${isActive ? 'web-sidebar__sublink--active' : ''}`
                  }
                  onClick={() => onClose?.()}
                >
                  Dashboard
                </NavLink>

                <NavLink
                  to="/web/schedules"
                  className={({ isActive }) =>
                    `web-sidebar__sublink ${isActive ? 'web-sidebar__sublink--active' : ''}`
                  }
                  onClick={() => onClose?.()}
                >
                  Jadwal Pelajaran
                </NavLink>

                <NavLink
                  to="/web/upload-import"
                  className={({ isActive }) =>
                    `web-sidebar__sublink ${isActive ? 'web-sidebar__sublink--active' : ''}`
                  }
                  onClick={() => onClose?.()}
                >
                  Import Jadwal PDF
                </NavLink>

                <NavLink
                  to="/web/review-import"
                  className={({ isActive }) =>
                    `web-sidebar__sublink ${isActive ? 'web-sidebar__sublink--active' : ''}`
                  }
                  onClick={() => onClose?.()}
                >
                  Review Import
                </NavLink>
              </div>
            )}
          </div>

          {/* GROUP 2: Data & Kesiswaan */}
          <div className="web-sidebar__group">
            <button
              type="button"
              className="web-sidebar__group-header"
              onClick={() => toggleGroup('data')}
            >
              <div className="web-sidebar__group-title">
                <Layers size={16} strokeWidth={1.5} className="web-sidebar__group-icon" />
                <span>Data &amp; Kesiswaan</span>
              </div>
              <ChevronDown
                size={14}
                strokeWidth={1.5}
                className={`web-sidebar__group-chevron ${openGroups.data ? 'web-sidebar__group-chevron--open' : ''}`}
              />
            </button>

            {openGroups.data && (
              <div className="web-sidebar__submenu">
                <NavLink
                  to="/web/master-data"
                  className={({ isActive }) =>
                    `web-sidebar__sublink ${isActive ? 'web-sidebar__sublink--active' : ''}`
                  }
                  onClick={() => onClose?.()}
                >
                  Master Data
                </NavLink>

                <NavLink
                  to="/web/grade-promotion"
                  className={({ isActive }) =>
                    `web-sidebar__sublink ${isActive ? 'web-sidebar__sublink--active' : ''}`
                  }
                  onClick={() => onClose?.()}
                >
                  Kenaikan Kelas
                </NavLink>

                <NavLink
                  to="/web/monitoring"
                  className={({ isActive }) =>
                    `web-sidebar__sublink ${isActive ? 'web-sidebar__sublink--active' : ''}`
                  }
                  onClick={() => onClose?.()}
                >
                  Monitoring &amp; Rekap
                </NavLink>
              </div>
            )}
          </div>
        </>
      );
    }

    if (hasRole('teacher')) {
      return (
        <>
          <div className="px-3 py-1.5 text-[11px] font-semibold text-gray-400 uppercase tracking-wider">
            Menu Guru {isKesiswaan() ? '& Kesiswaan' : ''}
          </div>

          <NavLink
            to="/teacher/schedule"
            className={({ isActive }) =>
              `web-sidebar__mainlink ${isActive ? 'web-sidebar__mainlink--active' : ''}`
            }
            onClick={() => onClose?.()}
          >
            <Calendar size={16} strokeWidth={1.5} />
            <span>Jadwal Mengajar</span>
          </NavLink>

          <NavLink
            to="/teacher/journal"
            className={({ isActive }) =>
              `web-sidebar__mainlink ${isActive ? 'web-sidebar__mainlink--active' : ''}`
            }
            onClick={() => onClose?.()}
          >
            <BookOpen size={16} strokeWidth={1.5} />
            <span>Jurnal KBM &amp; Presensi</span>
          </NavLink>

          <NavLink
            to="/teacher/quiz"
            className={({ isActive }) =>
              `web-sidebar__mainlink ${isActive ? 'web-sidebar__mainlink--active' : ''}`
            }
            onClick={() => onClose?.()}
          >
            <FileQuestion size={16} strokeWidth={1.5} />
            <span>Manajemen Kuis AI</span>
          </NavLink>

          <NavLink
            to="/teacher/permissions"
            className={({ isActive }) =>
              `web-sidebar__mainlink ${isActive ? 'web-sidebar__mainlink--active' : ''}`
            }
            onClick={() => onClose?.()}
          >
            <UserCheck size={16} strokeWidth={1.5} />
            <span>Verifikasi Perizinan</span>
          </NavLink>

          {isKesiswaan() && (
            <NavLink
              to="/web/monitoring"
              className={({ isActive }) =>
                `web-sidebar__mainlink ${isActive ? 'web-sidebar__mainlink--active' : ''}`
              }
              onClick={() => onClose?.()}
            >
              <Eye size={16} strokeWidth={1.5} />
              <span>Monitoring Kesiswaan</span>
            </NavLink>
          )}
        </>
      );
    }

    if (hasRole('student')) {
      return (
        <>
          <div className="px-3 py-1.5 text-[11px] font-semibold text-gray-400 uppercase tracking-wider">
            Menu Siswa
          </div>

          <NavLink
            to="/student/home"
            className={({ isActive }) =>
              `web-sidebar__mainlink ${isActive ? 'web-sidebar__mainlink--active' : ''}`
            }
            onClick={() => onClose?.()}
          >
            <Home size={16} strokeWidth={1.5} />
            <span>Beranda &amp; Presensi</span>
          </NavLink>

          <NavLink
            to="/student/permissions"
            className={({ isActive }) =>
              `web-sidebar__mainlink ${isActive ? 'web-sidebar__mainlink--active' : ''}`
            }
            onClick={() => onClose?.()}
          >
            <FileText size={16} strokeWidth={1.5} />
            <span>Pengajuan Perizinan</span>
          </NavLink>

          <NavLink
            to="/student/quiz"
            className={({ isActive }) =>
              `web-sidebar__mainlink ${isActive ? 'web-sidebar__mainlink--active' : ''}`
            }
            onClick={() => onClose?.()}
          >
            <FileQuestion size={16} strokeWidth={1.5} />
            <span>Pengerjaan Kuis AI</span>
          </NavLink>
        </>
      );
    }

    if (hasRole('parent')) {
      return (
        <>
          <div className="px-3 py-1.5 text-[11px] font-semibold text-gray-400 uppercase tracking-wider">
            Menu Orang Tua
          </div>

          <NavLink
            to="/parent/monitoring"
            className={({ isActive }) =>
              `web-sidebar__mainlink ${isActive ? 'web-sidebar__mainlink--active' : ''}`
            }
            onClick={() => onClose?.()}
          >
            <Eye size={16} strokeWidth={1.5} />
            <span>Monitoring Anak</span>
          </NavLink>
        </>
      );
    }

    return null;
  };

  return (
    <aside className={`web-sidebar ${isOpen ? 'web-sidebar--open' : ''}`}>
      <div className="web-sidebar__mobile-header">
        <span className="web-sidebar__mobile-title">Navigasi SCP</span>
        <button
          type="button"
          className="web-sidebar__close-btn"
          onClick={onClose}
          aria-label="Tutup menu navigasi"
        >
          <X size={16} />
        </button>
      </div>

      <nav className="web-sidebar__nav">{renderNavLinks()}</nav>

      <div className="web-sidebar__footer">
        <NavLink
          to="/profile"
          className={({ isActive }) =>
            `web-sidebar__footer-btn ${isActive ? 'web-sidebar__mainlink--active' : ''}`
          }
          onClick={() => onClose?.()}
        >
          <User size={15} />
          <span className="truncate">{user?.name || 'Profil Akun'}</span>
        </NavLink>

        <button
          type="button"
          className="web-sidebar__footer-btn text-red-600 hover:text-red-700 hover:bg-red-50"
          onClick={handleLogout}
        >
          <LogOut size={15} />
          <span>Keluar Sistem</span>
        </button>
      </div>
    </aside>
  );
}
