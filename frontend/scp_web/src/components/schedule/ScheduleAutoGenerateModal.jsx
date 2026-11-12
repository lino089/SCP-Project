import { useState, useEffect, useMemo, useCallback } from 'react';
import {
  Sparkles,
  CheckCircle2,
  AlertTriangle,
  RefreshCw,
  Trash2,
  ArrowRight,
  Loader2,
  Calendar,
  List,
  ChevronLeft,
  ChevronRight,
  ChevronDown,
  Search,
} from 'lucide-react';
import { Modal, Button, Badge, PasswordModal } from '../shared';
import ScheduleTimetableMatrix from './ScheduleTimetableMatrix';
import scheduleGenerationApi from '../../services/scheduleGenerationApi';
import { NUMBER_TO_DAY, resolveSlotTime, DAYS_LIST } from '../../utils/timetableHelper';
import './ScheduleAutoGenerateModal.css';

/**
 * Helper fleksibel untuk mengekstrak data dari response Axios
 * Menangani baik format response Axios murni maupun yang telah di-unwrap oleh interceptor
 */
const unwrapData = (res) => {
  if (!res) return null;
  if (res.data && res.data.data !== undefined) return res.data.data;
  if (res.data !== undefined) return res.data;
  return res;
};

export default function ScheduleAutoGenerateModal({
  isOpen,
  onClose,
  onSuccess,
  showToast,
  showErrorToast,
}) {
  // Navigation Steps: 'CONFIG' | 'GENERATING' | 'PREVIEW'
  const [step, setStep] = useState('CONFIG');

  // Master Data & Configuration state
  const [config, setConfig] = useState(null);
  const [isConfigLoading, setIsConfigLoading] = useState(false);
  const [configError, setConfigError] = useState(null);

  // Form Parameters
  const [selectedCycles, setSelectedCycles] = useState([1, 2]); // [1], [2], or [1, 2]

  // Generating & Progress state
  const [generatingProgress, setGeneratingProgress] = useState(15);
  const [generatingMessage, setGeneratingMessage] = useState(
    'Mempersiapkan parameter & alokasi beban kurikulum...'
  );

  // Batch Result & Drafts state
  const [batchData, setBatchData] = useState(null);
  const [drafts, setDrafts] = useState([]);
  const [isDraftsLoading, setIsDraftsLoading] = useState(false);

  // Preview Navigation & Filter state
  const [previewCycle, setPreviewCycle] = useState(1);
  const [selectedClassId, setSelectedClassId] = useState('');
  const [levelFilter, setLevelFilter] = useState('all'); // 'all' | 10 | 11 | 12
  const [previewViewMode, setPreviewViewMode] = useState('matrix'); // 'matrix' | 'table'
  const [tableSearchTerm, setTableSearchTerm] = useState('');
  const [tableOnlyConflicts, setTableOnlyConflicts] = useState(false);
  const [selectedSlotDetail, setSelectedSlotDetail] = useState(null);

  // Smart Confirmation Dialog states (Keputusan 3)
  const [isCheckingState, setIsCheckingState] = useState(false);
  const [overwriteInfo, setOverwriteInfo] = useState(null);
  const [isOverwriteModalOpen, setIsOverwriteModalOpen] = useState(false);
  const [isPasswordModalOpen, setIsPasswordModalOpen] = useState(false);
  const [passwordModalLoading, setPasswordModalLoading] = useState(false);
  const [passwordModalError, setPasswordModalError] = useState('');

  // 1. Muat konfigurasi kesiapan data saat modal dibuka
  const loadConfig = useCallback(async () => {
    setIsConfigLoading(true);
    setConfigError(null);
    try {
      const res = await scheduleGenerationApi.getConfig();
      const payload = unwrapData(res);
      if (payload && (payload.master_counts || payload.is_ready !== undefined)) {
        setConfig(payload);
      } else {
        setConfigError('Format data kesiapan jadwal tidak sesuai.');
      }
    } catch (err) {
      setConfigError(
        err?.response?.data?.message || err?.message || 'Gagal memuat konfigurasi generate jadwal.'
      );
    } finally {
      setIsConfigLoading(false);
    }
  }, []);

  useEffect(() => {
    if (isOpen) {
      setStep('CONFIG');
      setBatchData(null);
      setDrafts([]);
      setSelectedClassId('');
      setLevelFilter('all');
      setPreviewViewMode('matrix');
      setTableSearchTerm('');
      setTableOnlyConflicts(false);
      setSelectedSlotDetail(null);
      setOverwriteInfo(null);
      setIsOverwriteModalOpen(false);
      setIsPasswordModalOpen(false);
      loadConfig();
    }
  }, [isOpen, loadConfig]);

  // Handle cycle selection
  const handleCycleSelect = (cycleChoice) => {
    if (cycleChoice === 'both') {
      setSelectedCycles([1, 2]);
    } else {
      setSelectedCycles([cycleChoice]);
    }
  };

  // 2. Jalankan Generator Otomatis
  const handleStartGenerate = async () => {
    setStep('GENERATING');
    setGeneratingProgress(20);
    setGeneratingMessage('Mengelompokkan kelas paralel & membagi siklus rolling...');

    const timer1 = setTimeout(() => {
      setGeneratingProgress(50);
      setGeneratingMessage('Mengalokasikan mata pelajaran kejuruan ke laboratorium...');
    }, 400);

    const timer2 = setTimeout(() => {
      setGeneratingProgress(80);
      setGeneratingMessage('Mengalokasikan mata pelajaran normada ke ruang teori kelas...');
    }, 800);

    try {
      const res = await scheduleGenerationApi.runGeneration(selectedCycles);
      clearTimeout(timer1);
      clearTimeout(timer2);
      setGeneratingProgress(100);
      setGeneratingMessage('Menyelesaikan validasi jadwal bebas bentrok...');

      const payload = unwrapData(res);
      if (payload && payload.batch_uuid) {
        setBatchData(payload);
        setPreviewCycle(selectedCycles[0]);
        setPreviewViewMode('matrix');
        // Ambil draft hasil generate
        await loadDrafts(payload.batch_uuid);
        setTimeout(() => setStep('PREVIEW'), 300);
      } else {
        throw new Error(res?.message || 'Gagal memproses hasil generate jadwal.');
      }
    } catch (err) {
      clearTimeout(timer1);
      clearTimeout(timer2);
      setStep('CONFIG');
      showErrorToast?.(
        err?.response?.data?.message || err?.message || 'Terjadi kesalahan saat melakukan generate jadwal.'
      );
    }
  };

  // Muat Drafts Jadwal
  const loadDrafts = async (batchUuid) => {
    setIsDraftsLoading(true);
    try {
      const res = await scheduleGenerationApi.getDrafts(batchUuid);
      const payload = unwrapData(res);
      if (Array.isArray(payload)) {
        setDrafts(payload);
      } else if (Array.isArray(payload?.data)) {
        setDrafts(payload.data);
      }
    } catch (err) {
      showErrorToast?.('Gagal memuat draft jadwal pelajaran.');
    } finally {
      setIsDraftsLoading(false);
    }
  };

  // Ekstraksi seluruh kelas unik yang terdapat di dalam draft
  const availableClasses = useMemo(() => {
    const map = new Map();
    drafts.forEach((d) => {
      if (d.school_class && d.class_id) {
        if (!map.has(d.class_id)) {
          map.set(d.class_id, {
            id: d.class_id,
            name: d.school_class.name,
            level: d.school_class.level,
          });
        }
      }
    });
    return Array.from(map.values()).sort((a, b) => {
      if (a.level !== b.level) return a.level - b.level;
      return a.name.localeCompare(b.name, undefined, { numeric: true });
    });
  }, [drafts]);

  // Filter kelas berdasarkan pilihan tingkat
  const filteredClasses = useMemo(() => {
    if (levelFilter === 'all') return availableClasses;
    return availableClasses.filter((c) => Number(c.level) === Number(levelFilter));
  }, [availableClasses, levelFilter]);

  // Sinkronisasi selectedClassId agar selalu valid saat draft atau filter berubah
  useEffect(() => {
    if (filteredClasses.length > 0) {
      const exists = filteredClasses.some((c) => String(c.id) === String(selectedClassId));
      if (!exists) {
        setSelectedClassId(filteredClasses[0].id);
      }
    } else {
      setSelectedClassId('');
    }
  }, [filteredClasses, selectedClassId]);

  // Index kelas aktif untuk navigasi Sebelumnya / Selanjutnya
  const currentClassIndex = useMemo(() => {
    return filteredClasses.findIndex((c) => String(c.id) === String(selectedClassId));
  }, [filteredClasses, selectedClassId]);

  const currentClass = useMemo(() => {
    if (currentClassIndex >= 0) return filteredClasses[currentClassIndex];
    return filteredClasses[0] || null;
  }, [filteredClasses, currentClassIndex]);

  const handlePrevClass = () => {
    if (currentClassIndex > 0) {
      setSelectedClassId(filteredClasses[currentClassIndex - 1].id);
    }
  };

  const handleNextClass = () => {
    if (currentClassIndex < filteredClasses.length - 1) {
      setSelectedClassId(filteredClasses[currentClassIndex + 1].id);
    }
  };

  // Draft jadwal untuk rombel kelas yang sedang aktif dilihat
  const currentClassDrafts = useMemo(() => {
    if (!currentClass?.id) return [];
    return drafts.filter(
      (d) =>
        Number(d.cycle_type) === Number(previewCycle) &&
        String(d.class_id) === String(currentClass.id)
    );
  }, [drafts, previewCycle, currentClass]);

  // Set ID slot bentrok untuk penandaan badge merah
  const conflictIds = useMemo(() => {
    return new Set(drafts.filter((d) => d.has_conflict).map((d) => d.id));
  }, [drafts]);

  // Statistik statistik kelas terpilih
  const currentClassStats = useMemo(() => {
    const totalJP = currentClassDrafts.reduce(
      (sum, d) => sum + (Number(d.duration_periods) || 1),
      0
    );
    const uniqueSubjects = new Set(currentClassDrafts.map((d) => d.subject_id)).size;
    const uniqueTeachers = new Set(currentClassDrafts.map((d) => d.teacher_id)).size;
    const hasConflict = currentClassDrafts.some((d) => d.has_conflict);

    return { totalJP, uniqueSubjects, uniqueTeachers, hasConflict };
  }, [currentClassDrafts]);

  // Filtered Drafts untuk tampilan alternatif tabel baris
  const tableFilteredDrafts = useMemo(() => {
    return drafts.filter((d) => {
      if (Number(d.cycle_type) !== Number(previewCycle)) return false;
      if (levelFilter !== 'all' && Number(d.school_class?.level) !== Number(levelFilter)) return false;
      if (selectedClassId && selectedClassId !== 'all') {
        if (String(d.class_id) !== String(selectedClassId)) return false;
      }
      if (tableOnlyConflicts && !d.has_conflict) return false;
      if (tableSearchTerm.trim()) {
        const q = tableSearchTerm.toLowerCase();
        const sName = (d.subject?.name || '').toLowerCase();
        const tName = (d.teacher?.name || '').toLowerCase();
        const rName = (d.room?.name || '').toLowerCase();
        const cName = (d.school_class?.name || '').toLowerCase();
        if (!sName.includes(q) && !tName.includes(q) && !rName.includes(q) && !cName.includes(q)) {
          return false;
        }
      }
      return true;
    });
  }, [drafts, previewCycle, levelFilter, selectedClassId, tableOnlyConflicts, tableSearchTerm]);

  // 3. Tombol Terapkan Jadwal (Cek Kondisi Kosong vs Terisi - Keputusan 3)
  const handleApplyClick = async () => {
    setIsCheckingState(true);
    try {
      const res = await scheduleGenerationApi.checkTargetState(selectedCycles);
      const stateData = unwrapData(res);
      if (stateData) {
        setOverwriteInfo(stateData);
        if (stateData.has_existing_schedules) {
          // Kondisi 2: Jadwal sudah terisi -> Buka Modal Peringatan Penimpaan
          setIsOverwriteModalOpen(true);
        } else {
          // Kondisi 1: Jadwal masih kosong -> Langsung buka Password Modal
          setIsPasswordModalOpen(true);
        }
      }
    } catch (err) {
      showErrorToast?.('Gagal memeriksa status jadwal aktif saat ini.');
    } finally {
      setIsCheckingState(false);
    }
  };

  // Dari Modal Peringatan Penimpaan Lanjut ke Password Modal
  const handleConfirmOverwrite = () => {
    setIsOverwriteModalOpen(false);
    setIsPasswordModalOpen(true);
  };

  // Eksekusi Apply dengan Password Step-Up
  const handleApplyWithPassword = async (password) => {
    setPasswordModalLoading(true);
    setPasswordModalError('');
    try {
      const res = await scheduleGenerationApi.applyBatch(batchData.batch_uuid, password);
      if (res?.success || res?.data?.success) {
        setIsPasswordModalOpen(false);
        onClose?.();
        showToast?.(
          res?.message ||
          res?.data?.message ||
          'Jadwal pelajaran hasil generate otomatis berhasil diterapkan ke KBM aktif!'
        );
        onSuccess?.();
      }
    } catch (err) {
      const passwordError = err?.response?.data?.errors?.password?.[0];
      const serverMessage = err?.response?.data?.message;
      let msg = 'Terjadi kesalahan saat menerapkan jadwal ke sistem.';

      if (err?.response?.status === 422 && passwordError) {
        msg = passwordError;
      } else if (serverMessage) {
        msg = serverMessage;
      } else if (err?.message) {
        msg = err.message;
      }
      setPasswordModalError(msg);
    } finally {
      setPasswordModalLoading(false);
    }
  };

  // Batalkan & Buang Draft
  const handleDiscard = async () => {
    if (batchData?.batch_uuid) {
      try {
        await scheduleGenerationApi.discardBatch(batchData.batch_uuid);
      } catch (e) {
        // Ignore error on discard
      }
    }
    setStep('CONFIG');
    setBatchData(null);
    setDrafts([]);
  };

  // Jangan render apa pun jika modal ditutup (Zero Memory & CPU footprint saat modal tertutup)
  if (!isOpen) return null;

  // Render Langkah 1: CONFIG
  const renderConfigStep = () => {
    if (isConfigLoading) {
      return (
        <div className="py-12 flex flex-col items-center justify-center gap-3">
          <Loader2 size={32} className="text-indigo-600 animate-spin" />
          <div className="text-center">
            <span className="text-sm font-semibold text-gray-800 block">
              Memeriksa Kesiapan Master Data...
            </span>
            <span className="text-xs text-gray-500">
              Menganalisis rombel kelas, guru, ruangan, mapel, dan alokasi beban kurikulum
            </span>
          </div>
        </div>
      );
    }

    if (configError) {
      return (
        <div className="py-8 flex flex-col items-center justify-center gap-3 text-center">
          <AlertTriangle size={36} className="text-amber-500" />
          <div>
            <span className="text-sm font-semibold text-gray-800 block">{configError}</span>
            <span className="text-xs text-gray-500">
              Pastikan koneksi backend aktif dan database terhubung dengan baik.
            </span>
          </div>
          <Button variant="secondary" size="sm" icon={RefreshCw} onClick={loadConfig}>
            Coba Muat Ulang
          </Button>
        </div>
      );
    }

    const isReady = config?.is_ready;
    const counts = config?.master_counts || {};

    return (
      <div className="space-y-4">
        {/* Readiness Info Card */}
        <div className="bg-slate-50 border border-slate-200 rounded-lg p-4">
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-2">
              <Sparkles size={18} className="text-indigo-600" />
              <span className="font-semibold text-sm text-slate-800">
                Kesiapan Master Data Institusi
              </span>
            </div>
            {isReady ? (
              <Badge variant="success" className="gap-1">
                <CheckCircle2 size={12} /> Master Data Siap
              </Badge>
            ) : (
              <Badge variant="warning" className="gap-1">
                <AlertTriangle size={12} /> Belum Lengkap
              </Badge>
            )}
          </div>

          <div className="auto-gen-readiness-grid">
            <div className="auto-gen-readiness-card">
              <span className="auto-gen-readiness-label">Rombel Kelas</span>
              <span className="auto-gen-readiness-val">{counts.classes ?? 0}</span>
            </div>
            <div className="auto-gen-readiness-card">
              <span className="auto-gen-readiness-label">Guru Pengampu</span>
              <span className="auto-gen-readiness-val">{counts.teachers ?? 0}</span>
            </div>
            <div className="auto-gen-readiness-card">
              <span className="auto-gen-readiness-label">Ruangan Belajar</span>
              <span className="auto-gen-readiness-val">{counts.rooms ?? 0}</span>
            </div>
            <div className="auto-gen-readiness-card">
              <span className="auto-gen-readiness-label">Mata Pelajaran</span>
              <span className="auto-gen-readiness-val">{counts.subjects ?? 0}</span>
            </div>
            <div className="auto-gen-readiness-card">
              <span className="auto-gen-readiness-label">Alokasi Beban</span>
              <span className="auto-gen-readiness-val">{counts.curriculum_assignments ?? 0}</span>
            </div>
          </div>
        </div>

        {/* Target Cycle Selection */}
        <div>
          <label className="block text-xs font-semibold text-gray-700 uppercase tracking-wider mb-1.5">
            Pilih Putaran yang Ingin Digenerate
          </label>
          <div className="auto-gen-cycle-selector">
            <button
              type="button"
              className={`auto-gen-cycle-btn ${
                selectedCycles.length === 2 ? 'auto-gen-cycle-btn--active' : ''
              }`}
              onClick={() => handleCycleSelect('both')}
            >
              <span className="auto-gen-cycle-btn-title">Putaran 1 & 2 Sekaligus</span>
              <span className="auto-gen-cycle-btn-desc">
                Generate pola rolling TeFa bergantian secara lengkap untuk seluruh semester
              </span>
            </button>
            <button
              type="button"
              className={`auto-gen-cycle-btn ${
                selectedCycles.length === 1 && selectedCycles[0] === 1
                  ? 'auto-gen-cycle-btn--active'
                  : ''
              }`}
              onClick={() => handleCycleSelect(1)}
            >
              <span className="auto-gen-cycle-btn-title">Putaran 1 Saja</span>
              <span className="auto-gen-cycle-btn-desc">
                Khusus jadwal blok minggu ganjil / awal putaran
              </span>
            </button>
            <button
              type="button"
              className={`auto-gen-cycle-btn ${
                selectedCycles.length === 1 && selectedCycles[0] === 2
                  ? 'auto-gen-cycle-btn--active'
                  : ''
              }`}
              onClick={() => handleCycleSelect(2)}
            >
              <span className="auto-gen-cycle-btn-title">Putaran 2 Saja</span>
              <span className="auto-gen-cycle-btn-desc">
                Khusus jadwal blok minggu genap / pertukaran rolling
              </span>
            </button>
          </div>
        </div>

        {/* Rolling Pairs Preview */}
        {config?.rolling_pairs?.length > 0 && (
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label className="text-xs font-semibold text-gray-700 uppercase tracking-wider">
                Deteksi Rombel Paralel (Rolling TeFa)
              </label>
              <span className="text-xs text-gray-500">
                {config.rolling_pairs.filter((p) => p.is_paired).length} Jurusan Paralel Terdeteksi
              </span>
            </div>
            <div className="auto-gen-pairs-box">
              {config.rolling_pairs.map((pair, idx) => (
                <div key={idx} className="auto-gen-pair-badge">
                  <span className="font-semibold text-indigo-700">{pair.group_name}:</span>
                  <span>{pair.classes.map((c) => c.name).join(' ⟷ ')}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Bottom Actions */}
        <div className="flex justify-end gap-2 pt-3 border-t border-gray-100">
          <Button variant="outline" onClick={onClose}>
            Batal
          </Button>
          <Button
            variant="primary"
            icon={Sparkles}
            disabled={!isReady || isConfigLoading}
            onClick={handleStartGenerate}
          >
            Mulai Generate Jadwal
          </Button>
        </div>
      </div>
    );
  };

  // Render Langkah 2: GENERATING
  const renderGeneratingStep = () => (
    <div className="auto-gen-loading-container">
      <div className="auto-gen-spinner" />
      <div className="space-y-1">
        <h3 className="auto-gen-loading-title">Sedang Menyusun Jadwal Otomatis</h3>
        <p className="auto-gen-loading-sub">{generatingMessage}</p>
      </div>
      <div className="w-full max-w-md bg-gray-200 rounded-full h-2 overflow-hidden mt-2">
        <div
          className="bg-indigo-600 h-2 rounded-full transition-all duration-300"
          style={{ width: `${generatingProgress}%` }}
        />
      </div>
      <span className="text-xs font-semibold text-indigo-700">{generatingProgress}%</span>
    </div>
  );

  // Render Langkah 3: PREVIEW (Redesain Matriks Mingguan per Rombel Kelas)
  const renderPreviewStep = () => {
    const hasConflicts = (batchData?.conflict_slots_count ?? 0) > 0;

    return (
      <div className="space-y-3.5">
        {/* Summary Statistics Bar */}
        <div className="auto-gen-summary-bar">
          <div className="flex items-center gap-4 flex-wrap">
            <div className="auto-gen-summary-stat">
              <span>Total Slot:</span>
              <strong>{batchData?.total_slots_generated ?? drafts.length} Slot</strong>
            </div>
            <div className="auto-gen-summary-stat">
              <span>Rombel Kelas:</span>
              <strong>{availableClasses.length} Kelas</strong>
            </div>
            <div className="auto-gen-summary-stat">
              <span>Waktu Komputasi:</span>
              <strong>{batchData?.execution_time_seconds ?? 0}s</strong>
            </div>
          </div>
          <div>
            {hasConflicts ? (
              <Badge variant="warning" className="gap-1.5 text-xs font-semibold py-1 px-2.5">
                <AlertTriangle size={13} /> {batchData.conflict_slots_count} Bentrok Terdeteksi
              </Badge>
            ) : (
              <Badge variant="success" className="gap-1.5 text-xs font-semibold py-1 px-2.5">
                <CheckCircle2 size={13} /> 0 Bentrok (Bebas Konflik - Siap Diterapkan)
              </Badge>
            )}
          </div>
        </div>

        {/* Navigation & Controls Toolbar */}
        <div className="auto-gen-nav-toolbar">
          {/* Sisi Kiri: Switcher Putaran & Filter Tingkat */}
          <div className="auto-gen-nav-left">
            {selectedCycles.length > 1 && (
              <div className="auto-gen-cycle-toggle-group">
                <button
                  type="button"
                  className={`auto-gen-cycle-toggle-btn ${previewCycle === 1 ? 'active' : ''}`}
                  onClick={() => setPreviewCycle(1)}
                >
                  Putaran 1
                </button>
                <button
                  type="button"
                  className={`auto-gen-cycle-toggle-btn ${previewCycle === 2 ? 'active' : ''}`}
                  onClick={() => setPreviewCycle(2)}
                >
                  Putaran 2
                </button>
              </div>
            )}

            <div className="auto-gen-filter-group">
              <span className="auto-gen-filter-label">Tingkat:</span>
              <div className="auto-gen-level-pills">
                {['all', 10, 11, 12].map((lvl) => (
                  <button
                    key={lvl}
                    type="button"
                    className={`auto-gen-level-pill ${levelFilter === lvl ? 'active' : ''}`}
                    onClick={() => setLevelFilter(lvl)}
                  >
                    {lvl === 'all' ? 'Semua' : `Kls ${lvl}`}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* Sisi Tengah: Selector Rombel & Navigasi Prev/Next */}
          <div className="auto-gen-nav-center">
            <button
              type="button"
              className="auto-gen-nav-btn"
              disabled={currentClassIndex <= 0}
              onClick={handlePrevClass}
              title="Lihat jadwal kelas sebelumnya"
            >
              <ChevronLeft size={15} />
              <span className="hidden sm:inline">Sebelumnya</span>
            </button>

            <div className="auto-gen-class-select-wrapper">
              <select
                className="auto-gen-class-select"
                value={selectedClassId}
                onChange={(e) => setSelectedClassId(e.target.value)}
              >
                {filteredClasses.map((cls) => (
                  <option key={cls.id} value={cls.id}>
                    Kelas {cls.name} (Tingkat {cls.level})
                  </option>
                ))}
              </select>
              <span className="auto-gen-class-index-badge">
                {filteredClasses.length > 0 ? `${currentClassIndex + 1} / ${filteredClasses.length}` : '0/0'}
              </span>
              <ChevronDown size={14} className="auto-gen-select-arrow" />
            </div>

            <button
              type="button"
              className="auto-gen-nav-btn"
              disabled={currentClassIndex >= filteredClasses.length - 1}
              onClick={handleNextClass}
              title="Lihat jadwal kelas selanjutnya"
            >
              <span className="hidden sm:inline">Selanjutnya</span>
              <ChevronRight size={15} />
            </button>
          </div>

          {/* Sisi Kanan: Switcher Mode Tampilan (Matriks vs Daftar Slot) */}
          <div className="auto-gen-nav-right">
            <div className="auto-gen-view-toggle">
              <button
                type="button"
                className={`auto-gen-view-btn ${previewViewMode === 'matrix' ? 'active' : ''}`}
                onClick={() => setPreviewViewMode('matrix')}
                title="Tampilan Matriks Jadwal Mingguan"
              >
                <Calendar size={13} />
                <span>Matriks</span>
              </button>
              <button
                type="button"
                className={`auto-gen-view-btn ${previewViewMode === 'table' ? 'active' : ''}`}
                onClick={() => setPreviewViewMode('table')}
                title="Tampilan Daftar Slot (Tabel)"
              >
                <List size={13} />
                <span>Daftar</span>
              </button>
            </div>
          </div>
        </div>

        {/* Konten Utama Preview */}
        {isDraftsLoading ? (
          <div className="py-16 flex flex-col items-center justify-center gap-3">
            <Loader2 size={32} className="text-indigo-600 animate-spin" />
            <span className="text-xs text-gray-500 font-medium">Memuat pratinjau matriks jadwal...</span>
          </div>
        ) : previewViewMode === 'matrix' ? (
          /* Tampilan Matriks Mingguan per Rombel Kelas (Sesuai Referensi Gambar 2) */
          currentClass ? (
            <div className="auto-gen-class-card">
              {/* Header Identitas Rombel Kelas (Identik Halaman Jadwal) */}
              <div className="auto-gen-class-header">
                <div className="auto-gen-class-title-group">
                  <div className="auto-gen-class-title-row">
                    <h2 className="auto-gen-class-title">Kelas {currentClass.name}</h2>
                    <Badge variant="outline">Tingkat {currentClass.level}</Badge>
                    {currentClassStats.hasConflict ? (
                      <Badge variant="error" className="text-[10px]">
                        Bentrok Terdeteksi
                      </Badge>
                    ) : (
                      <Badge variant="success" className="text-[10px]">
                        Valid Bebas Bentrok
                      </Badge>
                    )}
                  </div>
                  <span className="auto-gen-class-subtitle">
                    SMK NEGERI 1 BANTUL &bull; Putaran {previewCycle} (Hasil Generate Otomatis)
                  </span>
                </div>

                <div className="auto-gen-class-actions">
                  <span className="auto-gen-class-stat-badge">
                    <strong>{currentClassStats.totalJP}</strong> JP / Minggu
                  </span>
                  <span className="auto-gen-class-stat-badge">
                    <strong>{currentClassStats.uniqueSubjects}</strong> Mapel
                  </span>
                  <span className="auto-gen-class-stat-badge">
                    <strong>{currentClassStats.uniqueTeachers}</strong> Guru
                  </span>
                </div>
              </div>

              {/* Matriks Timetable Universal */}
              <div className="auto-gen-matrix-scroll-wrapper">
                <ScheduleTimetableMatrix
                  schedules={currentClassDrafts}
                  matrixDays={DAYS_LIST}
                  mondayIsUpacara={true}
                  periodTemplates={config?.period_templates || []}
                  conflictIds={conflictIds}
                  role="waka"
                  onCardClick={(item) => setSelectedSlotDetail(item)}
                  emptySlotAction={null}
                  emptySlotDisabled={true}
                />
              </div>
            </div>
          ) : (
            <div className="p-8 text-center text-gray-500 text-xs border border-gray-200 rounded-lg bg-gray-50">
              Tidak ada data rombel kelas untuk filter tingkat ini.
            </div>
          )
        ) : (
          /* Tampilan Alternatif: Daftar Slot (Tabel Flat) */
          <div className="space-y-2">
            <div className="flex flex-wrap items-center justify-between gap-2 bg-gray-50 p-2 rounded border border-gray-200">
              <div className="flex items-center gap-2 flex-1 max-w-xs">
                <div className="relative w-full">
                  <Search size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-400" />
                  <input
                    type="text"
                    placeholder="Cari mapel, guru, kelas, ruang..."
                    className="w-full text-xs pl-8 pr-3 py-1.5 bg-white border border-gray-300 rounded focus:outline-none focus:ring-1 focus:ring-indigo-500"
                    value={tableSearchTerm}
                    onChange={(e) => setTableSearchTerm(e.target.value)}
                  />
                </div>
              </div>
              <label className="flex items-center gap-1.5 text-xs text-gray-700 cursor-pointer">
                <input
                  type="checkbox"
                  className="rounded border-gray-300 text-indigo-600 focus:ring-indigo-500"
                  checked={tableOnlyConflicts}
                  onChange={(e) => setTableOnlyConflicts(e.target.checked)}
                />
                <span>Hanya slot bentrok</span>
              </label>
            </div>

            <div className="auto-gen-preview-matrix">
              <table className="auto-gen-table">
                <thead>
                  <tr>
                    <th style={{ width: '85px' }}>Hari</th>
                    <th style={{ width: '120px' }}>Jam & Waktu</th>
                    <th style={{ width: '110px' }}>Kelas</th>
                    <th>Mata Pelajaran</th>
                    <th>Guru Pengampu</th>
                    <th style={{ width: '90px' }}>Ruangan</th>
                    <th style={{ width: '85px' }}>Kategori</th>
                    <th style={{ width: '110px' }}>Status</th>
                  </tr>
                </thead>
                <tbody>
                  {tableFilteredDrafts.length === 0 ? (
                    <tr>
                      <td colSpan={8} className="text-center py-6 text-gray-500 text-xs">
                        Tidak ada slot jadwal yang sesuai dengan filter preview ini.
                      </td>
                    </tr>
                  ) : (
                    tableFilteredDrafts.slice(0, 150).map((d) => {
                      const slotTime = resolveSlotTime(
                        NUMBER_TO_DAY[d.day_of_week] || 'Senin',
                        d.period_number,
                        d.duration_periods,
                        true,
                        config?.period_templates || []
                      );

                      return (
                        <tr
                          key={d.id}
                          className={`${d.has_conflict ? 'bg-amber-50/70' : ''} cursor-pointer hover:bg-slate-50`}
                          onClick={() => setSelectedSlotDetail(d)}
                        >
                          <td className="font-medium text-gray-900">
                            {NUMBER_TO_DAY[d.day_of_week] || `Hari ${d.day_of_week}`}
                          </td>
                          <td>
                            <span className="font-semibold text-slate-800 block">
                              Jam {d.period_number}
                              {d.duration_periods > 1 && `-${d.period_number + d.duration_periods - 1}`}
                              <span className="text-[10px] text-gray-500 ml-1 font-normal">
                                ({d.duration_periods} JP)
                              </span>
                            </span>
                            <span className="text-[10px] text-gray-500 font-mono block">
                              {slotTime.startTime} - {slotTime.endTime}
                            </span>
                          </td>
                          <td className="font-semibold text-slate-800">
                            {d.school_class?.name || `Kelas #${d.class_id}`}
                          </td>
                          <td>
                            <span className="font-medium text-gray-900">{d.subject?.name}</span>
                          </td>
                          <td className="text-gray-700">{d.teacher?.name}</td>
                          <td>
                            <Badge variant="outline" className="text-[11px]">
                              {d.room?.name}
                            </Badge>
                          </td>
                          <td>
                            <Badge
                              variant={d.category === 'jurusan' ? 'primary' : 'neutral'}
                              className="text-[10px]"
                            >
                              {d.category === 'jurusan' ? 'Jurusan' : 'Normada'}
                            </Badge>
                          </td>
                          <td>
                            {d.has_conflict ? (
                              <span
                                className="inline-flex items-center gap-1 text-[11px] text-amber-700 font-medium"
                                title={d.conflict_note || 'Bentrok terdeteksi'}
                              >
                                <AlertTriangle size={12} className="text-amber-600 flex-shrink-0" />
                                <span>Bentrok</span>
                              </span>
                            ) : (
                              <span className="inline-flex items-center gap-1 text-[11px] text-emerald-700 font-medium">
                                <CheckCircle2 size={12} className="text-emerald-600 flex-shrink-0" />
                                <span>Valid</span>
                              </span>
                            )}
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
              {tableFilteredDrafts.length > 150 && (
                <div className="p-2 text-center text-xs text-gray-500 bg-gray-50 border-t border-gray-200">
                  Menampilkan 150 dari total {tableFilteredDrafts.length} slot draft.
                </div>
              )}
            </div>
          </div>
        )}

        {/* Action Buttons Footer */}
        <div className="flex items-center justify-between pt-3 border-t border-gray-200">
          <Button
            variant="outline"
            icon={Trash2}
            className="text-red-600 border-red-200 hover:bg-red-50"
            onClick={handleDiscard}
          >
            Batalkan & Hapus Draft
          </Button>

          <div className="flex gap-2">
            <Button variant="secondary" onClick={() => setStep('CONFIG')}>
              Kembali ke Pengaturan
            </Button>
            <Button
              variant="primary"
              icon={CheckCircle2}
              loading={isCheckingState}
              disabled={hasConflicts}
              title={
                hasConflicts
                  ? 'Tidak dapat menerapkan jadwal karena masih terdapat slot yang bentrok.'
                  : 'Terapkan seluruh draft jadwal ke KBM aktif'
              }
              onClick={handleApplyClick}
            >
              Terapkan Jadwal ke Sistem
            </Button>
          </div>
        </div>
      </div>
    );
  };

  return (
    <>
      <Modal
        isOpen={isOpen}
        onClose={onClose}
        title="Generate Jadwal Pelajaran Otomatis"
        size={step === 'PREVIEW' ? 'full' : 'xl'}
      >
        <div className="auto-gen-modal">
          {/* Steps Indicator */}
          <div className="auto-gen-steps-header">
            <div className="auto-gen-steps">
              <div
                className={`auto-gen-step-item ${
                  step === 'CONFIG'
                    ? 'auto-gen-step-item--active'
                    : 'auto-gen-step-item--completed'
                }`}
              >
                <div className="auto-gen-step-circle">1</div>
                <span>Parameter & Beban</span>
              </div>
              <ArrowRight size={14} className="text-gray-300" />
              <div
                className={`auto-gen-step-item ${
                  step === 'GENERATING'
                    ? 'auto-gen-step-item--active'
                    : step === 'PREVIEW'
                    ? 'auto-gen-step-item--completed'
                    : ''
                }`}
              >
                <div className="auto-gen-step-circle">2</div>
                <span>Proses Generate</span>
              </div>
              <ArrowRight size={14} className="text-gray-300" />
              <div
                className={`auto-gen-step-item ${
                  step === 'PREVIEW' ? 'auto-gen-step-item--active' : ''
                }`}
              >
                <div className="auto-gen-step-circle">3</div>
                <span>Pratinjau Matriks</span>
              </div>
            </div>
          </div>

          {/* Active Step Content */}
          {step === 'CONFIG' && renderConfigStep()}
          {step === 'GENERATING' && renderGeneratingStep()}
          {step === 'PREVIEW' && renderPreviewStep()}
        </div>
      </Modal>

      {/* Detail Slot Modal (Ketika kartu KBM diklik) */}
      {selectedSlotDetail && (
        <Modal
          isOpen={!!selectedSlotDetail}
          onClose={() => setSelectedSlotDetail(null)}
          title="Detail Slot Jadwal Pelajaran"
          size="sm"
        >
          <div className="space-y-3.5 py-1">
            <div className="flex items-start justify-between gap-2 border-b border-gray-100 pb-2.5">
              <div>
                <span className="text-xs text-gray-400 uppercase tracking-wider block font-medium">
                  Mata Pelajaran
                </span>
                <h3 className="text-sm font-bold text-gray-900 mt-0.5">
                  {selectedSlotDetail.subject?.name || 'Mata Pelajaran'}
                </h3>
                {selectedSlotDetail.subject?.code && (
                  <span className="text-xs text-gray-500 font-mono">
                    Kode: {selectedSlotDetail.subject.code}
                  </span>
                )}
              </div>
              <Badge
                variant={selectedSlotDetail.category === 'jurusan' ? 'primary' : 'neutral'}
                className="text-[10px] shrink-0"
              >
                {selectedSlotDetail.category === 'jurusan' ? 'Jurusan' : 'Normada'}
              </Badge>
            </div>

            <div className="grid grid-cols-2 gap-2.5 text-xs">
              <div className="bg-slate-50 p-2 rounded border border-slate-100">
                <span className="text-gray-400 block mb-0.5">Guru Pengampu</span>
                <span className="font-semibold text-slate-800 block">
                  {selectedSlotDetail.teacher?.name || '-'}
                </span>
                {selectedSlotDetail.teacher?.nip && (
                  <span className="text-[10px] text-gray-500 font-mono">
                    NIP: {selectedSlotDetail.teacher.nip}
                  </span>
                )}
              </div>

              <div className="bg-slate-50 p-2 rounded border border-slate-100">
                <span className="text-gray-400 block mb-0.5">Ruangan Belajar</span>
                <span className="font-semibold text-slate-800 block">
                  {selectedSlotDetail.room?.name || '-'}
                </span>
                {selectedSlotDetail.room?.code && (
                  <span className="text-[10px] text-gray-500 font-mono">
                    Kode: {selectedSlotDetail.room.code}
                  </span>
                )}
              </div>

              <div className="bg-slate-50 p-2 rounded border border-slate-100">
                <span className="text-gray-400 block mb-0.5">Waktu KBM</span>
                <span className="font-semibold text-slate-800 block">
                  {NUMBER_TO_DAY[selectedSlotDetail.day_of_week] || 'Hari -'}, Jam {selectedSlotDetail.period_number}
                  {selectedSlotDetail.duration_periods > 1 &&
                    `-${selectedSlotDetail.period_number + selectedSlotDetail.duration_periods - 1}`}
                </span>
                <span className="text-[10px] text-gray-500 font-mono">
                  {selectedSlotDetail.duration_periods} JP (
                  {
                    resolveSlotTime(
                      NUMBER_TO_DAY[selectedSlotDetail.day_of_week] || 'Senin',
                      selectedSlotDetail.period_number,
                      selectedSlotDetail.duration_periods,
                      true,
                      config?.period_templates || []
                    ).timeText
                  }{' '}
                  WIB)
                </span>
              </div>

              <div className="bg-slate-50 p-2 rounded border border-slate-100">
                <span className="text-gray-400 block mb-0.5">Rombel & Putaran</span>
                <span className="font-semibold text-slate-800 block">
                  Kelas {selectedSlotDetail.school_class?.name || selectedSlotDetail.class_id}
                </span>
                <span className="text-[10px] text-indigo-600 font-medium">
                  Putaran {selectedSlotDetail.cycle_type}
                </span>
              </div>
            </div>

            <div className="pt-2 border-t border-gray-100">
              {selectedSlotDetail.has_conflict ? (
                <div className="p-2 bg-amber-50 border border-amber-200 rounded text-xs text-amber-800 flex items-start gap-1.5">
                  <AlertTriangle size={14} className="text-amber-600 shrink-0 mt-0.5" />
                  <div>
                    <span className="font-bold block">Peringatan Bentrok:</span>
                    <span>
                      {selectedSlotDetail.conflict_note || 'Slot jadwal terdeteksi mengalami konflik jadwal.'}
                    </span>
                  </div>
                </div>
              ) : (
                <div className="p-2 bg-emerald-50 border border-emerald-200 rounded text-xs text-emerald-800 flex items-center gap-1.5">
                  <CheckCircle2 size={14} className="text-emerald-600 shrink-0" />
                  <span>
                    Slot jadwal ini <strong>valid dan bebas konflik</strong> (Guru, Kelas, dan Ruangan tersedia).
                  </span>
                </div>
              )}
            </div>

            <div className="flex justify-end pt-2">
              <Button variant="secondary" size="sm" onClick={() => setSelectedSlotDetail(null)}>
                Tutup
              </Button>
            </div>
          </div>
        </Modal>
      )}

      {/* Modal Dialog Peringatan Penimpaan Jadwal (Keputusan 3 - Kondisi 2: Active State) */}
      <Modal
        isOpen={isOverwriteModalOpen}
        onClose={() => setIsOverwriteModalOpen(false)}
        title="Konfirmasi Penimpaan Jadwal Pelajaran Aktif"
        size="md"
      >
        <div className="space-y-4">
          <div className="auto-gen-overwrite-card">
            <AlertTriangle size={24} className="auto-gen-overwrite-icon" />
            <div>
              <h4 className="auto-gen-overwrite-title">
                Peringatan: Jadwal Sudah Memiliki Data Aktif!
              </h4>
              <p className="auto-gen-overwrite-text">
                Sistem mendeteksi bahwa jadwal pelajaran untuk{' '}
                <strong>Putaran {selectedCycles.join(' & ')}</strong> saat ini sudah memiliki{' '}
                <strong>{overwriteInfo?.total_active_schedules ?? 0} slot jadwal aktif</strong>.
              </p>
              <p className="auto-gen-overwrite-text mt-2">
                Jika Anda melanjutkan, seluruh jadwal aktif pada putaran tersebut akan{' '}
                <strong>ditimpa dan digantikan secara permanen</strong> oleh jadwal hasil generate
                otomatis ini.
              </p>
              <p className="auto-gen-overwrite-text mt-2 font-semibold">
                Apakah Anda yakin ingin mengganti jadwal lama dengan hasil generate baru ini?
              </p>
            </div>
          </div>

          <div className="flex justify-end gap-2 pt-2">
            <Button
              variant="outline"
              onClick={() => setIsOverwriteModalOpen(false)}
            >
              Batalkan, Pertahankan Jadwal Lama
            </Button>
            <Button
              variant="primary"
              className="bg-amber-600 hover:bg-amber-700 text-white"
              onClick={handleConfirmOverwrite}
            >
              Ya, Timpa Jadwal Sebelumnya
            </Button>
          </div>
        </div>
      </Modal>

      {/* Modal Password Step-Up Auth */}
      <PasswordModal
        isOpen={isPasswordModalOpen}
        onClose={() => setIsPasswordModalOpen(false)}
        onConfirm={handleApplyWithPassword}
        title="Verifikasi Kata Sandi Waka Kurikulum"
        description="Masukkan kata sandi akun Anda untuk mengesahkan dan menerapkan jadwal hasil generate otomatis ke KBM aktif."
        confirmText="Terapkan Jadwal Sekarang"
        confirmVariant="primary"
        loading={passwordModalLoading}
        error={passwordModalError}
      />
    </>
  );
}
