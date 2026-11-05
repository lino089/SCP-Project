import { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import {
  Pencil,
  RotateCcw,
  ArrowRight,
  Search,
  Calendar,
} from 'lucide-react';
import {
  Button,
  Select,
  Modal,
  Badge,
  ConfirmDialog,
} from '../../components/shared';
import { SkeletonRow, EmptyState, ErrorState, LoadingOverlay } from '../../components/feedback';
import { classApi, studentApi } from '../../services/masterDataApi';
import './GradePromotion.css';

/**
 * Helper untuk mengekstrak singkatan kejuruan/jurusan dari nama kelas.
 * Mendeteksi RPL, TKJ, DKV, AKL, AK, MPLB, MP, TBSM, TKR, IPA, IPS, dll.
 * Jika tidak ditemukan (misal format kelas umum "X-1", "X-2"), fallback ke 'Umum'.
 */
function extractJurusan(className) {
  if (!className) return 'Umum';
  const name = String(className).toUpperCase();
  const match = name.match(/\b(RPL|TKJ|DKV|AKL|AK|MPLB|MP|TBSM|TSM|TKRO|TKR|BDP|OTKP|IPA|IPS|SIJA|TOI|TITL|TB)\b/i);
  if (match) return match[1].toUpperCase();

  const hyphenMatch = name.match(/-(IPA|IPS|RPL|TKJ|DKV|AK|AKL)-/i);
  if (hyphenMatch) return hyphenMatch[1].toUpperCase();

  return 'Umum';
}

export default function GradePromotionPage() {
  const [classList, setClassList] = useState([]);
  const [studentList, setStudentList] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [fetchError, setFetchError] = useState(null);
  const [holdingBackStudentId, setHoldingBackStudentId] = useState(null);

  // Section 1: Edit Mapping Modal State
  const [editingClass, setEditingClass] = useState(null);
  const [selectedNextClassId, setSelectedNextClassId] = useState('');
  const [isSavingMapping, setIsSavingMapping] = useState(false);

  // Section 2: Filter States & Shortcut
  const searchInputRef = useRef(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedJurusanFilter, setSelectedJurusanFilter] = useState('ALL');
  const [selectedLevelFilter, setSelectedLevelFilter] = useState('ALL'); // 'ALL' | '10' | '11' | '12'
  const [selectedClassFilter, setSelectedClassFilter] = useState('ALL');
  const [selectedStatusFilter, setSelectedStatusFilter] = useState('ALL'); // 'ALL' | 'READY' | 'HELD_BACK'
  const [graduationDate, setGraduationDate] = useState('2026-06-20');

  // Section 3: Mass Promotion Execution States
  const [isConfirmModalOpen, setIsConfirmModalOpen] = useState(false);
  const [isExecuting, setIsExecuting] = useState(false);
  const [promotionResult, setPromotionResult] = useState(null);

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

  // Manual refresh handler
  const handleRefresh = useCallback(async () => {
    setIsLoading(true);
    setFetchError(null);
    try {
      const [cRes, sRes] = await Promise.all([
        classApi.getClasses({ all: true }),
        studentApi.getStudents({ all: true }),
      ]);
      if (cRes?.data) setClassList(cRes.data);
      if (sRes?.data) setStudentList(sRes.data);
    } catch (err) {
      setFetchError(err?.response?.data?.message || err?.message || 'Gagal memuat data kenaikan kelas.');
      setClassList([]);
      setStudentList([]);
    } finally {
      setIsLoading(false);
    }
  }, []);

  // Initial load on mount
  useEffect(() => {
    let isMounted = true;
    async function init() {
      setIsLoading(true);
      setFetchError(null);
      try {
        const [cRes, sRes] = await Promise.all([
          classApi.getClasses({ all: true }),
          studentApi.getStudents({ all: true }),
        ]);
        if (isMounted && cRes?.data) setClassList(cRes.data);
        if (isMounted && sRes?.data) setStudentList(sRes.data);
      } catch (err) {
        if (isMounted) {
          setFetchError(err?.response?.data?.message || err?.message || 'Gagal memuat data kenaikan kelas.');
          setClassList([]);
          setStudentList([]);
        }
      } finally {
        if (isMounted) {
          setIsLoading(false);
        }
      }
    }
    init();
    return () => {
      isMounted = false;
    };
  }, []);

  // Section 1: Edit Mapping Handlers
  const handleOpenEditMapping = (cls) => {
    setEditingClass(cls);
    setSelectedNextClassId(cls.next_class_id ? String(cls.next_class_id) : '');
  };

  const handleSaveMapping = async () => {
    if (!editingClass) return;
    setIsSavingMapping(true);

    const nextId = selectedNextClassId ? Number(selectedNextClassId) : null;
    const payload = {
      name: editingClass.name,
      level: Number(editingClass.level),
      next_class_id: nextId,
    };

    try {
      await classApi.updateClass(editingClass.id, payload);
      setClassList((prev) =>
        prev.map((c) => (c.id === editingClass.id ? { ...c, next_class_id: nextId } : c))
      );
    } catch {
      // Offline fallback
      setClassList((prev) =>
        prev.map((c) => (c.id === editingClass.id ? { ...c, next_class_id: nextId } : c))
      );
    } finally {
      setIsSavingMapping(false);
      setEditingClass(null);
    }
  };

  // Section 2: Toggle Hold-Back Checkbox
  const handleToggleHoldBack = async (student) => {
    const studentId = student.id;
    const newStatus = !student.is_held_back;

    setHoldingBackStudentId(studentId);
    try {
      await studentApi.holdBack(studentId, { is_held_back: newStatus });
      // Update local state
      setStudentList((prev) =>
        prev.map((s) => (s.id === studentId ? { ...s, is_held_back: newStatus } : s))
      );
    } catch (err) {
      alert(err.response?.data?.message || err.message || 'Gagal mengubah status tinggal kelas siswa.');
    } finally {
      setHoldingBackStudentId(null);
    }
  };

  // Section 3: Mass Promotion Execution
  const handleExecutePromotion = async () => {
    setIsExecuting(true);
    try {
      const res = await classApi.promoteClasses();
      const resultData = res?.data;
      if (!resultData) {
        throw new Error('Respons server tidak memuat data hasil kenaikan kelas.');
      }

      setPromotionResult(resultData);
      setIsConfirmModalOpen(false);
      // Reload updated student list
      await handleRefresh();
    } catch (err) {
      const errorMsg =
        err.response?.data?.message ||
        err.message ||
        'Gagal mengeksekusi kenaikan kelas massal. Silakan periksa koneksi server.';
      alert(errorMsg);
    } finally {
      setIsExecuting(false);
    }
  };

  // Unique Jurusan options from current class list
  const availableMajors = useMemo(() => {
    const majors = new Set();
    classList.forEach((cls) => {
      majors.add(extractJurusan(cls.name));
    });
    return Array.from(majors);
  }, [classList]);

  // Selectable classes filtered by selected level
  const selectableClasses = useMemo(() => {
    if (selectedLevelFilter === 'ALL') return classList;
    return classList.filter((c) => String(c.level) === selectedLevelFilter);
  }, [classList, selectedLevelFilter]);

  // Filtered students based on all filter parameters
  const filteredStudents = useMemo(() => {
    const q = searchQuery.toLowerCase().trim();

    return studentList.filter((s) => {
      const cls = classList.find((c) => c.id === s.class_id);
      const studentLevel = cls ? String(cls.level) : '';
      const studentMajor = cls ? extractJurusan(cls.name) : 'Umum';

      // 1. Level filter (Segmented Tab)
      if (selectedLevelFilter !== 'ALL' && studentLevel !== selectedLevelFilter) {
        return false;
      }
      // 2. Class filter (Dropdown)
      if (selectedClassFilter !== 'ALL' && String(s.class_id) !== selectedClassFilter) {
        return false;
      }
      // 3. Jurusan filter (Dropdown)
      if (selectedJurusanFilter !== 'ALL' && studentMajor !== selectedJurusanFilter) {
        return false;
      }
      // 4. Status filter (Dropdown)
      if (selectedStatusFilter === 'READY' && s.is_held_back) {
        return false;
      }
      if (selectedStatusFilter === 'HELD_BACK' && !s.is_held_back) {
        return false;
      }

      // 5. Search query (Name or NIS)
      if (!q) return true;
      const name = String(s.name || '').toLowerCase();
      const nis = String(s.nis_nip || s.nis || '').toLowerCase();
      return name.includes(q) || nis.includes(q);
    });
  }, [
    studentList,
    classList,
    searchQuery,
    selectedLevelFilter,
    selectedClassFilter,
    selectedJurusanFilter,
    selectedStatusFilter,
  ]);

  // Total statistics for Section 2
  const totalFilteredCount = filteredStudents.length;
  const heldBackCount = useMemo(() => {
    return filteredStudents.filter((s) => s.is_held_back).length;
  }, [filteredStudents]);

  // Section 1: Grouping Classes by Cohort (Setiap Angkatan: 10, 11, 12)
  const cohortGroups = useMemo(() => {
    const levels = [
      { level: 10, roman: 'X', title: 'Angkatan Kelas X (Tingkat 10)' },
      { level: 11, roman: 'XI', title: 'Angkatan Kelas XI (Tingkat 11)' },
      { level: 12, roman: 'XII', title: 'Angkatan Kelas XII (Tingkat 12)' },
    ];

    return levels.map((lvl) => ({
      ...lvl,
      classes: classList.filter((c) => Number(c.level) === lvl.level),
    }));
  }, [classList]);

  // Section 2: Grouping Filtered Students by Active Class
  const studentGroupsByClass = useMemo(() => {
    const map = new Map();

    filteredStudents.forEach((student) => {
      const cid = student.class_id || 'unassigned';
      if (!map.has(cid)) {
        map.set(cid, []);
      }
      map.get(cid).push(student);
    });

    const result = [];
    classList.forEach((cls) => {
      if (map.has(cls.id)) {
        const targetCls = classList.find((c) => c.id === cls.next_class_id) || null;
        result.push({
          classItem: cls,
          students: map.get(cls.id),
          targetClass: targetCls,
        });
      }
    });

    if (map.has('unassigned')) {
      result.push({
        classItem: { id: 'unassigned', name: 'Tanpa Kelas', level: '-' },
        students: map.get('unassigned'),
        targetClass: null,
      });
    }

    return result;
  }, [filteredStudents, classList]);

  return (
    <div className="promotion-container">
      {/* Header */}
      <div className="promotion-header">
        <div>
          <h1 className="promotion-title">Siklus Kenaikan Kelas &amp; Kelulusan</h1>
          <p className="promotion-subtitle">
            Konfigurasi pemetaan rombel tujuan, penetapan siswa tinggal kelas, dan eksekusi promosi massal akhir tahun ajaran.
          </p>
        </div>

        <div className="promotion-header-actions">
          <Button
            variant="secondary"
            onClick={handleRefresh}
            loading={isLoading}
            disabled={isLoading || isExecuting}
            title="Muat Ulang Data"
          >
            Refresh
          </Button>

          <Button
            variant="danger"
            onClick={() => setIsConfirmModalOpen(true)}
            disabled={isLoading || isExecuting || classList.length === 0}
          >
            Eksekusi Promosi Massal
          </Button>
        </div>
      </div>

      {/* Success Notification Result Card */}
      {promotionResult && (
        <div className="promotion-success-card accent-border-left--success">
          <div className="promotion-success-left">
            <span className="status-dot status-dot--success mt-1" />
            <div>
              <h4 className="font-semibold text-neutral-900 text-sm">
                Proses Promosi Massal Berhasil Dijalankan
              </h4>
              <p className="text-xs text-neutral-600">
                Data rombel siswa dan kelulusan telah diperbarui ke basis data tahun ajaran baru.
              </p>
            </div>
          </div>

          <div className="promotion-success-stats">
            <div className="promotion-stat-item">
              <span className="promotion-stat-label">Total Diproses</span>
              <span className="promotion-stat-val">{promotionResult.total_students}</span>
            </div>
            <div className="promotion-stat-item">
              <span className="promotion-stat-label text-success-700">Naik Kelas</span>
              <span className="promotion-stat-val text-success-700">{promotionResult.promoted}</span>
            </div>
            <div className="promotion-stat-item">
              <span className="promotion-stat-label text-danger-700">Tinggal Kelas</span>
              <span className="promotion-stat-val text-danger-700">{promotionResult.held_back}</span>
            </div>
            <div className="promotion-stat-item">
              <span className="promotion-stat-label text-gray-700">Lulus</span>
              <span className="promotion-stat-val text-gray-900">{promotionResult.graduated}</span>
            </div>
            {typeof promotionResult.deactivated_assignments === 'number' && (
              <div className="promotion-stat-item">
                <span className="promotion-stat-label text-blue-700">Penugasan Diarsipkan</span>
                <span className="promotion-stat-val text-blue-700">{promotionResult.deactivated_assignments}</span>
              </div>
            )}
          </div>
        </div>
      )}

      {/* SECTION 1: Pemetaan Rombel Kelas Tujuan (Dikelompokkan per Angkatan) */}
      <section className="promotion-section">
        <div className="promotion-section-header">
          <div>
            <h2 className="promotion-section-title">Pemetaan Rombel Kelas Tujuan</h2>
            <p className="promotion-section-desc">
              Tentukan kelas tujuan untuk setiap rombel saat promosi massal dijalankan. Kelas tingkat 12 otomatis diarahkan ke status kelulusan.
            </p>
          </div>
        </div>

        {isLoading ? (
          <div className="promotion-table-loading">
            <SkeletonRow count={4} />
          </div>
        ) : fetchError ? (
          <ErrorState
            title="Gagal Memuat Data Kelas"
            message={fetchError}
            onRetry={handleRefresh}
          />
        ) : classList.length === 0 ? (
          <EmptyState
            title="Tidak Ada Data Kelas"
            message="Belum ada data rombel kelas yang terdaftar."
          />
        ) : (
          <div className="promotion-cohort-list">
            {cohortGroups.map((cohort) => {
              if (cohort.classes.length === 0) return null;
              return (
                <div className="promotion-class-card" key={cohort.level}>
                  <div className="promotion-class-header">
                    <div className="promotion-class-title">
                      <span className="promotion-class-bar" />
                      <span className="promotion-class-name">
                        ANGKATAN KELAS {cohort.roman} (TINGKAT {cohort.level})
                      </span>
                      <span className="promotion-class-dot">•</span>
                      <span className="promotion-class-count">{cohort.classes.length} ROMBEL</span>
                    </div>

                    <div className="promotion-class-target">
                      {cohort.level === 12 ? (
                        <span className="promotion-target-badge promotion-target-badge--success">
                          Tingkat Akhir → Kelulusan
                        </span>
                      ) : (
                        <span className="promotion-target-badge">
                          Promosi ke Tingkat {cohort.level + 1}
                        </span>
                      )}
                    </div>
                  </div>

                  <div className="promotion-table-responsive">
                    <table className="promotion-custom-table">
                      <thead>
                        <tr>
                          <th style={{ width: '60px' }}>No</th>
                          <th style={{ width: '120px' }}>Tingkat</th>
                          <th>Rombel Asal</th>
                          <th>Rombel Tujuan (Tahun Baru)</th>
                          <th style={{ width: '160px', textAlign: 'right' }}>Aksi</th>
                        </tr>
                      </thead>
                      <tbody>
                        {cohort.classes.map((cls, idx) => {
                          const target = classList.find((c) => c.id === cls.next_class_id);
                          return (
                            <tr key={cls.id}>
                              <td className="promotion-cell-no">
                                {String(idx + 1).padStart(2, '0')}
                              </td>
                              <td>
                                <Badge variant="neutral">Kelas {cls.level}</Badge>
                              </td>
                              <td>
                                <strong className="font-mono text-sm text-neutral-900">
                                  {cls.name}
                                </strong>
                              </td>
                              <td>
                                {target ? (
                                  <div className="flex items-center gap-1.5 font-mono text-xs text-gray-800 font-semibold">
                                    <ArrowRight size={13} />
                                    <span>{target.name}</span>
                                  </div>
                                ) : cls.level === 12 ? (
                                  <Badge variant="success">Tingkat Akhir → Kelulusan</Badge>
                                ) : (
                                  <span className="text-xs text-neutral-400 italic">
                                    Belum Dipetakan
                                  </span>
                                )}
                              </td>
                              <td style={{ textAlign: 'right' }}>
                                <Button
                                  variant="secondary"
                                  size="sm"
                                  icon={Pencil}
                                  onClick={() => handleOpenEditMapping(cls)}
                                  disabled={isLoading || isExecuting}
                                >
                                  Ubah Pemetaan
                                </Button>
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>

                  <div className="promotion-class-footer">
                    Menampilkan 01–{String(cohort.classes.length).padStart(2, '0')} dari{' '}
                    {cohort.classes.length} rombel
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </section>

      {/* SECTION 2: Daftar Siswa untuk Kenaikan & Kelulusan (Dikelompokkan per Rombel) */}
      <section className="promotion-section">
        {/* Header Section dengan Judul & Kontrol Tanggal / Counter */}
        <div className="promotion-section-header">
          <div>
            <h2 className="promotion-section-title">Daftar Siswa untuk Kenaikan &amp; Kelulusan</h2>
            <p className="promotion-section-desc">
              Semua siswa otomatis ditandai naik kelas atau lulus, kecuali bila dicentang tinggal kelas.
            </p>
          </div>

          <div className="promotion-header-meta">
            <div className="promotion-date-picker-wrap">
              <label htmlFor="tglSklInput" className="promotion-date-label">
                Tgl SKL / Ijazah:
              </label>
              <div className="promotion-date-input-container">
                <input
                  id="tglSklInput"
                  type="date"
                  className="promotion-date-input"
                  value={graduationDate}
                  onChange={(e) => setGraduationDate(e.target.value)}
                  disabled={isLoading}
                />
              </div>
            </div>

            <div className="promotion-stats-badge">
              {totalFilteredCount.toLocaleString('id-ID')} siswa ditampilkan ({heldBackCount.toLocaleString('id-ID')} tinggal kelas)
            </div>
          </div>
        </div>

        {/* Toolbar Filter & Search Sesuai Desain Screenshot */}
        <div className="promotion-toolbar-row">
          {/* Search Box dengan Shortcut '/' */}
          <div className="promotion-search-box">
            <Search size={15} className="promotion-search-icon" />
            <input
              ref={searchInputRef}
              type="text"
              className="promotion-search-input"
              placeholder="Cari nama atau NIS siswa..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              disabled={isLoading}
            />
            <kbd className="promotion-search-shortcut">/</kbd>
          </div>

          <div className="promotion-filters-group">
            {/* Filter Jurusan */}
            <select
              className="promotion-filter-select"
              value={selectedJurusanFilter}
              onChange={(e) => setSelectedJurusanFilter(e.target.value)}
              disabled={isLoading}
            >
              <option value="ALL">Semua Jurusan</option>
              {availableMajors.map((m) => (
                <option key={m} value={m}>
                  Jurusan {m}
                </option>
              ))}
            </select>

            {/* Segmented Tabs Tingkat: Semua, Kelas X, Kelas XI, Kelas XII */}
            <div className="promotion-segmented-tabs">
              <button
                type="button"
                className={`promotion-tab-btn ${selectedLevelFilter === 'ALL' ? 'promotion-tab-btn--active' : ''}`}
                onClick={() => {
                  setSelectedLevelFilter('ALL');
                  setSelectedClassFilter('ALL');
                }}
                disabled={isLoading}
              >
                Semua
              </button>
              <button
                type="button"
                className={`promotion-tab-btn ${selectedLevelFilter === '10' ? 'promotion-tab-btn--active' : ''}`}
                onClick={() => {
                  setSelectedLevelFilter('10');
                  setSelectedClassFilter('ALL');
                }}
                disabled={isLoading}
              >
                Kelas X
              </button>
              <button
                type="button"
                className={`promotion-tab-btn ${selectedLevelFilter === '11' ? 'promotion-tab-btn--active' : ''}`}
                onClick={() => {
                  setSelectedLevelFilter('11');
                  setSelectedClassFilter('ALL');
                }}
                disabled={isLoading}
              >
                Kelas XI
              </button>
              <button
                type="button"
                className={`promotion-tab-btn ${selectedLevelFilter === '12' ? 'promotion-tab-btn--active' : ''}`}
                onClick={() => {
                  setSelectedLevelFilter('12');
                  setSelectedClassFilter('ALL');
                }}
                disabled={isLoading}
              >
                Kelas XII
              </button>
            </div>

            {/* Filter Rombel */}
            <select
              className="promotion-filter-select"
              value={selectedClassFilter}
              onChange={(e) => setSelectedClassFilter(e.target.value)}
              disabled={isLoading}
            >
              <option value="ALL">Semua Rombel</option>
              {selectableClasses.map((c) => (
                <option key={c.id} value={String(c.id)}>
                  {c.name}
                </option>
              ))}
            </select>

            {/* Filter Status */}
            <select
              className="promotion-filter-select"
              value={selectedStatusFilter}
              onChange={(e) => setSelectedStatusFilter(e.target.value)}
              disabled={isLoading}
            >
              <option value="ALL">Semua Status</option>
              <option value="READY">Siap Naik / Lulus</option>
              <option value="HELD_BACK">Tinggal Kelas</option>
            </select>
          </div>
        </div>

        {/* Daftar Siswa Berkelompok per Rombel */}
        {isLoading ? (
          <div className="promotion-table-loading">
            <SkeletonRow count={6} />
          </div>
        ) : fetchError ? (
          <ErrorState
            title="Gagal Memuat Data Siswa"
            message={fetchError}
            onRetry={handleRefresh}
          />
        ) : filteredStudents.length === 0 ? (
          <EmptyState
            title="Tidak Ada Data Siswa"
            message={
              searchQuery ||
              selectedLevelFilter !== 'ALL' ||
              selectedClassFilter !== 'ALL' ||
              selectedJurusanFilter !== 'ALL' ||
              selectedStatusFilter !== 'ALL'
                ? 'Tidak ditemukan data siswa yang sesuai dengan filter pencarian.'
                : 'Belum ada data siswa yang terdaftar di sistem.'
            }
          />
        ) : (
          <div className="promotion-groups-list">
            {studentGroupsByClass.map((group) => {
              const { classItem, students, targetClass } = group;
              const count = students.length;

              return (
                <div className="promotion-class-card" key={classItem.id}>
                  {/* Card Header dengan Bar Gelap & Badge Target */}
                  <div className="promotion-class-header">
                    <div className="promotion-class-title">
                      <span className="promotion-class-bar" />
                      <span className="promotion-class-name">KELAS {classItem.name}</span>
                      <span className="promotion-class-dot">•</span>
                      <span className="promotion-class-count">{count} SISWA</span>
                    </div>

                    <div className="promotion-class-target">
                      <span className="promotion-target-label">TARGET:</span>
                      <span className="promotion-target-badge">
                        {targetClass
                          ? `KELAS ${targetClass.name}`
                          : classItem.level === 12
                          ? 'LULUS DARI SEKOLAH'
                          : 'BELUM DIPETAKAN'}
                      </span>
                    </div>
                  </div>

                  {/* Tabel Siswa dalam Grup Rombel */}
                  <div className="promotion-table-responsive">
                    <table className="promotion-custom-table">
                      <thead>
                        <tr>
                          <th style={{ width: '50px' }}>No</th>
                          <th style={{ width: '130px' }}>NIS</th>
                          <th>Nama Siswa</th>
                          <th style={{ width: '110px' }}>Jurusan</th>
                          <th style={{ width: '180px' }}>Transisi Kelas</th>
                          <th style={{ width: '180px' }}>Status Kenaikan / Kelulusan</th>
                          <th style={{ width: '180px' }}>Penetapan</th>
                        </tr>
                      </thead>
                      <tbody>
                        {students.map((student, idx) => {
                          const jurusan = extractJurusan(classItem.name);
                          const isHeldBack = Boolean(student.is_held_back);
                          const isRowLoading = holdingBackStudentId === student.id;

                          // Transisi teks
                          let transitionText = '';
                          let statusLabel = '';
                          if (isHeldBack) {
                            transitionText = `${classItem.name} → ${classItem.name} (Tetap)`;
                            statusLabel = 'Tinggal Kelas';
                          } else if (classItem.level === 12) {
                            transitionText = `${classItem.name} → Lulus`;
                            statusLabel = 'Lulus';
                          } else if (targetClass) {
                            transitionText = `${classItem.name} → ${targetClass.name}`;
                            statusLabel = 'Naik Kelas';
                          } else {
                            transitionText = `${classItem.name} → ?`;
                            statusLabel = 'Naik Kelas';
                          }

                          return (
                            <tr key={student.id}>
                              <td className="promotion-cell-no">
                                {String(idx + 1).padStart(2, '0')}
                              </td>
                              <td>
                                <span className="promotion-nis-badge">
                                  {student.nis_nip || student.nis || '-'}
                                </span>
                              </td>
                              <td>
                                <strong className="promotion-student-name text-neutral-900">
                                  {student.name}
                                </strong>
                              </td>
                              <td>
                                <span className="promotion-jurusan-badge">{jurusan}</span>
                              </td>
                              <td>
                                <span
                                  className={`font-mono text-xs ${
                                    isHeldBack ? 'text-red-600 font-semibold' : 'text-neutral-800'
                                  }`}
                                >
                                  {transitionText}
                                </span>
                              </td>
                              <td>
                                <span
                                  className={`promotion-status-text ${
                                    isHeldBack
                                      ? 'text-red-600 font-semibold'
                                      : 'text-neutral-800 font-medium'
                                  }`}
                                >
                                  {statusLabel}
                                </span>
                              </td>
                              <td>
                                <label className="promotion-checkbox-label">
                                  <input
                                    type="checkbox"
                                    className="promotion-checkbox-input"
                                    checked={isHeldBack}
                                    onChange={() => handleToggleHoldBack(student)}
                                    disabled={isRowLoading || isExecuting}
                                  />
                                  <span className="promotion-checkbox-text">
                                    {isRowLoading ? 'Menyimpan...' : 'Tandai Tinggal Kelas'}
                                  </span>
                                </label>
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>

                  {/* Footer Keterangan Data */}
                  <div className="promotion-class-footer">
                    Menampilkan 01–{String(count).padStart(2, '0')} dari {count} data
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </section>

      {/* Edit Mapping Modal */}
      <Modal
        isOpen={editingClass !== null}
        onClose={() => setEditingClass(null)}
        title={`Ubah Pemetaan Kelas Tujuan: ${editingClass?.name}`}
        size="sm"
        footer={
          <div className="flex justify-end gap-2 w-full">
            <Button
              variant="secondary"
              onClick={() => setEditingClass(null)}
              disabled={isSavingMapping}
            >
              Batal
            </Button>
            <Button
              variant="primary"
              onClick={handleSaveMapping}
              loading={isSavingMapping}
            >
              Simpan Pemetaan
            </Button>
          </div>
        }
      >
        <div className="flex flex-col gap-3 py-1">
          <p className="text-xs text-neutral-600">
            Siswa yang berada di rombel <strong>{editingClass?.name}</strong> (Tingkat {editingClass?.level}) akan dipindahkan ke kelas tujuan berikut:
          </p>

          <Select
            label="Pilih Rombel Kelas Tujuan"
            value={selectedNextClassId}
            onChange={(e) => setSelectedNextClassId(e.target.value)}
            options={[
              { value: '', label: '-- Tingkat Akhir (Lulus dari Sekolah) --' },
              ...classList
                .filter((c) => c.id !== editingClass?.id)
                .map((c) => ({
                  value: String(c.id),
                  label: `${c.name} (Tingkat ${c.level})`,
                })),
            ]}
          />
        </div>
      </Modal>

      {/* Confirmation Dialog for Mass Promotion */}
      <ConfirmDialog
        isOpen={isConfirmModalOpen}
        onClose={() => setIsConfirmModalOpen(false)}
        onConfirm={handleExecutePromotion}
        title="Konfirmasi Promosi Kelas Massal"
        message="PERINGATAN: Tindakan ini akan memindahkan seluruh siswa ke kelas kenaikan tahun ajaran baru, meluluskan siswa tingkat 12, serta mengarsipkan (menonaktifkan) seluruh penugasan Wali Kelas dan Guru BK/Kesiswaan periode berjalan agar siap diisi penugasan tahun ajaran baru. Seluruh riwayat data periode sebelumnya tetap tersimpan utuh."
        confirmLabel="Ya, Eksekusi Promosi Massal"
        cancelLabel="Batal"
        confirmVariant="danger"
        loading={isExecuting}
      />

      {/* Fullscreen Loading Overlay saat Promosi Massal Sedang Diproses */}
      {isExecuting && (
        <LoadingOverlay
          fixed
          message="Sedang Mengeksekusi Kenaikan Kelas Massal..."
          subtext="Memindahkan rombel siswa, memproses kelulusan, dan mengarsipkan penugasan periode berjalan. Mohon tidak menutup halaman."
        />
      )}
    </div>
  );
}
