import { useState, useEffect, useMemo, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Calendar,
  Clock,
  CheckCircle2,
  AlertCircle,
  RotateCw,
  FileQuestion,
  ChevronRight,
  BookOpen,
  MapPin,
  User,
  GraduationCap,
} from 'lucide-react';
import { useAuth } from '../../hooks/useAuth';
import leaveApi from '../../services/leaveApi';
import { scheduleApi } from '../../services/scheduleApi';
import { quizApi } from '../../services/quizApi';
import academicEventApi from '../../services/academicEventApi';
import { Badge, Button, BottomSheetModal, Card } from '../../components/shared';
import { resolveSlotTime } from '../../utils/timetableHelper';
import { formatDateIndo } from '../../utils/formatters';

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

  // Student Profile Data
  const student = useMemo(() => {
    return {
      name: user?.name || 'Peserta Didik',
      nis: user?.nis_nip || user?.nis || '-',
      className:
        user?.school_class?.name ||
        user?.schoolClass?.name ||
        user?.className ||
        (user?.class_id ? `Kelas #${user.class_id}` : 'Belum Ditentukan'),
      classId: user?.class_id || null,
      academicYear: user?.academic_year || '2025/2026 Ganjil',
    };
  }, [user]);

  // Current Day & Date Resolution
  const dateInfo = useMemo(() => {
    const now = new Date();
    const dayOfWeek = now.getDay() === 0 ? 7 : now.getDay(); // 1 = Senin..7 = Minggu
    const dayNames = ['', 'Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat', 'Sabtu', 'Minggu'];
    return {
      dayOfWeek,
      dayName: dayNames[dayOfWeek] || 'Senin',
      dateStr: now.toISOString().split('T')[0],
      formattedDate: formatDateIndo(now),
    };
  }, []);

  // Fetch Portal Data
  const loadPortalData = useCallback(async () => {
    setLoadError(null);
    try {
      const schedPromise = student.classId
        ? scheduleApi.getSchedules({
            class_id: student.classId,
            day: dateInfo.dayOfWeek,
            per_page: 50,
          })
        : Promise.resolve({ data: [] });

      const [attRes, schedRes, quizRes, eventRes] = await Promise.all([
        leaveApi.getAttendances({ per_page: 50 }).catch(() => ({ data: [] })),
        schedPromise.catch(() => ({ data: [] })),
        quizApi.getQuizzes({ per_page: 20 }).catch(() => ({ data: [] })),
        academicEventApi
          .checkExemption({ for_my_class: 1, date: dateInfo.dateStr })
          .catch(() => ({ data: { data: {} } })),
      ]);

      // 1. Rekapitulasi Presensi
      const attList = Array.isArray(attRes)
        ? attRes
        : Array.isArray(attRes?.data)
          ? attRes.data
          : [];
      setAttendances(attList);

      // 2. Jadwal Hari Ini
      const schedList = Array.isArray(schedRes)
        ? schedRes
        : Array.isArray(schedRes?.data)
          ? schedRes.data
          : [];
      setTodaySchedules(schedList);

      // 3. Kuis Aktif (Status published)
      const quizList = Array.isArray(quizRes)
        ? quizRes
        : Array.isArray(quizRes?.data)
          ? quizRes.data
          : [];
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
      setLoadError(err.message || 'Gagal memuat data beranda siswa dari server.');
    } finally {
      setLoading(false);
    }
  }, [student.classId, dateInfo.dayOfWeek, dateInfo.dateStr]);

  useEffect(() => {
    let cancel = false;
    async function init() {
      try {
        await loadPortalData();
      } catch {
        if (!cancel) setLoadError('Gagal menghubungkan ke server.');
      }
    }
    init();
    return () => {
      cancel = true;
    };
  }, [loadPortalData]);

  const handleRefresh = async () => {
    setLoading(true);
    await loadPortalData();
  };

  // Kalkulasi 4 Metrik Kehadiran
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

  // Format jam KBM
  const formatScheduleTime = (item) => {
    if (item.resolved_times?.start_time && item.resolved_times?.end_time) {
      return `${item.resolved_times.start_time.slice(0, 5)} - ${item.resolved_times.end_time.slice(0, 5)} WIB`;
    }
    const resolved = resolveSlotTime(
      item.day_of_week || dateInfo.dayOfWeek,
      item.period_number || 1,
      item.duration_periods || 1
    );
    return `${resolved.timeText} WIB`;
  };

  return (
    <div className="space-y-4">
      {/* Load Error Alert */}
      {loadError && (
        <div className="mb-4 p-3.5 bg-[var(--color-danger-bg)] border border-[var(--color-danger-border)] rounded-[10px] flex items-center justify-between gap-3 text-[var(--color-danger-fg)] text-xs">
          <div className="flex items-center gap-2">
            <AlertCircle className="w-4 h-4 shrink-0 text-[var(--color-danger-fg)]" />
            <span>{loadError}</span>
          </div>
          <Button
            size="sm"
            variant="outline"
            onClick={handleRefresh}
            className="shrink-0 text-[var(--color-danger-fg)] border-[var(--color-danger-border)] hover:bg-[var(--color-danger-bg)]"
          >
            <RotateCw className="w-3.5 h-3.5 mr-1" />
            Coba Lagi
          </Button>
        </div>
      )}

      {/* Profil Header Card */}
      <div className="surface-card p-4 mb-4">
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-full bg-[var(--color-warning-bg)] border border-[var(--color-warning-border)] text-[var(--color-warning-fg)] flex items-center justify-center font-bold text-base shrink-0">
              {student.name.charAt(0).toUpperCase()}
            </div>
            <div>
              <div className="flex items-center gap-1.5 flex-wrap">
                <span className="font-semibold text-[var(--color-text-primary)] text-sm">{student.name}</span>
                <Badge variant="warning" className="text-[11px] px-1.5 py-0">
                  Siswa
                </Badge>
              </div>
              <div className="text-xs text-[var(--color-text-secondary)] flex items-center gap-2 mt-0.5 font-mono">
                <span>NIS: {student.nis}</span>
                <span>•</span>
                <span className="text-[var(--color-text-primary)] font-sans font-medium flex items-center gap-1">
                  <GraduationCap className="w-3.5 h-3.5 text-[var(--color-text-muted)]" />
                  {student.className}
                </span>
              </div>
            </div>
          </div>
          <button
            onClick={handleRefresh}
            disabled={loading}
            aria-label="Refresh data"
            className="p-2 rounded-[10px] text-[var(--color-text-muted)] hover:text-[var(--color-text-secondary)] hover:bg-[var(--color-surface-subtle)] transition-colors"
          >
            <RotateCw className={`w-4 h-4 ${loading ? 'animate-spin text-[var(--color-warning-fg)]' : ''}`} />
          </button>
        </div>

        <div className="mt-3 pt-3 border-t border-[var(--color-border-light)] flex items-center justify-between text-xs text-[var(--color-text-secondary)]">
          <div className="flex items-center gap-1.5">
            <Calendar className="w-3.5 h-3.5 text-[var(--color-text-muted)]" />
            <span>{dateInfo.dayName}, {dateInfo.formattedDate}</span>
          </div>
          <span className="font-mono text-[11px] bg-[var(--color-surface-subtle)] text-[var(--color-text-primary)] px-2 py-0.5 rounded-[6px]">
            {student.academicYear}
          </span>
        </div>
      </div>

      {/* Agenda Khusus / Libur Banner */}
      {activeEvent && (
        <div
          className={`mb-4 p-3.5 rounded-[14px] border flex items-start gap-3 ${
            activeEvent.disables_teaching
              ? 'bg-[var(--color-warning-bg)] border-[var(--color-warning-border)] text-[var(--color-warning-fg)]'
              : 'bg-[var(--color-info-bg)] border-[var(--color-info-border)] text-[var(--color-info-fg)]'
          }`}
        >
          <AlertCircle className="w-5 h-5 shrink-0 mt-0.5" />
          <div className="text-xs">
            <p className="font-semibold">{activeEvent.title}</p>
            <p className="mt-0.5 text-[var(--color-text-secondary)]">
              {activeEvent.disables_teaching
                ? 'Kegiatan ini meniadakan Kegiatan Belajar Mengajar (KBM) untuk kelas Anda hari ini.'
                : activeEvent.description || 'Agenda khusus sekolah hari ini.'}
            </p>
          </div>
        </div>
      )}

      {/* Ringkasan Presensi Card */}
      <div className="mb-5">
        <div className="flex items-center justify-between mb-2 px-0.5">
          <h2 className="section-label">
            Rekap Kehadiran Saya
          </h2>
          <button
            onClick={() => setIsAttendanceModalOpen(true)}
            className="text-xs text-[var(--color-warning-fg)] font-semibold hover:underline flex items-center gap-0.5"
          >
            Lihat Riwayat
            <ChevronRight className="w-3.5 h-3.5" />
          </button>
        </div>

        <div className="grid grid-cols-4 gap-2">
          <div
            onClick={() => setIsAttendanceModalOpen(true)}
            className="cursor-pointer bg-[var(--color-surface)] border border-[var(--color-success-border)] rounded-[14px] p-2.5 text-center shadow-[var(--shadow-card)] hover:border-emerald-400 transition-colors"
          >
            <span className="block text-[11px] text-[var(--color-success-fg)] font-semibold mb-0.5">Hadir</span>
            <span className="text-lg font-bold font-mono text-[var(--color-success-fg)]">
              {loading ? '…' : attendanceStats.hadir}
            </span>
          </div>
          <div
            onClick={() => setIsAttendanceModalOpen(true)}
            className="cursor-pointer bg-[var(--color-surface)] border border-[var(--color-info-border)] rounded-[14px] p-2.5 text-center shadow-[var(--shadow-card)] hover:border-blue-400 transition-colors"
          >
            <span className="block text-[11px] text-[var(--color-info-fg)] font-semibold mb-0.5">Sakit</span>
            <span className="text-lg font-bold font-mono text-[var(--color-info-fg)]">
              {loading ? '…' : attendanceStats.sakit}
            </span>
          </div>
          <div
            onClick={() => setIsAttendanceModalOpen(true)}
            className="cursor-pointer bg-[var(--color-surface)] border border-[var(--color-warning-border)] rounded-[14px] p-2.5 text-center shadow-[var(--shadow-card)] hover:border-[var(--color-warning-border)] transition-colors"
          >
            <span className="block text-[11px] text-[var(--color-warning-fg)] font-semibold mb-0.5">Izin</span>
            <span className="text-lg font-bold font-mono text-[var(--color-warning-fg)]">
              {loading ? '…' : attendanceStats.izin}
            </span>
          </div>
          <div
            onClick={() => setIsAttendanceModalOpen(true)}
            className="cursor-pointer bg-[var(--color-surface)] border border-[var(--color-danger-border)] rounded-[14px] p-2.5 text-center shadow-[var(--shadow-card)] hover:border-red-400 transition-colors"
          >
            <span className="block text-[11px] text-[var(--color-danger-fg)] font-semibold mb-0.5">Alpa</span>
            <span className="text-lg font-bold font-mono text-[var(--color-danger-fg)]">
              {loading ? '…' : attendanceStats.alpa}
            </span>
          </div>
        </div>
      </div>

      {/* Banner Kuis Aktif */}
      {activeQuizzes.length > 0 && (
        <div className="mb-5 bg-gradient-to-r from-amber-500/10 via-amber-400/5 to-transparent border border-[var(--color-warning-border)] rounded-[14px] p-3.5">
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-[var(--color-warning-bg)]0 animate-pulse" />
              <h3 className="text-xs font-bold text-[var(--color-warning-fg)] uppercase tracking-wide">
                Kuis Aktif Tersedia ({activeQuizzes.length})
              </h3>
            </div>
            <button
              onClick={() => navigate('/student/quiz')}
              className="text-xs text-[var(--color-warning-fg)] font-semibold hover:underline flex items-center gap-0.5"
            >
              Semua Kuis
              <ChevronRight className="w-3.5 h-3.5" />
            </button>
          </div>

          <div className="space-y-2">
            {activeQuizzes.slice(0, 2).map((quiz) => (
              <div
                key={quiz.id}
                className="bg-[var(--color-surface)] border border-[var(--color-warning-border)] rounded-[10px] p-3 flex items-center justify-between gap-3 shadow-[var(--shadow-card)]"
              >
                <div className="min-w-0 flex-1">
                  <p className="font-semibold text-[var(--color-text-primary)] text-xs truncate">{quiz.title}</p>
                  <div className="flex items-center gap-2 text-[11px] text-[var(--color-text-secondary)] mt-1">
                    <span className="flex items-center gap-1">
                      <Clock className="w-3 h-3 text-[var(--color-text-muted)]" />
                      {quiz.duration_minutes || quiz.duration || 30} menit
                    </span>
                    <span>•</span>
                    <span className="flex items-center gap-1 font-mono">
                      <FileQuestion className="w-3 h-3 text-[var(--color-text-muted)]" />
                      {quiz.questions_count || (quiz.questions ? quiz.questions.length : 0)} Soal
                    </span>
                  </div>
                </div>
                <Button
                  size="sm"
                  variant="primary"
                  onClick={() => navigate('/student/quiz')}
                  className="shrink-0 text-xs font-semibold px-3 py-1.5"
                >
                  Kerjakan
                </Button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Jadwal Hari Ini */}
      <div className="mb-6">
        <div className="flex items-center justify-between mb-2.5 px-0.5">
          <div className="flex items-center gap-2">
            <BookOpen className="w-4 h-4 text-[var(--color-text-primary)]" />
            <h2 className="section-label">
              Jadwal KBM Hari Ini ({dateInfo.dayName})
            </h2>
          </div>
          <button
            onClick={() => navigate('/student/schedule')}
            className="text-xs text-[var(--color-warning-fg)] font-semibold hover:underline flex items-center gap-0.5"
          >
            Lihat Lengkap
            <ChevronRight className="w-3.5 h-3.5" />
          </button>
        </div>

        {loading ? (
          <div className="space-y-2">
            {[1, 2, 3].map((i) => (
              <div
                key={i}
                className="h-20 bg-[var(--color-surface-subtle)] rounded-[14px] animate-pulse border border-[var(--color-border-subtle)]/60"
              />
            ))}
          </div>
        ) : todaySchedules.length === 0 ? (
          <div className="bg-[var(--color-surface)] border border-dashed border-[var(--color-border-subtle)] rounded-[14px] p-6 text-center">
            <Calendar className="w-8 h-8 text-[var(--color-text-muted)] mx-auto mb-2" />
            <p className="text-xs font-semibold text-[var(--color-text-primary)]">Tidak ada jadwal KBM hari ini</p>
            <p className="text-[11px] text-[var(--color-text-muted)] mt-0.5">
              {dateInfo.dayOfWeek >= 6
                ? 'Hari libur akhir pekan. Selamat beristirahat!'
                : 'Belum ada sesi pelajaran terdaftar untuk kelas Anda hari ini.'}
            </p>
          </div>
        ) : (
          <div className="space-y-2">
            {todaySchedules.map((item, idx) => (
              <div
                key={item.id || idx}
                className="surface-card p-3.5 hover:border-[var(--color-border-strong)] transition-colors"
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="flex-1 min-w-0">
                    <span className="font-semibold text-[var(--color-text-primary)] text-xs block truncate">
                      {item.subject?.name || 'Mata Pelajaran'}
                    </span>
                    <div className="flex items-center gap-2 text-[11px] text-[var(--color-text-secondary)] mt-1">
                      <span className="flex items-center gap-1 truncate">
                        <User className="w-3 h-3 text-[var(--color-text-muted)] shrink-0" />
                        {item.teacher?.name || 'Guru Pengampu'}
                      </span>
                      <span>•</span>
                      <span className="flex items-center gap-1 shrink-0">
                        <MapPin className="w-3 h-3 text-[var(--color-text-muted)]" />
                        {item.room?.name || 'Ruang Kelas'}
                      </span>
                    </div>
                  </div>
                  <Badge variant="outline" className="font-mono text-[11px] shrink-0">
                    Jam ke-{item.period_number}
                  </Badge>
                </div>

                <div className="mt-2.5 pt-2 border-t border-[var(--color-border-light)] flex items-center justify-between text-[11px]">
                  <span className="text-[var(--color-text-secondary)] font-mono flex items-center gap-1">
                    <Clock className="w-3 h-3 text-[var(--color-text-muted)]" />
                    {formatScheduleTime(item)}
                  </span>
                  {item.journals && item.journals.length > 0 ? (
                    <span className="inline-flex items-center gap-1 text-[var(--color-success-fg)] font-medium">
                      <CheckCircle2 className="w-3.5 h-3.5" />
                      KBM Terlaksana
                    </span>
                  ) : (
                    <span className="text-[var(--color-text-muted)] font-medium">Belum Dimulai</span>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Navigasi Cepat Siswa */}
      <div className="grid grid-cols-2 gap-2.5">
        <Card
          onClick={() => navigate('/student/permissions')}
          className="p-3.5 cursor-pointer hover:border-[var(--color-warning-border)] transition-colors bg-[var(--color-surface)]"
        >
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-[10px] bg-[var(--color-info-bg)] text-[var(--color-info-fg)] flex items-center justify-center shrink-0">
              <Calendar className="w-4 h-4" />
            </div>
            <div>
              <p className="text-xs font-semibold text-[var(--color-text-primary)]">Ajukan Izin</p>
              <p className="text-[11px] text-[var(--color-text-secondary)]">Sakit atau Dispensasi</p>
            </div>
          </div>
        </Card>

        <Card
          onClick={() => navigate('/student/calendar')}
          className="p-3.5 cursor-pointer hover:border-[var(--color-warning-border)] transition-colors bg-[var(--color-surface)]"
        >
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-[10px] bg-[var(--color-warning-bg)] text-[var(--color-warning-fg)] flex items-center justify-center shrink-0">
              <Calendar className="w-4 h-4" />
            </div>
            <div>
              <p className="text-xs font-semibold text-[var(--color-text-primary)]">Kalender</p>
              <p className="text-[11px] text-[var(--color-text-secondary)]">Agenda & Hari Libur</p>
            </div>
          </div>
        </Card>
      </div>

      {/* Modal Riwayat Presensi Detail */}
      <BottomSheetModal
        isOpen={isAttendanceModalOpen}
        onClose={() => setIsAttendanceModalOpen(false)}
        title="Riwayat Presensi KBM"
        subtitle={`Catatan kehadiran ${student.name} pada sesi pembelajaran`}
        size="lg"
      >
        <div className="space-y-3 pb-4">
          {attendances.length === 0 ? (
            <div className="py-8 text-center text-[var(--color-text-muted)] text-xs">
              Belum ada riwayat catatan presensi KBM yang tercatat.
            </div>
          ) : (
            attendances.map((item, idx) => {
              const st = (item.status || '').toLowerCase();
              return (
                <div
                  key={item.id || idx}
                  className="p-3 rounded-[10px] border border-[var(--color-border-subtle)] bg-[var(--color-surface)] space-y-1.5"
                >
                  <div className="flex items-center justify-between text-xs">
                    <span className="font-mono font-semibold text-[var(--color-text-primary)]">
                      {item.date || (item.created_at ? item.created_at.split('T')[0] : '-')}
                    </span>
                    {st === 'hadir' || st === 'present' ? (
                      <Badge variant="success">Hadir</Badge>
                    ) : st === 'sakit' || st === 'sick' ? (
                      <Badge variant="info">Izin Sakit</Badge>
                    ) : st === 'izin' || st === 'permit' ? (
                      <Badge variant="warning">Izin</Badge>
                    ) : (
                      <Badge variant="error">Alpa</Badge>
                    )}
                  </div>
                  <p className="text-xs text-[var(--color-text-primary)]">
                    {item.journal?.topic_description ||
                      item.journal?.schedule?.subject?.name ||
                      'Sesi pembelajaran reguler'}
                  </p>
                  {item.notes && (
                    <div className="text-[11px] text-[var(--color-warning-fg)] bg-[var(--color-warning-bg)] border border-[var(--color-warning-border)]/60 rounded-[6px] px-2 py-1 font-medium">
                      Catatan Guru: {item.notes}
                    </div>
                  )}
                </div>
              );
            })
          )}
        </div>
      </BottomSheetModal>
    </div>
  );
}
