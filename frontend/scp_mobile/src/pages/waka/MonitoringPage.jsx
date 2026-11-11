import { useState, useEffect, useMemo, useCallback } from 'react';
import { useSearchParams } from 'react-router-dom';
import {
  FileText,
  Users,
  RotateCw,
  X,
  Eye,
  AlertTriangle,
  AlertCircle,
  CheckCircle2,
  Filter,
  GraduationCap,
  Download,
  Calendar,
  MessageSquare,
  ChevronRight,
  BookOpen,
} from 'lucide-react';
import { useAuth } from '../../hooks/useAuth';
import journalApi from '../../services/journalApi';
import leaveApi from '../../services/leaveApi';
import attendanceRecapApi from '../../services/attendanceRecapApi';
import { classApi } from '../../services/masterDataApi';
import {
  Button,
  Modal,
  Input,
  Select,
  SearchInput,
  DataTable,
  PaginationBar,
  SegmentedTabs,
  Badge,
  ProgressBar,
  StatCard,
  BottomSheetModal,
} from '../../components/shared';
import { EmptyState, ErrorState } from '../../components/feedback';
import { getStorageUrl, formatDateIndo } from '../../utils/formatters';
import { unwrap, unwrapList } from '../../utils/responseHelper';
import { todayLocalISO } from '../../utils/dateUtils';

