import { useState, useEffect, useMemo, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Calendar,
  Clock,
  Sparkles,
  FileText,
  CheckCircle2,
  ArrowRight,
  GraduationCap,
  AlertCircle,
  RotateCw,
} from 'lucide-react';
import { useAuth } from '../../hooks/useAuth';
import leaveApi from '../../services/leaveApi';
import { scheduleApi } from '../../services/scheduleApi';
import { quizApi } from '../../services/quizApi';
import academicEventApi from '../../services/academicEventApi';
import { Badge, Button, Modal, Table } from '../../components/shared';
import './StudentHome.css';

export default function StudentHomePage() {
  const { user } = useAuth();
  const navigate = useNavigate();

  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(null);
  const [attendances, setAttendances] = useState([]);
  const [todaySchedules, setTodaySchedules] = useState([]);
  const [activeQuizzes, setActiveQuizzes] = useState([]);
  const [activeEvent, setActiveEvent] = useState(null);
  const [isAttendanceModalOpen, setIsAttendanceModalOpen] = useState(false);

  // Student Profile Data (Data Riil dari Auth State)
  const student = useMemo(() => {
    return {
      name: user?.name || 'Peserta Didik',
      nis: user?.nis_nip || '-',
      nisn: user?.nisn || '-',
      className: user?.school_class?.name || user?.schoolClass?.name || user?.className || 'Belum Ada Rombel',
      classId: user?.class_id || null,
      academicYear: user?.academic_year || '2025/2026 Ganjil',
    };
  }, [user]);

  // Current Day & Date Resolution
  const dateInfo = useMemo(() => {
    const now = new Date();
    const dayOfWeek = now.getDay() === 0 ? 7 : now.getDay(); // 1 = Senin, ..., 7 = Minggu
    const dayNames = ['', 'Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat', 'Sabtu', 'Minggu'];
    const monthNames = [
      'Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni',
      'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember',
    ];
    return {
      dayOfWeek,
      dayName: dayNames[dayOfWeek] || 'Senin',
      formattedDate: `${now.getDate()} ${monthNames[now.getMonth()]} ${now.getFullYear()}`,
      currentTimeStr: `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`,
    };
  }, []);

  // Fetch Portal Data on Mount
  const loadPortalData = useCallback(async () => {
    setLoading(true);
    setLoadError(null);
    try {
      const schedPromise = student.classId
        ? scheduleApi.getSchedules({
            class_id: student.classId,
            day: dateInfo.dayOfWeek,
            per_page: 50,
          })
        : Promise.resolve({ data: [] });

      const todayStr = new Date().toISOString().split('T')[0];
      const [attRes, schedRes, quizRes, eventRes] = await Promise.all([
        leaveApi.getAttendances({ per_page: 50 }),
        schedPromise,
        quizApi.getQuizzes({ per_page: 20 }),
        academicEventApi.checkExemption({ for_my_class: 1, date: todayStr }).catch(() => ({ data: { data: {} } })),
      ]);

      // 1. Rekapitulasi Presensi
      const attList = Array.isArray(attRes) ? attRes : Array.isArray(attRes?.data) ? attRes.data : [];
      setAttendances(attList);

      // 2. Jadwal Hari Ini
      const schedList = Array.isArray(schedRes) ? schedRes : Array.isArray(schedRes?.data) ? schedRes.data : [];
      setTodaySchedules(schedList);

      // 3. Kuis Aktif (Status published)
      const quizList = Array.isArray(quizRes) ? quizRes : Array.isArray(quizRes?.data) ? quizRes.data : [];
      const filteredQuizzes = quizList.filter((q) => q.status === 'published');
      setActiveQuizzes(filteredQuizzes);

      // 4. Agenda Khusus Kelas Hari Ini
      const eventData = eventRes?.data?.data;
      if (eventData?.disabling_event) {
        setActiveEvent(eventData.disabling_event);
      } else if (eventData?.active_events && eventData.active_events.length > 0) {
        setActiveEvent(eventData.active_events[0]);
      } else {
        setActiveEvent(null);
      }
    } catch (err) {
      console.warn('Gagal memuat data portal beranda siswa:', err);
      setLoadError(err.message || 'Gagal memuat data portal beranda siswa.');
    } finally {
      setLoading(false);
    }
  }, [student.classId, dateInfo.dayOfWeek]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    loadPortalData();
  }, [loadPortalData]);

  // Kalkulasi 4 Metrik Kehadiran Mandiri (Data Murni Database)
  const attendanceStats = useMemo(() => {
    return attendances.reduce(
      (acc, item) => {
        const st = (item.status || '').toLowerCase();
        if (st === 'hadir' || st === 'present') acc.hadir += 1;
        else if (st === 'sakit' || st === 'sick') acc.sakit += 1;
        else if (st === 'izin' || st === 'permit') acc.izin += 1;
        else if (st === 'alpa' || st === 'absent') acc.alpa += 1;
        return acc;
      },
      { hadir: 0, sakit: 0, izin: 0, alpa: 0 }
    );
  }, [attendances]);

  // Helper untuk format waktu jadwal KBM
  const formatScheduleTime = (item) => {
    if (item.resolved_times?.start_time && item.resolved_times?.end_time) {
      return `${item.resolved_times.start_time.slice(0, 5)} - ${item.resolved_times.end_time.slice(0, 5)} WIB`;
    }
    // Estimasi jam per period
    const startHour = 7 + Math.floor(((item.period_number || 1) - 1) * 0.75);
    const startMin = (((item.period_number || 1) - 1) * 45) % 60;
    const endHour = startHour + Math.floor(((item.duration_periods || 2) * 45 + startMin) / 60);
    const endMin = ((item.duration_periods || 2) * 45 + startMin) % 60;
    return `${String(startHour).padStart(2, '0')}:${String(startMin).padStart(2, '0')} - ${String(endHour).padStart(2, '0')}:${String(endMin).padStart(2, '0')} WIB`;
  };

  // Log Presensi Table Columns
  const attendanceColumns = [
    {
      key: 'no',
      label: 'No',
      align: 'center',
      width: '50px',
      renderCell: (row, idx) => (
        <span className="font-mono text-xs text-slate-400">
          {String(idx + 1).padStart(2, '0')}
        </span>
      ),
    },
    {
      key: 'date',
      label: 'Tanggal KBM',
      renderCell: (row) => (
        <span className="font-mono text-xs font-semibold text-slate-800">
          {row.date || (row.created_at ? row.created_at.split('T')[0] : '-')}
        </span>
      ),
    },
    {
      key: 'status',
      label: 'Status Kehadiran',
      renderCell: (row) => {
        const s = (row.status || '').toLowerCase();
        if (s === 'hadir' || s === 'present') return <Badge variant="success">Hadir Penuh</Badge>;
        if (s === 'sakit' || s === 'sick') return <Badge variant="info">Izin Sakit</Badge>;
        if (s === 'izin' || s === 'permit') return <Badge variant="warning">Izin Keluar/Lainnya</Badge>;
        return <Badge variant="error">Alpa</Badge>;
      },
    },
    {
      key: 'topic',
      label: 'Materi Pembelajaran / Catatan Guru',
      renderCell: (row) => (
        <div className="flex flex-col gap-0.5">
          <span className="text-xs text-slate-700">
            {row.journal?.topic_description || 'Sesi pembelajaran kelas reguler'}
          </span>
          {row.notes && (
            <span className="text-[11px] text-amber-800 bg-amber-50 border border-amber-200/60 rounded px-1.5 py-0.5 inline-block max-w-fit font-medium">
              Catatan Guru: {row.notes}
            </span>
          )}
        </div>
      ),
    },
  ];

  return (
    <div className="student-home">
      {loadError && (
        <div style={{ marginBottom: '1.25rem', padding: '1rem', backgroundColor: '#fef2f2', border: '1px solid #fecaca', borderRadius: '0.75rem', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '1rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', color: '#991b1b', fontSize: '0.875rem' }}>
            <AlertCircle style={{ width: '1.25rem', height: '1.25rem', flexShrink: 0 }} />
            <span>{loadError}</span>
          </div>
          <Button size="sm" variant="outline" onClick={loadPortalData}>
            <RotateCw className="w-3.5 h-3.5 mr-1" />
            Coba Lagi
          </Button>
        </div>
      )}

      {/* =========================================================================
          1. HEADER IDENTITAS PROFIL SISWA
         ========================================================================= */}
      <div className="student-home__profile-card">
        <div className="student-home__profile-header">
          <div className="student-home__profile-main">
            <div className="student-home__avatar">
              {student.name
                .split(' ')
                .map((n) => n[0])
                .slice(0, 2)
                .join('')}
            </div>
            <div>
              <div className="student-home__name-wrap">
                <h1 className="student-home__student-name">{student.name}</h1>
                <Badge variant="success">Siswa Aktif</Badge>
              </div>
              <p className="student-home__student-meta">
                NIS: <span className="font-mono font-medium text-slate-700">{student.nis}</span> &bull;{' '}
                NISN: <span className="font-mono text-slate-700">{student.nisn}</span> &bull;{' '}
                Rombel <strong className="font-mono text-slate-900">{student.className}</strong>
              </p>
            </div>
          </div>

          <div className="student-home__period-badge">
            <span>
              Tahun Ajaran: <strong className="font-mono text-slate-800">{student.academicYear}</strong>
            </span>
          </div>
        </div>
      </div>

      {/* =========================================================================
          2. EMPAT KARTU METRIK KEHADIRAN MANDIRI
         ========================================================================= */}
      <div className="student-home__stats-grid">
        <div className="student-home__stat-card">
          <div className="student-home__stat-top">
            <span className="student-home__stat-title">Hari Masuk</span>
            <span className="student-home__stat-indicator student-home__stat-indicator--hadir" />
          </div>
          <div className="student-home__stat-body">
            <span className="student-home__stat-value font-mono">{attendanceStats.hadir}</span>
            <span className="student-home__stat-unit">hari</span>
          </div>
          <p className="student-home__stat-desc">Presensi fisik terkonfirmasi di kelas</p>
        </div>

        <div className="student-home__stat-card">
          <div className="student-home__stat-top">
            <span className="student-home__stat-title">Izin Sakit</span>
            <span className="student-home__stat-indicator student-home__stat-indicator--sakit" />
          </div>
          <div className="student-home__stat-body">
            <span className="student-home__stat-value font-mono">{attendanceStats.sakit}</span>
            <span className="student-home__stat-unit">hari</span>
          </div>
          <p className="student-home__stat-desc">Tervalidasi surat keterangan dokter</p>
        </div>

        <div className="student-home__stat-card">
          <div className="student-home__stat-top">
            <span className="student-home__stat-title">Izin Keperluan</span>
            <span className="student-home__stat-indicator student-home__stat-indicator--izin" />
          </div>
          <div className="student-home__stat-body">
            <span className="student-home__stat-value font-mono">{attendanceStats.izin}</span>
            <span className="student-home__stat-unit">hari</span>
          </div>
          <p className="student-home__stat-desc">Izin resmi disetujui pihak sekolah</p>
        </div>

        <div className="student-home__stat-card">
          <div className="student-home__stat-top">
            <span className="student-home__stat-title">Alpa</span>
            <span className="student-home__stat-indicator student-home__stat-indicator--alpa" />
          </div>
          <div className="student-home__stat-body">
            <span className="student-home__stat-value font-mono">{attendanceStats.alpa}</span>
            <span className="student-home__stat-unit">hari</span>
          </div>
          <p className="student-home__stat-desc">Ketidakhadiran tanpa keterangan</p>
        </div>
      </div>

      {/* =========================================================================
          3. AKSI CEPAT SISWA (QUICK ACTIONS)
         ========================================================================= */}
      <div className="student-home__quick-actions">
        <button
          type="button"
          className="student-home__action-card"
          onClick={() => navigate('/student/permissions')}
        >
          <div className="student-home__action-icon student-home__action-icon--blue">
            <FileText size={18} />
          </div>
          <div>
            <span className="student-home__action-title">Ajukan Izin / Sakit</span>
            <span className="student-home__action-subtitle">Kirim permohonan surat izin mandiri</span>
          </div>
        </button>

        <button
          type="button"
          className="student-home__action-card"
          onClick={() => navigate('/student/quiz')}
        >
          <div className="student-home__action-icon student-home__action-icon--yellow">
            <Sparkles size={18} />
          </div>
          <div>
            <span className="student-home__action-title">Pengerjaan Kuis CBT</span>
            <span className="student-home__action-subtitle">Buka lembar ujian evaluasi AI aktif</span>
          </div>
        </button>

        <button
          type="button"
          className="student-home__action-card"
          onClick={() => setIsAttendanceModalOpen(true)}
        >
          <div className="student-home__action-icon student-home__action-icon--slate">
            <Clock size={18} />
          </div>
          <div>
            <span className="student-home__action-title">Riwayat Presensi</span>
            <span className="student-home__action-subtitle">Lihat rekapitulasi kehadiran kelas</span>
          </div>
        </button>
      </div>

      {/* =========================================================================
          BANNER AGENDA KALENDER AKADEMIK KELAS HARI INI
         ========================================================================= */}
      {activeEvent && (
        <div style={{ marginBottom: '1.5rem', padding: '1rem 1.25rem', backgroundColor: activeEvent.disables_teaching ? '#fffbeb' : '#f0fdf4', border: `1px solid ${activeEvent.disables_teaching ? '#fde68a' : '#bbf7d0'}`, borderRadius: '0.75rem' }}>
          <div className="flex items-start gap-3">
            <Calendar className={`w-5 h-5 mt-0.5 shrink-0 ${activeEvent.disables_teaching ? 'text-amber-600' : 'text-emerald-600'}`} />
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <h3 className={`text-sm font-bold ${activeEvent.disables_teaching ? 'text-amber-950' : 'text-emerald-950'}`}>
                  Agenda Hari Ini: {activeEvent.title}
                </h3>
                <Badge variant={activeEvent.disables_teaching ? 'warning' : 'success'}>
                  {activeEvent.type === 'holiday' ? 'Libur Sekolah' : activeEvent.type === 'exam' ? 'Agenda Ujian' : 'Agenda Khusus'}
                </Badge>
              </div>
              {activeEvent.description && (
                <p className={`text-xs mt-1 ${activeEvent.disables_teaching ? 'text-amber-800' : 'text-emerald-800'}`}>
                  {activeEvent.description}
                </p>
              )}
              {activeEvent.disables_teaching ? (
                <p className="text-xs font-semibold text-rose-700 mt-1">
                  KBM reguler di kelas ditiadakan selama agenda berlangsung.
                </p>
              ) : (
                <p className="text-xs font-medium text-emerald-700 mt-1">
                  Kegiatan belajar mengajar (KBM) kelas tetap berjalan sesuai jadwal.
                </p>
              )}
            </div>
          </div>
        </div>
      )}

      {/* =========================================================================
          4. LAYOUT UTAMA: JADWAL KBM HARI INI & KUIS AKTIF
         ========================================================================= */}
      <div className="student-home__main-grid">
        {/* Kolom Kiri: Jadwal KBM Hari Ini */}
        <div className="student-home__section-card">
          <div className="student-home__section-header">
            <h2 className="student-home__section-title">
              <span>Jadwal Pembelajaran Hari Ini</span>
            </h2>
            <div className="flex items-center gap-2">
              <span className="student-home__section-badge font-mono">
                {dateInfo.dayName}, {dateInfo.formattedDate}
              </span>
              <button
                type="button"
                className="text-xs font-semibold text-blue-600 hover:text-blue-700 underline cursor-pointer"
                onClick={() => navigate('/student/schedule')}
              >
                Lihat Jadwal Lengkap &rarr;
              </button>
            </div>
          </div>

          {loading ? (
            <div className="student-home__empty-widget">
              <p className="text-xs text-slate-400">Memuat jadwal KBM kelas...</p>
            </div>
          ) : todaySchedules.length === 0 ? (
            <div className="student-home__empty-widget">
              <Calendar size={32} className="student-home__empty-icon" />
              <p className="student-home__empty-text">
                Tidak ada jadwal KBM aktif untuk hari <strong>{dateInfo.dayName}</strong>.
              </p>
              <p className="text-xs text-slate-400 mt-1">
                Gunakan waktu luang untuk mengulas catatan dan mengerjakan tugas kuis.
              </p>
            </div>
          ) : (
            <div className="student-home__schedule-list">
              {todaySchedules.map((item, idx) => (
                <div key={item.id || idx} className="student-home__schedule-item">
                  <div className="student-home__time-col">
                    <span className="student-home__time-slot font-mono">
                      {formatScheduleTime(item)}
                    </span>
                    <span className="student-home__period-num font-mono">
                      Jam Ke-{item.period_number || idx + 1}
                    </span>
                  </div>

                  <div className="student-home__sched-details">
                    <div className="flex items-center gap-2 flex-wrap">
                      <h3 className="student-home__subject-name">
                        {item.subject?.name || '-'}
                      </h3>
                      {item.is_teaching_exempted && (
                        <Badge variant="warning" className="text-[10px]">
                          Dikecualikan: {item.exemption_reason || 'Agenda Khusus'}
                        </Badge>
                      )}
                    </div>
                    <p className="student-home__teacher-name">
                      Guru: {item.teacher?.name || '-'}
                    </p>
                    <span className="student-home__room-badge font-mono">
                      Ruang: {item.room?.name || '-'}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Kolom Kanan: Kuis Aktif */}
        <div className="student-home__section-card">
          <div className="student-home__section-header">
            <h2 className="student-home__section-title">
              <span>Kuis Aktif Kelas</span>
            </h2>
            <Badge variant="warning" dot>{activeQuizzes.length} Kuis</Badge>
          </div>

          {loading ? (
            <div className="student-home__empty-widget">
              <p className="text-xs text-slate-400">Memeriksa kuis yang ditugaskan...</p>
            </div>
          ) : activeQuizzes.length === 0 ? (
            <div className="student-home__empty-widget">
              <CheckCircle2 size={32} className="student-home__empty-icon text-emerald-400" />
              <p className="student-home__empty-text">Semua kuis telah selesai dikerjakan!</p>
              <p className="text-xs text-slate-400 mt-1">
                Tidak ada tugas asesmen aktif yang memerlukan pengerjaan saat ini.
              </p>
            </div>
          ) : (
            <div className="student-home__quiz-list">
              {activeQuizzes.map((quiz) => (
                <div key={quiz.id} className="student-home__quiz-item">
                  <div className="student-home__quiz-head">
                    <h3 className="student-home__quiz-title">{quiz.title}</h3>
                    <Badge variant="neutral">
                      {quiz.questions_count ?? (quiz.questions?.length ?? '-')} Soal
                    </Badge>
                  </div>

                  <div className="student-home__quiz-meta">
                    <span>Mata Pelajaran: {quiz.subject?.name || 'KBM Kelas'}</span>
                  </div>

                  <div className="student-home__quiz-footer">
                    <div className="student-home__quiz-due">
                      <Clock size={12} />
                      <span className="font-mono">
                        Tenggat: {quiz.due_date ? String(quiz.due_date).split('T')[0] : 'Sesuai Jadwal'}
                      </span>
                    </div>

                    <Button
                      size="sm"
                      variant="primary"
                      icon={ArrowRight}
                      onClick={() => navigate('/student/quiz')}
                    >
                      Buka CBT
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* =========================================================================
          5. KARTU UCAPAN MOTIVASI BELAJAR (INSPIRASI BELAJAR)
         ========================================================================= */}
      <div className="student-home__quote-box">
        <div className="student-home__quote-icon">
          <GraduationCap size={22} />
        </div>
        <div className="student-home__quote-content">
          <h4>Inspirasi Belajar Kejuruan</h4>
          <p>
            &ldquo;Konsistensi latihan harian dan kedisiplinan presensi adalah fondasi utama keberhasilan penguasaan kompetensi keahlian. Teruslah berproses dan raih capaian terbaik!&rdquo;
          </p>
        </div>
      </div>

      {/* =========================================================================
          MODAL RIWAYAT LOG PRESENSI SISWA
         ========================================================================= */}
      <Modal
        isOpen={isAttendanceModalOpen}
        onClose={() => setIsAttendanceModalOpen(false)}
        title={`Riwayat Log Presensi: ${student.name} (${student.className})`}
        maxWidth="max-w-2xl"
      >
        <div className="space-y-4">
          <Table
            columns={attendanceColumns}
            data={attendances}
            pageSize={8}
            emptyMessage="Belum ada catatan presensi terekam untuk siswa."
          />
          <div className="flex justify-end pt-2">
            <Button variant="secondary" onClick={() => setIsAttendanceModalOpen(false)}>
              Tutup
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
