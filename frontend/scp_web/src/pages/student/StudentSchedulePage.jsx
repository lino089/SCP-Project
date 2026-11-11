import { useState, useEffect, useMemo, useCallback } from 'react';
import {
  RotateCw,
  User,
  MapPin,
  Clock,
  Calendar,
  Layers,
  GraduationCap,
  Download,
} from 'lucide-react';
import { useAuth } from '../../hooks/useAuth';
import { scheduleApi, academicSettingApi } from '../../services/scheduleApi';
import academicEventApi from '../../services/academicEventApi';
import {
  DAYS_LIST,
  DAY_TO_NUMBER,
  NUMBER_TO_DAY,
  resolveSlotTime,
} from '../../utils/timetableHelper';
import { generateSchedulePdf } from '../../utils/schedulePdfGenerator';
import { unwrap, unwrapList } from '../../utils/responseHelper';
import { todayLocalISO } from '../../utils/dateUtils';
import {
  Badge,
  Button,
  Modal,
  Select,
  SearchInput,
  useToast,
} from '../../components/shared';
import {
  ScheduleTimetableMatrix,
  ScheduleLegendBar,
} from '../../components/schedule';
import {
  ScheduleTableSkeleton,
  EmptyState,
  ErrorState,
} from '../../components/feedback';
import '../waka/ScheduleManagement.css';
import './StudentSchedule.css';

