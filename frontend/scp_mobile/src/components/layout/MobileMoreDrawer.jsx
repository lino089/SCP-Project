import { NavLink, useNavigate } from 'react-router-dom';
import {
  Calendar,
  TrendingUp,
  FileText,
  UserCheck,
  Eye,
  User,
  LogOut,
  ChevronRight,
  LayoutDashboard,
  Layers,
  BookOpen,
  FileQuestion,
  Home,
  Moon,
  Sun,
} from 'lucide-react';
import BottomSheetModal from '../shared/BottomSheetModal';
import Badge from '../shared/Badge';
import { useAuth } from '../../hooks/useAuth';
import useTheme from '../../hooks/useTheme';
import './MobileMoreDrawer.css';

/**
 * MobileMoreDrawer — Slide-Up Navigation Drawer for Secondary Role Menus & Account Actions
 * Strictly excludes Waka Import Jadwal / Excel Import features per Mobile Scope Rules.
 */
export default function MobileMoreDrawer({ isOpen = false, onClose }) {
  const navigate = useNavigate();
  const { user, hasRole, isKesiswaan, isWaliKelas, logout } = useAuth();

  const { isDark, toggleTheme } = useTheme();

  const handleLogout = async () => {
    onClose?.();
    await logout();
    navigate('/login');
  };

  const getRoleMenuGroups = () => {
    if (hasRole('waka')) {
      return [
        {
          title: 'Kurikulum & Akademik',
          items: [
            {
              label: 'Dashboard Waka',
              desc: 'Ringkasan metrik kehadiran & kelas berjalan',
              to: '/web/dashboard',
              icon: LayoutDashboard,
            },
            {
              label: 'Kalender Akademik',
              desc: 'Agenda sekolah, hari libur & ujian',
              to: '/web/academic-calendar',
              icon: Calendar,
            },
            {
              label: 'Jadwal Pelajaran',
              desc: 'Kelola jadwal KBM seluruh rombel',
              to: '/web/schedules',
              icon: Calendar,
            },
          ],
        },
        {
          title: 'Data & Kesiswaan',
          items: [
            {
              label: 'Master Data',
              desc: 'Tahun ajaran, jurusan, kelas, mapel, guru, siswa, ortu & penugasan',
              to: '/web/master-data',
              icon: Layers,
            },
            {
              label: 'Kenaikan Kelas',
              desc: 'Promosi rombel & kelulusan siswa antar tahun ajaran',
              to: '/web/grade-promotion',
              icon: TrendingUp,
            },
            {
              label: 'Monitoring & Rekap',
              desc: 'Pantau jurnal guru, izin & ekspor laporan XLSX',
              to: '/web/monitoring',
              icon: Eye,
            },
          ],
        },
      ];
    }

    if (hasRole('teacher')) {
      const items = [
        {
          label: 'Dashboard Guru',
          desc: 'Jadwal hari ini & statistik pengajaran',
          to: '/teacher/dashboard',
          icon: LayoutDashboard,
        },
        {
          label: 'Kalender Akademik',
          desc: 'Jadwal kegiatan & hari penting sekolah',
          to: '/teacher/calendar',
          icon: Calendar,
        },
        {
          label: 'Jadwal Mengajar',
          desc: 'Daftar jam pelajaran & rombel pengajaran',
          to: '/teacher/schedule',
          icon: Calendar,
        },
        {
          label: 'Jurnal KBM & Presensi',
          desc: 'Input materi ajar, catatan & presensi siswa',
          to: '/teacher/journal',
          icon: BookOpen,
        },
        {
          label: 'Pengajuan Izin Guru',
          desc: 'Ajukan izin tugas/sakit & instruksi guru piket',
          to: '/teacher/leave',
          icon: FileText,
        },
        {
          label: 'Kuis',
          desc: 'Buat kuis otomatis dari dokumen PDF/TXT',
          to: '/teacher/quiz',
          icon: FileQuestion,
        },
      ];

      if (isKesiswaan() || isWaliKelas()) {
        items.push({
          label:
            isKesiswaan()
              ? 'Verifikasi Perizinan Siswa'
              : 'Perizinan Siswa (Wali Kelas)',
          desc: 'Tinjau & proses permohonan izin ketidakhadiran siswa',
          to: '/teacher/permissions',
          icon: UserCheck,
        });
      }

      if (isKesiswaan()) {
        items.push({
          label: 'Monitoring Kesiswaan',
          desc: 'Rekap kehadiran & pemantauan aktivitas kelas',
          to: '/web/monitoring',
          icon: Eye,
        });
      }

      return [
        {
          title: `Menu Guru ${
            isKesiswaan() ? '& Kesiswaan' : isWaliKelas() ? '& Wali Kelas' : ''
          }`,
          items,
        },
      ];
    }

    if (hasRole('student')) {
      return [
        {
          title: 'Menu Siswa',
          items: [
            {
              label: 'Beranda Siswa',
              desc: 'Ringkasan kehadiran & jadwal hari ini',
              to: '/student/home',
              icon: Home,
            },
            {
              label: 'Kalender & Kegiatan',
              desc: 'Agenda akademik & kegiatan sekolah',
              to: '/student/calendar',
              icon: Calendar,
            },
            {
              label: 'Jadwal Pelajaran',
              desc: 'Jadwal pelajaran kelas mingguan',
              to: '/student/schedule',
              icon: Calendar,
            },
            {
              label: 'Pengajuan Perizinan',
              desc: 'Ajukan surat izin sakit atau dispensasi',
              to: '/student/permissions',
              icon: FileText,
            },
            {
              label: 'Kuis',
              desc: 'Gabung kuis dengan PIN & lihat nilai',
              to: '/student/quiz',
              icon: FileQuestion,
            },
          ],
        },
      ];
    }

    if (hasRole('parent')) {
      return [
        {
          title: 'Menu Orang Tua',
          items: [
            {
              label: 'Monitoring Anak',
              desc: 'Pantau presensi, jurnal kelas & riwayat izin anak',
              to: '/parent/monitoring',
              icon: Eye,
            },
            {
              label: 'Kalender Sekolah',
              desc: 'Informasi agenda & libur akademik sekolah',
              to: '/parent/calendar',
              icon: Calendar,
            },
          ],
        },
      ];
    }

    return [];
  };

  const groups = getRoleMenuGroups();

  return (
    <BottomSheetModal
      isOpen={isOpen}
      onClose={onClose}
      title="Menu & Navigasi Lengkap"
      subtitle="Akses cepat seluruh fitur sesuai hak akses akun Anda"
      size="lg"
    >
      <div className="mobile-more-drawer">
        {/* User Summary Card */}
        <div className="mobile-more-drawer__user-card">
          <div className="mobile-more-drawer__user-info">
            <span className="mobile-more-drawer__user-name">
              {user?.name || 'Pengguna Sistem'}
            </span>
            <span className="mobile-more-drawer__user-id font-mono">
              ID: {user?.nis_nip || user?.username || '-'}
            </span>
          </div>
          <Badge variant="accent" size="sm">
            {user?.academic_year || '2025/2026 Ganjil'}
          </Badge>
        </div>

        {/* Dynamic Role Menu Groups */}
        {groups.map((group, gIdx) => (
          <div key={gIdx} className="mobile-more-drawer__group">
            <h4 className="mobile-more-drawer__group-title">{group.title}</h4>
            <div className="mobile-more-drawer__list">
              {group.items.map((item) => {
                const Icon = item.icon;
                return (
                  <NavLink
                    key={item.to}
                    to={item.to}
                    onClick={onClose}
                    className={({ isActive }) =>
                      [
                        'mobile-more-drawer__link',
                        isActive && 'mobile-more-drawer__link--active',
                      ]
                        .filter(Boolean)
                        .join(' ')
                    }
                  >
                    <div className="mobile-more-drawer__link-icon">
                      <Icon size={17} strokeWidth={1.75} />
                    </div>
                    <div className="mobile-more-drawer__link-text">
                      <span className="mobile-more-drawer__link-label">
                        {item.label}
                      </span>
                      {item.desc && (
                        <span className="mobile-more-drawer__link-desc">
                          {item.desc}
                        </span>
                      )}
                    </div>
                    <ChevronRight size={16} className="text-[var(--color-text-muted)] shrink-0" />
                  </NavLink>
                );
              })}
            </div>
          </div>
        ))}

        {/* Account & Session Section */}
        <div className="mobile-more-drawer__group">
          <h4 className="mobile-more-drawer__group-title">Pengaturan Akun</h4>
          <div className="mobile-more-drawer__list">
            <NavLink
              to="/profile"
              onClick={onClose}
              className={({ isActive }) =>
                [
                  'mobile-more-drawer__link',
                  isActive && 'mobile-more-drawer__link--active',
                ]
                  .filter(Boolean)
                  .join(' ')
              }
            >
              <div className="mobile-more-drawer__link-icon">
                <User size={17} strokeWidth={1.75} />
              </div>
              <div className="mobile-more-drawer__link-text">
                <span className="mobile-more-drawer__link-label">
                  Profil &amp; Keamanan Akun
                </span>
                <span className="mobile-more-drawer__link-desc">
                  Informasi identitas &amp; ubah kata sandi
                </span>
              </div>
              <ChevronRight size={16} className="text-[var(--color-text-muted)] shrink-0" />
            </NavLink>

            <button
              type="button"
              className="mobile-more-drawer__link"
              onClick={toggleTheme}
            >
              <div className="mobile-more-drawer__link-icon">
                {isDark ? <Moon size={17} strokeWidth={1.75} /> : <Sun size={17} strokeWidth={1.75} />}
              </div>
              <div className="mobile-more-drawer__link-text">
                <span className="mobile-more-drawer__link-label">Mode Tampilan</span>
                <span className="mobile-more-drawer__link-desc">
                  {isDark ? 'Gelap — ketuk untuk mode terang' : 'Terang — ketuk untuk mode gelap'}
                </span>
              </div>
            </button>

            <button
              type="button"
              className="mobile-more-drawer__link mobile-more-drawer__link--danger"
              onClick={handleLogout}
            >
              <div className="mobile-more-drawer__link-icon mobile-more-drawer__link-icon--danger">
                <LogOut size={17} strokeWidth={1.75} />
              </div>
              <div className="mobile-more-drawer__link-text">
                <span className="mobile-more-drawer__link-label">
                  Keluar dari Sistem
                </span>
                <span className="mobile-more-drawer__link-desc">
                  Akhiri sesi login pada perangkat ini
                </span>
              </div>
            </button>
          </div>
        </div>
      </div>
    </BottomSheetModal>
  );
}
