import { useState, useEffect, useMemo, useCallback } from 'react';
import {
  Pencil,
  RotateCcw,
  ArrowRight,
} from 'lucide-react';
import {
  Button,
  Select,
  Modal,
  Table,
  Badge,
  SearchInput,
  ConfirmDialog,
} from '../../components/shared';
import { SkeletonRow, EmptyState } from '../../components/feedback';
import { classApi, studentApi } from '../../services/masterDataApi';
import './GradePromotion.css';

export default function GradePromotionPage() {
  const [classList, setClassList] = useState([]);
  const [studentList, setStudentList] = useState([]);
  const [isLoading, setIsLoading] = useState(false);

  // Section 1: Edit Mapping Modal State
  const [editingClass, setEditingClass] = useState(null);
  const [selectedNextClassId, setSelectedNextClassId] = useState('');
  const [isSavingMapping, setIsSavingMapping] = useState(false);

  // Section 2: Student Hold-Back Filters
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedLevelFilter, setSelectedLevelFilter] = useState('ALL');
  const [selectedClassFilter, setSelectedClassFilter] = useState('ALL');

  // Section 3: Mass Promotion Execution States
  const [isConfirmModalOpen, setIsConfirmModalOpen] = useState(false);
  const [isExecuting, setIsExecuting] = useState(false);
  const [promotionResult, setPromotionResult] = useState(null);

  // Manual refresh handler
  const handleRefresh = useCallback(async () => {
    setIsLoading(true);
    try {
      const [cRes, sRes] = await Promise.all([
        classApi.getClasses({ per_page: 100 }),
        studentApi.getStudents({ per_page: 100 }),
      ]);
      if (cRes?.data) setClassList(cRes.data);
      if (sRes?.data) setStudentList(sRes.data);
    } catch {
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
      try {
        const [cRes, sRes] = await Promise.all([
          classApi.getClasses({ per_page: 100 }),
          studentApi.getStudents({ per_page: 100 }),
        ]);
        if (isMounted && cRes?.data) setClassList(cRes.data);
        if (isMounted && sRes?.data) setStudentList(sRes.data);
      } catch {
        if (isMounted) {
          setClassList([]);
          setStudentList([]);
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

  // Section 2: Toggle Hold-Back
  const handleToggleHoldBack = async (student) => {
    const studentId = student.id;
    const newStatus = !student.is_held_back;

    try {
      if (newStatus) {
        await studentApi.holdBack(studentId);
      }
      // Update local state
      setStudentList((prev) =>
        prev.map((s) => (s.id === studentId ? { ...s, is_held_back: newStatus } : s))
      );
    } catch (err) {
      alert(err.response?.data?.message || err.message || 'Gagal mengubah status tinggal kelas siswa.');
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

  // Filtered students
  const filteredStudents = useMemo(() => {
    const q = (typeof searchQuery === 'string' ? searchQuery : (searchQuery?.target?.value ?? '')).toLowerCase().trim();

    return studentList.filter((s) => {
      const cls = classList.find((c) => c.id === s.class_id);
      const studentLevel = cls ? String(cls.level) : '';

      if (selectedLevelFilter !== 'ALL' && studentLevel !== selectedLevelFilter) {
        return false;
      }
      if (selectedClassFilter !== 'ALL' && String(s.class_id) !== selectedClassFilter) {
        return false;
      }

      if (!q) return true;
      const name = String(s.name || '').toLowerCase();
      const nis = String(s.nis_nip || s.nis || '').toLowerCase();
      return name.includes(q) || nis.includes(q);
    });
  }, [studentList, classList, searchQuery, selectedLevelFilter, selectedClassFilter]);

  // Columns for Section 1 (Classes Mapping)
  const mappingColumns = [
    {
      key: 'no',
      label: 'No',
      renderCell: (_, idx) => (
        <span className="font-mono text-xs text-neutral-400">
          {String(idx + 1).padStart(2, '0')}
        </span>
      ),
    },
    {
      key: 'level',
      label: 'Tingkat',
      renderCell: (r) => <Badge variant="neutral">Kelas {r.level}</Badge>,
    },
    {
      key: 'name',
      label: 'Rombel Asal',
      renderCell: (r) => <strong className="font-mono text-sm text-neutral-900">{r.name}</strong>,
    },
    {
      key: 'next_class',
      label: 'Rombel Tujuan (Tahun Baru)',
      renderCell: (r) => {
        const target = classList.find((c) => c.id === r.next_class_id);
        if (target) {
          return (
            <div className="flex items-center gap-1.5 font-mono text-xs text-gray-800 font-semibold">
              <ArrowRight size={13} />
              <span>{target.name}</span>
            </div>
          );
        }
        if (r.level === 12) {
          return <Badge variant="success">Tingkat Akhir &rarr; Kelulusan</Badge>;
        }
        return <span className="text-xs text-neutral-400 italic">Belum Dipetakan</span>;
      },
    },
    {
      key: 'actions',
      label: 'Aksi',
      align: 'right',
      renderCell: (r) => (
        <Button
          variant="secondary"
          size="sm"
          icon={Pencil}
          onClick={() => handleOpenEditMapping(r)}
        >
          Ubah Pemetaan
        </Button>
      ),
    },
  ];

  // Columns for Section 2 (Students & Hold-Back)
  const studentColumns = [
    {
      key: 'no',
      label: 'No',
      renderCell: (_, idx) => (
        <span className="font-mono text-xs text-neutral-400">
          {String(idx + 1).padStart(2, '0')}
        </span>
      ),
    },
    {
      key: 'nis',
      label: 'NIS',
      renderCell: (r) => (
        <code className="font-mono text-xs bg-neutral-100 px-1.5 py-0.5 rounded text-neutral-700">
          {r.nis_nip || r.nis}
        </code>
      ),
    },
    {
      key: 'name',
      label: 'Nama Siswa',
      renderCell: (r) => <strong className="text-sm text-neutral-900">{r.name}</strong>,
    },
    {
      key: 'class',
      label: 'Kelas Saat Ini',
      renderCell: (r) => {
        const cls = classList.find((c) => c.id === r.class_id);
        return <Badge variant="neutral">{cls?.name || 'Belum Ada'}</Badge>;
      },
    },
    {
      key: 'status',
      label: 'Status Kenaikan',
      renderCell: (r) =>
        r.is_held_back ? (
          <Badge variant="danger">Ditandai Tinggal Kelas</Badge>
        ) : (
          <Badge variant="success">Siap Naik / Lulus</Badge>
        ),
    },
    {
      key: 'action',
      label: 'Tinggal Kelas (Hold-Back)',
      align: 'right',
      renderCell: (r) => (
        <button
          type="button"
          className={`promotion-holdback-btn ${r.is_held_back ? 'promotion-holdback-btn--active' : ''}`}
          onClick={() => handleToggleHoldBack(r)}
          title="Toggle status tinggal kelas"
        >
          <RotateCcw size={13} />
          <span>{r.is_held_back ? 'Batalkan Tinggal Kelas' : 'Tandai Tinggal Kelas'}</span>
        </button>
      ),
    },
  ];

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
            title="Muat Ulang Data"
          >
            Refresh
          </Button>

          <Button
            variant="danger"
            onClick={() => setIsConfirmModalOpen(true)}
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

      {/* SECTION 1: Pemetaan Rombel Kenaikan Kelas */}
      <section className="promotion-section">
        <div className="promotion-section-header">
          <div>
            <h2 className="promotion-section-title">1. Pemetaan Rombel Kelas Tujuan</h2>
            <p className="promotion-section-desc">
              Tentukan kelas tujuan untuk setiap rombel saat promosi massal dijalankan. Kelas tingkat 12 otomatis diarahkan ke status kelulusan.
            </p>
          </div>
        </div>

        {isLoading ? (
          <SkeletonRow count={4} />
        ) : (
          <Table columns={mappingColumns} data={classList} />
        )}
      </section>

      {/* SECTION 2: Siswa & Penanda Tinggal Kelas */}
      <section className="promotion-section">
        <div className="promotion-section-header">
          <div>
            <h2 className="promotion-section-title">2. Daftar Siswa &amp; Penanda Tinggal Kelas (*Hold-Back*)</h2>
            <p className="promotion-section-desc">
              Tandai siswa yang tidak memenuhi kriteria kenaikan kelas. Siswa bertanda ini akan tetap berada di kelasnya saat promosi dieksekusi.
            </p>
          </div>
        </div>

        {/* Toolbar */}
        <div className="promotion-toolbar">
          <div className="promotion-search">
            <SearchInput
              placeholder="Cari siswa berdasarkan nama atau NIS..."
              value={typeof searchQuery === 'string' ? searchQuery : ''}
              onChange={(val) => {
                const str = typeof val === 'string' ? val : (val?.target?.value ?? '');
                setSearchQuery(str);
              }}
            />
          </div>

          <div className="promotion-filters">
            <select
              className="promotion-filter-select"
              value={selectedLevelFilter}
              onChange={(e) => setSelectedLevelFilter(e.target.value)}
            >
              <option value="ALL">Semua Tingkat</option>
              <option value="10">Tingkat 10</option>
              <option value="11">Tingkat 11</option>
              <option value="12">Tingkat 12</option>
            </select>

            <select
              className="promotion-filter-select"
              value={selectedClassFilter}
              onChange={(e) => setSelectedClassFilter(e.target.value)}
            >
              <option value="ALL">Semua Rombel</option>
              {classList.map((c) => (
                <option key={c.id} value={String(c.id)}>
                  {c.name}
                </option>
              ))}
            </select>
          </div>
        </div>

        {filteredStudents.length === 0 ? (
          <EmptyState
            title="Tidak Ada Data Siswa"
            message="Tidak ditemukan data siswa yang sesuai dengan filter pencarian."
          />
        ) : (
          <Table columns={studentColumns} data={filteredStudents} />
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
    </div>
  );
}
