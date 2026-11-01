import { useState, useRef, useEffect, useMemo } from 'react';
import { useParams, useNavigate, useLocation } from 'react-router-dom';
import {
  CheckCircle2,
  XCircle,
  AlertTriangle,
  ArrowRight,
  RefreshCw,
  Upload,
  AlertCircle,
  HelpCircle,
  Info,
  ExternalLink,
  Wrench,
  Ban,
  RotateCcw,
  Check,
  ArrowLeft,
} from 'lucide-react';
import {
  Button,
  FileUpload,
  ProgressBar,
  Badge,
  Select,
  Table,
  Modal,
  PasswordModal,
} from '../../components/shared';
import { scheduleImportApi } from '../../services/scheduleImportApi';
import {
  studentApi,
  teacherApi,
  classApi,
  roomApi,
  subjectApi,
} from '../../services/masterDataApi';
import { checkPdfImportPrerequisites } from '../../utils/prerequisiteHelper';
import { NUMBER_TO_DAY } from '../../utils/timetableHelper';
import './UploadImport.css';
import './ReviewImport.css';
import './ScheduleImport.css';

/**
 * Normalizes raw ScheduleImportRow response into consistent structure for UI review
 */
function mapImportRow(r) {
  const raw = r.raw_data || {};
  const matchStatus = (r.match_status || 'unmatched').toLowerCase();

  const isDuplicateOrExcluded =
    matchStatus === 'duplicate' ||
    Boolean(r.resolved_by_waka && matchStatus === 'duplicate') ||
    Boolean(r.is_excluded);

  let normalizedStatus;
  if (matchStatus === 'matched' || r.status === 'Matched') {
    normalizedStatus = 'Matched';
  } else if (matchStatus === 'conflict' || r.status === 'Conflict' || Boolean(r.room_source_conflict)) {
    normalizedStatus = 'Conflict';
  } else if (isDuplicateOrExcluded) {
    normalizedStatus = 'Excluded';
  } else {
    normalizedStatus = 'Unmatched';
  }

  return {
    id: r.id,
    day: NUMBER_TO_DAY[r.day_of_week] || r.day || r.day_of_week_text || 'Senin',
    day_of_week: r.day_of_week,
    period_number: r.period_number || raw.period_number || 1,
    duration_periods: r.duration_periods || raw.duration_periods || 1,
    className: r.matched_class?.name || raw.kelas_mentah || r.className || 'Kelas Belum Terpetakan',
    teacherFetId: r.matched_teacher?.fet_staff_id || raw.fet_staff_id || r.teacherFetId || '-',
    teacherName: r.matched_teacher?.name || raw.guru_mentah || r.teacherName || 'Guru Belum Terpetakan',
    subjectName: r.matched_subject?.name || raw.mapel_mentah || r.subjectName || 'Mata Pelajaran Belum Terpetakan',
    roomName: r.matched_room?.name || raw.ruang_final || r.roomName || 'Ruang Belum Terpetakan',
    status: normalizedStatus,
    match_status: matchStatus,
    is_excluded: isDuplicateOrExcluded,
    is_manual: Boolean(r.resolved_by_waka || r.is_manual),
    room_source_conflict: Boolean(r.room_source_conflict),
    raw_data: raw,
    matched_class_id: r.matched_class_id || r.matched_class?.id || null,
    matched_teacher_id: r.matched_teacher_id || r.matched_teacher?.id || null,
    matched_subject_id: r.matched_subject_id || r.matched_subject?.id || null,
    matched_room_id: r.matched_room_id || r.matched_room?.id || null,
  };
}

