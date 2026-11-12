import { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  AlertCircle,
  CheckCircle2,
  AlertTriangle,
  Info,
  RotateCw,
  Clock,
  Layers,
  BookOpen,
  Calendar,
  FileText,
  Download,
  ChevronDown,
} from 'lucide-react';
import { useAuth } from '../../hooks/useAuth';
import { journalApi } from '../../services/journalApi';
import { leaveApi } from '../../services/leaveApi';
import { scheduleApi, academicSettingApi } from '../../services/scheduleApi';
import academicEventApi from '../../services/academicEventApi';
import {
  DAYS_LIST,
  DAY_TO_NUMBER,
  NUMBER_TO_DAY,
  detectScheduleConflicts,
} from '../../utils/timetableHelper';
import { generateSchedulePdf } from '../../utils/schedulePdfGenerator';
import { unwrap, unwrapList } from '../../utils/responseHelper';
import { todayLocalISO } from '../../utils/dateUtils';
import {
  Badge,
  Button,
  Select,
  SearchInput,
  useToast,
} from '../../components/shared';
import {
  ScheduleTimetableMatrix,
  ScheduleLegendBar,
} from '../../components/schedule';
import { ScheduleTableSkeleton, EmptyState, ErrorState } from '../../components/feedback';
import '../waka/ScheduleManagement.css';
import './TeacherSchedule.css';

