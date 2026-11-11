import { useState, useEffect, useMemo, useCallback } from 'react';
import {
  Users,
  Calendar,
  AlertTriangle,
  AlertCircle,
  CheckCircle2,
  Download,
  RefreshCw,
  Search,
  Filter,
  Eye,
  FileSpreadsheet,
  MessageSquare,
  GraduationCap,
  ArrowUpDown,
  BookOpen,
  Info,
} from 'lucide-react';
import { useAuth } from '../../hooks/useAuth';
import attendanceRecapApi from '../../services/attendanceRecapApi';
import StatCard from '../../components/shared/StatCard';
import Badge from '../../components/shared/Badge';
import Button from '../../components/shared/Button';
import Tabs from '../../components/shared/Tabs';
import StudentAttendanceDetailModal from './components/StudentAttendanceDetailModal';
import { todayLocalISO } from '../../utils/dateUtils';

// Helper Format Tanggal Indonesia
function formatDateIndo(dateStr) {
  if (!dateStr) return '-';
  try {
    const d = new Date(dateStr);
    return d.toLocaleDateString('id-ID', {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
    });
  } catch {
    return dateStr;
  }
}

export default function StudentAttendanceRecapPage({ embedded = false }) {
  const { user, isKesiswaan, isWaliKelas, hasRole } = useAuth();

  // State Akses Kelas
  const [classesList, setClassesList] = useState([]);
  const [roleContext, setRoleContext] = useState(null);
  const [selectedClassId, setSelectedClassId] = useState('');
  const [isClassesLoading, setIsClassesLoading] = useState(true);

  // State Filter Periode
  const [periodPreset, setPeriodPreset] = useState('month'); // 'month' | 'semester' | 'custom'
  const [customStartDate, setCustomStartDate] = useState('');
  const [customEndDate, setCustomEndDate] = useState('');

  // State Filter Siswa & Sorting
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('all'); // 'all' | 'at_risk_only' | 'danger' | 'warning'
  const [sortBy, setSortBy] = useState('name_asc'); // 'name_asc' | 'alpa_desc' | 'attendance_asc'

  // State Tab Halaman
  const [activeTab, setActiveTab] = useState('all_students'); // 'all_students' | 'at_risk'

  // State Data Rekap
  const [summaryData, setSummaryData] = useState(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isExporting, setIsExporting] = useState(false);
  const [errorMessage, setErrorMessage] = useState(null);

  // State Modal Detail Siswa
  const [selectedStudentForDetail, setSelectedStudentForDetail] = useState(null);

  // 1. Inisialisasi: Ambil daftar kelas yang berhak diakses
  useEffect(() => {
    let isMounted = true;
    async function loadClasses() {
      setIsClassesLoading(true);
      try {
        const res = await attendanceRecapApi.getClasses();
        const payload = res?.data ?? res;
        if (isMounted && (res?.success || payload?.classes)) {
          const list = payload?.classes || [];
          const ctx = payload?.role_context || {};
          const defaultId = payload?.default_class_id || (list[0]?.id ? String(list[0].id) : '');

          setClassesList(list);
          setRoleContext(ctx);
          setSelectedClassId(String(defaultId));
        }
      } catch (err) {
        if (isMounted) {
          setErrorMessage(
            err?.message ||
              err?.response?.data?.message ||
              'Gagal memuat wewenang kelas. Pastikan akun memiliki penugasan Wali Kelas atau Kesiswaan.'
          );
        }
      } finally {
        if (isMounted) {
          setIsClassesLoading(false);
        }
      }
    }

    loadClasses();
    return () => {
      isMounted = false;
    };
  }, []);

  // Hitung rentang tanggal efektif berdasarkan preset
  const effectiveDateRange = useMemo(() => {
    const now = new Date();
    const y = now.getFullYear();
    const m = now.getMonth(); // 0-11

    if (periodPreset === 'month') {
      const start = new Date(y, m, 1);
      const end = new Date(y, m + 1, 0);
      const format = (d) => todayLocalISO(d);
      return { start_date: format(start), end_date: format(end), label: 'Bulan Berjalan' };
    }

    if (periodPreset === 'semester') {
      // Semester Ganjil: Jul - Des, Semester Genap: Jan - Jun
      const isGanjil = m >= 6; // Juli onwards
      const start = isGanjil ? new Date(y, 6, 1) : new Date(y, 0, 1);
      const end = isGanjil ? new Date(y, 11, 31) : new Date(y, 5, 30);
      const format = (d) => todayLocalISO(d);
      return {
        start_date: format(start),
        end_date: format(end),
        label: isGanjil ? `Semester Ganjil ${y}/${y + 1}` : `Semester Genap ${y - 1}/${y}`,
      };
    }

    // Custom
    return {
      start_date: customStartDate || null,
      end_date: customEndDate || null,
      label: customStartDate && customEndDate ? `${customStartDate} s.d. ${customEndDate}` : 'Kustom',
    };
  }, [periodPreset, customStartDate, customEndDate]);

  // 2. Muat Data Rekapitulasi Kehadiran
  const fetchSummary = useCallback(async () => {
    if (!selectedClassId && selectedClassId !== 'all') return;
    setIsLoading(true);
    setErrorMessage(null);

    try {
      const params = {
        class_id: selectedClassId,
        search: searchQuery.trim() || undefined,
        status_filter: statusFilter,
        sort_by: sortBy,
      };

      if (effectiveDateRange.start_date) params.start_date = effectiveDateRange.start_date;
      if (effectiveDateRange.end_date) params.end_date = effectiveDateRange.end_date;

      const res = await attendanceRecapApi.getSummary(params);
      const payload = res?.data ?? res;
      if (res?.success || payload?.kpi) {
        setSummaryData(payload);
      } else {
        setErrorMessage(res?.message || 'Gagal mengambil rekapitulasi kehadiran.');
      }
    } catch (err) {
      setErrorMessage(
        err?.message ||
          err?.response?.data?.message ||
          'Terjadi kesalahan saat memuat data rekapitulasi kehadiran.'
      );
    } finally {
      setIsLoading(false);
    }
  }, [selectedClassId, searchQuery, statusFilter, sortBy, effectiveDateRange]);

  // Panggil fetchSummary setiap kali parameter filter utama berubah
  useEffect(() => {
    if (selectedClassId) {
      fetchSummary();
    }
  }, [selectedClassId, fetchSummary]);

  // Ekspor Excel (.xlsx)
  const handleExportExcel = async () => {
    setIsExporting(true);
    try {
      const params = {
        class_id: selectedClassId,
        search: searchQuery.trim() || undefined,
        status_filter: statusFilter,
        sort_by: sortBy,
      };
      if (effectiveDateRange.start_date) params.start_date = effectiveDateRange.start_date;
      if (effectiveDateRange.end_date) params.end_date = effectiveDateRange.end_date;

      const response = await attendanceRecapApi.exportExcel(params);
      const rawBlob = response instanceof Blob ? response : response?.data instanceof Blob ? response.data : new Blob([response]);
      const blob = new Blob([rawBlob], {
        type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      });
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;

      let fileName = `Rekap_Kehadiran_${todayLocalISO()}.xlsx`;
      link.setAttribute('download', fileName);
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(url);
    } catch (err) {
      setErrorMessage(
        err?.message || err?.response?.data?.message || 'Gagal mengekspor berkas Excel. Silakan coba kembali.'
      );
    } finally {
      setIsExporting(false);
    }
  };

  const kpi = summaryData?.kpi || {
    total_students: 0,
    total_sessions: 0,
    class_attendance_rate: null,
    total_hadir: 0,
    total_sakit: 0,
    total_izin: 0,
    total_alpa: 0,
    at_risk_count: 0,
  };

  const hasSessions = (kpi?.total_sessions ?? (kpi.total_hadir + kpi.total_sakit + kpi.total_izin + kpi.total_alpa)) > 0;

  const studentsList = summaryData?.students || [];
  const atRiskStudents = useMemo(() => {
    return studentsList.filter((s) => s.risk_level === 'danger' || s.risk_level === 'warning');
  }, [studentsList]);

  const isMultiClassActive = Boolean(summaryData?.is_multi_class);

  // Label Tingkat Kehadiran Kelas
  const getRateBadgeVariant = (rate) => {
    if (rate === null || rate === undefined) return 'default';
    if (rate >= 90) return 'success';
    if (rate >= 85) return 'warning';
    return 'danger';
  };

  return (
    <div className={embedded ? "space-y-6" : "space-y-6 max-w-7xl mx-auto px-4 py-6 sm:px-6"}>
      {/* 1. Header Halaman */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <h1 className={embedded ? "text-lg sm:text-xl font-bold text-gray-900" : "text-xl sm:text-2xl font-bold text-gray-900"}>
              Rekapitulasi Kehadiran Siswa
            </h1>
            {roleContext?.is_vice_principal && (
              <span className="text-xs px-2.5 py-0.5 rounded-full bg-indigo-100 text-indigo-800 font-semibold flex items-center gap-1">
                <Users size={13} />
                <span>Waka Kurikulum</span>
              </span>
            )}
            {roleContext?.is_wali_kelas && (
              <span className="text-xs px-2.5 py-0.5 rounded-full bg-blue-100 text-blue-800 font-semibold flex items-center gap-1">
                <GraduationCap size={13} />
                <span>Wali Kelas</span>
              </span>
            )}
            {roleContext?.is_kesiswaan && (
              <span className="text-xs px-2.5 py-0.5 rounded-full bg-emerald-100 text-emerald-800 font-semibold flex items-center gap-1">
                <Users size={13} />
                <span>Tim Kesiswaan</span>
              </span>
            )}
          </div>
          <p className="text-xs sm:text-sm text-gray-500 mt-1">
            Pantau statistik kehadiran kumulatif, identifikasi dini siswa sering tidak hadir, dan telusuri catatan presensi rombel.
          </p>
        </div>

        {/* Action Buttons */}
        <div className="flex items-center gap-2 shrink-0">
          <Button
            variant="outline"
            size="sm"
            onClick={fetchSummary}
            disabled={isLoading}
            className="flex items-center gap-1.5"
          >
            <RefreshCw size={14} className={isLoading ? 'animate-spin' : ''} />
            <span>Segarkan</span>
          </Button>

          <Button
            variant="primary"
            size="sm"
            onClick={handleExportExcel}
            disabled={isExporting || isLoading || studentsList.length === 0}
            className="flex items-center gap-1.5 bg-emerald-600 hover:bg-emerald-700 text-white border-transparent"
          >
            <Download size={14} className={isExporting ? 'animate-spin' : ''} />
            <span>{isExporting ? 'Mengekspor...' : 'Ekspor Excel (.xlsx)'}</span>
          </Button>
        </div>
      </div>

      {/* Pesan Kesalahan / Peringatan */}
      {errorMessage && (
        <div className="p-4 rounded-xl bg-rose-50 border border-rose-200 text-rose-800 text-sm flex items-start gap-3 shadow-sm">
          <AlertCircle size={18} className="text-rose-600 shrink-0 mt-0.5" />
          <div className="flex-1">
            <p className="font-semibold">Informasi</p>
            <p className="text-xs mt-0.5 text-rose-700">{errorMessage}</p>
          </div>
          <button
            type="button"
            onClick={() => setErrorMessage(null)}
            className="text-rose-500 hover:text-rose-700 text-xs font-semibold"
          >
            Tutup
          </button>
        </div>
      )}

      {/* 2. Filter Bar: Pilihan Kelas & Periode Waktu */}
      <div className="p-4 rounded-xl bg-white border border-gray-200 shadow-sm space-y-4">
        <div className="grid grid-cols-1 md:grid-cols-12 gap-3 items-center">
          {/* Pilihan Kelas */}
          <div className="md:col-span-4">
            <label className="block text-xs font-semibold text-gray-700 mb-1">
              Kelas Binaan
            </label>
            {isClassesLoading ? (
              <div className="h-9 bg-gray-100 rounded-lg animate-pulse" />
            ) : classesList.length > 1 || roleContext?.is_kesiswaan || roleContext?.is_vice_principal ? (
              <select
                value={selectedClassId}
                onChange={(e) => setSelectedClassId(e.target.value)}
                className="w-full h-9 px-3 text-xs border border-gray-300 rounded-lg bg-white focus:ring-2 focus:ring-blue-500 font-medium"
              >
                {(roleContext?.is_kesiswaan || roleContext?.is_vice_principal) && (
                  <option value="all">★ Semua Kelas Binaan ({classesList.length} Rombel)</option>
                )}
                {classesList.map((c) => (
                  <option key={c.id} value={c.id}>
                    Kelas {c.name} {c.is_homeroom ? '(Wali Kelas)' : ''}
                  </option>
                ))}
              </select>
            ) : classesList.length === 1 ? (
              <div className="h-9 px-3 flex items-center justify-between text-xs bg-gray-50 border border-gray-200 rounded-lg font-medium text-gray-800">
                <span>Kelas {classesList[0].name}</span>
                <span className="text-[10px] px-2 py-0.5 rounded bg-blue-100 text-blue-800 font-semibold">
                  Wali Kelas
                </span>
              </div>
            ) : (
              <div className="h-9 px-3 flex items-center text-xs bg-rose-50 border border-rose-200 rounded-lg text-rose-700">
                Tidak ada kelas binaan
              </div>
            )}
          </div>

          {/* Pilihan Rentang Waktu (Preset) */}
          <div className="md:col-span-4">
            <label className="block text-xs font-semibold text-gray-700 mb-1">
              Periode Presensi
            </label>
            <div className="flex items-center gap-1 bg-gray-100 p-1 rounded-lg">
              <button
                type="button"
                onClick={() => setPeriodPreset('month')}
                className={`flex-1 py-1.5 text-xs font-medium rounded-md transition-colors ${
                  periodPreset === 'month'
                    ? 'bg-white text-blue-700 shadow-sm font-semibold'
                    : 'text-gray-600 hover:text-gray-900'
                }`}
              >
                Bulan Ini
              </button>
              <button
                type="button"
                onClick={() => setPeriodPreset('semester')}
                className={`flex-1 py-1.5 text-xs font-medium rounded-md transition-colors ${
                  periodPreset === 'semester'
                    ? 'bg-white text-blue-700 shadow-sm font-semibold'
                    : 'text-gray-600 hover:text-gray-900'
                }`}
              >
                Semester Ini
              </button>
              <button
                type="button"
                onClick={() => setPeriodPreset('custom')}
                className={`flex-1 py-1.5 text-xs font-medium rounded-md transition-colors ${
                  periodPreset === 'custom'
                    ? 'bg-white text-blue-700 shadow-sm font-semibold'
                    : 'text-gray-600 hover:text-gray-900'
                }`}
              >
                Kustom
              </button>
            </div>
          </div>

          {/* Kustom Tanggal jika dipilih */}
          {periodPreset === 'custom' ? (
            <div className="md:col-span-4 flex items-center gap-2">
              <div className="flex-1">
                <label className="block text-[11px] font-medium text-gray-500 mb-1">Dari</label>
                <input
                  type="date"
                  value={customStartDate}
                  onChange={(e) => setCustomStartDate(e.target.value)}
                  className="w-full h-9 px-2 text-xs border border-gray-300 rounded-lg focus:ring-1 focus:ring-blue-500"
                />
              </div>
              <div className="flex-1">
                <label className="block text-[11px] font-medium text-gray-500 mb-1">Sampai</label>
                <input
                  type="date"
                  value={customEndDate}
                  onChange={(e) => setCustomEndDate(e.target.value)}
                  className="w-full h-9 px-2 text-xs border border-gray-300 rounded-lg focus:ring-1 focus:ring-blue-500"
                />
              </div>
            </div>
          ) : (
            <div className="md:col-span-4 flex items-center justify-end text-xs text-gray-500 font-medium">
              <Calendar size={13} className="mr-1 text-gray-400" />
              <span>
                {formatDateIndo(summaryData?.period?.start_date)} s.d.{' '}
                {formatDateIndo(summaryData?.period?.end_date)}
              </span>
            </div>
          )}
        </div>

        {/* Sub-bar: Pencarian, Status Filter & Sorting */}
        <div className="pt-3 border-t border-gray-100 flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
          <div className="relative flex-1 max-w-sm">
            <Search
              size={14}
              className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400"
            />
            <input
              type="text"
              placeholder="Cari nama siswa atau NIS..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full h-8 pl-8 pr-3 text-xs border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 bg-white"
            />
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {/* Filter Status Peringatan */}
            <div className="flex items-center gap-1.5">
              <span className="text-[11px] font-semibold text-gray-500 uppercase tracking-wider">
                Status:
              </span>
              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                className="h-8 px-2.5 text-xs border border-gray-300 rounded-lg bg-white focus:ring-1 focus:ring-blue-500"
              >
                <option value="all">Semua Siswa</option>
                <option value="at_risk_only">Perlu Perhatian (Kritis &amp; Waspada)</option>
                <option value="danger">Hanya Kritis (Alpa &ge; 3 / &lt;85%)</option>
                <option value="warning">Hanya Waspada (Alpa 1-2 / 85-89%)</option>
              </select>
            </div>

            {/* Urutan */}
            <div className="flex items-center gap-1.5">
              <span className="text-[11px] font-semibold text-gray-500 uppercase tracking-wider">
                Urutkan:
              </span>
              <select
                value={sortBy}
                onChange={(e) => setSortBy(e.target.value)}
                className="h-8 px-2.5 text-xs border border-gray-300 rounded-lg bg-white focus:ring-1 focus:ring-blue-500"
              >
                <option value="name_asc">Nama Siswa (A - Z)</option>
                <option value="alpa_desc">Alpa Terbanyak</option>
                <option value="attendance_asc">Kehadiran Terendah</option>
              </select>
            </div>
          </div>
        </div>
      </div>

      {/* 3. Stat Cards / KPI Bar */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          label="Tingkat Kehadiran"
          value={hasSessions && kpi.class_attendance_rate !== null ? `${kpi.class_attendance_rate}%` : '-'}
          badge={
            hasSessions && kpi.class_attendance_rate !== null
              ? kpi.class_attendance_rate >= 90
                ? 'Baik'
                : kpi.class_attendance_rate >= 85
                ? 'Waspada'
                : 'Kritis'
              : 'Belum Ada KBM'
          }
          badgeVariant={hasSessions && kpi.class_attendance_rate !== null ? getRateBadgeVariant(kpi.class_attendance_rate) : 'default'}
          variant={hasSessions && kpi.class_attendance_rate !== null ? getRateBadgeVariant(kpi.class_attendance_rate) : 'default'}
          accentBorder
          description={
            hasSessions && kpi.class_attendance_rate !== null
              ? 'Rasio kehadiran pada periode aktif'
              : 'Belum ada sesi KBM tercatat pada periode ini'
          }
        />

        <StatCard
          label="Siswa Perlu Perhatian"
          value={kpi.at_risk_count}
          unit="Siswa"
          badge={kpi.at_risk_count > 0 ? 'Perlu Follow-up' : 'Nihil'}
          badgeVariant={kpi.at_risk_count > 0 ? 'danger' : 'success'}
          variant={kpi.at_risk_count > 0 ? 'danger' : 'default'}
          accentBorder
          description="Alpa &ge; 1 atau kehadiran &lt; 90%"
        />

        <StatCard
          label="Total Alpa"
          value={kpi.total_alpa}
          unit="Pertemuan"
          badge={kpi.total_alpa > 0 ? 'Tanpa Kabar' : 'Tertib'}
          badgeVariant={kpi.total_alpa > 0 ? 'danger' : 'success'}
          variant={kpi.total_alpa > 0 ? 'warning' : 'default'}
          accentBorder
          description="Ketidakhadiran tanpa izin resmi"
        />

        <StatCard
          label="Sakit &amp; Izin"
          value={kpi.total_sakit + kpi.total_izin}
          unit="Pertemuan"
          badge={`${kpi.total_sakit} S / ${kpi.total_izin} I`}
          badgeVariant="info"
          variant="info"
          accentBorder
          description="Dengan surat atau izin sah"
        />
      </div>

      {/* Banner Informasi bila belum ada sesi KBM tercatat */}
      {!isLoading && studentsList.length > 0 && !hasSessions && (
        <div className="p-4 rounded-xl bg-blue-50/70 border border-blue-200 text-blue-900 text-xs flex items-start gap-3 shadow-sm">
          <Info size={18} className="text-blue-600 shrink-0 mt-0.5" />
          <div>
            <p className="font-semibold text-sm text-blue-950">
              Belum Ada Sesi Pertemuan KBM Tercatat
            </p>
            <p className="text-xs text-blue-800 mt-0.5">
              Guru pengampu belum mengisi atau menyelesaikan Jurnal Mengajar untuk kelas ini pada periode yang dipilih. Data kehadiran (H, S, I, A) akan otomatis diperbarui secara real-time saat guru menyelesaikan sesi KBM.
            </p>
          </div>
        </div>
      )}

      {/* 4. Tab Navigasi Halaman */}
      <div className="border-b border-gray-200">
        <nav className="flex space-x-6">
          <button
            type="button"
            onClick={() => setActiveTab('all_students')}
            className={`py-3 text-xs sm:text-sm font-semibold border-b-2 transition-colors flex items-center gap-2 ${
              activeTab === 'all_students'
                ? 'border-blue-600 text-blue-600'
                : 'border-transparent text-gray-500 hover:text-gray-700'
            }`}
          >
            <Users size={16} />
            <span>Rekapitulasi Siswa</span>
            <span className="text-xs px-2 py-0.5 rounded-full bg-gray-100 text-gray-600">
              {studentsList.length}
            </span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('at_risk')}
            className={`py-3 text-xs sm:text-sm font-semibold border-b-2 transition-colors flex items-center gap-2 ${
              activeTab === 'at_risk'
                ? 'border-rose-600 text-rose-600'
                : 'border-transparent text-gray-500 hover:text-gray-700'
            }`}
          >
            <AlertTriangle size={16} />
            <span>Siswa Sering Tidak Hadir</span>
            {kpi.at_risk_count > 0 && (
              <span className="text-xs px-2.5 py-0.5 rounded-full bg-rose-100 text-rose-700 font-bold">
                {kpi.at_risk_count}
              </span>
            )}
          </button>
        </nav>
      </div>

      {/* 5. Konten Tab */}

      {/* TAB 1: Rekapitulasi Siswa */}
      {activeTab === 'all_students' && (
        <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-gray-50 border-b border-gray-200 text-gray-600 font-semibold uppercase tracking-wider">
                <tr>
                  <th className="py-3 px-3 w-12 text-center">No</th>
                  <th className="py-3 px-3">Nama Siswa &amp; NIS</th>
                  {isMultiClassActive && <th className="py-3 px-3">Kelas</th>}
                  <th className="py-3 px-2 text-center w-12 text-emerald-700">H</th>
                  <th className="py-3 px-2 text-center w-12 text-blue-700">S</th>
                  <th className="py-3 px-2 text-center w-12 text-amber-700">I</th>
                  <th className="py-3 px-2 text-center w-12 text-rose-700 font-bold">A</th>
                  <th className="py-3 px-3 text-center w-28">% Kehadiran</th>
                  <th className="py-3 px-3 text-center w-36">Status</th>
                  <th className="py-3 px-3 min-w-[200px]">Catatan Guru Terakhir</th>
                  <th className="py-3 px-3 text-center w-28">Aksi</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {isLoading && (
                  <tr>
                    <td
                      colSpan={isMultiClassActive ? 11 : 10}
                      className="py-12 text-center text-gray-400"
                    >
                      <RefreshCw size={24} className="animate-spin text-blue-600 mx-auto mb-2" />
                      <span>Memuat data rekapitulasi siswa...</span>
                    </td>
                  </tr>
                )}

                {!isLoading && studentsList.length === 0 && (
                  <tr>
                    <td
                      colSpan={isMultiClassActive ? 11 : 10}
                      className="py-12 text-center text-gray-400"
                    >
                      <Users size={32} className="mx-auto mb-2 text-gray-300" />
                      <p className="font-semibold text-gray-700 text-sm">
                        Tidak Ada Siswa yang Ditemukan
                      </p>
                      <p className="text-xs text-gray-400 mt-1">
                        Coba sesuaikan kata kunci pencarian atau filter yang digunakan.
                      </p>
                    </td>
                  </tr>
                )}

                {!isLoading &&
                  studentsList.map((st, idx) => {
                    const isDanger = st.risk_level === 'danger';
                    const isWarning = st.risk_level === 'warning';

                    return (
                      <tr
                        key={st.id}
                        className={`hover:bg-gray-50 transition-colors ${
                          isDanger
                            ? 'bg-rose-50/30'
                            : isWarning
                            ? 'bg-amber-50/20'
                            : ''
                        }`}
                      >
                        <td className="py-3 px-3 text-center text-gray-400 font-medium">
                          {idx + 1}
                        </td>
                        <td className="py-3 px-3">
                          <div className="font-semibold text-gray-900">{st.name}</div>
                          <div className="text-[11px] text-gray-400 flex items-center gap-1.5 mt-0.5">
                            <span className="font-mono">{st.nis || '-'}</span>
                            <span>•</span>
                            <span>{st.gender === 'P' ? 'Perempuan' : 'Laki-Laki'}</span>
                          </div>
                        </td>

                        {isMultiClassActive && (
                          <td className="py-3 px-3">
                            <span className="px-2 py-0.5 rounded bg-gray-100 font-medium text-gray-700 text-[11px]">
                              {st.class_name}
                            </span>
                          </td>
                        )}

                        <td className="py-3 px-2 text-center font-semibold text-emerald-600">
                          {st.hadir}
                        </td>
                        <td className="py-3 px-2 text-center font-medium text-blue-600">
                          {st.sakit}
                        </td>
                        <td className="py-3 px-2 text-center font-medium text-amber-600">
                          {st.izin}
                        </td>
                        <td className="py-3 px-2 text-center font-bold text-rose-600">
                          {st.alpa}
                        </td>

                        <td className="py-3 px-3 text-center">
                          <div className="flex flex-col items-center">
                            {st.total_sessions > 0 && st.attendance_rate !== null && st.attendance_rate !== undefined ? (
                              <>
                                <span
                                  className={`font-bold ${
                                    st.attendance_rate >= 90
                                      ? 'text-emerald-700'
                                      : st.attendance_rate >= 85
                                      ? 'text-amber-700'
                                      : 'text-rose-700'
                                  }`}
                                >
                                  {st.attendance_rate}%
                                </span>
                                <div className="w-16 h-1.5 bg-gray-200 rounded-full mt-1 overflow-hidden">
                                  <div
                                    className={`h-full rounded-full ${
                                      st.attendance_rate >= 90
                                        ? 'bg-emerald-500'
                                        : st.attendance_rate >= 85
                                        ? 'bg-amber-500'
                                        : 'bg-rose-500'
                                    }`}
                                    style={{ width: `${Math.min(100, st.attendance_rate)}%` }}
                                  />
                                </div>
                              </>
                            ) : (
                              <span className="font-semibold text-gray-400">-</span>
                            )}
                          </div>
                        </td>

                        <td className="py-3 px-3 text-center">
                          {st.total_sessions > 0 ? (
                            isDanger ? (
                              <Badge variant="danger" dot>
                                Kritis
                              </Badge>
                            ) : isWarning ? (
                              <Badge variant="warning" dot>
                                Waspada
                              </Badge>
                            ) : (
                              <Badge variant="success" dot>
                                Baik
                              </Badge>
                            )
                          ) : (
                            <Badge variant="default">
                              Belum Ada KBM
                            </Badge>
                          )}
                        </td>

                        <td className="py-3 px-3">
                          {st.latest_note ? (
                            <div className="flex items-start gap-1.5 text-xs text-gray-700 bg-amber-50/60 p-2 rounded-lg border border-amber-200/60">
                              <MessageSquare size={13} className="text-amber-600 shrink-0 mt-0.5" />
                              <div className="line-clamp-2">
                                <span className="font-semibold text-amber-900">
                                  [{formatDateIndo(st.latest_note_date)}]:
                                </span>{' '}
                                <span>{st.latest_note}</span>
                              </div>
                            </div>
                          ) : (
                            <span className="text-gray-400 text-xs italic">
                              Tidak ada catatan
                            </span>
                          )}
                        </td>

                        <td className="py-3 px-3 text-center">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => setSelectedStudentForDetail(st)}
                            className="text-blue-600 hover:text-blue-800 flex items-center gap-1 mx-auto"
                            title="Buka Linimasa Presensi & Catatan Guru"
                          >
                            <Eye size={14} />
                            <span>Riwayat</span>
                          </Button>
                        </td>
                      </tr>
                    );
                  })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* TAB 2: Siswa Sering Tidak Hadir (At-Risk) */}
      {activeTab === 'at_risk' && (
        <div className="space-y-4">
          <div className="p-4 rounded-xl bg-amber-50 border border-amber-200 text-amber-900 text-xs flex items-start gap-3">
            <AlertTriangle size={18} className="text-amber-700 shrink-0 mt-0.5" />
            <div>
              <p className="font-semibold text-sm text-amber-950">
                Kriteria Siswa Membutuhkan Evaluasi Kehadiran
              </p>
              <ul className="list-disc pl-4 mt-1 space-y-0.5 text-amber-800">
                <li>
                  <strong>Kritis:</strong> Siswa memiliki <strong>Alpa &ge; 3 kali</strong> atau tingkat kehadiran <strong>&lt; 85%</strong>.
                </li>
                <li>
                  <strong>Waspada:</strong> Siswa memiliki <strong>Alpa 1–2 kali</strong>, tingkat kehadiran <strong>85% – 89.9%</strong>, atau akumulasi tidak masuk (S+I+A) <strong>&ge; 5 kali</strong>.
                </li>
              </ul>
            </div>
          </div>

          <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-gray-50 border-b border-gray-200 text-gray-600 font-semibold uppercase tracking-wider">
                  <tr>
                    <th className="py-3 px-3 w-12 text-center">No</th>
                    <th className="py-3 px-3">Nama Siswa</th>
                    {isMultiClassActive && <th className="py-3 px-3">Kelas</th>}
                    <th className="py-3 px-2 text-center text-rose-700 font-bold">Alpa</th>
                    <th className="py-3 px-2 text-center text-blue-700">Sakit</th>
                    <th className="py-3 px-2 text-center text-amber-700">Izin</th>
                    <th className="py-3 px-3 text-center">% Hadir</th>
                    <th className="py-3 px-3 text-center">Tingkat Risiko</th>
                    <th className="py-3 px-3 min-w-[200px]">Catatan Guru Terakhir</th>
                    <th className="py-3 px-3 text-center w-28">Aksi</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {atRiskStudents.length === 0 ? (
                    <tr>
                      <td
                        colSpan={isMultiClassActive ? 10 : 9}
                        className="py-12 text-center text-gray-400"
                      >
                        <CheckCircle2 size={32} className="mx-auto mb-2 text-emerald-500" />
                        <p className="font-semibold text-gray-700 text-sm">
                          Seluruh Siswa Berstatus Baik
                        </p>
                        <p className="text-xs text-gray-400 mt-1">
                          Tidak ditemukan siswa dengan indikator Alpa berulang maupun kehadiran di bawah batas minimum.
                        </p>
                      </td>
                    </tr>
                  ) : (
                    atRiskStudents.map((st, idx) => {
                      const isDanger = st.risk_level === 'danger';

                      return (
                        <tr
                          key={st.id}
                          className={`hover:bg-gray-50 transition-colors ${
                            isDanger ? 'bg-rose-50/40' : 'bg-amber-50/30'
                          }`}
                        >
                          <td className="py-3 px-3 text-center text-gray-400 font-medium">
                            {idx + 1}
                          </td>
                          <td className="py-3 px-3">
                            <div className="font-semibold text-gray-900">{st.name}</div>
                            <div className="text-[11px] text-gray-400 font-mono mt-0.5">
                              NIS: {st.nis || '-'}
                            </div>
                          </td>
                          {isMultiClassActive && (
                            <td className="py-3 px-3">
                              <span className="px-2 py-0.5 rounded bg-gray-100 font-medium text-gray-700 text-[11px]">
                                {st.class_name}
                              </span>
                            </td>
                          )}
                          <td className="py-3 px-2 text-center font-bold text-rose-700 text-sm">
                            {st.alpa}
                          </td>
                          <td className="py-3 px-2 text-center text-blue-600 font-medium">
                            {st.sakit}
                          </td>
                          <td className="py-3 px-2 text-center text-amber-600 font-medium">
                            {st.izin}
                          </td>
                          <td className="py-3 px-3 text-center font-bold text-gray-800">
                            {st.attendance_rate}%
                          </td>
                          <td className="py-3 px-3 text-center">
                            {isDanger ? (
                              <Badge variant="danger" dot>
                                Kritis (Perhatian)
                              </Badge>
                            ) : (
                              <Badge variant="warning" dot>
                                Waspada
                              </Badge>
                            )}
                          </td>
                          <td className="py-3 px-3">
                            {st.latest_note ? (
                              <div className="flex items-start gap-1.5 text-xs text-gray-700 bg-amber-50/80 p-2 rounded-lg border border-amber-200">
                                <MessageSquare
                                  size={13}
                                  className="text-amber-700 shrink-0 mt-0.5"
                                />
                                <div className="line-clamp-2">
                                  <span className="font-semibold text-amber-950">
                                    [{formatDateIndo(st.latest_note_date)}]:
                                  </span>{' '}
                                  <span>{st.latest_note}</span>
                                </div>
                              </div>
                            ) : (
                              <span className="text-gray-400 text-xs italic">
                                Belum ada catatan
                              </span>
                            )}
                          </td>
                          <td className="py-3 px-3 text-center">
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => setSelectedStudentForDetail(st)}
                              className="text-blue-600 hover:text-blue-800 flex items-center gap-1 mx-auto text-xs"
                            >
                              <Eye size={13} />
                              <span>Detail</span>
                            </Button>
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* Modal Detail Riwayat Siswa */}
      <StudentAttendanceDetailModal
        isOpen={Boolean(selectedStudentForDetail)}
        onClose={() => setSelectedStudentForDetail(null)}
        student={selectedStudentForDetail}
        startDate={summaryData?.period?.start_date}
        endDate={summaryData?.period?.end_date}
      />
    </div>
  );
}
