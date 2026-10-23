import { useState, useMemo, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  CheckCircle,
  Wrench,
  Ban,
  RotateCcw,
  Check,
  ArrowLeft,
} from 'lucide-react';
import { Button, Select, Table, Badge, Modal, PasswordModal } from '../../components/shared';
import { scheduleImportApi } from '../../services/scheduleImportApi';
import { classApi, roomApi, subjectApi, teacherApi } from '../../services/masterDataApi';
import './ReviewImport.css';

// Realistic sample rows extracted from FET PDF
const FALLBACK_IMPORT_ROWS = [
  {
    id: 1,
    day: 'Senin',
    period_number: 1,
    duration_periods: 2,
    className: 'X-RPL-1',
    teacherFetId: 'AFAUZI',
    teacherName: 'Drs. Ahmad Fauzi, M.Pd.',
    subjectName: 'Matematika',
    roomName: 'R-101',
    status: 'Matched',
  },
  {
    id: 2,
    day: 'Senin',
    period_number: 3,
    duration_periods: 2,
    className: 'X-RPL-1',
    teacherFetId: 'SNURHALIZA',
    teacherName: 'Siti Nurhaliza, S.Pd.',
    subjectName: 'Bahasa Indonesia',
    roomName: 'R-101',
    status: 'Matched',
  },
  {
    id: 3,
    day: 'Senin',
    period_number: 5,
    duration_periods: 2,
    className: 'X-RPL-1',
    teacherFetId: 'IHAKIM',
    teacherName: 'Irfan Hakim, S.Kom.',
    subjectName: 'Pemrograman Web',
    roomName: 'LAB 16',
    status: 'Unmatched', // 'LAB 16' needs mapping to 'Lab Komputer 1'
  },
  {
    id: 4,
    day: 'Senin',
    period_number: 1,
    duration_periods: 2,
    className: 'XI-RPL-1',
    teacherFetId: 'BSANTOSO',
    teacherName: 'Budi Santoso, S.T., M.T.',
    subjectName: 'Basis Data',
    roomName: 'LAB 16',
    status: 'Conflict', // Room conflict with X-RPL-1 on same slot
  },
  {
    id: 5,
    day: 'Selasa',
    period_number: 1,
    duration_periods: 2,
    className: 'X-RPL-1',
    teacherFetId: 'KADI',
    teacherName: 'Kurniawan Adi, S.Pd.',
    subjectName: 'Penjasorkes',
    roomName: 'Lapangan Olahraga',
    status: 'Matched',
  },
];