export default function MonitoringPage() {
  const { hasRole, isKesiswaan, isWaliKelas, user } = useAuth();
  const [searchParams, setSearchParams] = useSearchParams();

  // Active Tab
  const validTabs = ['rekap_siswa', 'jurnal', 'presensi'];
  const tabFromUrl = searchParams.get('tab');
  const [activeTab, setActiveTab] = useState(() => {
    if (tabFromUrl && validTabs.includes(tabFromUrl)) return tabFromUrl;
    return 'rekap_siswa';
  });

  const handleTabChange = (newTab) => {
    setActiveTab(newTab);
    setSearchParams(
      (prev) => {
        const next = new URLSearchParams(prev);
        next.set('tab', newTab);
        return next;
      },
      { replace: true }
    );
  };

  useEffect(() => {
    if (tabFromUrl && validTabs.includes(tabFromUrl) && tabFromUrl !== activeTab) {
      setActiveTab(tabFromUrl);
    }
  }, [tabFromUrl]);

  // Toast
  const [toastMessage, setToastMessage] = useState(null);
  const [toastType, setToastType] = useState('success');

  const showToast = (msg, type = 'success') => {
    setToastMessage(msg);
    setToastType(type);
    setTimeout(() => setToastMessage(null), 3500);
  };

  // ==========================================
  // STATE: TAB 1 - REKAPITULASI KEHADIRAN SISWA
  // ==========================================
  const [recapClasses, setRecapClasses] = useState([]);
  const [selectedRecapClassId, setSelectedRecapClassId] = useState('');
  const [roleContext, setRoleContext] = useState(null);
  const [recapPeriodPreset, setRecapPeriodPreset] = useState('month'); // 'month' | 'semester'
  const [recapSearch, setRecapSearch] = useState('');
  const [recapStatusFilter, setRecapStatusFilter] = useState('all'); // 'all' | 'at_risk_only'
  const [recapSummary, setRecapSummary] = useState(null);
  const [isRecapLoading, setIsRecapLoading] = useState(false);
  const [isExportingRecap, setIsExportingRecap] = useState(false);

  // Student Detail Bottom Sheet State
  const [selectedStudentForDetail, setSelectedStudentForDetail] = useState(null);
  const [studentHistoryData, setStudentHistoryData] = useState(null);
  const [isHistoryLoading, setIsHistoryLoading] = useState(false);
  const [historyError, setHistoryError] = useState(null);

  // Hitung rentang tanggal efektif untuk Rekap Siswa
  const effectiveRecapDateRange = useMemo(() => {
    const now = new Date();
    const y = now.getFullYear();
    const m = now.getMonth();

    if (recapPeriodPreset === 'month') {
      const start = new Date(y, m, 1);
      const end = new Date(y, m + 1, 0);
      return {
        start_date: todayLocalISO(start),
        end_date: todayLocalISO(end),
        label: 'Bulan Berjalan',
      };
    }

    // Semester
    const isGanjil = m >= 6;
    const start = isGanjil ? new Date(y, 6, 1) : new Date(y, 0, 1);
    const end = isGanjil ? new Date(y, 11, 31) : new Date(y, 5, 30);
    return {
      start_date: todayLocalISO(start),
      end_date: todayLocalISO(end),
      label: isGanjil ? `Semester Ganjil ${y}/${y + 1}` : `Semester Genap ${y - 1}/${y}`,
    };
  }, [recapPeriodPreset]);

  // Muat daftar kelas yang dapat diakses untuk Rekap Kehadiran
  useEffect(() => {
    let isMounted = true;
    async function loadClasses() {
      try {
        const res = await attendanceRecapApi.getClasses();
        const payload = res?.data ?? res;
        if (isMounted && (res?.success || payload?.classes)) {
          const list = payload?.classes || [];
          const ctx = payload?.role_context || {};
          const defaultId = payload?.default_class_id || (list[0]?.id ? String(list[0].id) : '');
          setRecapClasses(list);
          setRoleContext(ctx);
          setSelectedRecapClassId(String(defaultId));
        }
      } catch (err) {
        console.error('Gagal memuat kelas rekap:', err);
      }
    }
    loadClasses();
    return () => {
      isMounted = false;
    };
  }, []);

  // Ambil data ringkasan rekapitulasi siswa
  const fetchRecapSummary = useCallback(async () => {
    if (!selectedRecapClassId && selectedRecapClassId !== 'all') return;
    setIsRecapLoading(true);
    try {
      const params = {
        class_id: selectedRecapClassId,
        search: recapSearch.trim() || undefined,
        status_filter: recapStatusFilter,
        start_date: effectiveRecapDateRange.start_date,
        end_date: effectiveRecapDateRange.end_date,
      };
      const res = await attendanceRecapApi.getSummary(params);
      const payload = res?.data ?? res;
      if (res?.success || payload?.kpi) {
        setRecapSummary(payload);
      }
    } catch (err) {
      showToast(err.message || 'Gagal memuat rekapitulasi kehadiran.', 'error');
    } finally {
      setIsRecapLoading(false);
    }
  }, [selectedRecapClassId, recapSearch, recapStatusFilter, effectiveRecapDateRange]);

  useEffect(() => {
    if (activeTab === 'rekap_siswa' && selectedRecapClassId) {
      fetchRecapSummary();
    }
  }, [activeTab, selectedRecapClassId, fetchRecapSummary]);

  // Buka detail riwayat presensi siswa pada BottomSheet
  const handleOpenStudentDetail = async (student) => {
    setSelectedStudentForDetail(student);
    setIsHistoryLoading(true);
    setHistoryError(null);
    setStudentHistoryData(null);
    try {
      const params = {};
      if (effectiveRecapDateRange.start_date) params.start_date = effectiveRecapDateRange.start_date;
      if (effectiveRecapDateRange.end_date) params.end_date = effectiveRecapDateRange.end_date;
      const res = await attendanceRecapApi.getStudentHistory(student.id, params);
      const payload = res?.data ?? res;
      setStudentHistoryData(payload);
    } catch (err) {
      setHistoryError(err.message || 'Gagal memuat riwayat presensi siswa.');
    } finally {
      setIsHistoryLoading(false);
    }
  };

  // Ekspor Excel Rekapitulasi Siswa (.xlsx)
  const handleExportRecapExcel = async () => {
    if (!selectedRecapClassId) return;
    setIsExportingRecap(true);
    try {
      const params = {
        class_id: selectedRecapClassId,
        start_date: effectiveRecapDateRange.start_date,
        end_date: effectiveRecapDateRange.end_date,
      };
      const res = await attendanceRecapApi.exportExcel(params);
      const blob = new Blob([res?.data || res], {
        type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      });
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', `Rekap_Kehadiran_Kelas_${selectedRecapClassId}_${todayLocalISO()}.xlsx`);
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(url);
      showToast('Rekapitulasi Excel berhasil diunduh.');
    } catch (err) {
      showToast(err.message || 'Gagal mengunduh berkas Excel.', 'error');
    } finally {
      setIsExportingRecap(false);
    }
  };

  // Daftar siswa terfilter untuk Tab Rekap
  const displayedStudents = useMemo(() => {
    if (!recapSummary?.students) return [];
    let list = recapSummary.students;
    if (recapStatusFilter === 'at_risk_only') {
      list = list.filter((s) => s.status === 'danger' || s.status === 'warning' || s.attendance_rate < 80);
    }
    if (recapSearch.trim()) {
      const q = recapSearch.toLowerCase().trim();
      list = list.filter(
        (s) =>
          (s.name || '').toLowerCase().includes(q) ||
          (s.nis_nip || '').toLowerCase().includes(q)
      );
    }
    return list;
  }, [recapSummary, recapStatusFilter, recapSearch]);

  // ==========================================
  // STATE: TAB 2 (JURNAL) & TAB 3 (PRESENSI)
  // ==========================================
  const [selectedDate, setSelectedDate] = useState(() => todayLocalISO());
  const [selectedClassId, setSelectedClassId] = useState('ALL');
  const [filterStatus, setFilterStatus] = useState(() => searchParams.get('status') || 'ALL');
  const [searchQuery, setSearchQuery] = useState('');

  // Pagination tabel (client-side)
  const [page, setPage] = useState(1);
  const [perPage, setPerPage] = useState(10);

  // Data states
  const [journals, setJournals] = useState([]);
  const [dailyRecap, setDailyRecap] = useState(null);
  const [attendances, setAttendances] = useState([]);
  const [classesList, setClassesList] = useState([]);

  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState(null);

  // Preview Photo Modal
  const [previewPhotoUrl, setPreviewPhotoUrl] = useState(null);
  const [previewPhotoTitle, setPreviewPhotoTitle] = useState('');

  // Mark teacher absent action
  const [markingAbsentId, setMarkingAbsentId] = useState(null);

  const canMarkAbsent = useMemo(() => {
    return hasRole('waka') || isKesiswaan?.();
  }, [hasRole, isKesiswaan]);

  // Fetch classes for dropdown in Tab Jurnal/Presensi
  useEffect(() => {
    classApi
      .getClasses({ per_page: 100 })
      .then((res) => {
        setClassesList(unwrapList(res));
      })
      .catch(() => {});
  }, []);

  const fetchMonitoringData = useCallback(async () => {
    try {
      if (activeTab === 'jurnal') {
        const [jRes, recapRes] = await Promise.allSettled([
          journalApi.getJournals({ date: selectedDate }),
          journalApi.getDailyRecap({ date: selectedDate }),
        ]);

        if (jRes.status === 'fulfilled') {
          setJournals(unwrapList(jRes.value));
        }

        if (recapRes.status === 'fulfilled') {
          setDailyRecap(unwrap(recapRes.value));
        }
      } else if (activeTab === 'presensi') {
        const params = { date: selectedDate };
        if (selectedClassId !== 'ALL') params.class_id = selectedClassId;
        const aRes = await leaveApi.getAttendances(params);
        setAttendances(unwrapList(aRes));
      }
      setLoadError(null);
    } catch (err) {
      setLoadError(err.message || 'Gagal memuat data monitoring.');
    } finally {
      setIsLoading(false);
    }
  }, [activeTab, selectedDate, selectedClassId]);

  useEffect(() => {
    if (activeTab === 'jurnal' || activeTab === 'presensi') {
      setIsLoading(true);
      fetchMonitoringData();
    }
  }, [activeTab, selectedDate, selectedClassId, fetchMonitoringData]);

  const handleRefresh = () => {
    if (activeTab === 'rekap_siswa') {
      fetchRecapSummary();
    } else {
      setIsLoading(true);
      fetchMonitoringData();
    }
  };

  // Handle Mark Teacher Absent (Jam Kosong)
  const handleMarkTeacherAbsent = async (item) => {
    if (!window.confirm('Tandai sesi ini sebagai Guru Berhalangan Hadir (Jam Kosong)?')) return;
    const actionKey = item.journal_id || item.schedule_id || item.id;
    setMarkingAbsentId(actionKey);
    try {
      if (item.journal_id) {
        await journalApi.markTeacherAbsent(item.journal_id);
      } else {
        await journalApi.markTeacherAbsent(null, {
          schedule_id: item.schedule_id || item.id,
          date: item.date || selectedDate,
        });
      }
      showToast('Sesi KBM berhasil ditandai sebagai Guru Berhalangan Hadir.');
      handleRefresh();
    } catch (err) {
      showToast(err.response?.data?.message || err.message || 'Gagal mengubah status.', 'error');
    } finally {
      setMarkingAbsentId(null);
    }
  };

  // Filtered Journals
  const filteredJournals = useMemo(() => {
    const rawItems = dailyRecap?.items && dailyRecap.items.length > 0 ? dailyRecap.items : journals;

    return rawItems.filter((item) => {
      if (selectedClassId !== 'ALL') {
        const itemClassId = item.school_class_id || item.class_id || item.schedule?.school_class_id;
        if (String(itemClassId) !== String(selectedClassId)) return false;
      }

      if (filterStatus !== 'ALL') {
        if (filterStatus === 'unfilled' && item.status !== 'unfilled') return false;
        if (filterStatus === 'completed' && item.status !== 'completed') return false;
        if (filterStatus === 'teacher_absent' && item.status !== 'teacher_absent') return false;
        if (filterStatus === 'exempted' && item.status !== 'exempted') return false;
        if (filterStatus === 'ongoing' && item.status !== 'ongoing') return false;
      }

      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase().trim();
        const cls = (item.class_name || item.schedule?.school_class?.name || '').toLowerCase();
        const teacher = (item.teacher_name || item.schedule?.teacher?.name || '').toLowerCase();
        const subject = (item.subject_name || item.schedule?.subject?.name || '').toLowerCase();
        const topic = (item.topic_description || item.exemption_reason || '').toLowerCase();
        if (!cls.includes(q) && !teacher.includes(q) && !subject.includes(q) && !topic.includes(q)) {
          return false;
        }
      }

      return true;
    });
  }, [dailyRecap, journals, selectedClassId, filterStatus, searchQuery]);

  // Filtered Attendances
  const filteredAttendances = useMemo(() => {
    return attendances.filter((a) => {
      if (selectedClassId !== 'ALL') {
        const itemClassId = a.class_id || a.student?.class_id || a.school_class_id;
        if (String(itemClassId) !== String(selectedClassId)) return false;
      }

      if (!searchQuery.trim()) return true;
      const q = searchQuery.toLowerCase().trim();
      const name = (a.student?.name || '').toLowerCase();
      const cls = (a.school_class?.name || '').toLowerCase();
      return name.includes(q) || cls.includes(q);
    });
  }, [attendances, selectedClassId, searchQuery]);

  const activeList = activeTab === 'jurnal' ? filteredJournals : filteredAttendances;
  const totalItems = activeList.length;
  const totalPages = Math.max(1, Math.ceil(totalItems / perPage));
  const pagedItems = activeList.slice((page - 1) * perPage, page * perPage);

  useEffect(() => {
    setPage(1);
  }, [activeTab, selectedDate, selectedClassId, filterStatus, searchQuery, perPage]);

  // Metrik Daily Recap
  const totalSesi = dailyRecap?.total_mandatory ?? dailyRecap?.effective_mandatory ?? dailyRecap?.items?.length ?? 0;
  const belumDiisiCount = dailyRecap?.unfilled_count ?? 0;
  const selesaiCount = dailyRecap?.completed_count ?? 0;
  const jamKosongCount = dailyRecap?.absent_count ?? 0;

  return (
    <div className="space-y-4">
      {/* Toast Feedback */}
      {toastMessage && (
        <div
          className={`p-3 rounded-[10px] text-xs flex items-center justify-between border ${
            toastType === 'error'
              ? 'bg-[var(--color-danger-bg)] border-[var(--color-danger-border)] text-[var(--color-danger-fg)]'
              : 'bg-[var(--color-success-bg)] border-[var(--color-success-border)] text-[var(--color-success-fg)]'
          }`}
        >
          <span>{toastMessage}</span>
          <button
            type="button"
            onClick={() => setToastMessage(null)}
            className="text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)]"
          >
            <X size={14} />
          </button>
        </div>
      )}

      {/* Header Info */}
      <div className="surface-card p-3.5 shadow-[var(--shadow-card)] flex items-center justify-between">
        <div>
          <div className="flex items-center gap-1.5 flex-wrap">
            <h1 className="text-sm font-bold text-[var(--color-text-primary)]">Monitoring &amp; Rekap</h1>
            {isWaliKelas() && !hasRole('waka') && !isKesiswaan() && (
              <Badge variant="warning" size="sm">
                Wali Kelas
              </Badge>
            )}
          </div>
          <p className="text-[11px] text-[var(--color-text-muted)] mt-0.5">
            Rekapitulasi kehadiran rombel, jurnal mengajar &amp; presensi harian
          </p>
        </div>
        <Button
          size="sm"
          variant="ghost"
          onClick={handleRefresh}
          className="p-1.5 h-8 w-8 min-h-0"
          aria-label="Segarkan"
        >
          <RotateCw size={14} className={isRecapLoading || isLoading ? 'animate-spin' : ''} />
        </Button>
      </div>

      {/* Segmented Tabs Switcher: 3 Tab Terpadu */}
      <div className="pt-1">
        <SegmentedTabs
          fullWidth
          tabs={[
            { id: 'rekap_siswa', label: 'Rekap Siswa', icon: GraduationCap },
            { id: 'jurnal', label: 'Jurnal KBM', icon: FileText },
            { id: 'presensi', label: 'Presensi', icon: Users },
          ]}
          activeTab={activeTab}
          onChange={handleTabChange}
        />
      </div>

      {/* ========================================================
          TAB 1: REKAPITULASI KEHADIRAN SISWA (AGREGAT, RISIKO, EXCEL)
          ======================================================== */}
      {activeTab === 'rekap_siswa' && (
        <div className="space-y-3.5">
          {/* Filter Card: Kelas & Periode */}
          <div className="surface-card p-3 rounded-[12px] border border-[var(--color-border-subtle)] space-y-2.5">
            <div className="flex items-center justify-between gap-2">
              <span className="text-xs font-semibold text-[var(--color-text-primary)] flex items-center gap-1">
                <Users size={14} /> Pilih Rombel Kelas
              </span>
              {recapSummary?.class_info?.name && (
                <span className="text-[11px] font-mono text-[var(--color-text-muted)]">
                  {recapSummary?.students?.length || 0} Siswa Terdaftar
                </span>
              )}
            </div>

            <Select
              value={selectedRecapClassId}
              onChange={(e) => setSelectedRecapClassId(e.target.value)}
              className="text-xs font-semibold"
              disabled={isWaliKelas() && !hasRole('waka') && !isKesiswaan() && recapClasses.length <= 1}
            >
              {recapClasses.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name} {c.major?.code ? `(${c.major.code})` : ''}
                </option>
              ))}
            </Select>

            {/* Pilihan Preset Periode: Bulan Ini vs Semester Ini */}
            <div className="flex items-center gap-1.5 pt-1">
              <button
                type="button"
                onClick={() => setRecapPeriodPreset('month')}
                className={`px-3 py-1 rounded-full text-xs font-medium transition ${
                  recapPeriodPreset === 'month'
                    ? 'bg-[var(--color-brand-primary)] text-white'
                    : 'bg-[var(--color-bg-app)] text-[var(--color-text-secondary)] border border-[var(--color-border-subtle)]'
                }`}
              >
                Bulan Ini
              </button>
              <button
                type="button"
                onClick={() => setRecapPeriodPreset('semester')}
                className={`px-3 py-1 rounded-full text-xs font-medium transition ${
                  recapPeriodPreset === 'semester'
                    ? 'bg-[var(--color-brand-primary)] text-white'
                    : 'bg-[var(--color-bg-app)] text-[var(--color-text-secondary)] border border-[var(--color-border-subtle)]'
                }`}
              >
                Semester Ini
              </button>

              <div className="ml-auto">
                <Button
                  size="sm"
                  variant="outline"
                  onClick={handleExportRecapExcel}
                  loading={isExportingRecap}
                  className="text-xs h-7 px-2.5"
                  title="Unduh Rekap Excel"
                >
                  <Download size={13} className="mr-1" />
                  Excel
                </Button>
              </div>
            </div>
          </div>

          {/* KPI StatCards */}
          {recapSummary?.kpi && (
            <div className="grid grid-cols-2 gap-2">
              <StatCard
                label="Rata-rata Hadir"
                value={`${recapSummary.kpi.average_attendance_rate ?? 0}%`}
                variant={
                  (recapSummary.kpi.average_attendance_rate ?? 0) >= 85
                    ? 'success'
                    : (recapSummary.kpi.average_attendance_rate ?? 0) >= 75
                    ? 'warning'
                    : 'danger'
                }
                subtext="Akumulatif rombel"
              />
              <StatCard
                label="Siswa Berisiko"
                value={`${recapSummary.kpi.at_risk_students_count ?? 0} Siswa`}
                variant={(recapSummary.kpi.at_risk_students_count ?? 0) > 0 ? 'danger' : 'success'}
                subtext="Kehadiran < 80%"
              />
              <StatCard
                label="Total Alpa"
                value={`${recapSummary.kpi.total_alpa ?? 0} Sesi`}
                variant={(recapSummary.kpi.total_alpa ?? 0) > 0 ? 'danger' : 'neutral'}
                subtext="Tanpa keterangan"
              />
              <StatCard
                label="Sakit &amp; Izin"
                value={`${recapSummary.kpi.total_sakit_izin ?? 0} Sesi`}
                variant="info"
                subtext="Terverifikasi"
              />
            </div>
          )}

          {/* Filter Status Siswa (Semua vs Berisiko) & Search */}
          <div className="space-y-2">
            <div className="flex items-center gap-1.5">
              <button
                type="button"
                onClick={() => setRecapStatusFilter('all')}
                className={`flex-1 py-1.5 rounded-[8px] text-xs font-semibold text-center transition ${
                  recapStatusFilter === 'all'
                    ? 'bg-[var(--color-surface-subtle)] border border-[var(--color-border-light)] text-[var(--color-text-primary)] shadow-sm'
                    : 'text-[var(--color-text-muted)]'
                }`}
              >
                Semua ({recapSummary?.students?.length || 0})
              </button>
              <button
                type="button"
                onClick={() => setRecapStatusFilter('at_risk_only')}
                className={`flex-1 py-1.5 rounded-[8px] text-xs font-semibold text-center transition ${
                  recapStatusFilter === 'at_risk_only'
                    ? 'bg-rose-500/10 border border-rose-500/30 text-rose-500 shadow-sm'
                    : 'text-[var(--color-text-muted)]'
                }`}
              >
                Berisiko ({recapSummary?.kpi?.at_risk_students_count || 0})
              </button>
            </div>

            <SearchInput
              placeholder="Cari nama siswa atau NIS..."
              value={recapSearch}
              onChange={(e) => setRecapSearch(e.target.value)}
            />
          </div>

          {/* Daftar Siswa (Mobile Card List) */}
          <div className="space-y-2">
            <div className="flex items-center justify-between px-0.5">
              <span className="section-label">
                Daftar Rekapitulasi Siswa ({displayedStudents.length})
              </span>
            </div>

            {isRecapLoading ? (
              <div className="surface-card p-6 rounded-[12px] text-center space-y-2 text-xs text-[var(--color-text-muted)]">
                <RotateCw size={18} className="animate-spin mx-auto text-[var(--color-brand-primary)]" />
                <p>Memuat rekapitulasi kehadiran rombel...</p>
              </div>
            ) : displayedStudents.length === 0 ? (
              <EmptyState
                title="Tidak Ada Siswa"
                message={
                  recapStatusFilter === 'at_risk_only'
                    ? 'Bagus! Tidak ada siswa yang berada dalam kategori bahaya atau waspada kehadiran (<80%).'
                    : 'Belum ada data siswa untuk kelas atau kriteria pencarian ini.'
                }
              />
            ) : (
              displayedStudents.map((student) => {
                const rate = Number(student.attendance_rate || 0);
                const isDanger = student.status === 'danger' || rate < 75;
                const isWarning = student.status === 'warning' || (rate >= 75 && rate < 85);

                return (
                  <div
                    key={student.id}
                    onClick={() => handleOpenStudentDetail(student)}
                    className="surface-card p-3 rounded-[12px] border border-[var(--color-border-subtle)] space-y-2 active:scale-[0.99] transition-all cursor-pointer shadow-sm"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <div className="font-semibold text-xs text-[var(--color-text-primary)]">
                          {student.name}
                        </div>
                        <div className="text-[11px] text-[var(--color-text-muted)] font-mono">
                          NIS: {student.nis_nip || '-'}
                        </div>
                      </div>

                      {isDanger ? (
                        <Badge variant="error" size="sm" icon={AlertCircle}>
                          Bahaya ({rate}%)
                        </Badge>
                      ) : isWarning ? (
                        <Badge variant="warning" size="sm" icon={AlertTriangle}>
                          Waspada ({rate}%)
                        </Badge>
                      ) : (
                        <Badge variant="success" size="sm" icon={CheckCircle2}>
                          Aman ({rate}%)
                        </Badge>
                      )}
                    </div>

                    {/* Progress Bar Kehadiran */}
                    <ProgressBar
                      value={rate}
                      showValue={false}
                      color={isDanger ? 'error' : isWarning ? 'accent' : 'success'}
                    />

                    {/* Stat Breakdown & Detail Indicator */}
                    <div className="flex items-center justify-between text-[11px] pt-1 border-t border-[var(--color-border-subtle)]">
                      <div className="flex items-center gap-2 font-mono text-[var(--color-text-secondary)]">
                        <span className="text-[var(--color-success-fg)] font-semibold">
                          H: {student.hadir_count}
                        </span>
                        <span>&bull;</span>
                        <span className="text-blue-500 font-semibold">S: {student.sakit_count}</span>
                        <span>&bull;</span>
                        <span className="text-amber-500 font-semibold">I: {student.izin_count}</span>
                        <span>&bull;</span>
                        <span className="text-rose-500 font-semibold">A: {student.alpa_count}</span>
                      </div>

                      <span className="text-[var(--color-brand-primary)] text-[11px] font-medium flex items-center gap-0.5">
                        Riwayat <ChevronRight size={12} />
                      </span>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>
      )}

      {/* ========================================================
          TAB 2 & 3: JURNAL MENGAJAR & LOG PRESENSI HARIAN
          ======================================================== */}
      {(activeTab === 'jurnal' || activeTab === 'presensi') && (
        <div className="space-y-3.5">
          {/* Filter Tanggal Harian */}
          <div className="space-y-2">
            <Input
              type="date"
              value={selectedDate}
              onChange={(e) => setSelectedDate(e.target.value)}
              className="text-xs font-semibold"
            />
          </div>

          {/* Daily Recap Summary Cards (when in 'jurnal' tab) */}
          {activeTab === 'jurnal' && dailyRecap && (
            <div className="grid grid-cols-4 gap-2">
              <button
                type="button"
                onClick={() => setFilterStatus('ALL')}
                className={`surface-card p-2 text-center transition-all rounded-[10px] ${
                  filterStatus === 'ALL'
                    ? 'border-[var(--color-brand-primary,#2563eb)] ring-2 ring-[var(--color-brand-primary,#2563eb)]/30'
                    : 'border border-[var(--color-border-subtle)]'
                }`}
              >
                <p className="text-[10px] text-[var(--color-text-secondary)] font-semibold truncate">Total Sesi</p>
                <p className="text-sm font-bold text-[var(--color-text-primary)] mt-0.5">{totalSesi}</p>
              </button>
              <button
                type="button"
                onClick={() => setFilterStatus(filterStatus === 'unfilled' ? 'ALL' : 'unfilled')}
                className={`surface-card p-2 text-center transition-all rounded-[10px] ${
                  filterStatus === 'unfilled'
                    ? 'border-amber-500 ring-2 ring-amber-500/30'
                    : 'border border-[var(--color-border-subtle)]'
                }`}
              >
                <p className="text-[10px] text-amber-500 font-semibold truncate">Belum Diisi</p>
                <p className="text-sm font-bold text-amber-500 mt-0.5">{belumDiisiCount}</p>
              </button>
              <button
                type="button"
                onClick={() => setFilterStatus(filterStatus === 'completed' ? 'ALL' : 'completed')}
                className={`surface-card p-2 text-center transition-all rounded-[10px] ${
                  filterStatus === 'completed'
                    ? 'border-emerald-500 ring-2 ring-emerald-500/30'
                    : 'border border-[var(--color-border-subtle)]'
                }`}
              >
                <p className="text-[10px] text-[var(--color-success-fg)] font-semibold truncate">Selesai</p>
                <p className="text-sm font-bold text-[var(--color-success-fg)] mt-0.5">{selesaiCount}</p>
              </button>
              <button
                type="button"
                onClick={() => setFilterStatus(filterStatus === 'teacher_absent' ? 'ALL' : 'teacher_absent')}
                className={`surface-card p-2 text-center transition-all rounded-[10px] ${
                  filterStatus === 'teacher_absent'
                    ? 'border-rose-500 ring-2 ring-rose-500/30'
                    : 'border border-[var(--color-border-subtle)]'
                }`}
              >
                <p className="text-[10px] text-[var(--color-danger-fg)] font-semibold truncate">Jam Kosong</p>
                <p className="text-sm font-bold text-[var(--color-danger-fg)] mt-0.5">{jamKosongCount}</p>
              </button>
            </div>
          )}

          {/* Filter Rombel & Filter Status & Search Input */}
          <div className="space-y-2">
            <div className="grid grid-cols-2 gap-2">
              <Select
                value={selectedClassId}
                onChange={(e) => setSelectedClassId(e.target.value)}
                className="text-xs"
              >
                <option value="ALL">Semua Rombel</option>
                {classesList.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </Select>

              {activeTab === 'jurnal' ? (
                <Select
                  value={filterStatus}
                  onChange={(e) => setFilterStatus(e.target.value)}
                  className="text-xs"
                >
                  <option value="ALL">Semua Status</option>
                  <option value="unfilled">Belum Diisi</option>
                  <option value="completed">Selesai</option>
                  <option value="teacher_absent">Jam Kosong</option>
                  <option value="exempted">Dikecualikan</option>
                  <option value="ongoing">Berjalan</option>
                </Select>
              ) : (
                <div className="flex items-center justify-end text-xs text-[var(--color-text-secondary)] font-medium px-2">
                  Total Presensi: {totalItems}
                </div>
              )}
            </div>

            {filterStatus !== 'ALL' && activeTab === 'jurnal' && (
              <div className="flex items-center gap-1.5 px-1">
                <span className="text-[11px] text-[var(--color-text-secondary)] flex items-center gap-1">
                  <Filter size={11} /> Filter aktif:
                </span>
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-semibold bg-[var(--color-surface-subtle)] border border-[var(--color-border-light)] text-[var(--color-text-primary)]">
                  {filterStatus === 'unfilled'
                    ? 'Belum Diisi'
                    : filterStatus === 'completed'
                    ? 'Selesai'
                    : filterStatus === 'teacher_absent'
                    ? 'Jam Kosong'
                    : filterStatus === 'exempted'
                    ? 'Dikecualikan'
                    : filterStatus}
                  <button
                    type="button"
                    onClick={() => setFilterStatus('ALL')}
                    className="hover:text-[var(--color-danger-fg)] ml-0.5"
                    title="Hapus filter"
                  >
                    <X size={12} />
                  </button>
                </span>
              </div>
            )}

            <SearchInput
              placeholder={
                activeTab === 'jurnal'
                  ? 'Cari guru, kelas, mapel, atau topik...'
                  : 'Cari nama siswa...'
              }
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </div>

          {/* Tabel Jurnal KBM / Rekap Presensi */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <span className="section-label">
                {activeTab === 'jurnal'
                  ? `Daftar Sesi KBM (${totalItems})`
                  : `Log Presensi Harian (${totalItems})`}
              </span>
            </div>

            {loadError ? (
              <ErrorState message={loadError} onRetry={handleRefresh} />
            ) : (
              <DataTable
                columns={
                  activeTab === 'jurnal'
                    ? [
                        { key: 'jp', label: 'JP', width: 40, align: 'center' },
                        { key: 'subject', label: 'Jurnal KBM' },
                        { key: 'actions', label: 'Aksi', width: 74, align: 'right' },
                      ]
                    : [
                        { key: 'no', label: '#', width: 30, align: 'center' },
                        { key: 'student', label: 'Siswa / Rombel' },
                        { key: 'status', label: 'Status', width: 74, align: 'right' },
                      ]
                }
                rows={pagedItems}
                isLoading={isLoading}
                skeletonRows={Math.min(perPage, 8)}
                ariaLabel={activeTab === 'jurnal' ? 'Daftar jurnal KBM' : 'Rekap presensi siswa'}
                empty={
                  activeTab === 'jurnal' ? (
                    <EmptyState
                      title={filterStatus !== 'ALL' ? 'Tidak Ada Sesi yang Cocok' : 'Tidak Ada Sesi KBM'}
                      message={
                        filterStatus === 'unfilled'
                          ? 'Semua sesi KBM telah diisi jurnalnya.'
                          : filterStatus !== 'ALL'
                          ? `Tidak ditemukan sesi KBM dengan status "${filterStatus}" untuk kriteria ini.`
                          : `Belum ada sesi KBM yang tercatat pada tanggal ${formatDateIndo(selectedDate)}.`
                      }
                    />
                  ) : (
                    <EmptyState
                      title="Tidak Ada Data Presensi"
                      message="Belum ada catatan presensi siswa untuk kriteria filter ini."
                    />
                  )
                }
                renderRow={(item, index) => {
                  const rowNo = String((page - 1) * perPage + index + 1).padStart(2, '0');

                  if (activeTab === 'jurnal') {
                    const j = item;
                    const status = j.status;
                    const isCompleted = status === 'completed';
                    const isTeacherAbsent = status === 'teacher_absent';
                    const isExempted = status === 'exempted';
                    const isUnfilled = status === 'unfilled';
                    const photoUrl = j.photo_url || j.photo_path;

                    const jp = j.period_number ?? j.schedule?.period_number ?? 1;
                    const subjectName = j.subject_name || j.schedule?.subject?.name || 'Mata Pelajaran';
                    const className = j.class_name || j.schedule?.school_class?.name || 'Rombel';
                    const teacherName = j.teacher_name || j.schedule?.teacher?.name || 'Guru Pengampu';

                    let statusLabel = 'Berjalan';
                    let badgeVariant = 'neutral';

                    if (isCompleted) {
                      statusLabel = 'Selesai';
                      badgeVariant = 'success';
                    } else if (isTeacherAbsent) {
                      statusLabel = 'Jam Kosong';
                      badgeVariant = 'danger';
                    } else if (isExempted) {
                      statusLabel = 'Dikecualikan';
                      badgeVariant = 'warning';
                    } else if (isUnfilled) {
                      statusLabel = 'Belum Diisi';
                      badgeVariant = 'warning';
                    }

                    return (
                      <tr key={j.id || `sched-${j.schedule_id}-${index}`}>
                        <td className="data-table__no">
                          <span className="data-table__mono">{jp}</span>
                        </td>
                        <td>
                          <div className="flex items-center gap-1.5 flex-wrap">
                            <span className="data-table__cell-title">{subjectName}</span>
                            <Badge variant={badgeVariant} size="sm">
                              {statusLabel}
                            </Badge>
                          </div>
                          <span className="data-table__cell-sub">
                            {className} · {teacherName}
                            {j.substitute_teacher_name && (
                              <span className="text-amber-500 font-medium">
                                {' '}
                                (Pengganti: {j.substitute_teacher_name})
                              </span>
                            )}
                          </span>
                          {j.topic_description ? (
                            <span className="data-table__cell-meta">{j.topic_description}</span>
                          ) : isExempted ? (
                            <span className="data-table__cell-meta text-amber-500">
                              Agenda: {j.exemption_reason || 'Kegiatan Sekolah'}
                            </span>
                          ) : isUnfilled ? (
                            <span className="data-table__cell-meta text-amber-500/80 italic">
                              Jurnal belum diisi oleh guru pengampu
                            </span>
                          ) : null}
                        </td>
                        <td>
                          <div className="data-table__actions">
                            {photoUrl && (
                              <button
                                type="button"
                                className="data-table__action"
                                onClick={() => {
                                  setPreviewPhotoUrl(getStorageUrl(photoUrl));
                                  setPreviewPhotoTitle(`${className} - ${subjectName}`);
                                }}
                                aria-label="Lihat foto bukti KBM"
                              >
                                <Eye size={13} />
                              </button>
                            )}
                            {canMarkAbsent && !isCompleted && !isTeacherAbsent && !isExempted && (
                              <button
                                type="button"
                                disabled={markingAbsentId === (j.journal_id || j.schedule_id || j.id)}
                                onClick={() => handleMarkTeacherAbsent(j)}
                                className="data-table__action data-table__action--danger"
                                title="Tandai Jam Kosong"
                                aria-label="Tandai jam kosong"
                              >
                                <AlertTriangle size={13} />
                              </button>
                            )}
                          </div>
                        </td>
                      </tr>
                    );
                  }

                  const a = item;
                  const status = a.status || 'Hadir';
                  const badgeVariant =
                    status === 'Hadir'
                      ? 'success'
                      : status === 'Sakit'
                      ? 'info'
                      : status === 'Izin'
                      ? 'warning'
                      : 'error';

                  return (
                    <tr key={a.id}>
                      <td className="data-table__no">{rowNo}</td>
                      <td>
                        <span className="data-table__cell-title">{a.student?.name || 'Siswa'}</span>
                        <span className="data-table__cell-meta">
                          {a.school_class?.name || 'Rombel'}
                          {a.notes ? ` · ${a.notes}` : ''}
                        </span>
                      </td>
                      <td>
                        <div className="data-table__actions">
                          <span className={`badge badge--${badgeVariant} badge--sm`}>{status}</span>
                        </div>
                      </td>
                    </tr>
                  );
                }}
                footer={
                  <PaginationBar
                    currentPage={page}
                    totalPages={totalPages}
                    totalItems={totalItems}
                    perPage={perPage}
                    onPageChange={setPage}
                    onPerPageChange={setPerPage}
                    disabled={isLoading}
                  />
                }
              />
            )}
          </div>
        </div>
      )}

      {/* ========================================================
          BOTTOM SHEET: DETAIL RIWAYAT PRESENSI SISWA
          ======================================================== */}
      <BottomSheetModal
        isOpen={Boolean(selectedStudentForDetail)}
        onClose={() => setSelectedStudentForDetail(null)}
        title={selectedStudentForDetail?.name || 'Detail Kehadiran Siswa'}
        subtitle={`NIS: ${selectedStudentForDetail?.nis_nip || '-'} • Rombel: ${
          recapClasses.find((c) => String(c.id) === String(selectedRecapClassId))?.name || '-'
        }`}
        size="lg"
      >
        <div className="space-y-4 py-1">
          {isHistoryLoading ? (
            <div className="p-6 text-center text-xs text-[var(--color-text-muted)] space-y-2">
              <RotateCw size={18} className="animate-spin mx-auto text-[var(--color-brand-primary)]" />
              <p>Mengambil rincian catatan presensi siswa...</p>
            </div>
          ) : historyError ? (
            <div className="p-3 bg-[var(--color-danger-bg)] border border-[var(--color-danger-border)] rounded-[10px] text-[var(--color-danger-fg)] text-xs">
              {historyError}
            </div>
          ) : (
            <>
              {/* Ringkasan Presensi Siswa */}
              <div className="surface-card p-3 rounded-[10px] border border-[var(--color-border-subtle)] space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-semibold text-[var(--color-text-secondary)]">
                    Tingkat Kehadiran Kumulatif
                  </span>
                  <span className="font-mono text-sm font-bold text-[var(--color-text-primary)]">
                    {studentHistoryData?.stats?.attendance_rate ?? selectedStudentForDetail?.attendance_rate ?? 0}%
                  </span>
                </div>

                <ProgressBar
                  value={studentHistoryData?.stats?.attendance_rate ?? selectedStudentForDetail?.attendance_rate ?? 0}
                  showValue={false}
                  color={
                    (selectedStudentForDetail?.attendance_rate ?? 0) < 75
                      ? 'error'
                      : (selectedStudentForDetail?.attendance_rate ?? 0) < 85
                      ? 'accent'
                      : 'success'
                  }
                />

                <div className="grid grid-cols-4 gap-1.5 pt-1 text-center font-mono text-xs">
                  <div className="p-1.5 rounded bg-emerald-500/10 text-emerald-600 font-semibold">
                    H: {studentHistoryData?.stats?.hadir ?? selectedStudentForDetail?.hadir_count ?? 0}
                  </div>
                  <div className="p-1.5 rounded bg-blue-500/10 text-blue-600 font-semibold">
                    S: {studentHistoryData?.stats?.sakit ?? selectedStudentForDetail?.sakit_count ?? 0}
                  </div>
                  <div className="p-1.5 rounded bg-amber-500/10 text-amber-600 font-semibold">
                    I: {studentHistoryData?.stats?.izin ?? selectedStudentForDetail?.izin_count ?? 0}
                  </div>
                  <div className="p-1.5 rounded bg-rose-500/10 text-rose-600 font-semibold">
                    A: {studentHistoryData?.stats?.alpa ?? selectedStudentForDetail?.alpa_count ?? 0}
                  </div>
                </div>
              </div>

              {/* Tombol Hubungi Orang Tua via WhatsApp (Jika Tersedia) */}
              {studentHistoryData?.student?.parent_phone && (
                <Button
                  variant="brand"
                  size="md"
                  fullWidth
                  onClick={() => {
                    const phone = studentHistoryData.student.parent_phone.replace(/\D/g, '');
                    const studentName = selectedStudentForDetail?.name || 'Siswa';
                    const rate = selectedStudentForDetail?.attendance_rate || 0;
                    const text = encodeURIComponent(
                      `Yth. Orang Tua / Wali dari ${studentName}, kami menginformasikan catatan tingkat kehadiran siswa pada periode ini adalah ${rate}%. Mohon perhatian dan kerjasamanya demi kelancaran KBM.`
                    );
                    window.open(`https://wa.me/${phone}?text=${text}`, '_blank');
                  }}
                >
                  <MessageSquare size={15} className="mr-1.5" />
                  Kirim Notifikasi WhatsApp ke Orang Tua
                </Button>
              )}

              {/* Rincian per Mata Pelajaran */}
              {studentHistoryData?.subject_breakdown && studentHistoryData.subject_breakdown.length > 0 && (
                <div className="space-y-1.5">
                  <span className="text-xs font-semibold text-[var(--color-text-primary)] flex items-center gap-1">
                    <BookOpen size={13} /> Kehadiran per Mata Pelajaran
                  </span>

                  <div className="space-y-1.5 max-h-48 overflow-y-auto pr-0.5">
                    {studentHistoryData.subject_breakdown.map((sb, idx) => (
                      <div
                        key={idx}
                        className="p-2 rounded-[8px] bg-[var(--color-bg-app)] border border-[var(--color-border-subtle)] flex items-center justify-between text-xs"
                      >
                        <div className="truncate max-w-[65%]">
                          <p className="font-semibold text-[var(--color-text-primary)] truncate">
                            {sb.subject_name}
                          </p>
                          <p className="text-[10px] text-[var(--color-text-muted)] font-mono">
                            H:{sb.hadir} S:{sb.sakit} I:{sb.izin} A:{sb.alpa} ({sb.total_sessions} Sesi)
                          </p>
                        </div>
                        <Badge
                          variant={sb.rate >= 85 ? 'success' : sb.rate >= 75 ? 'warning' : 'error'}
                          size="sm"
                        >
                          {sb.rate}%
                        </Badge>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Linimasa Presensi Terakhir */}
              {studentHistoryData?.timeline && studentHistoryData.timeline.length > 0 && (
                <div className="space-y-1.5">
                  <span className="text-xs font-semibold text-[var(--color-text-primary)] flex items-center gap-1">
                    <Calendar size={13} /> Riwayat Sesi Terakhir
                  </span>

                  <div className="space-y-1.5 max-h-48 overflow-y-auto pr-0.5">
                    {studentHistoryData.timeline.slice(0, 15).map((tl, idx) => (
                      <div
                        key={idx}
                        className="p-2 rounded-[8px] bg-[var(--color-bg-app)] border border-[var(--color-border-subtle)] flex items-center justify-between text-xs"
                      >
                        <div>
                          <p className="font-medium text-[var(--color-text-primary)]">
                            {tl.subject_name || 'KBM'}
                          </p>
                          <p className="text-[10px] text-[var(--color-text-muted)]">
                            {formatDateIndo(tl.date)} {tl.notes ? `• ${tl.notes}` : ''}
                          </p>
                        </div>
                        <Badge
                          variant={
                            tl.status === 'Hadir'
                              ? 'success'
                              : tl.status === 'Sakit'
                              ? 'info'
                              : tl.status === 'Izin'
                              ? 'warning'
                              : 'error'
                          }
                          size="sm"
                        >
                          {tl.status}
                        </Badge>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </>
          )}

          <Button
            type="button"
            variant="secondary"
            onClick={() => setSelectedStudentForDetail(null)}
            className="w-full mt-2"
          >
            Tutup
          </Button>
        </div>
      </BottomSheetModal>

      {/* Modal Pratinjau Foto KBM (Tab Jurnal) */}
      <Modal
        isOpen={Boolean(previewPhotoUrl)}
        onClose={() => setPreviewPhotoUrl(null)}
        title={previewPhotoTitle || 'Foto Bukti KBM'}
      >
        <div className="space-y-3">
          <div className="rounded-[14px] overflow-hidden border border-[var(--color-border-subtle)] bg-[var(--color-text-primary)] flex items-center justify-center max-h-[70vh]">
            {previewPhotoUrl && (
              <img
                src={previewPhotoUrl}
                alt="Dokumentasi KBM"
                className="max-h-[65vh] w-auto object-contain"
              />
            )}
          </div>
          <Button
            type="button"
            variant="secondary"
            onClick={() => setPreviewPhotoUrl(null)}
            className="w-full"
          >
            Tutup
          </Button>
        </div>
      </Modal>
    </div>
  );
}