export default function StudentSchedulePage() {
  const { user } = useAuth();
  const { toast } = useToast();

  // Profil Siswa
  const student = useMemo(() => {
    return {
      name: user?.name || 'Peserta Didik',
      nis: user?.nis_nip || '-',
      className:
        user?.school_class?.name ||
        user?.schoolClass?.name ||
        user?.className ||
        (user?.class_id ? `Kelas #${user.class_id}` : 'Rombel Siswa'),
      classId: user?.class_id || null,
      level: user?.school_class?.level || user?.level || 10,
    };
  }, [user]);

  // Settings & System Config
  const [activeCycleSetting, setActiveCycleSetting] = useState(() => Number(user?.active_cycle || 1));
  const [selectedCycle, setSelectedCycle] = useState(() => Number(user?.active_cycle || 1));
  const [mondayIsUpacara, setMondayIsUpacara] = useState(() => (typeof user?.monday_is_upacara === 'boolean' ? user.monday_is_upacara : true));
  const [periodTemplates, setPeriodTemplates] = useState([]);
  const [academicYear, setAcademicYear] = useState('2026/2027');
  const [semester, setSemester] = useState('Ganjil');

  // Export State
  const [isExporting, setIsExporting] = useState(false);

  // Filter States
  const [selectedDay, setSelectedDay] = useState('Semua Hari');
  const [searchQuery, setSearchQuery] = useState('');

  // Schedule list & loading states
  const [schedules, setSchedules] = useState([]);
  const [todayEvent, setTodayEvent] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [fetchError, setFetchError] = useState(null);

  // Modal Detail Sesi KBM
  const [selectedDetailSchedule, setSelectedDetailSchedule] = useState(null);

  // 1. Ambil Template Jam & Pengaturan Akademik
  const fetchSettings = useCallback(async () => {
    try {
      // Ambil period templates (tersedia publik terautentikasi)
      const tplRes = await academicSettingApi.getPeriodTemplates();
      if (tplRes?.data && Array.isArray(tplRes.data)) {
        setPeriodTemplates(tplRes.data);
      }
    } catch {
      // Abaikan fallback default slots
    }

    try {
      const setRes = await academicSettingApi.getSettings();
      const sData = setRes?.data || setRes;
      if (sData) {
        if (sData.active_cycle) {
          setActiveCycleSetting(Number(sData.active_cycle));
        }
        if (typeof sData.monday_is_upacara === 'boolean') {
          setMondayIsUpacara(sData.monday_is_upacara);
        }
        if (sData.academic_year) {
          setAcademicYear(sData.academic_year);
        }
        if (sData.semester) {
          setSemester(sData.semester);
        }
      }
    } catch {
      // Fallback profil user jika role student tidak diizinkan membuka setting waka
      if (user?.active_cycle) {
        setActiveCycleSetting(Number(user.active_cycle));
      }
      if (typeof user?.monday_is_upacara === 'boolean') {
        setMondayIsUpacara(user.monday_is_upacara);
      }
    }
    try {
      const todayStr = todayLocalISO();
      const eventRes = await academicEventApi.checkExemption({ for_my_class: 1, date: todayStr });
      const evtData = unwrap(eventRes);
      if (evtData?.disabling_event) {
        setTodayEvent(evtData.disabling_event);
      } else if (evtData?.active_events && evtData.active_events.length > 0) {
        setTodayEvent(evtData.active_events[0]);
      } else {
        setTodayEvent(null);
      }
    } catch {
      // Abaikan fallback
    }
  }, [user]);

  // 2. Ambil Data Jadwal Kelas Siswa dari Backend (P-14: signal guard)
  const fetchSchedules = useCallback(async (abortSignal) => {
    // Validasi abortSignal: pastikan instance AbortSignal sah, abaikan jika SyntheticEvent dari onClick
    const validSignal = abortSignal instanceof AbortSignal ? abortSignal : undefined;
    if (validSignal?.aborted) return;

    setIsLoading(true);
    setFetchError(null);

    try {
      const params = {
        cycle: selectedCycle,
        all: 1,
        per_page: 100,
      };
      if (student.classId) {
        params.class_id = student.classId;
      }

      const config = validSignal ? { signal: validSignal } : {};
      const res = await scheduleApi.getSchedules(params, config);
      if (validSignal?.aborted) return;

      const raw = unwrapList(res);

      const mapped = raw.map((s) => ({
        ...s,
        id: s.id,
        cycle: Number(s.cycle_type || s.cycle || selectedCycle),
        cycle_type: Number(s.cycle_type || s.cycle || selectedCycle),
        day:
          typeof s.day_of_week === 'number'
            ? NUMBER_TO_DAY[s.day_of_week] || 'Senin'
            : s.day || 'Senin',
        day_of_week:
          typeof s.day_of_week === 'number'
            ? s.day_of_week
            : DAY_TO_NUMBER[s.day] || 1,
        slot: Number(s.period_number || s.slot || 1),
        period_number: Number(s.period_number || s.slot || 1),
        duration: Number(s.duration_periods || s.duration || 1),
        duration_periods: Number(s.duration_periods || s.duration || 1),
        teacher_id: s.teacher_id || s.teacher?.id,
        class_id: s.class_id || s.school_class?.id,
        room_id: s.room_id || s.room?.id,
        subject_id: s.subject_id || s.subject?.id,
        is_teaching_exempted: Boolean(s.is_teaching_exempted),
        exemption_reason: s.exemption_reason || null,
        event_type: s.event_type || null,
        academic_event_id: s.academic_event_id || null,
        teacherName: s.teacher?.name || s.teacherName || 'Guru Pengampu',
        className:
          s.school_class?.name ||
          s.schoolClass?.name ||
          s.className ||
          student.className,
        level: s.school_class?.level || s.level || student.level,
        roomName: s.room?.name || s.roomName || 'Ruang',
        roomCapacity: s.room?.capacity,
        subjectName: s.subject?.name || s.subjectName || 'Mata Pelajaran',
      }));

      setSchedules(mapped);
    } catch (err) {
      if (
        err?.name === 'CanceledError' ||
        err?.code === 'ERR_CANCELED' ||
        err?.isCanceled ||
        err?.raw?.name === 'CanceledError' ||
        err?.raw?.code === 'ERR_CANCELED' ||
        validSignal?.aborted
      ) {
        return;
      }
      console.warn('Gagal memuat jadwal siswa:', err);
      setFetchError(
        err?.message || 'Gagal memuat jadwal pelajaran dari server. Silakan coba kembali.'
      );
      setSchedules([]);
    } finally {
      if (!validSignal?.aborted) {
        setIsLoading(false);
      }
    }
  }, [selectedCycle, student.classId, student.className, student.level]);

  useEffect(() => {
    fetchSettings();
  }, [fetchSettings]);

  useEffect(() => {
    const controller = new AbortController();
    fetchSchedules(controller.signal);
    return () => controller.abort();
  }, [fetchSchedules]);

  // Statistik Ringkasan Jadwal Kelas
  const scheduleStats = useMemo(() => {
    const totalJP = schedules.reduce(
      (sum, s) => sum + Number(s.duration || s.duration_periods || 1),
      0
    );
    const uniqueSubjects = new Set(
      schedules.map((s) => s.subject_id || s.subjectName)
    ).size;
    const uniqueTeachers = new Set(
      schedules.map((s) => s.teacher_id || s.teacherName)
    ).size;

    return { totalJP, uniqueSubjects, uniqueTeachers };
  }, [schedules]);

  // Filter Jadwal berdasarkan Hari & Kata Kunci Pencarian
  const filteredSchedules = useMemo(() => {
    return schedules.filter((s) => {
      // 1. Filter Hari
      if (selectedDay !== 'Semua Hari' && s.day !== selectedDay) {
        return false;
      }
      // 2. Filter Pencarian
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase().trim();
        const matchSubject = s.subjectName?.toLowerCase().includes(q);
        const matchTeacher = s.teacherName?.toLowerCase().includes(q);
        const matchRoom = s.roomName?.toLowerCase().includes(q);
        if (!matchSubject && !matchTeacher && !matchRoom) {
          return false;
        }
      }
      return true;
    });
  }, [schedules, selectedDay, searchQuery]);

  // Kolom Hari yang Dirender dalam Matriks
  const matrixDays = useMemo(() => {
    if (selectedDay === 'Semua Hari') {
      return DAYS_LIST;
    }
    return [selectedDay];
  }, [selectedDay]);

  // Resolusi jam detail untuk modal terpilih
  const detailSlotTime = useMemo(() => {
    if (!selectedDetailSchedule) return null;
    return resolveSlotTime(
      selectedDetailSchedule.day,
      selectedDetailSchedule.slot || selectedDetailSchedule.period_number,
      selectedDetailSchedule.duration || selectedDetailSchedule.duration_periods || 1,
      mondayIsUpacara,
      periodTemplates
    );
  }, [selectedDetailSchedule, mondayIsUpacara, periodTemplates]);

  // Ekspor Jadwal Kelas Terpadu ke PDF (Putaran 1 & Putaran 2 Sekaligus)
  const handleExportPdf = async () => {
    setIsExporting(true);
    try {
      const paramsP1 = { cycle: 1, all: 1, per_page: 100 };
      const paramsP2 = { cycle: 2, all: 1, per_page: 100 };
      if (student.classId) {
        paramsP1.class_id = student.classId;
        paramsP2.class_id = student.classId;
      }

      const [resP1, resP2] = await Promise.all([
        scheduleApi.getSchedules(paramsP1),
        scheduleApi.getSchedules(paramsP2),
      ]);

      const mapStudentItems = (rawList, cNum) => {
        return rawList.map((s) => ({
          ...s,
          id: s.id,
          cycle: Number(s.cycle_type || s.cycle || cNum),
          cycle_type: Number(s.cycle_type || s.cycle || cNum),
          day:
            typeof s.day_of_week === 'number'
              ? NUMBER_TO_DAY[s.day_of_week] || 'Senin'
              : s.day || 'Senin',
          day_of_week:
            typeof s.day_of_week === 'number'
              ? s.day_of_week
              : DAY_TO_NUMBER[s.day] || 1,
          slot: Number(s.period_number || s.slot || 1),
          period_number: Number(s.period_number || s.slot || 1),
          duration: Number(s.duration_periods || s.duration || 1),
          duration_periods: Number(s.duration_periods || s.duration || 1),
          teacherName: s.teacher?.name || s.teacherName || 'Guru Pengampu',
          className:
            s.school_class?.name ||
            s.schoolClass?.name ||
            s.className ||
            student.className,
          roomName: s.room?.name || s.roomName || 'Ruang',
          subjectName: s.subject?.name || s.subjectName || 'Mata Pelajaran',
        }));
      };

      const p1Data = mapStudentItems(unwrapList(resP1), 1);
      const p2Data = mapStudentItems(unwrapList(resP2), 2);

      generateSchedulePdf({
        role: 'student',
        user: {
          name: student.name,
          nis: student.nis,
          className: student.className,
        },
        schedulesByCycle: {
          1: p1Data,
          2: p2Data,
        },
        cycles: [1, 2],
        mondayIsUpacara,
        periodTemplates,
        academicYear,
        semester,
      });
      toast.success(`Jadwal pelajaran kelas ${student.className} (Putaran 1 & 2) berhasil diekspor ke PDF.`);
    } catch (err) {
      console.error('Gagal mengekspor jadwal siswa:', err);
      toast.error('Gagal mengekspor jadwal pelajaran ke format PDF.');
    } finally {
      setIsExporting(false);
    }
  };

  return (
    <div className="student-schedule-page">
      {/* 1. Header Identitas Halaman */}
      <div className="student-schedule__header">
        <div className="student-schedule__title-group">
          <div className="flex items-center gap-2">
            <h1>Jadwal Pelajaran Siswa</h1>
            <Badge variant="outline">Kelas {student.className}</Badge>
          </div>
          <p className="student-schedule__subtitle">
            SMK NEGERI 1 BANTUL &bull; Alokasi KBM Rombel {student.className} &bull; Putaran{' '}
            {selectedCycle} {activeCycleSetting === selectedCycle && '(Aktif)'}
          </p>
        </div>

        <div className="student-schedule__header-actions">
          <Button
            variant="outline"
            size="sm"
            icon={Download}
            disabled={isLoading || isExporting}
            onClick={handleExportPdf}
            title="Unduh jadwal pelajaran resmi format PDF"
          >
            {isExporting ? 'Mengekspor...' : 'Ekspor PDF'}
          </Button>

          <Button
            variant="outline"
            size="sm"
            icon={RotateCw}
            disabled={isLoading}
            onClick={() => fetchSchedules()}
          >
            Muat Ulang
          </Button>
        </div>
      </div>

      {/* 2. Kartu Ringkasan Metrik Beban Belajar */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <div className="bg-white border border-gray-200 rounded-lg p-3.5 shadow-xs">
          <span className="text-[11px] font-semibold text-gray-500 uppercase tracking-wider block mb-1">
            Rombel Kelas
          </span>
          <div className="text-base font-bold text-gray-900 font-mono">
            {student.className}
          </div>
          <span className="text-[11px] text-gray-400">Tingkat {student.level}</span>
        </div>

        <div className="bg-white border border-gray-200 rounded-lg p-3.5 shadow-xs">
          <span className="text-[11px] font-semibold text-gray-500 uppercase tracking-wider block mb-1">
            Beban Belajar
          </span>
          <div className="text-base font-bold text-gray-900 font-mono">
            {scheduleStats.totalJP} JP
          </div>
          <span className="text-[11px] text-gray-400">Jam Pelajaran / Minggu</span>
        </div>

        <div className="bg-white border border-gray-200 rounded-lg p-3.5 shadow-xs">
          <span className="text-[11px] font-semibold text-gray-500 uppercase tracking-wider block mb-1">
            Mata Pelajaran
          </span>
          <div className="text-base font-bold text-gray-900 font-mono">
            {scheduleStats.uniqueSubjects} Mapel
          </div>
          <span className="text-[11px] text-gray-400">Kurikulum Aktif</span>
        </div>

        <div className="bg-white border border-gray-200 rounded-lg p-3.5 shadow-xs">
          <span className="text-[11px] font-semibold text-gray-500 uppercase tracking-wider block mb-1">
            Guru Pengampu
          </span>
          <div className="text-base font-bold text-gray-900 font-mono">
            {scheduleStats.uniqueTeachers} Guru
          </div>
          <span className="text-[11px] text-gray-400">Tenaga Pendidik</span>
        </div>
      </div>

      {/* Banner Agenda Khusus / Kalender Akademik Hari Ini */}
      {todayEvent && (
        <div style={{ marginBottom: '1.25rem', padding: '1rem 1.25rem', backgroundColor: todayEvent.disables_teaching ? '#fffbeb' : '#f0fdf4', border: `1px solid ${todayEvent.disables_teaching ? '#fde68a' : '#bbf7d0'}`, borderRadius: '0.75rem' }}>
          <div className="flex items-start gap-3">
            <Calendar className={`w-5 h-5 mt-0.5 shrink-0 ${todayEvent.disables_teaching ? 'text-amber-600' : 'text-emerald-600'}`} />
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <h3 className={`text-sm font-bold ${todayEvent.disables_teaching ? 'text-amber-950' : 'text-emerald-950'}`}>
                  Agenda Hari Ini: {todayEvent.title}
                </h3>
                <Badge variant={todayEvent.disables_teaching ? 'warning' : 'success'}>
                  {todayEvent.type === 'holiday' ? 'Libur Sekolah' : todayEvent.type === 'exam' ? 'Agenda Ujian' : 'Agenda Khusus'}
                </Badge>
              </div>
              {todayEvent.description && (
                <p className={`text-xs mt-1 ${todayEvent.disables_teaching ? 'text-amber-800' : 'text-emerald-800'}`}>
                  {todayEvent.description}
                </p>
              )}
              {todayEvent.disables_teaching && (
                <p className="text-xs font-semibold text-rose-700 mt-1">
                  KBM reguler di kelas ditiadakan selama agenda ini berlangsung.
                </p>
              )}
            </div>
          </div>
        </div>
      )}

      {/* 3. Kartu Informasi Upacara Hari Senin */}
      <div className="schedule-ceremony-card">
        <div className="schedule-ceremony-card__info">
          <div className="schedule-ceremony-card__top">
            <span className="schedule-ceremony-card__label">Upacara hari Senin</span>
            <Badge variant={mondayIsUpacara ? 'success' : 'neutral'}>
              {mondayIsUpacara ? 'Aktif' : 'Nonaktif'}
            </Badge>
          </div>
          <div className="schedule-ceremony-card__title">
            {mondayIsUpacara ? 'Upacara Bendera Aktif' : 'KBM Normal'}
          </div>
          <p className="schedule-ceremony-card__desc">
            {mondayIsUpacara
              ? 'Jam ke-1 dialokasikan untuk upacara bendera (KBM pelajaran dimulai 08:00 WIB).'
              : 'Tidak ada upacara bendera, KBM jam ke-1 dimulai normal pukul 07:15 WIB.'}
          </p>
        </div>
      </div>

      {/* 4. Filter Card Terpadu */}
      <div className="schedule-filters-card">
        <div className="schedule-filters">
          {/* Putaran Switcher */}
          <div className="schedule-filter-item">
            <span className="schedule-filter-label">Putaran Jadwal</span>
            <div className="inline-flex items-center bg-gray-100 p-1 rounded-md gap-1 w-fit">
              <button
                type="button"
                className={`px-3 py-1.5 rounded text-[12px] transition-all cursor-pointer ${
                  selectedCycle === 1
                    ? 'bg-white text-gray-900 shadow-xs font-semibold'
                    : 'text-gray-600 hover:text-gray-900 font-normal'
                }`}
                onClick={() => setSelectedCycle(1)}
              >
                Putaran 1 {activeCycleSetting === 1 && '(Aktif)'}
              </button>
              <button
                type="button"
                className={`px-3 py-1.5 rounded text-[12px] transition-all cursor-pointer ${
                  selectedCycle === 2
                    ? 'bg-white text-gray-900 shadow-xs font-semibold'
                    : 'text-gray-600 hover:text-gray-900 font-normal'
                }`}
                onClick={() => setSelectedCycle(2)}
              >
                Putaran 2 {activeCycleSetting === 2 && '(Aktif)'}
              </button>
            </div>
          </div>

          {/* Filter Hari */}
          <div className="schedule-filter-item">
            <Select
              label="Hari Pelajaran"
              value={selectedDay}
              options={[
                { value: 'Semua Hari', label: 'Semua Hari (Senin - Jumat)' },
                ...DAYS_LIST.map((d) => ({ value: d, label: d })),
              ]}
              onChange={(e) => setSelectedDay(e.target.value)}
            />
          </div>

          {/* Input Pencarian */}
          <div className="schedule-filter-item flex-1">
            <span className="schedule-filter-label">Pencarian</span>
            <SearchInput
              value={searchQuery}
              onChange={setSearchQuery}
              onClear={() => setSearchQuery('')}
              placeholder="Cari mata pelajaran, guru pengampu, atau ruang..."
            />
          </div>
        </div>

        {/* Legend Bar Standar Siswa */}
        <ScheduleLegendBar
          mode="student"
          mondayIsUpacara={mondayIsUpacara}
          extraStats={
            <span>
              Menampilkan:{' '}
              <strong className="text-gray-900">
                {filteredSchedules.length} Sesi Terjadwal
              </strong>
            </span>
          }
        />
      </div>

      {/* 5. Konten Utama: Skeleton | Error | Empty | Matriks Jadwal */}
      {isLoading ? (
        <ScheduleTableSkeleton
          count={1}
          days={matrixDays}
          hasCeremony={mondayIsUpacara}
        />
      ) : fetchError ? (
        <div className="bg-white border border-red-200 rounded-lg p-6">
          <ErrorState
            title="Gagal Memuat Jadwal Pelajaran"
            message={fetchError}
            onRetry={() => fetchSchedules()}
            retryLabel="Muat Ulang Jadwal"
          />
        </div>
      ) : filteredSchedules.length === 0 ? (
        <EmptyState
          type={searchQuery || selectedDay !== 'Semua Hari' ? 'search' : 'default'}
          title={
            searchQuery || selectedDay !== 'Semua Hari'
              ? 'Tidak Ada Jadwal Ditemukan'
              : 'Belum Ada Jadwal Pelajaran'
          }
          description={
            searchQuery
              ? `Tidak ditemukan alokasi jadwal yang cocok dengan kata kunci "${searchQuery}".`
              : selectedDay !== 'Semua Hari'
              ? `Tidak ada jadwal pelajaran pada hari ${selectedDay} di Putaran ${selectedCycle}.`
              : `Belum ada alokasi jadwal pelajaran yang terdaftar untuk kelas ${student.className} pada Putaran ${selectedCycle}.`
          }
          actionLabel={
            searchQuery || selectedDay !== 'Semua Hari' ? 'Reset Filter' : undefined
          }
          onAction={
            searchQuery || selectedDay !== 'Semua Hari'
              ? () => {
                  setSelectedDay('Semua Hari');
                  setSearchQuery('');
                }
              : undefined
          }
        />
      ) : (
        <div className="space-y-4">
          {/* Header Identitas Rombel Kelas */}
          <div className="p-4 bg-white border border-gray-200 rounded-lg shadow-xs flex items-center justify-between flex-wrap gap-3">
            <div>
              <h2 className="text-sm font-bold text-gray-900 uppercase tracking-wide">
                Matriks Jadwal Belajar Kelas {student.className}
              </h2>
              <span className="text-xs text-gray-500">
                SMK NEGERI 1 BANTUL &bull; Putaran {selectedCycle}{' '}
                {activeCycleSetting === selectedCycle && '(Aktif)'}
              </span>
            </div>

            <div className="flex items-center gap-2">
              <Badge variant="outline">
                {filteredSchedules.reduce(
                  (sum, s) => sum + Number(s.duration || s.duration_periods || 1),
                  0
                )}{' '}
                JP Terjadwal
              </Badge>
            </div>
          </div>

          {/* Matriks Timetable Standar Institusi */}
          <ScheduleTimetableMatrix
            schedules={filteredSchedules}
            matrixDays={matrixDays}
            mondayIsUpacara={mondayIsUpacara}
            periodTemplates={periodTemplates}
            role="student"
            onCardClick={(item) => setSelectedDetailSchedule(item)}
          />
        </div>
      )}

      {/* 6. Modal Informasi Detail Sesi Pembelajaran (Read-Only) */}
      <Modal
        isOpen={Boolean(selectedDetailSchedule)}
        onClose={() => setSelectedDetailSchedule(null)}
        title="Detail Sesi Pembelajaran"
        maxWidth="max-w-lg"
      >
        {selectedDetailSchedule && (
          <div className="schedule-detail-box">
            <div className="schedule-detail-hero">
              <div>
                <span className="text-[11px] font-semibold text-blue-600 uppercase tracking-wide block mb-0.5">
                  Mata Pelajaran
                </span>
                <div className="schedule-detail-subject">
                  {selectedDetailSchedule.subjectName}
                </div>
              </div>
              <Badge variant="info">
                {selectedDetailSchedule.duration || selectedDetailSchedule.duration_periods || 1} JP
              </Badge>
            </div>

            <div className="schedule-detail-grid">
              {selectedDetailSchedule.is_teaching_exempted && (
                <div style={{ gridColumn: '1 / -1', padding: '0.75rem', backgroundColor: '#fffbeb', border: '1px solid #fde68a', borderRadius: '0.5rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                  <Calendar className="w-4 h-4 text-amber-600 shrink-0" />
                  <span className="text-xs text-amber-900 font-medium">
                    <strong>KBM Dikecualikan:</strong> {selectedDetailSchedule.exemption_reason || 'Kegiatan Kalender Akademik'}
                  </span>
                </div>
              )}

              <div className="schedule-detail-item">
                <span className="schedule-detail-label">Guru Pengampu</span>
                <span className="schedule-detail-value flex items-center gap-1.5">
                  <User size={14} className="text-gray-400 shrink-0" />
                  <span>
                    {selectedDetailSchedule.teacherName}
                  </span>
                </span>
              </div>

              <div className="schedule-detail-item">
                <span className="schedule-detail-label">Ruang Belajar</span>
                <span className="schedule-detail-value flex items-center gap-1.5">
                  <MapPin size={14} className="text-gray-400 shrink-0" />
                  <span>Ruang {selectedDetailSchedule.roomName}</span>
                </span>
              </div>

              <div className="schedule-detail-item">
                <span className="schedule-detail-label">Hari Pelajaran</span>
                <span className="schedule-detail-value flex items-center gap-1.5">
                  <Calendar size={14} className="text-gray-400 shrink-0" />
                  <span>{selectedDetailSchedule.day}</span>
                </span>
              </div>

              <div className="schedule-detail-item">
                <span className="schedule-detail-label">Jam &amp; Waktu Riil</span>
                <span className="schedule-detail-value flex items-center gap-1.5">
                  <Clock size={14} className="text-gray-400 shrink-0" />
                  <span className="font-mono">
                    Jam Ke-{selectedDetailSchedule.slot || selectedDetailSchedule.period_number}
                    {' '}({detailSlotTime?.startTime || '--:--'} - {detailSlotTime?.endTime || '--:--'} WIB)
                  </span>
                </span>
              </div>

              <div className="schedule-detail-item">
                <span className="schedule-detail-label">Rombel Kelas</span>
                <span className="schedule-detail-value flex items-center gap-1.5">
                  <GraduationCap size={14} className="text-gray-400 shrink-0" />
                  <span>Kelas {student.className}</span>
                </span>
              </div>

              <div className="schedule-detail-item">
                <span className="schedule-detail-label">Putaran Jadwal</span>
                <span className="schedule-detail-value flex items-center gap-1.5">
                  <Layers size={14} className="text-gray-400 shrink-0" />
                  <span>
                    Putaran {selectedDetailSchedule.cycle || selectedDetailSchedule.cycle_type}
                    {activeCycleSetting === Number(selectedDetailSchedule.cycle || selectedDetailSchedule.cycle_type) && ' (Aktif)'}
                  </span>
                </span>
              </div>
            </div>

            <div className="flex justify-end pt-3 border-t border-gray-100">
              <Button
                variant="secondary"
                size="sm"
                onClick={() => setSelectedDetailSchedule(null)}
              >
                Tutup
              </Button>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
}