export default function TeacherSchedulePage() {
  const navigate = useNavigate();
  const { user, isWaliKelas } = useAuth();
  const { toast } = useToast();

  // Konteks Penugasan: Jadwal Mengajar Pribadi vs Jadwal Kelas Binaan Wali Kelas
  const homeroomAssignment = useMemo(() => {
    return user?.assignments?.find((a) => a.type === 'wali_kelas');
  }, [user]);

  const homeroomClassId = homeroomAssignment?.class_id;
  const homeroomClassName =
    homeroomAssignment?.school_class?.name ||
    homeroomAssignment?.class_name ||
    (homeroomClassId ? `Kelas #${homeroomClassId}` : 'Kelas Binaan');

  const [scheduleContext, setScheduleContext] = useState('my_schedule'); // 'my_schedule' | 'homeroom'

  // Settings & System Config
  const [activeCycleSetting, setActiveCycleSetting] = useState(() => Number(user?.active_cycle || 1));
  const [selectedCycle, setSelectedCycle] = useState(() => Number(user?.active_cycle || 1));
  const [mondayIsUpacara, setMondayIsUpacara] = useState(() => (typeof user?.monday_is_upacara === 'boolean' ? user.monday_is_upacara : true));
  const [periodTemplates, setPeriodTemplates] = useState([]);
  const [academicYear, setAcademicYear] = useState('2026/2027');
  const [semester, setSemester] = useState('Ganjil');

  // Export PDF States
  const [isExporting, setIsExporting] = useState(false);
  const [isExportMenuOpen, setIsExportMenuOpen] = useState(false);
  const exportMenuRef = useRef(null);

  // Tutup dropdown menu ekspor saat klik di luar elemen
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (exportMenuRef.current && !exportMenuRef.current.contains(event.target)) {
        setIsExportMenuOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Filter States
  const [selectedDay, setSelectedDay] = useState('Semua Hari');
  const [searchQuery, setSearchQuery] = useState('');

  // Schedules state & Load/Error states
  const [schedules, setSchedules] = useState([]);
  const [homeroomSchedules, setHomeroomSchedules] = useState([]);
  const [missingJournals, setMissingJournals] = useState([]);
  const [todayExemption, setTodayExemption] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [fetchError, setFetchError] = useState(null);

  // Perizinan Guru dari Backend (untuk badge & banner status hari ini)
  const [teacherLeaves, setTeacherLeaves] = useState([]);

  // Ambil konfigurasi akademik aktif & template jam KBM
  const fetchSettings = useCallback(async () => {
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
        if (Array.isArray(sData.period_templates)) {
          setPeriodTemplates(sData.period_templates);
        }
      }

      academicEventApi.checkExemption().then((res) => {
        const exData = res?.data ?? res;
        if (exData && (exData.disabling_event !== undefined || exData.is_teaching_exempted !== undefined)) {
          setTodayExemption(exData);
        }
      }).catch(() => {});
    } catch {
      // Fallback ke profil user jika ada
      if (user?.active_cycle) {
        setActiveCycleSetting(Number(user.active_cycle));
      }
      if (typeof user?.monday_is_upacara === 'boolean') {
        setMondayIsUpacara(user.monday_is_upacara);
      }
    }
  }, [user?.active_cycle, user?.monday_is_upacara]);

  // Ambil daftar perizinan mengajar guru dari backend
  const fetchTeacherLeaves = useCallback(async () => {
    try {
      const res = await leaveApi.getTeacherLeaveRequests({ per_page: 50 });
      const list = Array.isArray(res) ? res : Array.isArray(res?.data) ? res.data : [];
      setTeacherLeaves(list);
    } catch (err) {
      console.warn('Gagal memuat perizinan guru:', err);
    }
  }, []);

  // Izin mengajar aktif hari ini dari backend (P-11: todayLocalISO)
  const todayStr = useMemo(() => todayLocalISO(), []);
  const todayActiveLeave = useMemo(() => {
    return teacherLeaves.find(
      (l) => l.date === todayStr && (l.status === 'pending' || l.status === 'approved')
    );
  }, [teacherLeaves, todayStr]);

  // Ambil data jadwal mengajar guru dari database riil (P-12: allSettled, P-14: signal guard)
  const fetchData = useCallback(async (abortSignal) => {
    const validSignal = abortSignal instanceof AbortSignal ? abortSignal : undefined;
    if (validSignal?.aborted) return;

    setIsLoading(true);
    setFetchError(null);
    try {
      const config = validSignal ? { signal: validSignal } : {};
      const [schedRes, missingRes] = await Promise.allSettled([
        journalApi.getTeacherSchedules({ cycle: selectedCycle, all: 1, per_page: 100 }, config),
        journalApi.getMissingJournals({}, config),
      ]);

      const rawSchedules = schedRes.status === 'fulfilled' ? unwrapList(schedRes.value) : [];

      // Mapping data jadwal dengan normalisasi nama kelas yang 100% aman
      const mapped = rawSchedules.map((s) => ({
        ...s,
        id: s.id,
        cycle: Number(s.cycle_type || s.cycle || 1),
        cycle_type: Number(s.cycle_type || s.cycle || 1),
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
        teacherName: s.teacher?.name || s.teacherName || user?.name || 'Guru',
        className:
          s.school_class?.name ||
          s.schoolClass?.name ||
          s.class_name ||
          s.className ||
          (s.class_id ? `Kelas #${s.class_id}` : '-'),
        level: s.school_class?.level || s.level || 10,
        roomName: s.room?.name || s.roomName || 'Ruang',
        subjectName: s.subject?.name || s.subjectName || 'Mata Pelajaran',
      }));

      setSchedules(mapped);

      if (missingRes.status === 'fulfilled') {
        setMissingJournals(unwrapList(missingRes.value));
      } else {
        setMissingJournals([]);
      }
    } catch (err) {
      if (err?.isCanceled || err?.name === 'CanceledError' || err?.code === 'ERR_CANCELED') return;
      console.warn('Gagal memuat jadwal guru:', err);
      setFetchError(err.message || 'Gagal memuat jadwal mengajar dari server.');
      setSchedules([]);
    } finally {
      setIsLoading(false);
    }
  }, [selectedCycle, user?.name]);

  // Pemuatan data jadwal kelas binaan jika tab kelas binaan aktif
  const fetchHomeroomData = useCallback(async (abortSignal) => {
    if (scheduleContext !== 'homeroom' || !homeroomClassId) return;
    const validSignal = abortSignal instanceof AbortSignal ? abortSignal : undefined;
    if (validSignal?.aborted) return;

    setIsLoading(true);
    setFetchError(null);
    try {
      const config = validSignal ? { signal: validSignal } : {};
      const res = await scheduleApi.getSchedules({
        class_id: homeroomClassId,
        cycle: selectedCycle,
        all: 1,
        per_page: 100,
      }, config);

      const raw = unwrapList(res);

      const mapped = raw.map((s) => ({
        ...s,
        id: s.id,
        cycle: Number(s.cycle_type || s.cycle || 1),
        cycle_type: Number(s.cycle_type || s.cycle || 1),
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
        teacherName: s.teacher?.name || s.teacherName || 'Guru',
        className:
          s.school_class?.name ||
          s.schoolClass?.name ||
          s.class_name ||
          s.className ||
          homeroomClassName,
        level: s.school_class?.level || s.level || 10,
        roomName: s.room?.name || s.roomName || 'Ruang',
        subjectName: s.subject?.name || s.subjectName || 'Mata Pelajaran',
      }));

      setHomeroomSchedules(mapped);
    } catch (err) {
      if (err?.isCanceled || err?.name === 'CanceledError' || err?.code === 'ERR_CANCELED') return;
      console.warn('Gagal memuat jadwal kelas binaan:', err);
      setFetchError(err.message || 'Gagal memuat jadwal kelas binaan dari server.');
      setHomeroomSchedules([]);
    } finally {
      setIsLoading(false);
    }
  }, [scheduleContext, homeroomClassId, selectedCycle, homeroomClassName]);

  useEffect(() => {
    fetchSettings();
  }, [fetchSettings]);

  useEffect(() => {
    const controller = new AbortController();
    let isMounted = true;
    const loadAll = async () => {
      if (scheduleContext === 'homeroom') {
        await fetchHomeroomData(controller.signal);
      } else {
        await fetchData(controller.signal);
      }
      if (isMounted) {
        await fetchTeacherLeaves();
      }
    };
    loadAll();

    return () => {
      isMounted = false;
      controller.abort();
    };
  }, [scheduleContext, fetchData, fetchHomeroomData, fetchTeacherLeaves]);

  // Jadwal aktif yang sedang dirender berdasarkan konteks seleksi
  const activeSchedules = useMemo(() => {
    return scheduleContext === 'homeroom' ? homeroomSchedules : schedules;
  }, [scheduleContext, homeroomSchedules, schedules]);

  // Deteksi bentrok jadwal
  const conflictScheduleIds = useMemo(() => {
    return detectScheduleConflicts(activeSchedules);
  }, [activeSchedules]);

  // Filter jadwal berdasarkan Hari dan Kata Kunci Pencarian
  const filteredSchedules = useMemo(() => {
    return activeSchedules.filter((s) => {
      // 1. Filter Hari
      if (selectedDay !== 'Semua Hari' && s.day !== selectedDay) {
        return false;
      }
      // 2. Filter Pencarian
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase().trim();
        const matchesClass = s.className?.toLowerCase().includes(q);
        const matchesSubject = s.subjectName?.toLowerCase().includes(q);
        const matchesTeacher = s.teacherName?.toLowerCase().includes(q);
        const matchesRoom = s.roomName?.toLowerCase().includes(q);
        return matchesClass || matchesSubject || matchesTeacher || matchesRoom;
      }
      return true;
    });
  }, [activeSchedules, selectedDay, searchQuery]);

  // Rekapitulasi Metrik Beban Mengajar Guru (Jadwal Pribadi)
  const teacherStats = useMemo(() => {
    const totalJP = schedules.reduce(
      (sum, s) => sum + Number(s.duration || s.duration_periods || 1),
      0
    );
    const uniqueClasses = new Set(schedules.map((s) => s.class_id)).size;
    const uniqueSubjects = new Set(schedules.map((s) => s.subject_id)).size;

    return {
      totalJP,
      uniqueClasses,
      uniqueSubjects,
    };
  }, [schedules]);

  // Navigasi ke halaman form Jurnal & Presensi
  const handleOpenJournal = (item) => {
    if (item.is_teaching_exempted || item.journal_status === 'exempted') {
      toast.info(
        `Jadwal kelas ${item.school_class?.name || item.class_name || ''} dibebaskan dari KBM karena terdapat agenda sekolah: ${item.exemption_reason || 'Kegiatan Khusus'}.`
      );
      return;
    }

    navigate('/teacher/journal', {
      state: {
        schedule: item,
        fromSchedule: true,
      },
    });
  };

  // Render Status Badge pada kartu jadwal
  const renderStatusBadge = (item) => {
    if (item.is_teaching_exempted || item.journal_status === 'exempted') {
      return (
        <Badge variant="warning" title={item.exemption_reason || 'Dikecualikan dari KBM'}>
          {item.exemption_reason ? `Dikecualikan: ${item.exemption_reason}` : 'Dikecualikan KBM'}
        </Badge>
      );
    }

    if (scheduleContext === 'my_schedule' && todayActiveLeave) {
      if (todayActiveLeave.status === 'approved') {
        return <Badge variant="warning">Izin Disetujui</Badge>;
      }
      return <Badge variant="info">Izin Menunggu Verifikasi</Badge>;
    }
    if (item.journal_status === 'completed') {
      return <Badge variant="success">Jurnal Selesai</Badge>;
    }
    if (item.journal_status === 'ongoing') {
      return <Badge variant="info">Sedang Berlangsung</Badge>;
    }
    if (item.journal_status === 'teacher_absent') {
      return <Badge variant="danger">Guru Berhalangan</Badge>;
    }
    return <Badge variant="neutral">Jurnal Belum Diisi</Badge>;
  };

  // Hari yang akan ditampilkan dalam matriks (Semua Hari atau 1 Hari tertentu)
  const isAllDaysView = selectedDay === 'Semua Hari';
  const matrixDays = useMemo(() => {
    if (isAllDaysView) {
      return DAYS_LIST;
    }
    return [selectedDay];
  }, [isAllDaysView, selectedDay]);

  // Ekspor Jadwal Terpadu ke PDF (Putaran 1 & Putaran 2 Sekaligus)
  const handleExportPdf = async (target = 'my_schedule') => {
    setIsExporting(true);
    try {
      if (target === 'homeroom') {
        const [resP1, resP2] = await Promise.all([
          scheduleApi.getSchedules({ class_id: homeroomClassId, cycle: 1, all: 1, per_page: 100 }),
          scheduleApi.getSchedules({ class_id: homeroomClassId, cycle: 2, all: 1, per_page: 100 }),
        ]);

        const mapHomeroomItems = (rawList, cNum) => {
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
              homeroomClassName,
            roomName: s.room?.name || s.roomName || 'Ruang',
            subjectName: s.subject?.name || s.subjectName || 'Mata Pelajaran',
          }));
        };

        const p1Data = mapHomeroomItems(unwrapList(resP1), 1);
        const p2Data = mapHomeroomItems(unwrapList(resP2), 2);

        generateSchedulePdf({
          role: 'homeroom',
          user,
          schedulesByCycle: {
            1: p1Data,
            2: p2Data,
          },
          cycles: [1, 2],
          mondayIsUpacara,
          periodTemplates,
          academicYear,
          semester,
          homeroomClassName,
        });
        toast.success(`Jadwal kelas binaan ${homeroomClassName} (Putaran 1 & 2) berhasil diekspor.`);
      } else {
        const [resP1, resP2] = await Promise.all([
          journalApi.getTeacherSchedules({ cycle: 1, all: 1, per_page: 100 }),
          journalApi.getTeacherSchedules({ cycle: 2, all: 1, per_page: 100 }),
        ]);

        const mapTeacherItems = (rawList, cNum) => {
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
            teacherName: s.teacher?.name || s.teacherName || user?.name || 'Guru',
            className:
              s.school_class?.name ||
              s.schoolClass?.name ||
              s.class_name ||
              s.className ||
              (s.class_id ? `Kelas #${s.class_id}` : '-'),
            level: s.school_class?.level || s.level || 10,
            roomName: s.room?.name || s.roomName || 'Ruang',
            subjectName: s.subject?.name || s.subjectName || 'Mata Pelajaran',
          }));
        };

        const p1Data = mapTeacherItems(unwrapList(resP1), 1);
        const p2Data = mapTeacherItems(unwrapList(resP2), 2);

        generateSchedulePdf({
          role: 'teacher',
          user,
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
        toast.success('Jadwal mengajar pribadi (Putaran 1 & 2) berhasil diekspor ke PDF.');
      }
    } catch (err) {
      console.error('Gagal mengekspor jadwal:', err);
      toast.error('Gagal mengekspor jadwal ke format PDF. Silakan coba kembali.');
    } finally {
      setIsExporting(false);
    }
  };

  return (
    <div className="schedule-page teacher-schedule-page">
      {/* 1. Header Halaman Standar Waka */}
      <div className="schedule-header">
        <div className="schedule-header__title-group">
          <h1 className="schedule-header__title">Kalender Jadwal Mengajar</h1>
          <p className="schedule-header__subtitle">
            Pantau alokasi jam mengajar harian &amp; mingguan, rombel kelas, serta kepatuhan pengisian jurnal KBM.
          </p>
        </div>

        <div className="schedule-header__actions">
          {/* Tombol Ekspor PDF (Dropdown untuk Wali Kelas / Tombol Tunggal untuk Guru) */}
          {isWaliKelas() && homeroomClassId ? (
            <div className="relative inline-block text-left" ref={exportMenuRef}>
              <Button
                variant="outline"
                size="sm"
                icon={Download}
                onClick={() => setIsExportMenuOpen((prev) => !prev)}
                disabled={isLoading || isExporting}
                title="Pilih opsi ekspor jadwal PDF"
              >
                <span>{isExporting ? 'Mengekspor...' : 'Ekspor PDF'}</span>
                <ChevronDown size={14} className="ml-1" />
              </Button>
              {isExportMenuOpen && (
                <div className="absolute right-0 mt-1 w-64 bg-white border border-gray-200 rounded-lg shadow-lg z-50 py-1 text-xs">
                  <button
                    type="button"
                    className="w-full text-left px-3 py-2.5 hover:bg-gray-50 flex items-center gap-2.5 text-gray-700 cursor-pointer"
                    onClick={() => {
                      setIsExportMenuOpen(false);
                      handleExportPdf('my_schedule');
                    }}
                  >
                    <FileText size={15} className="text-blue-600 shrink-0" />
                    <div>
                      <div className="font-semibold text-gray-900">Jadwal Mengajar Pribadi</div>
                      <div className="text-[10px] text-gray-500">Mata pelajaran yang Anda ampu</div>
                    </div>
                  </button>
                  <button
                    type="button"
                    className="w-full text-left px-3 py-2.5 hover:bg-gray-50 flex items-center gap-2.5 text-gray-700 border-t border-gray-100 cursor-pointer"
                    onClick={() => {
                      setIsExportMenuOpen(false);
                      handleExportPdf('homeroom');
                    }}
                  >
                    <Layers size={15} className="text-purple-600 shrink-0" />
                    <div>
                      <div className="font-semibold text-gray-900">Jadwal Kelas Binaan</div>
                      <div className="text-[10px] text-gray-500">{homeroomClassName}</div>
                    </div>
                  </button>
                </div>
              )}
            </div>
          ) : (
            <Button
              variant="outline"
              size="sm"
              icon={Download}
              onClick={() => handleExportPdf('my_schedule')}
              disabled={isLoading || isExporting}
            >
              {isExporting ? 'Mengekspor...' : 'Ekspor PDF'}
            </Button>
          )}

          <Button
            variant="secondary"
            size="sm"
            icon={FileText}
            onClick={() => navigate('/teacher/leave')}
          >
            Pengajuan Izin
          </Button>

          <Badge variant="neutral">
            Guru: {user?.name || 'Bapak/Ibu Guru'}
          </Badge>
        </div>
      </div>

      {/* Banner Hari Libur Nasional / Agenda Sekolah Penuh */}
      {todayExemption?.is_teaching_exempted && todayExemption?.disabling_event?.scope_type === 'all' && (
        <div className="p-4 bg-rose-50 border border-rose-200 rounded-lg flex items-start gap-3 mb-4 text-rose-900 shadow-xs">
          <AlertCircle size={20} className="text-rose-600 shrink-0 mt-0.5" />
          <div>
            <h3 className="text-sm font-bold">
              HARI LIBUR / AGENDA RESMI: {todayExemption.disabling_event.title}
            </h3>
            <p className="text-xs text-rose-700 mt-0.5">
              Seluruh kegiatan KBM reguler dan kewajiban pengisian jurnal/presensi dinonaktifkan pada hari ini.
            </p>
          </div>
        </div>
      )}

      {/* 2. Kartu Statistik Ringkasan Beban Mengajar Guru */}
      {scheduleContext === 'my_schedule' && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <div className="p-3 bg-white border border-gray-200 rounded-lg shadow-xs flex items-center justify-between">
            <div>
              <span className="text-[11px] font-semibold text-gray-500 uppercase tracking-wider block">
                Beban Mengajar
              </span>
              <strong className="text-lg font-bold text-gray-900">{teacherStats.totalJP} JP</strong>
              <span className="text-[11px] text-gray-400 block">per minggu</span>
            </div>
            <div className="w-9 h-9 rounded-md bg-blue-50 text-blue-600 flex items-center justify-center font-bold">
              <Clock size={18} />
            </div>
          </div>

          <div className="p-3 bg-white border border-gray-200 rounded-lg shadow-xs flex items-center justify-between">
            <div>
              <span className="text-[11px] font-semibold text-gray-500 uppercase tracking-wider block">
                Rombel Kelas
              </span>
              <strong className="text-lg font-bold text-gray-900">{teacherStats.uniqueClasses} Rombel</strong>
              <span className="text-[11px] text-gray-400 block">diajar</span>
            </div>
            <div className="w-9 h-9 rounded-md bg-purple-50 text-purple-600 flex items-center justify-center font-bold">
              <Layers size={18} />
            </div>
          </div>

          <div className="p-3 bg-white border border-gray-200 rounded-lg shadow-xs flex items-center justify-between">
            <div>
              <span className="text-[11px] font-semibold text-gray-500 uppercase tracking-wider block">
                Mata Pelajaran
              </span>
              <strong className="text-lg font-bold text-gray-900">{teacherStats.uniqueSubjects} Mapel</strong>
              <span className="text-[11px] text-gray-400 block">diampu</span>
            </div>
            <div className="w-9 h-9 rounded-md bg-emerald-50 text-emerald-600 flex items-center justify-center font-bold">
              <BookOpen size={18} />
            </div>
          </div>

          <div className="p-3 bg-white border border-gray-200 rounded-lg shadow-xs flex items-center justify-between">
            <div>
              <span className="text-[11px] font-semibold text-gray-500 uppercase tracking-wider block">
                Jurnal Terlambat
              </span>
              <strong
                className={`text-lg font-bold ${
                  missingJournals.length > 0 ? 'text-amber-600' : 'text-gray-900'
                }`}
              >
                {missingJournals.length} Sesi
              </strong>
              <span className="text-[11px] text-gray-400 block">perlu diisi</span>
            </div>
            <div
              className={`w-9 h-9 rounded-md flex items-center justify-center font-bold ${
                missingJournals.length > 0
                  ? 'bg-amber-50 text-amber-600'
                  : 'bg-gray-50 text-gray-400'
              }`}
            >
              <AlertTriangle size={18} />
            </div>
          </div>
        </div>
      )}

      {/* 3. Selektor Multirole Wali Kelas */}
      {isWaliKelas() && homeroomClassId && (
        <div className="bg-gray-100 p-1 rounded-lg inline-flex items-center gap-1 w-fit">
          <button
            type="button"
            className={`px-3 py-1.5 text-xs font-semibold rounded-md transition-all cursor-pointer ${
              scheduleContext === 'my_schedule'
                ? 'bg-white text-gray-900 shadow-xs'
                : 'text-gray-600 hover:text-gray-900'
            }`}
            onClick={() => setScheduleContext('my_schedule')}
          >
            Jadwal Mengajar Saya
          </button>
          <button
            type="button"
            className={`px-3 py-1.5 text-xs font-semibold rounded-md transition-all flex items-center gap-1.5 cursor-pointer ${
              scheduleContext === 'homeroom'
                ? 'bg-white text-gray-900 shadow-xs'
                : 'text-gray-600 hover:text-gray-900'
            }`}
            onClick={() => setScheduleContext('homeroom')}
          >
            <span>Jadwal Kelas Binaan ({homeroomClassName})</span>
          </button>
        </div>
      )}

      {/* Banner Informasi Kelas Binaan */}
      {scheduleContext === 'homeroom' && (
        <div className="p-3 bg-blue-50 border border-blue-200 rounded-lg flex items-center gap-2.5 text-xs text-blue-900">
          <Info size={16} className="text-blue-600 shrink-0" />
          <span>
            Menampilkan seluruh alokasi jadwal mata pelajaran pada rombel binaan <strong>{homeroomClassName}</strong>. Anda dapat memantau kehadiran guru mata pelajaran atau membuka sesi KBM darurat jika guru pengampu berhalangan hadir.
          </span>
        </div>
      )}

      {/* Banner Status Izin Guru Aktif Hari Ini */}
      {todayActiveLeave && scheduleContext === 'my_schedule' && (
        <div className="teacher-schedule__alert teacher-schedule__alert--leave">
          <div className="flex items-center gap-2">
            <AlertTriangle size={16} className="text-amber-600 shrink-0" />
            <span>
              <strong>
                Status Izin {todayActiveLeave.status === 'approved' ? 'Disetujui' : 'Menunggu Verifikasi Kesiswaan'}:
              </strong>{' '}
              {todayActiveLeave.reason} &bull; Seluruh jam mengajar Anda hari ini didelegasikan ke{' '}
              <strong>Tim Kesiswaan (Piket)</strong>.
            </span>
          </div>
          <button
            type="button"
            className="teacher-schedule__alert-btn"
            onClick={() => navigate('/teacher/leave')}
          >
            Kelola di Menu Izin &rarr;
          </button>
        </div>
      )}

      {/* Peringatan Keterlambatan Pengisian Jurnal (> 30 menit sejak KBM dimulai) */}
      {missingJournals.length > 0 && scheduleContext === 'my_schedule' && (
        <div className="teacher-schedule__alert teacher-schedule__alert--warning">
          <AlertCircle size={18} className="text-amber-700 shrink-0 mt-0.5" />
          <div className="flex-1">
            <strong>Peringatan Keterlambatan Jurnal:</strong> Terdapat{' '}
            <strong>{missingJournals.length} sesi KBM</strong> yang telah melewati batas waktu pengisian (30 menit setelah KBM dimulai)
            namun belum memiliki laporan jurnal KBM terverifikasi.
          </div>
        </div>
      )}

      {/* Monday Ceremony Info Card Standar Waka (Versi Baca untuk Guru) */}
      <div className="schedule-ceremony-card">
        <div className="schedule-ceremony-card__info">
          <div className="schedule-ceremony-card__top">
            <span className="schedule-ceremony-card__label">Upacara hari Senin</span>
            <Badge variant={mondayIsUpacara ? 'success' : 'neutral'}>
              {mondayIsUpacara ? 'Aktif' : 'Nonaktif'}
            </Badge>
          </div>
          <div className="schedule-ceremony-card__title">
            {mondayIsUpacara ? 'Upacara Aktif' : 'KBM Normal'}
          </div>
          <p className="schedule-ceremony-card__desc">
            {mondayIsUpacara
              ? 'Jam ke-1 dialokasikan untuk upacara bendera (mulai 08:00 WIB).'
              : 'Tidak ada upacara bendera, KBM jam ke-1 dimulai normal (07:15 WIB).'}
          </p>
        </div>
      </div>

      {/* 4. Filter Card Terpadu (Mengadopsi Standar Waka) */}
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

          {/* Hari Filter */}
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

          {/* Search Input */}
          <div className="schedule-filter-item flex-1">
            <span className="schedule-filter-label">Pencarian</span>
            <SearchInput
              value={searchQuery}
              onChange={setSearchQuery}
              onClear={() => setSearchQuery('')}
              placeholder={
                scheduleContext === 'homeroom'
                  ? 'Cari nama mapel, guru pengampu, atau ruang...'
                  : 'Cari rombel kelas, mapel, atau ruang...'
              }
            />
          </div>
        </div>

        {/* Legend Bar */}
        <ScheduleLegendBar
          mode="teacher"
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

      {/* 5. Area Konten Utama: Skeleton | Error | Empty | Matriks Jadwal */}
      {isLoading ? (
        <ScheduleTableSkeleton
          count={1}
          days={matrixDays}
          hasCeremony={mondayIsUpacara}
        />
      ) : fetchError ? (
        <div className="bg-white border border-red-200 rounded-lg p-6">
          <ErrorState
            title="Gagal Memuat Jadwal Mengajar"
            message={fetchError}
            onRetry={() => (scheduleContext === 'homeroom' ? fetchHomeroomData() : fetchData())}
            retryLabel="Muat Ulang Jadwal"
          />
        </div>
      ) : filteredSchedules.length === 0 ? (
        <EmptyState
          type={searchQuery || selectedDay !== 'Semua Hari' ? 'search' : 'default'}
          title={
            searchQuery || selectedDay !== 'Semua Hari'
              ? 'Tidak Ada Jadwal Ditemukan'
              : 'Belum Ada Jadwal Mengajar'
          }
          description={
            searchQuery
              ? `Tidak ditemukan alokasi jadwal yang cocok dengan kata kunci "${searchQuery}".`
              : selectedDay !== 'Semua Hari'
              ? `Tidak ada jadwal mengajar pada hari ${selectedDay} di Putaran ${selectedCycle}.`
              : `Belum ada alokasi jam mengajar yang terdaftar pada Putaran ${selectedCycle}.`
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
          {/* Header Identitas Jadwal */}
          <div className="p-4 bg-white border border-gray-200 rounded-lg shadow-xs flex items-center justify-between flex-wrap gap-3">
            <div>
              <h2 className="text-sm font-bold text-gray-900 uppercase tracking-wide">
                {scheduleContext === 'homeroom'
                  ? `Matriks Jadwal KBM Rombel ${homeroomClassName}`
                  : `Matriks Mengajar ${user?.name || 'Bapak/Ibu Guru'}`}
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
              {conflictScheduleIds.size > 0 && (
                <Badge variant="error">
                  {conflictScheduleIds.size} Bentrok Terdeteksi
                </Badge>
              )}
            </div>
          </div>

          {/* Matriks Timetable Standar Waka */}
          <ScheduleTimetableMatrix
            schedules={filteredSchedules}
            matrixDays={matrixDays}
            mondayIsUpacara={mondayIsUpacara}
            periodTemplates={periodTemplates}
            conflictIds={conflictScheduleIds}
            role={scheduleContext === 'homeroom' ? 'homeroom' : 'teacher'}
            onCardClick={handleOpenJournal}
            renderCardStatus={renderStatusBadge}
          />
        </div>
      )}

    </div>
  );
}
