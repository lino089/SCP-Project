import { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import {
  FileSpreadsheet,
  RotateCw,
  Pencil,
  GraduationCap,
  UserCheck,
  Shield,
  Users,
  CheckCircle2,
  AlertTriangle,
  Search,
} from 'lucide-react';
import Button from '../../../components/shared/Button';
import SearchInput from '../../../components/shared/SearchInput';
import Table from '../../../components/shared/Table';
import Badge from '../../../components/shared/Badge';
import { SkeletonRow, EmptyState, ErrorState } from '../../../components/feedback';
import { teacherAssignmentApi } from '../../../services/masterDataApi';
import ClassAssignmentEditModal from './ClassAssignmentEditModal';
import TeacherAssignmentImportModal from './TeacherAssignmentImportModal';
import './TeacherAssignment.css';

/**
 * Tab Pengelolaan Penugasan Guru (Wali Kelas & Guru BK) pada Master Data.
 */
export default function TeacherAssignmentTab({
  teacherList = [],
  classList = [],
  onTabCountUpdate,
}) {
  const [matrixData, setMatrixData] = useState([]);
  const [summary, setSummary] = useState({
    total_classes: 0,
    classes_with_wali: 0,
    classes_with_kesiswaan: 0,
  });
  const [isLoading, setIsLoading] = useState(true);
  const [fetchError, setFetchError] = useState(null);

  // Filters
  const [searchQuery, setSearchQuery] = useState('');
  const [levelFilter, setLevelFilter] = useState('ALL'); // 'ALL' | '10' | '11' | '12'
  const [statusFilter, setStatusFilter] = useState('ALL'); // 'ALL' | 'complete' | 'no_wali' | 'no_bk'

  // Pagination
  const [currentPage, setCurrentPage] = useState(1);
  const pageSize = 25;

  // Modals state
  const [editingClass, setEditingClass] = useState(null);
  const [isImportModalOpen, setIsImportModalOpen] = useState(false);

  // Ref to hold onTabCountUpdate callback to break re-render loops
  const onTabCountUpdateRef = useRef(onTabCountUpdate);
  useEffect(() => {
    onTabCountUpdateRef.current = onTabCountUpdate;
  }, [onTabCountUpdate]);

  // Load Matrix Data from Backend (stable without external dependencies)
  const fetchMatrix = useCallback(async () => {
    setIsLoading(true);
    setFetchError(null);
    try {
      const res = await teacherAssignmentApi.getAssignmentMatrix();
      const data = res?.data?.data || res?.data || [];
      const sum = res?.data?.summary || {
        total_classes: data.length,
        classes_with_wali: data.filter((d) => d.wali_kelas).length,
        classes_with_kesiswaan: data.filter((d) => d.kesiswaan && d.kesiswaan.length > 0).length,
      };

      setMatrixData(data);
      setSummary(sum);
      if (typeof onTabCountUpdateRef.current === 'function') {
        onTabCountUpdateRef.current(data.length);
      }
    } catch (err) {
      console.error('Gagal memuat matriks penugasan:', err);
      setFetchError(err?.message || err?.response?.data?.message || 'Gagal memuat matriks penugasan guru.');
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchMatrix();
  }, [fetchMatrix]);

  // Statistik 4: Total Guru dengan Tugas Tambahan (Unik)
  const totalAssignedTeachers = useMemo(() => {
    const teacherIdSet = new Set();
    matrixData.forEach((row) => {
      if (row.wali_kelas?.id) {
        teacherIdSet.add(row.wali_kelas.id);
      }
      if (Array.isArray(row.kesiswaan)) {
        row.kesiswaan.forEach((bk) => {
          if (bk.id) teacherIdSet.add(bk.id);
        });
      }
    });
    return teacherIdSet.size;
  }, [matrixData]);

  // Filtering & Search
  const filteredData = useMemo(() => {
    let result = [...matrixData];

    // 1. Filter Tingkat
    if (levelFilter !== 'ALL') {
      const targetLvl = Number(levelFilter);
      result = result.filter((row) => Number(row.level) === targetLvl);
    }

    // 2. Filter Status Kelengkapan
    if (statusFilter === 'complete') {
      result = result.filter((row) => Boolean(row.wali_kelas) && Array.isArray(row.kesiswaan) && row.kesiswaan.length > 0);
    } else if (statusFilter === 'no_wali') {
      result = result.filter((row) => !row.wali_kelas);
    } else if (statusFilter === 'no_bk') {
      result = result.filter((row) => !row.kesiswaan || row.kesiswaan.length === 0);
    }

    // 3. Search Query (Nama Kelas, Nama Wali, Nama BK)
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase().trim();
      result = result.filter((row) => {
        const classNameMatch = row.class_name?.toLowerCase().includes(q);
        const waliMatch = row.wali_kelas?.name?.toLowerCase().includes(q) || row.wali_kelas?.nis_nip?.includes(q);
        const bkMatch = Array.isArray(row.kesiswaan) && row.kesiswaan.some((bk) => bk.name?.toLowerCase().includes(q));
        return classNameMatch || waliMatch || bkMatch;
      });
    }

    return result;
  }, [matrixData, levelFilter, statusFilter, searchQuery]);

  // Table Columns Definition
  const columns = useMemo(
    () => [
      {
        key: 'no',
        label: 'No',
        align: 'center',
        width: '55px',
        renderCell: (_row, idx) => (
          <span className="font-mono text-xs text-neutral-400">
            {String((currentPage - 1) * pageSize + idx + 1).padStart(2, '0')}
          </span>
        ),
      },
      {
        key: 'class_name',
        label: 'Rombel Kelas',
        width: '160px',
        renderCell: (row) => (
          <div className="flex items-center gap-2">
            <span className="font-bold text-neutral-900 text-sm">
              {row.class_name}
            </span>
            <Badge variant="primary">Tingkat {row.level}</Badge>
          </div>
        ),
      },
      {
        key: 'wali_kelas',
        label: 'Wali Kelas Aktif',
        renderCell: (row) => {
          if (!row.wali_kelas) {
            return (
              <span className="assignment-badge-empty">
                Belum Ditugaskan
              </span>
            );
          }
          return (
            <div className="assignment-teacher-cell">
              <span className="assignment-teacher-name">{row.wali_kelas.name}</span>
              {row.wali_kelas.nis_nip && (
                <span className="assignment-teacher-nip">
                  NIP: {row.wali_kelas.nis_nip}
                </span>
              )}
            </div>
          );
        },
      },
      {
        key: 'kesiswaan',
        label: 'Guru BK / Kesiswaan Binaan',
        renderCell: (row) => {
          const bkList = row.kesiswaan || [];
          if (bkList.length === 0) {
            return (
              <span className="assignment-badge-empty">
                Belum Ditugaskan
              </span>
            );
          }
          return (
            <div className="assignment-kesiswaan-badge-list">
              {bkList.map((bk) => (
                <div key={bk.id} className="assignment-kesiswaan-badge">
                  <span className="assignment-teacher-name text-xs">{bk.name}</span>
                  {bk.nis_nip && (
                    <span className="assignment-teacher-nip">
                      NIP: {bk.nis_nip}
                    </span>
                  )}
                </div>
              ))}
            </div>
          );
        },
      },
      {
        key: 'status',
        label: 'Status Penugasan',
        width: '150px',
        renderCell: (row) => {
          const hasWali = Boolean(row.wali_kelas);
          const hasBk = Array.isArray(row.kesiswaan) && row.kesiswaan.length > 0;
          const isComplete = hasWali && hasBk;

          return (
            <div className="flex items-center gap-1.5">
              {isComplete ? (
                <Badge variant="success">Lengkap</Badge>
              ) : (
                <Badge variant="warning">
                  {!hasWali && !hasBk
                    ? 'Kosong'
                    : !hasWali
                    ? 'Tanpa Wali'
                    : 'Tanpa BK'}
                </Badge>
              )}
            </div>
          );
        },
      },
      {
        key: 'actions',
        label: 'Aksi',
        align: 'center',
        width: '130px',
        renderCell: (row) => (
          <Button
            variant="outline"
            size="sm"
            icon={Pencil}
            onClick={() => setEditingClass(row)}
            title={`Kelola penugasan ${row.class_name}`}
          >
            Edit
          </Button>
        ),
      },
    ],
    [currentPage, pageSize]
  );

  return (
    <div className="flex flex-col gap-4">
      {/* 1. Header Toolbar Actions */}
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div>
          <h2 className="text-lg font-bold text-neutral-900 tracking-tight">
            Penugasan Wali Kelas & Guru BK
          </h2>
          <p className="text-xs text-neutral-500">
            Atur pembagian tanggung jawab kelas binaan untuk verifikasi perizinan dan pendampingan siswa.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            icon={RotateCw}
            onClick={fetchMatrix}
            loading={isLoading}
            disabled={isLoading}
            title="Muat ulang matriks penugasan"
          >
            Segarkan
          </Button>

          <Button
            variant="primary"
            icon={FileSpreadsheet}
            onClick={() => setIsImportModalOpen(true)}
            title="Import daftar penugasan resmi dari file Excel"
          >
            Import Penugasan (Excel)
          </Button>
        </div>
      </div>

      {/* 2. Dashboard Statistik Penugasan (4 Cards) */}
      <div className="assignment-stats-grid">
        <div className="assignment-stat-card">
          <div className="assignment-stat-icon assignment-stat-icon--primary">
            <GraduationCap size={22} />
          </div>
          <div className="assignment-stat-content">
            <span className="assignment-stat-value">{summary.total_classes}</span>
            <span className="assignment-stat-label">Total Rombel Kelas</span>
          </div>
        </div>

        <div className="assignment-stat-card">
          <div className="assignment-stat-icon assignment-stat-icon--success">
            <UserCheck size={22} />
          </div>
          <div className="assignment-stat-content">
            <span className="assignment-stat-value">
              {summary.classes_with_wali}{' '}
              <span className="text-xs font-normal text-neutral-400">
                / {summary.total_classes}
              </span>
            </span>
            <span className="assignment-stat-label">Memiliki Wali Kelas</span>
          </div>
        </div>

        <div className="assignment-stat-card">
          <div className="assignment-stat-icon assignment-stat-icon--warning">
            <Shield size={22} />
          </div>
          <div className="assignment-stat-content">
            <span className="assignment-stat-value">
              {summary.classes_with_kesiswaan}{' '}
              <span className="text-xs font-normal text-neutral-400">
                / {summary.total_classes}
              </span>
            </span>
            <span className="assignment-stat-label">Memiliki Guru BK</span>
          </div>
        </div>

        <div className="assignment-stat-card">
          <div className="assignment-stat-icon assignment-stat-icon--info">
            <Users size={22} />
          </div>
          <div className="assignment-stat-content">
            <span className="assignment-stat-value">{totalAssignedTeachers}</span>
            <span className="assignment-stat-label">Guru Diberi Penugasan</span>
          </div>
        </div>
      </div>

      {/* 3. Toolbar Filters & Search */}
      <div className="assignment-tab__toolbar">
        <div className="assignment-tab__toolbar-left">
          <div className="w-full max-w-sm">
            <SearchInput
              placeholder="Cari kelas, nama wali, atau guru BK..."
              value={searchQuery}
              onChange={(val) => {
                const str = typeof val === 'string' ? val : (val?.target?.value ?? '');
                setSearchQuery(str);
                setCurrentPage(1);
              }}
            />
          </div>
        </div>

        <div className="assignment-tab__toolbar-right">
          {/* Filter Tingkat */}
          <select
            className="master-data__filter-select"
            value={levelFilter}
            onChange={(e) => {
              setLevelFilter(e.target.value);
              setCurrentPage(1);
            }}
          >
            <option value="ALL">Semua Tingkat</option>
            <option value="10">Tingkat 10</option>
            <option value="11">Tingkat 11</option>
            <option value="12">Tingkat 12</option>
          </select>

          {/* Filter Status */}
          <select
            className="master-data__filter-select"
            value={statusFilter}
            onChange={(e) => {
              setStatusFilter(e.target.value);
              setCurrentPage(1);
            }}
          >
            <option value="ALL">Semua Status</option>
            <option value="complete">Penugasan Lengkap</option>
            <option value="no_wali">Tanpa Wali Kelas</option>
            <option value="no_bk">Tanpa Guru BK</option>
          </select>
        </div>
      </div>

      {/* 4. Table Matriks Data */}
      {isLoading ? (
        <div className="bg-white rounded-lg border border-neutral-200 overflow-hidden">
          <SkeletonRow count={8} />
        </div>
      ) : fetchError ? (
        <ErrorState
          title="Gagal Memuat Matriks Penugasan"
          message={fetchError}
          onRetry={fetchMatrix}
        />
      ) : filteredData.length === 0 ? (
        <EmptyState
          title="Tidak Ada Data Penugasan Ditemukan"
          message={
            searchQuery || levelFilter !== 'ALL' || statusFilter !== 'ALL'
              ? 'Tidak ditemukan kelas yang cocok dengan filter atau kata kunci pencarian Anda.'
              : 'Belum ada data rombel kelas yang terdaftar.'
          }
          actionLabel={searchQuery || levelFilter !== 'ALL' || statusFilter !== 'ALL' ? 'Reset Filter' : null}
          onAction={() => {
            setSearchQuery('');
            setLevelFilter('ALL');
            setStatusFilter('ALL');
          }}
        />
      ) : (
        <div className="bg-white rounded-lg border border-neutral-200 overflow-hidden shadow-2xs">
          <Table
            columns={columns}
            data={filteredData}
            pageSize={pageSize}
            currentPage={currentPage}
            onPageChange={setCurrentPage}
          />
        </div>
      )}

      {/* 5. Modal Edit Penugasan Kelas */}
      <ClassAssignmentEditModal
        isOpen={editingClass !== null}
        onClose={() => setEditingClass(null)}
        classItem={editingClass}
        teacherList={teacherList}
        matrixData={matrixData}
        onSaveSuccess={fetchMatrix}
      />

      {/* 6. Modal Wizard Import Excel */}
      <TeacherAssignmentImportModal
        isOpen={isImportModalOpen}
        onClose={() => setIsImportModalOpen(false)}
        teacherList={teacherList}
        classList={classList}
        onImportSuccess={fetchMatrix}
      />
    </div>
  );
}