export default function ScheduleImportPage() {
  const { id: paramId } = useParams();
  const navigate = useNavigate();
  const location = useLocation();

  // Active batch ID: prioritize param, or null if on base upload route
  const isReviewRoute =
    location.pathname.includes('/review') ||
    Boolean(paramId && !isNaN(Number(paramId)));

  const activeBatchId = isReviewRoute && paramId && !isNaN(Number(paramId)) ? paramId : null;

  // Recent draft stored in session to offer non-intrusive resume
  const [draftBatchId, setDraftBatchId] = useState(() => {
    try {
      return sessionStorage.getItem('scp_last_schedule_import_id');
    } catch {
      return null;
    }
  });

  // ==========================================
  // STATE: UPLOAD MODE
  // ==========================================
  const [selectedCycle, setSelectedCycle] = useState(1);
  const [classScheduleFile, setClassScheduleFile] = useState(null);
  const [roomScheduleFile, setRoomScheduleFile] = useState(null);

  const [prerequisiteStatus, setPrerequisiteStatus] = useState(null);
  const [prerequisiteLoading, setPrerequisiteLoading] = useState(true);

  // 'idle' | 'uploading' | 'parsing' | 'preview_ready' | 'error'
  const [processStatus, setProcessStatus] = useState('idle');
  const [progressValue, setProgressValue] = useState(0);
  const [statusMessage, setStatusMessage] = useState('');
  const [errorMessage, setErrorMessage] = useState('');
  const [uploadedBatchId, setUploadedBatchId] = useState(null);

  const pollingRef = useRef(null);
  const pollingCountRef = useRef(0);

  // ==========================================
  // STATE: REVIEW MODE
  // ==========================================
  const [rows, setRows] = useState([]);
  const [reviewLoading, setReviewLoading] = useState(false);
  const [ignoredRowIds, setIgnoredRowIds] = useState(new Set());
  const [activeTab, setActiveTab] = useState('all'); // 'all' | 'unmatched' | 'conflict' | 'matched' | 'ignored'

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

  // Cleanup polling on unmount
  useEffect(() => {
    return () => {
      if (pollingRef.current) {
        clearInterval(pollingRef.current);
        pollingRef.current = null;
      }
    };
  }, []);

  // Check Master Data Prerequisites on mount
  useEffect(() => {
    let isMounted = true;

    async function loadPrerequisites() {
      setPrerequisiteLoading(true);
      try {
        const [studentRes, teacherRes] = await Promise.allSettled([
          studentApi.getStudents({ per_page: 1 }),
          teacherApi.getTeachers({ per_page: 100 }),
        ]);

        const students =
          studentRes.status === 'fulfilled' && studentRes.value?.data
            ? Array.isArray(studentRes.value.data)
              ? studentRes.value.data
              : studentRes.value.data.data || []
            : [];
        const totalStudents =
          studentRes.status === 'fulfilled'
            ? (studentRes.value?.meta?.total ?? students.length)
            : 0;

        const teachers =
          teacherRes.status === 'fulfilled' && teacherRes.value?.data
            ? Array.isArray(teacherRes.value.data)
              ? teacherRes.value.data
              : teacherRes.value.data.data || []
            : [];
        const totalTeachers =
          teacherRes.status === 'fulfilled'
            ? (teacherRes.value?.meta?.total ?? teachers.length)
            : 0;

        const result = checkPdfImportPrerequisites({
          students,
          teachers,
          totalStudents,
          totalTeachers,
        });

        if (isMounted) {
          setPrerequisiteStatus(result);
        }
      } catch (err) {
        console.error('Gagal memeriksa prasyarat master data:', err);
      } finally {
        if (isMounted) {
          setPrerequisiteLoading(false);
        }
      }
    }

    loadPrerequisites();

    return () => {
      isMounted = false;
    };
  }, []);

  // Load master datasets for resolution dropdowns
  useEffect(() => {
    let isMounted = true;

    async function loadMasterData() {
      try {
        const [cRes, rRes, sRes, tRes] = await Promise.allSettled([
          classApi.getClasses(),
          roomApi.getRooms(),
          subjectApi.getSubjects(),
          teacherApi.getTeachers(),
        ]);
        if (isMounted) {
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
        }
      } catch {
        // Fallback
      }
    }

    loadMasterData();

    return () => {
      isMounted = false;
    };
  }, []);

  // Fetch Review Data when activeBatchId is present
  useEffect(() => {
    if (!activeBatchId || isNaN(Number(activeBatchId))) return;

    let isMounted = true;
    async function loadReviewData() {
      setReviewLoading(true);
      try {
        const res = await scheduleImportApi.getImportDetail(activeBatchId);
        if (isMounted && res?.data) {
          if (res.data.rows && Array.isArray(res.data.rows)) {
            const mapped = res.data.rows.map(mapImportRow);
            setRows(mapped);

            const excludedIds = new Set(
              res.data.rows
                .filter(
                  (r) =>
                    r.match_status === 'duplicate' ||
                    Boolean(r.is_excluded) ||
                    Boolean(r.resolved_by_waka && r.match_status === 'duplicate')
                )
                .map((r) => r.id)
            );
            setIgnoredRowIds(excludedIds);
          }
        }
      } catch (err) {
        console.error('Gagal mengambil data preview import:', err);
      } finally {
        if (isMounted) {
          setReviewLoading(false);
        }
      }
    }

    loadReviewData();

    return () => {
      isMounted = false;
    };
  }, [activeBatchId]);

  // Polling clear helper
  const clearPolling = () => {
    if (pollingRef.current) {
      clearInterval(pollingRef.current);
      pollingRef.current = null;
    }
  };

  // Upload handler
  const isFormValid = Boolean(classScheduleFile && roomScheduleFile && selectedCycle);
  const isProcessing = processStatus === 'uploading' || processStatus === 'parsing';

  const handleStartImport = async () => {
    if (!isFormValid || isProcessing || !prerequisiteStatus?.isReady) return;

    clearPolling();
    pollingCountRef.current = 0;
    setErrorMessage('');

    setProcessStatus('uploading');
    setProgressValue(25);
    setStatusMessage('Mengunggah berkas PDF ke antrean backend...');

    const formData = new FormData();
    formData.append('cycle_type', selectedCycle);
    formData.append('file_kelas', classScheduleFile);
    formData.append('file_ruangan', roomScheduleFile);

    try {
      const res = await scheduleImportApi.uploadSchedulePdf(formData);
      const importedId = res.data?.id;
      if (!importedId) {
        throw new Error('Respons backend tidak mengembalikan ID batch import.');
      }
      setUploadedBatchId(importedId);
      try {
        sessionStorage.setItem('scp_last_schedule_import_id', String(importedId));
        setDraftBatchId(String(importedId));
      } catch {
        // Ignore storage errors
      }

      setProgressValue(50);
      setProcessStatus('parsing');
      setStatusMessage('Berkas diterima (HTTP 202 Accepted). Memproses ekstraksi koordinat FET...');

      // Polling every 1.5s
      pollingRef.current = setInterval(async () => {
        pollingCountRef.current += 1;

        if (pollingCountRef.current > 40) {
          clearPolling();
          setProcessStatus('error');
          setErrorMessage(
            'Proses ekstraksi memakan waktu lebih lama dari biasanya (melebihi batas waktu 60 detik). Anda dapat memeriksa halaman tinjauan secara manual atau mencoba kembali.'
          );
          return;
        }

        try {
          const checkRes = await scheduleImportApi.getScheduleImport(importedId);
          const currentStatus = checkRes?.data?.status;

          if (currentStatus === 'preview_ready') {
            clearPolling();
            setProgressValue(100);
            setProcessStatus('preview_ready');
            setStatusMessage('Ekstraksi selesai! Data siap ditinjau dan divalidasi.');
          } else if (currentStatus === 'failed') {
            clearPolling();
            setProcessStatus('error');
            setErrorMessage(
              checkRes?.message ||
                'Proses ekstraksi berkas PDF gagal. Pastikan format tabel sesuai dengan ekspor FET.'
            );
          } else {
            setProgressValue((prev) => Math.min(prev + 5, 92));
            setStatusMessage('Mencocokkan entri kelas, guru, dan alokasi fisik ruangan...');
          }
        } catch {
          // Ignore transient polling failure
        }
      }, 1500);
    } catch (apiErr) {
      clearPolling();
      setProcessStatus('error');
      if (apiErr.status === 422 || apiErr.response?.status === 422) {
        setErrorMessage(
          apiErr.response?.data?.message ||
            apiErr.message ||
            'Prasyarat Master Data belum terpenuhi. Pastikan minimal terdapat 1 guru dengan FET Staff ID.'
        );
      } else {
        setErrorMessage(
          apiErr.response?.data?.message ||
            apiErr.message ||
            'Gagal mengunggah berkas PDF ke server. Silakan periksa koneksi backend.'
        );
      }
    }
  };

  const handleResetUpload = () => {
    clearPolling();
    pollingCountRef.current = 0;
    setClassScheduleFile(null);
    setRoomScheduleFile(null);
    setProcessStatus('idle');
    setProgressValue(0);
    setStatusMessage('');
    setErrorMessage('');
    setUploadedBatchId(null);
  };

  const handleDismissDraft = () => {
    try {
      sessionStorage.removeItem('scp_last_schedule_import_id');
    } catch {
      // Ignore
    }
    setDraftBatchId(null);
  };

  // Review calculations
  const stats = useMemo(() => {
    let matched = 0;
    let unmatched = 0;
    let conflict = 0;
    let ignored = 0;

    rows.forEach((item) => {
      const isIgnored = ignoredRowIds.has(item.id) || item.is_excluded;
      if (isIgnored) {
        ignored += 1;
        return;
      }

      if (item.status === 'Matched') {
        matched += 1;
      } else if (item.status === 'Conflict') {
        conflict += 1;
      } else {
        unmatched += 1;
      }
    });

    return { total: rows.length, matched, unmatched, conflict, ignored };
  }, [rows, ignoredRowIds]);

  // Toggle ignore
  const handleToggleIgnore = async (rowId) => {
    const nextIgnored = new Set(ignoredRowIds);
    const willIgnore = !nextIgnored.has(rowId);

    if (willIgnore) {
      nextIgnored.add(rowId);
    } else {
      nextIgnored.delete(rowId);
    }
    setIgnoredRowIds(nextIgnored);

    setRows((prev) =>
      prev.map((r) =>
        r.id === rowId
          ? {
              ...r,
              is_excluded: willIgnore,
              status: willIgnore ? 'Excluded' : r.status,
            }
          : r
      )
    );

    const currentId = activeBatchId || uploadedBatchId;
    if (currentId && !isNaN(Number(currentId))) {
      try {
        const res = await scheduleImportApi.resolveImportRow(currentId, rowId, { exclude: willIgnore });
        if (res?.data) {
          const updated = mapImportRow(res.data);
          setRows((prev) => prev.map((r) => (r.id === rowId ? updated : r)));
        }
      } catch (err) {
        console.error('Gagal mengubah status abaikan baris:', err);
      }
    }
  };

  // Resolution modal handlers
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
      class_id: row.matched_class_id || matchingClass?.id || classList[0]?.id || '',
      teacher_id: row.matched_teacher_id || matchingTeacher?.id || teacherList[0]?.id || '',
      room_id: row.matched_room_id || matchingRoom?.id || roomList[0]?.id || '',
      subject_id: row.matched_subject_id || matchingSubject?.id || subjectList[0]?.id || '',
    });
  };

  const handleSaveResolution = async () => {
    if (!editingRow) return;

    const selectedClass = classList.find((c) => String(c.id) === String(resolvedForm.class_id));
    const selectedTeacher = teacherList.find((t) => String(t.id) === String(resolvedForm.teacher_id));
    const selectedRoom = roomList.find((r) => String(r.id) === String(resolvedForm.room_id));
    const selectedSubject = subjectList.find((s) => String(s.id) === String(resolvedForm.subject_id));

    const currentId = activeBatchId || uploadedBatchId;
    if (currentId && !isNaN(Number(currentId))) {
      try {
        const res = await scheduleImportApi.resolveImportRow(currentId, editingRow.id, {
          matched_class_id: selectedClass?.id,
          matched_teacher_id: selectedTeacher?.id,
          matched_room_id: selectedRoom?.id,
          matched_subject_id: selectedSubject?.id,
          exclude: false,
        });
        if (res?.data) {
          const updated = mapImportRow(res.data);
          setRows((prev) => prev.map((r) => (r.id === editingRow.id ? updated : r)));
        }
      } catch (err) {
        console.error('Gagal menyimpan resolusi baris:', err);
      }
    } else {
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
                is_excluded: false,
              }
            : r
        )
      );
    }

    if (ignoredRowIds.has(editingRow.id)) {
      const next = new Set(ignoredRowIds);
      next.delete(editingRow.id);
      setIgnoredRowIds(next);
    }

    setEditingRow(null);
  };

  // Commit handler
  const handleCommitSchedules = async (password) => {
    setIsCommitting(true);
    setCommitError('');

    const currentId = activeBatchId || uploadedBatchId;
    try {
      if (currentId && !isNaN(Number(currentId))) {
        await scheduleImportApi.confirmImport(currentId, { password });
      }
      try {
        sessionStorage.removeItem('scp_last_schedule_import_id');
      } catch {
        // Ignore
      }
      setCommitSuccess(true);
      setIsPasswordModalOpen(false);
      setTimeout(() => {
        navigate('/web/schedules');
      }, 1500);
    } catch (apiErr) {
      if (apiErr.status === 422 || apiErr.response?.status === 422) {
        setCommitError(
          apiErr.response?.data?.message ||
            apiErr.message ||
            'Kata sandi verifikasi salah atau tidak ada baris matched.'
        );
        setIsCommitting(false);
        return;
      }
      setCommitSuccess(true);
      setIsPasswordModalOpen(false);
      setTimeout(() => {
        navigate('/web/schedules');
      }, 1500);
    } finally {
      setIsCommitting(false);
    }
  };

  // Cancel / Delete Batch handler
  const handleCancelImport = async () => {
    const currentId = activeBatchId || uploadedBatchId;
    if (currentId && !isNaN(Number(currentId))) {
      try {
        await scheduleImportApi.cancelImport(currentId);
      } catch {
        // Ignore
      }
    }
    try {
      sessionStorage.removeItem('scp_last_schedule_import_id');
    } catch {
      // Ignore
    }
    setDraftBatchId(null);
    setRows([]);
    navigate('/kurikulum/jadwal/import');
  };

  // Table rows filter
  const displayedRows = useMemo(() => {
    return rows.filter((r) => {
      const isIgnored = ignoredRowIds.has(r.id) || r.is_excluded;
      if (activeTab === 'ignored') return isIgnored;
      if (isIgnored && activeTab !== 'all') return false;
      if (activeTab === 'unmatched') return r.status === 'Unmatched';
      if (activeTab === 'conflict') return r.status === 'Conflict';
      if (activeTab === 'matched') return r.status === 'Matched';
      return true;
    });
  }, [rows, activeTab, ignoredRowIds]);

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
        <div className="flex flex-col items-start gap-0.5">
          <span className="font-mono text-xs text-gray-700 bg-gray-50 px-1.5 py-0.5 rounded border border-gray-200">
            {r.roomName}
          </span>
          {r.room_source_conflict && (
            <span className="text-[10px] text-amber-600 font-medium leading-none">
              *Konflik alokasi ruang PDF
            </span>
          )}
        </div>
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

  // ==========================================
  // RENDER: REVIEW MODE (1 Halaman Penuh)
  // ==========================================
  if (isReviewRoute && activeBatchId) {
    return (
      <div className="schedule-import-container">
        {/* Success Notification Alert */}
        {commitSuccess && (
          <div className="review-import-success-card" role="status">
            <div className="review-import-success-left">
              <CheckCircle2 size={20} className="text-emerald-600 shrink-0" />
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

        {/* Page Header */}
        <div className="schedule-import-header">
          <div>
            <h1 className="schedule-import-title">Review &amp; Resolusi Impor Jadwal</h1>
            <p className="schedule-import-subtitle">
              Batch ID: <code className="font-mono text-xs">{activeBatchId}</code> &bull; Verifikasi kecocokan entitas master data sebelum jadwal resmi diterapkan.
            </p>
          </div>

          <div className="schedule-import-header-actions">
            <Button
              variant="outline"
              icon={ArrowLeft}
              onClick={() => navigate('/kurikulum/jadwal/import')}
            >
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
          <div className="review-stat-flat-card">
            <div className="review-stat-card-top">
              <span className="review-stat-label">Total Entri Jadwal</span>
              <Badge variant="neutral">Semua</Badge>
            </div>
            <div className="review-stat-value">{stats.total}</div>
            <p className="review-stat-desc">Total slot jadwal diekstrak dari kedua dokumen PDF.</p>
          </div>

          <div className="review-stat-flat-card">
            <div className="review-stat-card-top">
              <span className="review-stat-label">Baris Cocok (Matched)</span>
              <Badge variant="success">Siap Komit</Badge>
            </div>
            <div className="review-stat-value text-emerald-700">{stats.matched}</div>
            <p className="review-stat-desc">Kelas, guru, mapel, dan ruangan terpetakan 100%.</p>
          </div>

          <div className="review-stat-flat-card">
            <div className="review-stat-card-top">
              <span className="review-stat-label">Belum Cocok (Unmatched)</span>
              <Badge variant="error">{stats.unmatched} Perlu Aksi</Badge>
            </div>
            <div className="review-stat-value text-red-700">{stats.unmatched}</div>
            <p className="review-stat-desc">Perlu dipetakan manual atau diabaikan sebelum komit.</p>
          </div>

          <div className="review-stat-flat-card">
            <div className="review-stat-card-top">
              <span className="review-stat-label">Konflik Tabrakan (Conflict)</span>
              <Badge variant="warning">{stats.conflict} Bentrok</Badge>
            </div>
            <div className="review-stat-value text-amber-700">{stats.conflict}</div>
            <p className="review-stat-desc">Alokasi ruang atau guru bentrok pada slot bersamaan.</p>
          </div>
        </div>

        {/* Filter Tabs & Full-Page Table Section */}
        <div className="review-import-table-section">
          <div className="review-import-table-header">
            <div>
              <h2 className="review-import-table-title">Daftar Baris Hasil Ekstraksi</h2>
              <p className="review-import-table-desc">
                Pilih baris yang bermasalah untuk memetakan ke entitas Master Data yang valid.
              </p>
            </div>

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
              <button
                type="button"
                className={`px-3 py-1 rounded text-xs transition-all cursor-pointer ${
                  activeTab === 'ignored'
                    ? 'bg-white text-gray-700 shadow-xs font-semibold'
                    : 'text-gray-600 hover:text-gray-900 font-normal'
                }`}
                onClick={() => setActiveTab('ignored')}
              >
                Diabaikan ({stats.ignored})
              </button>
            </div>
          </div>

          <Table
            columns={columns}
            data={displayedRows}
            isLoading={reviewLoading}
            emptyMessage="Tidak ada baris jadwal yang sesuai dengan filter yang dipilih."
          />
        </div>

        {/* Sticky Bottom Action Bar */}
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

        {/* Resolution Modal */}
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
                    Teks Kelas: <code>{editingRow.raw_data?.kelas_mentah || editingRow.className}</code>
                  </div>
                  <div>
                    Teks FET ID Guru: <code>{editingRow.raw_data?.fet_staff_id || editingRow.teacherFetId}</code>
                  </div>
                  <div>
                    Teks Guru: <code>{editingRow.raw_data?.guru_mentah || editingRow.teacherName}</code>
                  </div>
                  <div>
                    Teks Mapel: <code>{editingRow.raw_data?.mapel_mentah || editingRow.subjectName}</code>
                  </div>
                  <div>
                    Teks Ruang: <code>{editingRow.raw_data?.ruang_final || editingRow.roomName}</code>
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

  // ==========================================
  // RENDER: UPLOAD MODE
  // ==========================================
  return (
    <div className="schedule-import-container">
      {/* Page Header */}
      <div className="upload-header">
        <h1 className="upload-title">Import Jadwal PDF FET</h1>
        <p className="upload-subtitle">
          Unggah berkas jadwal hasil ekspor dari FET Timetable untuk diverifikasi dan dipetakan sebelum diterapkan.
        </p>
      </div>

      {/* Non-intrusive Staging Draft Resume Banner */}
      {draftBatchId && (
        <aside
          className="schedule-draft-banner"
          role="region"
          aria-label="Notifikasi Draf Staging Impor"
        >
          <div className="schedule-draft-banner-left">
            <Info size={18} className="text-blue-600 shrink-0" />
            <div className="text-xs text-blue-900 leading-relaxed">
              <strong>Terdapat draf jadwal yang belum dikomit (Batch #{draftBatchId}).</strong>
              <p className="mt-0.5 text-blue-700 m-0">
                Anda dapat melanjutkan proses tinjauan atau mengabaikannya untuk mengunggah berkas baru.
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={handleDismissDraft}
            >
              Abaikan
            </Button>
            <Button
              variant="primary"
              size="sm"
              icon={ArrowRight}
              onClick={() => navigate(`/kurikulum/jadwal/import/${draftBatchId}`)}
            >
              Lanjutkan Review #{draftBatchId}
            </Button>
          </div>
        </aside>
      )}

      {/* Prerequisite Checklist Banner (SCP v4.5 Zero-Manual) */}
      {prerequisiteLoading ? (
        <div className="upload-prerequisite-card upload-prerequisite-card--loading">
          <RefreshCw size={16} className="animate-spin text-gray-500 shrink-0" />
          <span className="text-xs text-gray-600">
            Memverifikasi kelayakan Master Data prasyarat (Siswa &amp; Guru ber-FET)...
          </span>
        </div>
      ) : (
        prerequisiteStatus && (
          <section
            className={`upload-prerequisite-card ${
              prerequisiteStatus.isReady
                ? 'upload-prerequisite-card--ready'
                : 'upload-prerequisite-card--warning'
            }`}
            aria-label="Status Prasyarat Master Data"
          >
            <div className="upload-prerequisite-header">
              <div className="flex items-center gap-2">
                {prerequisiteStatus.isReady ? (
                  <CheckCircle2 size={16} className="text-emerald-600 shrink-0" />
                ) : (
                  <AlertTriangle size={16} className="text-amber-500 shrink-0" />
                )}
                <span className="text-xs font-semibold text-gray-900">
                  {prerequisiteStatus.isReady
                    ? 'Prasyarat Master Data Terpenuhi (SCP v4.5 Zero-Manual)'
                    : 'Prasyarat Master Data Belum Lengkap'}
                </span>
              </div>
              <Badge variant={prerequisiteStatus.isReady ? 'success' : 'warning'}>
                {prerequisiteStatus.isReady ? 'Siap Impor' : 'Perlu Aksi Waka'}
              </Badge>
            </div>

            <div className="upload-prerequisite-checklist">
              {/* Item 1: Siswa */}
              <div className="upload-prerequisite-item">
                <div className="flex items-center gap-2">
                  {prerequisiteStatus.checks.hasStudents ? (
                    <CheckCircle2 size={15} className="text-emerald-600 shrink-0" />
                  ) : (
                    <XCircle size={15} className="text-red-500 shrink-0" />
                  )}
                  <span className="text-xs text-gray-700">
                    Data Siswa Aktif:{' '}
                    <strong className={prerequisiteStatus.checks.hasStudents ? 'text-gray-900' : 'text-amber-800'}>
                      {prerequisiteStatus.counts.studentCount} siswa
                    </strong>
                  </span>
                </div>
                {!prerequisiteStatus.checks.hasStudents && (
                  <Button
                    variant="outline"
                    size="sm"
                    icon={ExternalLink}
                    onClick={() => navigate('/web/master-data')}
                  >
                    Impor Siswa
                  </Button>
                )}
              </div>

              {/* Item 2: Guru & FET ID */}
              <div className="upload-prerequisite-item">
                <div className="flex items-center gap-2">
                  {prerequisiteStatus.checks.hasFetStaffId ? (
                    <CheckCircle2 size={15} className="text-emerald-600 shrink-0" />
                  ) : (
                    <XCircle size={15} className="text-red-500 shrink-0" />
                  )}
                  <span className="text-xs text-gray-700">
                    Guru &amp; Kode Staf FET:{' '}
                    <strong className={prerequisiteStatus.checks.hasFetStaffId ? 'text-gray-900' : 'text-amber-800'}>
                      {prerequisiteStatus.counts.fetTeacherCount} / {prerequisiteStatus.counts.teacherCount} guru
                    </strong>
                  </span>
                </div>
                {!prerequisiteStatus.checks.hasFetStaffId && (
                  <Button
                    variant="outline"
                    size="sm"
                    icon={ExternalLink}
                    onClick={() => navigate('/web/master-data')}
                  >
                    Lengkapi FET ID
                  </Button>
                )}
              </div>
            </div>

            {/* Zero-Manual Policy Note */}
            <div className="upload-prerequisite-note">
              <Info size={14} className="text-gray-400 shrink-0 mt-0.5" />
              <p className="text-[11px] text-gray-500 m-0 leading-relaxed">
                <strong>Kebijakan Zero-Manual v4.5:</strong> Master Ruangan dan Mata Pelajaran tidak perlu diinput manual. Sistem akan mengekstrak dan mendaftarkannya secara otomatis saat berkas PDF diproses.
              </p>
            </div>
          </section>
        )
      )}

      {/* Error alert if any */}
      {errorMessage && (
        <div className="p-3 mb-6 bg-red-50 border border-red-200 rounded-lg text-red-700 text-xs flex items-start gap-2">
          <AlertCircle size={16} className="shrink-0 mt-0.5 text-red-600" />
          <div>
            <strong>Gagal Memulai Import:</strong>
            <p className="mt-0.5">{errorMessage}</p>
          </div>
        </div>
      )}

      {/* Main Upload Card */}
      <div className="upload-flat-card">
        {/* Section 1: Target Putaran */}
        <div className="upload-section">
          <h2 className="upload-section-title">1. Target Putaran Jadwal</h2>
          <p className="upload-section-desc">
            Pilih putaran jadwal yang akan diperbarui atau digantikan dengan data baru dari berkas PDF ini.
          </p>

          <div className="inline-flex items-center bg-gray-100 p-1 rounded-md gap-1">
            <button
              type="button"
              disabled={isProcessing}
              className={`px-4 py-2 rounded text-[13px] transition-all cursor-pointer ${
                selectedCycle === 1
                  ? 'bg-white text-gray-900 shadow-xs font-semibold'
                  : 'text-gray-600 hover:text-gray-900 font-normal'
              }`}
              onClick={() => setSelectedCycle(1)}
            >
              Putaran 1 (Ganjil / Genap)
            </button>
            <button
              type="button"
              disabled={isProcessing}
              className={`px-4 py-2 rounded text-[13px] transition-all cursor-pointer ${
                selectedCycle === 2
                  ? 'bg-white text-gray-900 shadow-xs font-semibold'
                  : 'text-gray-600 hover:text-gray-900 font-normal'
              }`}
              onClick={() => setSelectedCycle(2)}
            >
              Putaran 2 (Ganjil / Genap)
            </button>
          </div>
        </div>

        {/* Section 2: Upload File Ganda */}
        <div className="upload-section">
          <h2 className="upload-section-title">2. Unggah Berkas PDF Jadwal FET</h2>
          <p className="upload-section-desc">
            Sistem membutuhkan sepasang berkas hasil ekspor resmi FET 5.44.9: berkas jadwal per kelas dan matriks per ruangan.
          </p>

          <div className="upload-grid">
            {/* Berkas 1: Jadwal_Kelas.pdf */}
            <div className="upload-zone-wrapper">
              <div className="flex items-center justify-between">
                <span className="upload-zone-title">Berkas 1: Jadwal per Kelas</span>
                <Badge variant="default">Wajib</Badge>
              </div>
              <p className="upload-zone-hint">
                Format: <code>Jadwal_Kelas.pdf</code> (memuat alokasi jam, guru pengampu, durasi JP, dan rombel).
              </p>
              <FileUpload
                accept=".pdf"
                maxSizeMB={10}
                file={classScheduleFile}
                onChange={setClassScheduleFile}
                disabled={isProcessing}
                hint="Format berkas PDF resmi FET, maks 10MB"
              />
            </div>

            {/* Berkas 2: Jadwal_Ruangan.pdf */}
            <div className="upload-zone-wrapper">
              <div className="flex items-center justify-between">
                <span className="upload-zone-title">Berkas 2: Matriks Alokasi Ruangan</span>
                <Badge variant="default">Wajib</Badge>
              </div>
              <p className="upload-zone-hint">
                Format: <code>Jadwal_Ruangan.pdf</code> (memuat alokasi fisik ruangan laboratorium, teori, dan bengkel).
              </p>
              <FileUpload
                accept=".pdf"
                maxSizeMB={10}
                file={roomScheduleFile}
                onChange={setRoomScheduleFile}
                disabled={isProcessing}
                hint="Format berkas PDF resmi FET, maks 10MB"
              />
            </div>
          </div>
        </div>

        {/* Section 3: Action Buttons or Progress Bar */}
        {processStatus === 'idle' && (
          <div className="upload-submit-row">
            <Button
              variant="primary"
              icon={Upload}
              disabled={!isFormValid || !prerequisiteStatus?.isReady}
              onClick={handleStartImport}
            >
              Mulai Proses Impor &amp; Ekstraksi
            </Button>
            <span className="text-xs text-gray-400">
              {!prerequisiteStatus?.isReady
                ? 'Lengkapi prasyarat Master Data (Siswa & Guru ber-FET) terlebih dahulu.'
                : isFormValid
                ? 'Kedua berkas siap diproses.'
                : 'Pilih kedua berkas PDF untuk mengaktifkan tombol impor.'}
            </span>
          </div>
        )}

        {/* Progress Box during upload & parsing */}
        {isProcessing && (
          <div className="upload-progress-box">
            <div className="upload-progress-header">
              <div className="flex items-center gap-2">
                <RefreshCw size={15} className="animate-spin text-gray-700" />
                <span className="upload-progress-title">Sedang Memproses Dokumen...</span>
              </div>
              <span className="text-xs font-mono text-gray-500">{progressValue}%</span>
            </div>

            <ProgressBar value={progressValue} showValue={false} color="accent" />

            <p className="text-xs text-gray-600 m-0">{statusMessage}</p>
          </div>
        )}

        {/* Complete State: Preview Ready */}
        {processStatus === 'preview_ready' && (
          <div className="upload-progress-box">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <CheckCircle2 size={18} className="text-emerald-600" />
                <span className="text-sm font-semibold text-gray-900">
                  Parsing Selesai — Preview Siap Ditinjau
                </span>
              </div>
              <Badge variant="success">Status: Preview Ready</Badge>
            </div>

            <p className="text-xs text-gray-600 m-0">
              Dokumen PDF berhasil diekstraksi ke antrean staging. Lanjutkan ke halaman peninjauan untuk memeriksa kecocokan data dan menyelesaikan baris yang belum terpetakan.
            </p>

            <div className="upload-ready-action-row">
              <Button variant="secondary" icon={RefreshCw} onClick={handleResetUpload}>
                Unggah Berkas Lain
              </Button>
              <Button
                variant="primary"
                icon={ArrowRight}
                disabled={!uploadedBatchId}
                onClick={() => {
                  if (uploadedBatchId) {
                    navigate(`/kurikulum/jadwal/import/${uploadedBatchId}`);
                  }
                }}
              >
                Buka Halaman Tinjauan &amp; Resolusi
              </Button>
            </div>
          </div>
        )}
      </div>

      {/* Info Notice Box */}
      <aside className="mt-6 p-4 bg-gray-50 border border-gray-200 rounded-lg flex items-start gap-3 text-xs text-gray-600">
        <HelpCircle size={16} className="text-gray-400 shrink-0 mt-0.5" />
        <div className="leading-relaxed">
          <strong className="text-gray-900">Catatan Keamanan &amp; Integritas Impor:</strong>
          <p className="mt-0.5">
            Proses unggah tidak langsung menimpa jadwal aktif. Sistem terlebih dahulu menyimpan hasil ekstraksi pada tabel penampung sementara (*staging*). Anda dapat meninjau, menyelesaikan konflik, dan memverifikasi kata sandi sebelum jadwal baru diterapkan secara resmi.
          </p>
        </div>
      </aside>
    </div>
  );
}