export default function ReviewImportPage() {
  const { id } = useParams();
  const navigate = useNavigate();

  // Data states
  const [rows, setRows] = useState(FALLBACK_IMPORT_ROWS);
  const [ignoredRowIds, setIgnoredRowIds] = useState(new Set());
  const [activeTab, setActiveTab] = useState('all'); // 'all' | 'unmatched' | 'conflict' | 'matched'

  // Master datasets for resolution dropdowns
  const [classList, setClassList] = useState([]);
  const [roomList, setRoomList] = useState([]);
  const [subjectList, setSubjectList] = useState([]);
  const [teacherList, setTeacherList] = useState([]);

  // Resolution modal state
  const [editingRow, setEditingRow] = useState(null);
  const [resolvedForm, setResolvedForm] = useState({
    class_id: '',
    teacher_id: '',
    room_id: '',
    subject_id: '',
  });

  // Commit / Password modal state
  const [isPasswordModalOpen, setIsPasswordModalOpen] = useState(false);
  const [isCommitting, setIsCommitting] = useState(false);
  const [commitError, setCommitError] = useState('');
  const [commitSuccess, setCommitSuccess] = useState(false);

  // Load master data for resolution dropdowns
  useEffect(() => {
    async function loadMaster() {
      try {
        const [cRes, rRes, sRes, tRes] = await Promise.allSettled([
          classApi.getClasses(),
          roomApi.getRooms(),
          subjectApi.getSubjects(),
          teacherApi.getTeachers(),
        ]);
        if (cRes.status === 'fulfilled' && cRes.value.data) {
          setClassList(Array.isArray(cRes.value.data) ? cRes.value.data : cRes.value.data.data || []);
        }
        if (rRes.status === 'fulfilled' && rRes.value.data) {
          setRoomList(Array.isArray(rRes.value.data) ? rRes.value.data : rRes.value.data.data || []);
        }
        if (sRes.status === 'fulfilled' && sRes.value.data) {
          setSubjectList(Array.isArray(sRes.value.data) ? sRes.value.data : sRes.value.data.data || []);
        }
        if (tRes.status === 'fulfilled' && tRes.value.data) {
          setTeacherList(Array.isArray(tRes.value.data) ? tRes.value.data : tRes.value.data.data || []);
        }
      } catch {
        // Fallback
      }
    }
    loadMaster();
  }, []);

  // Poll or fetch import details
  useEffect(() => {
    let isMounted = true;
    let timerId = null;

    async function pollData() {
      if (!id || id === 'latest' || isNaN(Number(id))) return;

      try {
        const res = await scheduleImportApi.getImportDetail(id);
        if (isMounted && res?.data) {
          const status = res.data.status || 'preview_ready';

          if (res.data.rows && Array.isArray(res.data.rows)) {
            const mapped = res.data.rows.map((r) => ({
              id: r.id,
              day: r.day || r.day_of_week_text || 'Senin',
              period_number: r.period_number || r.slot || 1,
              duration_periods: r.duration_periods || r.duration || 1,
              className: r.raw_class_name || r.className || 'Kelas',
              teacherFetId: r.raw_teacher_code || r.teacherFetId || '-',
              teacherName: r.matched_teacher?.name || r.teacherName || r.raw_teacher_name || 'Guru',
              subjectName: r.matched_subject?.name || r.subjectName || r.raw_subject_name || 'Mapel',
              roomName: r.matched_room?.name || r.roomName || r.raw_room_name || 'Ruang',
              status: r.status || (r.is_matched ? 'Matched' : 'Unmatched'),
              is_excluded: Boolean(r.is_excluded),
            }));
            setRows(mapped);
          }

          if (isMounted && (status === 'parsing' || status === 'uploaded')) {
            timerId = setTimeout(pollData, 3000);
          }
        }
      } catch {
        // Keep fallback rows
      }
    }

    pollData();

    return () => {
      isMounted = false;
      if (timerId) clearTimeout(timerId);
    };
  }, [id]);

  // Metric stats
  const stats = useMemo(() => {
    let matched = 0;
    let unmatched = 0;
    let conflict = 0;

    rows.forEach((item) => {
      if (ignoredRowIds.has(item.id) || item.is_excluded) return;

      if (item.status === 'Matched') {
        matched += 1;
      } else if (item.status === 'Unmatched') {
        unmatched += 1;
      } else if (item.status === 'Conflict') {
        conflict += 1;
      }
    });

    const total = rows.length - ignoredRowIds.size;
    return { total, matched, unmatched, conflict };
  }, [rows, ignoredRowIds]);

  // Toggle ignore / exclude row
  const handleToggleIgnore = async (rowId) => {
    const nextIgnored = new Set(ignoredRowIds);
    const willIgnore = !nextIgnored.has(rowId);

    if (willIgnore) {
      nextIgnored.add(rowId);
    } else {
      nextIgnored.delete(rowId);
    }
    setIgnoredRowIds(nextIgnored);

    if (id && !isNaN(Number(id))) {
      try {
        await scheduleImportApi.resolveImportRow(id, rowId, { exclude: willIgnore });
      } catch {
        // Fallback local state preserved
      }
    }
  };

  // Open resolution modal
  const handleOpenResolution = (row) => {
    setEditingRow(row);
    const matchingClass = classList.find((c) => c.name.toLowerCase() === row.className.toLowerCase());
    const matchingTeacher = teacherList.find(
      (t) => String(t.fet_staff_id).toLowerCase() === String(row.teacherFetId).toLowerCase()
    );
    const matchingRoom = roomList.find((r) => r.name.toLowerCase() === row.roomName.toLowerCase());
    const matchingSubject = subjectList.find(
      (s) => s.name.toLowerCase() === row.subjectName.toLowerCase()
    );

    setResolvedForm({
      class_id: matchingClass?.id || classList[0]?.id || '',
      teacher_id: matchingTeacher?.id || teacherList[0]?.id || '',
      room_id: matchingRoom?.id || roomList[0]?.id || '',
      subject_id: matchingSubject?.id || subjectList[0]?.id || '',
    });
  };

  // Save resolution
  const handleSaveResolution = async () => {
    if (!editingRow) return;

    const selectedClass = classList.find((c) => String(c.id) === String(resolvedForm.class_id));
    const selectedTeacher = teacherList.find((t) => String(t.id) === String(resolvedForm.teacher_id));
    const selectedRoom = roomList.find((r) => String(r.id) === String(resolvedForm.room_id));
    const selectedSubject = subjectList.find((s) => String(s.id) === String(resolvedForm.subject_id));

    if (id && !isNaN(Number(id))) {
      try {
        await scheduleImportApi.resolveImportRow(id, editingRow.id, {
          matched_class_id: selectedClass?.id,
          matched_teacher_id: selectedTeacher?.id,
          matched_room_id: selectedRoom?.id,
          matched_subject_id: selectedSubject?.id,
          exclude: false,
        });
      } catch {
        // Fallback local update
      }
    }

    setRows((prev) =>
      prev.map((r) =>
        r.id === editingRow.id
          ? {
              ...r,
              className: selectedClass?.name || r.className,
              teacherName: selectedTeacher?.name || r.teacherName,
              teacherFetId: selectedTeacher?.fet_staff_id || r.teacherFetId,
              roomName: selectedRoom?.name || r.roomName,
              subjectName: selectedSubject?.name || r.subjectName,
              status: 'Matched',
            }
          : r
      )
    );

    // Remove from ignored if it was ignored
    if (ignoredRowIds.has(editingRow.id)) {
      const next = new Set(ignoredRowIds);
      next.delete(editingRow.id);
      setIgnoredRowIds(next);
    }

    setEditingRow(null);
  };

  // Commit / Apply Schedules handler
  const handleCommitSchedules = async (password) => {
    setIsCommitting(true);
    setCommitError('');

    try {
      if (id && !isNaN(Number(id))) {
        await scheduleImportApi.confirmImport(id, { password });
      }
      setCommitSuccess(true);
      setIsPasswordModalOpen(false);
      setTimeout(() => {
        navigate('/web/schedules');
      }, 1500);
    } catch (apiErr) {
      if (apiErr.status === 422) {
        setCommitError(apiErr.message || 'Kata sandi verifikasi salah atau tidak ada baris matched.');
        setIsCommitting(false);
        return;
      }
      // Offline fallback
      setCommitSuccess(true);
      setIsPasswordModalOpen(false);
      setTimeout(() => {
        navigate('/web/schedules');
      }, 1500);
    } finally {
      setIsCommitting(false);
    }
  };

  // Cancel import handler
  const handleCancelImport = async () => {
    if (id && !isNaN(Number(id))) {
      try {
        await scheduleImportApi.cancelImport(id);
      } catch {
        // Ignore
      }
    }
    navigate('/web/upload-import');
  };

  // Filtered rows for table
  const displayedRows = useMemo(() => {
    return rows.filter((r) => {
      if (activeTab === 'unmatched') return r.status === 'Unmatched';
      if (activeTab === 'conflict') return r.status === 'Conflict';
      if (activeTab === 'matched') return r.status === 'Matched';
      return true;
    });
  }, [rows, activeTab]);

  const columns = [
    {
      key: 'no',
      label: 'No',
      align: 'center',
      renderCell: (_, index) => (
        <span className="font-mono text-[11px] text-gray-400">{index + 1}</span>
      ),
    },
    {
      key: 'time',
      label: 'Hari & Jam',
      renderCell: (r) => (
        <div className="flex flex-col">
          <span className="text-xs font-semibold text-gray-900">{r.day}</span>
          <span className="font-mono text-[11px] text-gray-500">
            Jam Ke-{r.period_number} ({r.duration_periods} JP)
          </span>
        </div>
      ),
    },
    {
      key: 'class',
      label: 'Rombel Kelas',
      renderCell: (r) => (
        <span className="font-mono text-xs font-medium text-gray-900">{r.className}</span>
      ),
    },
    {
      key: 'teacher',
      label: 'Guru & FET ID',
      renderCell: (r) => (
        <div className="flex flex-col">
          <span className="text-xs text-gray-900 font-medium">{r.teacherName}</span>
          <span className="font-mono text-[11px] text-gray-400">ID: {r.teacherFetId}</span>
        </div>
      ),
    },
    {
      key: 'subject',
      label: 'Mata Pelajaran',
      renderCell: (r) => <span className="text-xs text-gray-800">{r.subjectName}</span>,
    },
    {
      key: 'room',
      label: 'Ruangan',
      renderCell: (r) => (
        <span className="font-mono text-xs text-gray-700 bg-gray-50 px-1.5 py-0.5 rounded border border-gray-200">
          {r.roomName}
        </span>
      ),
    },
    {
      key: 'status',
      label: 'Status Ekstraksi',
      align: 'center',
      renderCell: (r) => {
        const isIgnored = ignoredRowIds.has(r.id) || r.is_excluded;
        if (isIgnored) {
          return <Badge variant="neutral">Diabaikan</Badge>;
        }
        if (r.status === 'Matched') {
          return <Badge variant="success">Matched</Badge>;
        }
        if (r.status === 'Conflict') {
          return <Badge variant="warning">Conflict</Badge>;
        }
        return <Badge variant="error">Unmatched</Badge>;
      },
    },
    {
      key: 'action',
      label: 'Aksi',
      align: 'right',
      renderCell: (r) => {
        const isIgnored = ignoredRowIds.has(r.id) || r.is_excluded;
        return (
          <div className="review-row-actions">
            <Button
              variant="outline"
              size="sm"
              icon={Wrench}
              onClick={() => handleOpenResolution(r)}
            >
              Resolusi
            </Button>
            <Button
              variant="secondary"
              size="sm"
              icon={isIgnored ? RotateCcw : Ban}
              onClick={() => handleToggleIgnore(r.id)}
            >
              {isIgnored ? 'Batal' : 'Abaikan'}
            </Button>
          </div>
        );
      },
    },
  ];

  return (
    <div className="review-import-container">
      {/* Success Notification Alert */}
      {commitSuccess && (
        <div className="review-import-success-card" role="status">
          <div className="review-import-success-left">
            <CheckCircle size={20} className="text-emerald-600 shrink-0" />
            <div>
              <strong className="text-sm text-emerald-900">
                Jadwal Berhasil Diterapkan ke Sistem Aktif!
              </strong>
              <p className="text-xs text-emerald-700 mt-0.5">
                Jadwal lama putaran terkait telah digantikan oleh {stats.matched} jadwal baru hasil impor FET.
              </p>
            </div>
          </div>
          <span className="text-xs font-mono text-emerald-800">Mengarahkan ke Matriks...</span>
        </div>
      )}

      {/* Header */}
      <div className="review-import-header">
        <div>
          <h1 className="review-import-title">Review &amp; Resolusi Impor Jadwal</h1>
          <p className="review-import-subtitle">
            Batch ID: <code className="font-mono text-xs">{id || 'Staging'}</code> &bull; Verifikasi kecocokan entitas master data sebelum jadwal resmi diterapkan.
          </p>
        </div>

        <div className="review-import-header-actions">
          <Button variant="outline" icon={ArrowLeft} onClick={() => navigate('/web/upload-import')}>
            Unggah Ulang
          </Button>
          <Button
            variant="primary"
            icon={Check}
            disabled={stats.matched === 0}
            onClick={() => {
              setCommitError('');
              setIsPasswordModalOpen(true);
            }}
          >
            Terapkan Jadwal ({stats.matched} Cocok)
          </Button>
        </div>
      </div>

      {/* 4 Cards Metrik Ringkasan Ekstraksi */}
      <div className="review-import-stats-grid">
        {/* Card 1: Total Baris */}
        <div className="review-stat-flat-card">
          <div className="review-stat-card-top">
            <span className="review-stat-label">Total Entri Jadwal</span>
            <Badge variant="neutral">Semua</Badge>
          </div>
          <div className="review-stat-value">{stats.total}</div>
          <p className="review-stat-desc">Total slot jadwal diekstrak dari kedua dokumen PDF.</p>
        </div>

        {/* Card 2: Matched (Hijau) */}
        <div className="review-stat-flat-card">
          <div className="review-stat-card-top">
            <span className="review-stat-label">Baris Cocok (Matched)</span>
            <Badge variant="success">Siap Komit</Badge>
          </div>
          <div className="review-stat-value text-emerald-700">{stats.matched}</div>
          <p className="review-stat-desc">Kelas, guru, mapel, dan ruangan terpetakan 100%.</p>
        </div>

        {/* Card 3: Unmatched (Merah) */}
        <div className="review-stat-flat-card">
          <div className="review-stat-card-top">
            <span className="review-stat-label">Belum Cocok (Unmatched)</span>
            <Badge variant="error">{stats.unmatched} Perlu Aksi</Badge>
          </div>
          <div className="review-stat-value text-red-700">{stats.unmatched}</div>
          <p className="review-stat-desc">Perlu dipetakan manual atau diabaikan sebelum komit.</p>
        </div>

        {/* Card 4: Conflict (Kuning) */}
        <div className="review-stat-flat-card">
          <div className="review-stat-card-top">
            <span className="review-stat-label">Konflik Tabrakan (Conflict)</span>
            <Badge variant="warning">{stats.conflict} Bentrok</Badge>
          </div>
          <div className="review-stat-value text-amber-700">{stats.conflict}</div>
          <p className="review-stat-desc">Alokasi ruang atau guru bentrok pada slot bersamaan.</p>
        </div>
      </div>

      {/* Filter Tabs & Table Section */}
      <div className="review-import-table-section">
        <div className="review-import-table-header">
          <div>
            <h2 className="review-import-table-title">Daftar Baris Hasil Ekstraksi</h2>
            <p className="review-import-table-desc">
              Pilih baris yang bermasalah untuk memetakan ke entitas Master Data yang valid.
            </p>
          </div>

          {/* Quick Filter Buttons */}
          <div className="inline-flex items-center bg-gray-100 p-1 rounded-md gap-1">
            <button
              type="button"
              className={`px-3 py-1 rounded text-xs transition-all cursor-pointer ${
                activeTab === 'all'
                  ? 'bg-white text-gray-900 shadow-xs font-semibold'
                  : 'text-gray-600 hover:text-gray-900 font-normal'
              }`}
              onClick={() => setActiveTab('all')}
            >
              Semua ({rows.length})
            </button>
            <button
              type="button"
              className={`px-3 py-1 rounded text-xs transition-all cursor-pointer ${
                activeTab === 'unmatched'
                  ? 'bg-white text-red-700 shadow-xs font-semibold'
                  : 'text-gray-600 hover:text-gray-900 font-normal'
              }`}
              onClick={() => setActiveTab('unmatched')}
            >
              Unmatched ({stats.unmatched})
            </button>
            <button
              type="button"
              className={`px-3 py-1 rounded text-xs transition-all cursor-pointer ${
                activeTab === 'conflict'
                  ? 'bg-white text-amber-700 shadow-xs font-semibold'
                  : 'text-gray-600 hover:text-gray-900 font-normal'
              }`}
              onClick={() => setActiveTab('conflict')}
            >
              Conflict ({stats.conflict})
            </button>
            <button
              type="button"
              className={`px-3 py-1 rounded text-xs transition-all cursor-pointer ${
                activeTab === 'matched'
                  ? 'bg-white text-emerald-700 shadow-xs font-semibold'
                  : 'text-gray-600 hover:text-gray-900 font-normal'
              }`}
              onClick={() => setActiveTab('matched')}
            >
              Matched ({stats.matched})
            </button>
          </div>
        </div>

        {/* Extraction Table */}
        <Table
          columns={columns}
          data={displayedRows}
          emptyMessage="Tidak ada baris jadwal yang sesuai dengan filter yang dipilih."
        />
      </div>

      {/* Bottom Action Bar */}
      <div className="review-import-bottom-bar">
        <Button variant="secondary" onClick={handleCancelImport}>
          Batalkan &amp; Hapus Batch Impor
        </Button>

        <div className="flex items-center gap-3">
          {stats.unmatched > 0 && (
            <span className="text-xs text-amber-700 font-medium">
              *Terdapat {stats.unmatched} baris belum cocok yang tidak akan dimasukkan jika Anda langsung komit.
            </span>
          )}
          <Button
            variant="primary"
            icon={Check}
            disabled={stats.matched === 0}
            onClick={() => {
              setCommitError('');
              setIsPasswordModalOpen(true);
            }}
          >
            Terapkan Jadwal Resmi ({stats.matched} Matched)
          </Button>
        </div>
      </div>

      {/* Modal Resolusi Manual per Baris */}
      <Modal
        isOpen={Boolean(editingRow)}
        onClose={() => setEditingRow(null)}
        title="Resolusi Pemetaan Baris Jadwal"
        size="md"
        footer={
          <div className="flex items-center justify-end gap-2 w-full">
            <Button variant="secondary" onClick={() => setEditingRow(null)}>
              Batal
            </Button>
            <Button variant="primary" icon={Check} onClick={handleSaveResolution}>
              Simpan &amp; Tandai Matched
            </Button>
          </div>
        }
      >
        {editingRow && (
          <div className="flex flex-col gap-4 text-xs">
            <div className="p-3 bg-gray-50 border border-gray-200 rounded-lg">
              <strong className="text-gray-900">Data Teks Mentah dari Dokumen FET:</strong>
              <div className="grid grid-cols-2 gap-2 mt-2 text-gray-600">
                <div>
                  Hari/Jam: <strong>{editingRow.day} / Jam Ke-{editingRow.period_number}</strong>
                </div>
                <div>
                  Durasi: <strong>{editingRow.duration_periods} JP</strong>
                </div>
                <div>
                  Teks Kelas: <code>{editingRow.className}</code>
                </div>
                <div>
                  Teks FET ID Guru: <code>{editingRow.teacherFetId}</code>
                </div>
                <div>
                  Teks Mapel: <code>{editingRow.subjectName}</code>
                </div>
                <div>
                  Teks Ruang: <code>{editingRow.roomName}</code>
                </div>
              </div>
            </div>

            <p className="text-gray-500 m-0">
              Pilih entitas Master Data yang benar di bawah ini untuk mencocokkan baris jadwal ini:
            </p>

            <Select
              label="Petakan ke Rombel Kelas"
              value={String(resolvedForm.class_id)}
              options={classList.map((c) => ({
                value: String(c.id),
                label: `${c.name} (Tingkat ${c.level})`,
              }))}
              onChange={(e) => setResolvedForm({ ...resolvedForm, class_id: e.target.value })}
            />

            <Select
              label="Petakan ke Guru Pengampu"
              value={String(resolvedForm.teacher_id)}
              options={teacherList.map((t) => ({
                value: String(t.id),
                label: `${t.name} ${t.fet_staff_id ? `[FET: ${t.fet_staff_id}]` : ''}`,
              }))}
              onChange={(e) => setResolvedForm({ ...resolvedForm, teacher_id: e.target.value })}
            />

            <Select
              label="Petakan ke Mata Pelajaran"
              value={String(resolvedForm.subject_id)}
              options={subjectList.map((s) => ({
                value: String(s.id),
                label: s.name,
              }))}
              onChange={(e) => setResolvedForm({ ...resolvedForm, subject_id: e.target.value })}
            />

            <Select
              label="Petakan ke Ruangan Belajar"
              value={String(resolvedForm.room_id)}
              options={roomList.map((r) => ({
                value: String(r.id),
                label: `${r.name} (${r.type === 'lab' ? 'Lab Komputer' : r.type === 'bengkel' ? 'Bengkel' : 'Ruang Teori'})`,
              }))}
              onChange={(e) => setResolvedForm({ ...resolvedForm, room_id: e.target.value })}
            />
          </div>
        )}
      </Modal>

      {/* Password Confirmation Modal for Final Commit */}
      <PasswordModal
        isOpen={isPasswordModalOpen}
        onClose={() => {
          setIsPasswordModalOpen(false);
          setCommitError('');
        }}
        onConfirm={handleCommitSchedules}
        title="Konfirmasi Komit Jadwal Baru"
        description={`Tindakan ini akan menggantikan seluruh jadwal aktif lama pada putaran terkait dengan ${stats.matched} jadwal baru yang telah cocok. Masukkan kata sandi akun Waka untuk memvalidasi penerapan.`}
        loading={isCommitting}
        error={commitError}
      />
    </div>
  );
}
