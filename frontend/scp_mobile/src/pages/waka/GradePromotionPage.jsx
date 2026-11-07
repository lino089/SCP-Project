import { useState, useEffect, useMemo, useCallback } from 'react';
import {
  GraduationCap,
  AlertTriangle,
  RotateCw,
  X,
} from 'lucide-react';
import {
  Button,
  Badge,
  SearchInput,
  Select,
  PasswordSheet,
} from '../../components/shared';
import { classApi, studentApi } from '../../services/masterDataApi';
import { SkeletonCard, EmptyState, ErrorState } from '../../components/feedback';

export default function GradePromotionPage() {
  const [classList, setClassList] = useState([]);
  const [studentList, setStudentList] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [fetchError, setFetchError] = useState(null);

  // Filters
  const [searchQuery, setSearchQuery] = useState('');
  const [levelFilter, setLevelFilter] = useState('ALL');
  const [classFilter, setClassFilter] = useState('ALL');

  // Hold back student action
  const [holdingBackId, setHoldingBackId] = useState(null);

  // Promotion execution
  const [isPasswordSheetOpen, setIsPasswordSheetOpen] = useState(false);
  const [isExecuting, setIsExecuting] = useState(false);
  const [passwordError, setPasswordError] = useState('');

  // Toast
  const [toastMessage, setToastMessage] = useState(null);
  const [toastType, setToastType] = useState('success');

  const showToast = (msg, type = 'success') => {
    setToastMessage(msg);
    setToastType(type);
    setTimeout(() => setToastMessage(null), 3500);
  };

  const fetchData = useCallback(async () => {
    try {
      const [cRes, sRes] = await Promise.all([
        classApi.getClasses({ all: true }),
        studentApi.getStudents({ all: true }),
      ]);

      const classes = Array.isArray(cRes) ? cRes : Array.isArray(cRes?.data) ? cRes.data : [];
      const students = Array.isArray(sRes) ? sRes : Array.isArray(sRes?.data) ? sRes.data : [];

      setClassList(Array.isArray(classes) ? classes : classes?.data || []);
      setStudentList(Array.isArray(students) ? students : students?.data || []);
      setFetchError(null);
    } catch (err) {
      setFetchError(err.message || 'Gagal memuat data rombel dan siswa.');
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    let isMounted = true;
    async function init() {
      try {
        const [cRes, sRes] = await Promise.all([
          classApi.getClasses({ all: true }),
          studentApi.getStudents({ all: true }),
        ]);

        const classes = Array.isArray(cRes) ? cRes : Array.isArray(cRes?.data) ? cRes.data : [];
        const students = Array.isArray(sRes) ? sRes : Array.isArray(sRes?.data) ? sRes.data : [];

        if (isMounted) {
          setClassList(Array.isArray(classes) ? classes : classes?.data || []);
          setStudentList(Array.isArray(students) ? students : students?.data || []);
          setFetchError(null);
        }
      } catch (err) {
        if (isMounted) setFetchError(err.message || 'Gagal memuat data rombel dan siswa.');
      } finally {
        if (isMounted) setIsLoading(false);
      }
    }
    init();
    return () => {
      isMounted = false;
    };
  }, []);

  const handleRefresh = () => {
    setIsLoading(true);
    fetchData();
  };

  // Statistics calculation
  const stats = useMemo(() => {
    const total = studentList.length;
    const grade10 = studentList.filter((s) => Number(s.school_class?.level) === 10).length;
    const grade11 = studentList.filter((s) => Number(s.school_class?.level) === 11).length;
    const grade12 = studentList.filter((s) => Number(s.school_class?.level) === 12).length;
    const heldBack = studentList.filter((s) => Boolean(s.is_held_back)).length;

    return { total, grade10, grade11, grade12, heldBack };
  }, [studentList]);

  // Toggle student hold-back status
  const handleToggleHoldBack = async (student) => {
    const newStatus = !student.is_held_back;
    setHoldingBackId(student.id);
    try {
      await studentApi.holdBack(student.id, { is_held_back: newStatus });
      setStudentList((prev) =>
        prev.map((s) => (s.id === student.id ? { ...s, is_held_back: newStatus } : s))
      );
      showToast(
        newStatus
          ? `${student.name} ditandai Tinggal Kelas.`
          : `Tanda Tinggal Kelas dibatalkan untuk ${student.name}.`
      );
    } catch (err) {
      showToast(err.response?.data?.message || err.message || 'Gagal memperbarui status.', 'error');
    } finally {
      setHoldingBackId(null);
    }
  };

  // Trigger mass promotion
  const handleTriggerPromotion = () => {
    setPasswordError('');
    setIsPasswordSheetOpen(true);
  };

  const handlePasswordConfirmPromotion = async (password) => {
    setIsExecuting(true);
    setPasswordError('');
    try {
      await classApi.promoteClasses({ password });
      setIsPasswordSheetOpen(false);
      showToast('Kenaikan kelas massal berhasil dieksekusi.');
      handleRefresh();
    } catch (err) {
      setPasswordError(
        err.response?.data?.message || err.message || 'Kata sandi tidak valid atau eksekusi gagal.'
      );
    } finally {
      setIsExecuting(false);
    }
  };

  // Filtered Students
  const filteredStudents = useMemo(() => {
    return studentList.filter((s) => {
      if (levelFilter !== 'ALL' && Number(s.school_class?.level) !== Number(levelFilter)) {
        return false;
      }
      if (classFilter !== 'ALL' && Number(s.class_id) !== Number(classFilter)) {
        return false;
      }
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const name = s.name?.toLowerCase() || '';
        const nis = s.nis_nip?.toLowerCase() || '';
        const cls = s.school_class?.name?.toLowerCase() || '';
        return name.includes(q) || nis.includes(q) || cls.includes(q);
      }
      return true;
    });
  }, [studentList, levelFilter, classFilter, searchQuery]);

  return (
    <div className="space-y-4">
      {/* Toast Feedback */}
      {toastMessage && (
        <div
          className={`p-3 rounded-[14px] text-xs flex items-center justify-between animate-fade-in ${
            toastType === 'success'
              ? 'bg-[var(--color-success-bg)] border border-[var(--color-success-border)] text-[var(--color-success-fg)]'
              : 'bg-[var(--color-danger-bg)] border border-[var(--color-danger-border)] text-[var(--color-danger-fg)]'
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
          <h1 className="text-sm font-bold text-[var(--color-text-primary)]">Kenaikan Kelas &amp; Kelulusan</h1>
          <p className="text-[11px] text-[var(--color-text-muted)]">
            Siklus akhir tahun ajaran &amp; promosi rombel
          </p>
        </div>
        <Button
          size="sm"
          variant="ghost"
          onClick={handleRefresh}
          className="p-1.5 h-8 w-8 min-h-0"
          aria-label="Segarkan"
        >
          <RotateCw size={14} />
        </Button>
      </div>

      {/* Ringkasan Tingkat Cards */}
      <div className="grid grid-cols-3 gap-2">
        <div className="surface-card p-2.5 text-center shadow-[var(--shadow-card)]">
          <p className="text-[11px] text-[var(--color-text-secondary)] font-semibold">Tingkat 10 → 11</p>
          <p className="text-sm font-bold text-[var(--color-text-primary)] mt-0.5">{stats.grade10} Siswa</p>
        </div>
        <div className="surface-card p-2.5 text-center shadow-[var(--shadow-card)]">
          <p className="text-[11px] text-[var(--color-text-secondary)] font-semibold">Tingkat 11 → 12</p>
          <p className="text-sm font-bold text-[var(--color-text-primary)] mt-0.5">{stats.grade11} Siswa</p>
        </div>
        <div className="surface-card p-2.5 text-center shadow-[var(--shadow-card)]">
          <p className="text-[11px] text-purple-600 font-semibold">Tingkat 12 → Lulus</p>
          <p className="text-sm font-bold text-purple-900 mt-0.5">{stats.grade12} Siswa</p>
        </div>
      </div>

      {/* Warning Box */}
      <div className="p-3 bg-[var(--color-warning-bg)] border border-[var(--color-warning-border)] rounded-[14px] flex items-start gap-2.5">
        <AlertTriangle className="text-[var(--color-warning-fg)] shrink-0 mt-0.5" size={16} />
        <div className="text-[11px] text-[var(--color-warning-fg)] leading-relaxed">
          <span className="font-bold">Perhatian:</span> Eksekusi promosi massal akan memindahkan seluruh siswa ke jenjang berikutnya dan meluluskan siswa tingkat 12. Siswa yang berhalangan naik kelas wajib ditandai <span className="font-bold underline">Tinggal Kelas</span> terlebih dahulu.
        </div>
      </div>

      {/* Action Button: Eksekusi Kenaikan Kelas */}
      <Button
        variant="primary"
        onClick={handleTriggerPromotion}
        disabled={isExecuting || stats.total === 0}
        className="w-full gap-2 text-xs font-bold py-2.5 bg-[var(--color-warning-bg)] hover:bg-[var(--color-brand)] text-[var(--color-text-primary)]"
      >
        <GraduationCap size={16} />
        Eksekusi Kenaikan Kelas &amp; Kelulusan Massal
      </Button>

      {/* Filter Rombel & Tingkat */}
      <div className="space-y-2">
        <div className="grid grid-cols-2 gap-2">
          <Select
            value={levelFilter}
            onChange={(e) => setLevelFilter(e.target.value)}
            className="text-xs"
          >
            <option value="ALL">Semua Tingkat</option>
            <option value="10">Kelas 10 (X)</option>
            <option value="11">Kelas 11 (XI)</option>
            <option value="12">Kelas 12 (XII)</option>
          </Select>

          <Select
            value={classFilter}
            onChange={(e) => setClassFilter(e.target.value)}
            className="text-xs"
          >
            <option value="ALL">Semua Rombel</option>
            {classList.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </Select>
        </div>

        <SearchInput
          placeholder="Cari siswa atau NISN..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
        />
      </div>

      {/* Students List */}
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <span className="section-label">
            Daftar Siswa ({filteredStudents.length})
          </span>
          {stats.heldBack > 0 && (
            <Badge variant="danger" size="sm">
              {stats.heldBack} Tinggal Kelas
            </Badge>
          )}
        </div>

        {isLoading ? (
          <SkeletonCard count={3} />
        ) : fetchError ? (
          <ErrorState message={fetchError} onRetry={handleRefresh} />
        ) : filteredStudents.length === 0 ? (
          <EmptyState
            title="Tidak Ada Siswa"
            message="Tidak ada siswa yang sesuai dengan filter yang dipilih."
          />
        ) : (
          <div className="space-y-2">
            {filteredStudents.map((student) => {
              const isHeld = Boolean(student.is_held_back);
              const isGrade12 = Number(student.school_class?.level) === 12;
              const isProcessing = holdingBackId === student.id;

              return (
                <div
                  key={student.id}
                  className={`bg-[var(--color-surface)] border rounded-[14px] p-3 shadow-[var(--shadow-card)] space-y-2 transition-all ${
                    isHeld ? 'border-[var(--color-danger-border)] bg-[var(--color-danger-bg)]/40' : 'border-[var(--color-border-subtle)]'
                  }`}
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <Badge variant="neutral" size="sm">
                          {student.school_class?.name || 'Rombel'}
                        </Badge>
                        <span className="text-[11px] font-mono text-[var(--color-text-secondary)] bg-[var(--color-surface-subtle)] px-1.5 py-0.5 rounded-[6px]">
                          NIS: {student.nis_nip || '-'}
                        </span>
                        {isHeld ? (
                          <Badge variant="danger" size="sm">
                            Tinggal Kelas
                          </Badge>
                        ) : isGrade12 ? (
                          <Badge variant="purple" size="sm">
                            Siap Lulus
                          </Badge>
                        ) : (
                          <Badge variant="success" size="sm">
                            Siap Naik Kelas
                          </Badge>
                        )}
                      </div>

                      <h3 className="text-xs font-bold text-[var(--color-text-primary)] mt-1 truncate">
                        {student.name}
                      </h3>
                    </div>

                    <button
                      type="button"
                      onClick={() => handleToggleHoldBack(student)}
                      disabled={isProcessing}
                      className={`px-2.5 py-1 rounded-[10px] text-[11px] font-semibold transition-all shrink-0 ${
                        isHeld
                          ? 'bg-[var(--color-danger-bg)] text-[var(--color-danger-fg)] hover:bg-rose-200'
                          : 'bg-[var(--color-surface-subtle)] text-[var(--color-text-secondary)] hover:bg-[var(--color-border-subtle)]'
                      }`}
                    >
                      {isProcessing
                        ? 'Memproses...'
                        : isHeld
                        ? 'Batal Tinggal Kelas'
                        : 'Tandai Tinggal Kelas'}
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Password Confirmation Sheet */}
      <PasswordSheet
        isOpen={isPasswordSheetOpen}
        onClose={() => setIsPasswordSheetOpen(false)}
        onConfirm={handlePasswordConfirmPromotion}
        title="Konfirmasi Promosi Kelas Massal"
        description="Masukkan kata sandi Waka Kurikulum untuk mengeksekusi kenaikan kelas dan kelulusan tahun ajaran baru."
        isLoading={isExecuting}
        errorMessage={passwordError}
      />
    </div>
  );
}
