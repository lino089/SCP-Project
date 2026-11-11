import { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import * as XLSX from 'xlsx';
import {
  GraduationCap,
  Search,
  FileSpreadsheet,
  RotateCw,
  Calendar,
  History,
  ArrowRight,
  Eye,
  X,
  Filter,
  Users,
} from 'lucide-react';
import {
  Button,
  Badge,
  Modal,
  Pagination,
  StatCard,
} from '../../components/shared';
import { SkeletonRow, EmptyState, ErrorState, LoadingOverlay } from '../../components/feedback';
import { alumniApi } from '../../services/masterDataApi';
import { formatDate } from '../../utils/formatters';
import './AlumniPage.css';

/**
 * Helper untuk mengekstrak singkatan kejuruan/jurusan dari nama kelas.
 */
function extractJurusan(className) {
  if (!className) return 'Umum';
  const name = String(className).toUpperCase();
  const match = name.match(/\b(RPL|TKJ|DKV|AKL|AK|MPLB|MP|BR|BD|LPS|TBSM|TSM|TKRO|TKR|BDP|OTKP|IPA|IPS)\b/i);
  if (match) return match[1].toUpperCase();
  return 'Umum';
}

const COMMON_MAJORS = ['ALL', 'RPL', 'TKJ', 'DKV', 'AK', 'MP', 'BR', 'BD', 'LPS'];

export default function AlumniPage() {
  const searchInputRef = useRef(null);

  // Data states
  const [alumniList, setAlumniList] = useState([]);
  const [meta, setMeta] = useState({
    current_page: 1,
    per_page: 25,
    total: 0,
    last_page: 1,
    available_years: [],
  });
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState(null);
  const [isExporting, setIsExporting] = useState(false);

  // Filter & Search states
  const [searchQuery, setSearchQuery] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [selectedYear, setSelectedYear] = useState('ALL');
  const [selectedMajor, setSelectedMajor] = useState('ALL');
  const [currentPage, setCurrentPage] = useState(1);
  const [perPage, setPerPage] = useState(25);

  // History detail modal state
  const [selectedStudentForHistory, setSelectedStudentForHistory] = useState(null);

  // Debounce search input
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearch(searchQuery.trim());
      setCurrentPage(1);
    }, 400);
    return () => clearTimeout(timer);
  }, [searchQuery]);

  // Keyboard shortcut '/' to focus search input
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === '/' && !['INPUT', 'TEXTAREA', 'SELECT'].includes(document.activeElement?.tagName)) {
        e.preventDefault();
        searchInputRef.current?.focus();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  // Fetch Alumni Data
  const fetchAlumniData = useCallback(async (page = 1) => {
    setIsLoading(true);
    setLoadError(null);
    try {
      const params = {
        page,
        per_page: 25,
      };

      if (debouncedSearch) {
        params.search = debouncedSearch;
      }
      if (selectedYear && selectedYear !== 'ALL') {
        params.graduation_year = selectedYear;
      }
      if (selectedMajor && selectedMajor !== 'ALL') {
        params.major = selectedMajor;
      }

      const res = await alumniApi.getAlumni(params);
      const payload = (res && res.success !== undefined) ? res : (res?.data || {});

      if (payload?.success) {
        setAlumniList(Array.isArray(payload.data) ? payload.data : []);
        if (payload.meta) {
          setMeta(payload.meta);
        }
      } else if (Array.isArray(payload)) {
        setAlumniList(payload);
      } else {
        setAlumniList([]);
      }
    } catch (err) {
      const msg = err.response?.data?.message || err.message || 'Gagal memuat basis data arsip siswa.';
      setLoadError(msg);
      setAlumniList([]);
    } finally {
      setIsLoading(false);
    }
  }, [debouncedSearch, selectedYear, selectedMajor]);

  // Fetch when page or filter changes
  useEffect(() => {
    fetchAlumniData(currentPage);
  }, [fetchAlumniData, currentPage]);

  const handleResetFilters = () => {
    setSearchQuery('');
    setDebouncedSearch('');
    setSelectedYear('ALL');
    setSelectedMajor('ALL');
    setCurrentPage(1);
  };

  const isFilterActive = searchQuery || selectedYear !== 'ALL' || selectedMajor !== 'ALL';

  // Metrics calculation
  const metrics = useMemo(() => {
    const totalCount = meta.total || alumniList.length;
    const yearsCount = (meta.available_years && meta.available_years.length > 0)
      ? meta.available_years.length
      : (alumniList.some(a => a.graduation_year) ? new Set(alumniList.map(a => a.graduation_year)).size : 0);

    let maleCount = 0;
    let femaleCount = 0;
    alumniList.forEach((a) => {
      if (a.gender === 'L') maleCount += 1;
      else if (a.gender === 'P') femaleCount += 1;
    });

    return {
      total: totalCount,
      years: yearsCount,
      males: maleCount,
      females: femaleCount,
    };
  }, [meta, alumniList]);

  // Ekspor Data Alumni ke Excel (.xlsx)
  const handleExportExcel = async () => {
    setIsExporting(true);
    try {
      // Ambil seluruh data alumni sesuai filter aktif (all = 1)
      const exportParams = { all: 1 };
      if (debouncedSearch) exportParams.search = debouncedSearch;
      if (selectedYear && selectedYear !== 'ALL') exportParams.graduation_year = selectedYear;
      if (selectedMajor && selectedMajor !== 'ALL') exportParams.major = selectedMajor;

      const res = await alumniApi.getAlumni(exportParams);
      const payload = (res && res.success !== undefined) ? res : (res?.data || {});
      const dataToExport = Array.isArray(payload.data) ? payload.data : (Array.isArray(payload) ? payload : alumniList);

      if (!dataToExport || dataToExport.length === 0) {
        alert('Tidak ada data arsip siswa untuk diekspor.');
        return;
      }

      const rows = dataToExport.map((item, idx) => ({
        'No': idx + 1,
        'NIS': item.nis || '-',
        'NISN': item.nisn || '-',
        'Nama Lengkap Siswa': item.name || '-',
        'Jenis Kelamin': item.gender === 'L' ? 'Laki-laki' : item.gender === 'P' ? 'Perempuan' : '-',
        'Kelas Terakhir': item.last_class_name || '-',
        'Jurusan': extractJurusan(item.last_class_name),
        'Tahun Kelulusan': item.graduation_year || '-',
        'Tanggal Kelulusan / SKL': item.graduation_date ? formatDate(item.graduation_date) : '-',
        'Email': item.email || '-',
        'No. Telepon': item.phone_number || '-',
      }));

      const worksheet = XLSX.utils.json_to_sheet(rows);

      // Auto-fit lebar kolom
      const colWidths = [
        { wch: 6 },  // No
        { wch: 14 }, // NIS
        { wch: 16 }, // NISN
        { wch: 32 }, // Nama
        { wch: 14 }, // Gender
        { wch: 16 }, // Kelas
        { wch: 12 }, // Jurusan
        { wch: 16 }, // Tahun Lulus
        { wch: 22 }, // Tanggal Lulus
        { wch: 26 }, // Email
        { wch: 16 }, // Telepon
      ];
      worksheet['!cols'] = colWidths;

      const workbook = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(workbook, worksheet, 'Arsip Siswa');

      const yearSuffix = selectedYear !== 'ALL' ? `_${selectedYear}` : '';
      const dateStr = new Date().toISOString().split('T')[0];
      const fileName = `Arsip_Siswa_SCP${yearSuffix}_${dateStr}.xlsx`;

      XLSX.writeFile(workbook, fileName);
    } catch (err) {
      alert(err.response?.data?.message || err.message || 'Gagal mengekspor data arsip siswa ke Excel.');
    } finally {
      setIsExporting(false);
    }
  };

  return (
    <div className="alumni-page-container">
      {/* Header */}
      <div className="alumni-header">
        <div className="alumni-title-group">
          <h1 className="alumni-title">
            <GraduationCap size={28} className="text-neutral-900" />
            <span>Arsip Siswa &amp; Kelulusan</span>
            {meta?.total !== undefined && (
              <span className="alumni-badge-count">
                {meta.total.toLocaleString('id-ID')} Siswa
              </span>
            )}
          </h1>
          <p className="alumni-subtitle">
            Daftar siswa lulusan institusi, arsip riwayat kelas terakhir, tahun kelulusan/angkatan, dan rekam jejak akademik siswa.
          </p>
        </div>

        <div className="alumni-header-actions">
          <Button
            variant="secondary"
            icon={RotateCw}
            onClick={() => fetchAlumniData(currentPage)}
            loading={isLoading}
            disabled={isLoading || isExporting}
            title="Muat Ulang Arsip Siswa"
          >
            Refresh
          </Button>

          <Button
            variant="primary"
            icon={FileSpreadsheet}
            onClick={handleExportExcel}
            loading={isExporting}
            disabled={isLoading || isExporting || ((meta?.total ?? alumniList.length) === 0)}
            title="Unduh seluruh arsip siswa terfilter ke format spreadsheet Excel (.xlsx)"
          >
            Unduh Berkas Excel (.xlsx)
          </Button>
        </div>
      </div>

      {/* Main Table Section */}
      <section className="alumni-section">
        {/* Toolbar & Filters */}
        <div className="alumni-toolbar">
          <div className="alumni-search-wrap">
            <Search size={15} className="alumni-search-icon" />
            <input
              ref={searchInputRef}
              type="text"
              className="alumni-search-input"
              placeholder="Cari nama, NIS, atau NISN siswa..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
            <kbd className="alumni-search-shortcut">/</kbd>
          </div>

          <div className="alumni-filters">
            {/* Filter Tahun Kelulusan */}
            <select
              className="alumni-filter-select"
              value={selectedYear}
              onChange={(e) => {
                setSelectedYear(e.target.value);
                setCurrentPage(1);
              }}
            >
              <option value="ALL">Semua Tahun Kelulusan</option>
              {meta.available_years && meta.available_years.map((yr) => (
                <option key={yr} value={String(yr)}>
                  Tahun Kelulusan {yr}
                </option>
              ))}
            </select>

            {/* Filter Jurusan */}
            <select
              className="alumni-filter-select"
              value={selectedMajor}
              onChange={(e) => {
                setSelectedMajor(e.target.value);
                setCurrentPage(1);
              }}
            >
              <option value="ALL">Semua Jurusan</option>
              {COMMON_MAJORS.filter((m) => m !== 'ALL').map((m) => (
                <option key={m} value={m}>
                  Jurusan {m}
                </option>
              ))}
            </select>

            {/* Reset Filter Button */}
            {isFilterActive && (
              <button
                type="button"
                className="alumni-reset-btn"
                onClick={handleResetFilters}
                title="Reset Semua Filter"
              >
                <X size={14} />
                <span>Reset</span>
              </button>
            )}
          </div>
        </div>

        {/* Content Area */}
        {isLoading ? (
          <div className="p-4 bg-white">
            <SkeletonRow variant="block" columns={6} count={5} />
          </div>
        ) : loadError ? (
          <ErrorState
            title="Gagal Memuat Arsip Siswa"
            message={loadError}
            onRetry={() => fetchAlumniData(currentPage)}
          />
        ) : alumniList.length === 0 ? (
          <EmptyState
            title="Belum Ada Arsip Siswa"
            message={
              isFilterActive
                ? 'Tidak ditemukan arsip siswa yang sesuai dengan parameter filter atau pencarian Anda.'
                : 'Belum ada siswa yang dinyatakan lulus di sistem. Siswa tingkat 12 akan otomatis masuk ke daftar arsip siswa setelah proses Kenaikan Kelas & Kelulusan dijalankan.'
            }
          />
        ) : (
          <div className="alumni-table-wrap">
            <table className="alumni-table">
              <thead>
                <tr>
                  <th style={{ width: '50px' }}>No</th>
                  <th style={{ width: '130px' }}>NIS / NISN</th>
                  <th>Nama Lengkap Siswa</th>
                  <th style={{ width: '60px', textAlign: 'center' }}>L/P</th>
                  <th style={{ width: '130px' }}>Kelas Terakhir</th>
                  <th style={{ width: '90px' }}>Jurusan</th>
                  <th style={{ width: '120px' }}>Tahun Lulus</th>
                  <th style={{ width: '150px' }}>Tanggal Kelulusan</th>
                  <th style={{ width: '130px', textAlign: 'right' }}>Aksi</th>
                </tr>
              </thead>
              <tbody>
                {alumniList.map((student, idx) => {
                  const itemIndex = ((currentPage - 1) * (meta.per_page || 25)) + idx + 1;
                  const jurusan = extractJurusan(student.last_class_name);
                  const historiesCount = student.class_histories?.length || 0;

                  return (
                    <tr key={student.id}>
                      <td className="alumni-cell-no">
                        {String(itemIndex).padStart(2, '0')}
                      </td>
                      <td>
                        <div className="alumni-nis-mono">
                          <span className="alumni-nis-val">{student.nis || '-'}</span>
                          {student.nisn && (
                            <span className="alumni-nisn-sub">NISN: {student.nisn}</span>
                          )}
                        </div>
                      </td>
                      <td>
                        <div className="alumni-name-cell">
                          <span className="alumni-name-text">{student.name}</span>
                          {(student.email || student.phone_number) && (
                            <span className="alumni-contact-sub">
                              {student.email || student.phone_number}
                            </span>
                          )}
                        </div>
                      </td>
                      <td style={{ textAlign: 'center' }}>
                        {student.gender === 'L' ? (
                          <span className="alumni-gender-badge alumni-gender-badge--l" title="Laki-laki">
                            L
                          </span>
                        ) : student.gender === 'P' ? (
                          <span className="alumni-gender-badge alumni-gender-badge--p" title="Perempuan">
                            P
                          </span>
                        ) : (
                          <span className="text-neutral-400 text-xs">-</span>
                        )}
                      </td>
                      <td>
                        <strong className="font-mono text-xs text-neutral-900">
                          {student.last_class_name || '-'}
                        </strong>
                      </td>
                      <td>
                        <span className="alumni-major-badge">{jurusan}</span>
                      </td>
                      <td>
                        <span className="alumni-year-badge">
                          <GraduationCap size={12} />
                          <span>{student.graduation_year || '-'}</span>
                        </span>
                      </td>
                      <td>
                        <span className="text-xs text-neutral-700">
                          {student.graduation_date ? formatDate(student.graduation_date) : '-'}
                        </span>
                      </td>
                      <td style={{ textAlign: 'right' }}>
                        <Button
                          variant="secondary"
                          size="sm"
                          icon={History}
                          onClick={() => setSelectedStudentForHistory(student)}
                          title="Lihat riwayat pergerakan kelas & kelulusan siswa"
                        >
                          Riwayat ({historiesCount})
                        </Button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

        {/* Footer & Pagination */}
        {meta.total > 0 && (
          <div className="alumni-footer">
            <Pagination
              currentPage={currentPage}
              totalPages={meta.last_page || 1}
              totalItems={meta.total}
              perPage={meta.per_page || 25}
              onPageChange={(page) => setCurrentPage(page)}
              disabled={isLoading}
            />
          </div>
        )}
      </section>

      {/* Modal Riwayat Kelas & Mutasi Akademik */}
      <Modal
        isOpen={selectedStudentForHistory !== null}
        onClose={() => setSelectedStudentForHistory(null)}
        title={`Jejak Riwayat Akademik: ${selectedStudentForHistory?.name || ''}`}
        size="md"
        footer={
          <div className="flex justify-end w-full">
            <Button variant="secondary" onClick={() => setSelectedStudentForHistory(null)}>
              Tutup
            </Button>
          </div>
        }
      >
        <div className="py-2">
          {/* Student mini info banner */}
          <div className="bg-neutral-50 border border-neutral-200 rounded-lg p-3 mb-4 flex items-center justify-between flex-wrap gap-2">
            <div>
              <div className="font-semibold text-neutral-900 text-sm">{selectedStudentForHistory?.name}</div>
              <div className="font-mono text-xs text-neutral-500">
                NIS: {selectedStudentForHistory?.nis || '-'} | NISN: {selectedStudentForHistory?.nisn || '-'}
              </div>
            </div>
            <Badge variant="success">
              Lulus Tahun {selectedStudentForHistory?.graduation_year || '-'}
            </Badge>
          </div>

          <h4 className="text-xs font-semibold text-neutral-500 uppercase tracking-wider mb-3">
            Linimasa Mutasi &amp; Kenaikan Kelas
          </h4>

          {(!selectedStudentForHistory?.class_histories || selectedStudentForHistory.class_histories.length === 0) ? (
            <p className="text-xs text-neutral-500 italic py-4 text-center">
              Belum ada riwayat kenaikan kelas yang tercatat secara digital untuk siswa ini.
            </p>
          ) : (
            <div className="alumni-history-timeline">
              {selectedStudentForHistory.class_histories.map((h) => {
                const isGraduated = h.action_type === 'graduated';
                const isPromoted = h.action_type === 'promoted';
                const isHeldBack = h.action_type === 'held_back';

                const dotClass = isGraduated
                  ? 'alumni-history-dot--graduated'
                  : isHeldBack
                  ? 'alumni-history-dot--held_back'
                  : 'alumni-history-dot--promoted';

                const badgeVariant = isGraduated ? 'success' : isHeldBack ? 'danger' : 'info';
                const badgeLabel = isGraduated ? 'Kelulusan' : isHeldBack ? 'Tinggal Kelas' : 'Naik Kelas';

                return (
                  <div key={h.id} className="alumni-history-item">
                    <span className={`alumni-history-dot ${dotClass}`} />
                    <div className="alumni-history-content">
                      <div className="alumni-history-header">
                        <span className="alumni-history-year">
                          Tahun Ajaran {h.academic_year || '-'}
                        </span>
                        <Badge variant={badgeVariant}>{badgeLabel}</Badge>
                      </div>

                      <div className="alumni-history-transition">
                        <span>{h.from_class || '-'}</span>
                        <ArrowRight size={13} className="text-neutral-400" />
                        <span>{h.to_class || (isGraduated ? 'Lulus dari Sekolah' : '-')}</span>
                      </div>

                      <div className="alumni-history-meta">
                        {h.processed_at && (
                          <span>Diproses: {formatDate(h.processed_at)}</span>
                        )}
                        {h.notes && <span>• Catatan: {h.notes}</span>}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </Modal>

      {/* Fullscreen Loading Overlay saat Ekspor Excel */}
      {isExporting && (
        <LoadingOverlay
          fixed
          message="Menyiapkan Berkas Excel Arsip Siswa..."
          subtext="Sedang merapikan seluruh baris dan kolom data arsip siswa lulusan."
        />
      )}
    </div>
  );
}
