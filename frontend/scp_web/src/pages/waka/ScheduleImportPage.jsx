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
  Sparkles,
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
  ConfirmDialog,
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
import { unwrapList, unwrapPagination } from '../../utils/responseHelper';
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
  } else if (matchStatus === 'conflict' || r.status === 'Conflict') {
    normalizedStatus = 'Conflict';
  } else if (isDuplicateOrExcluded) {
    normalizedStatus = 'Excluded';
  } else {
    // Normalization: jika semua 4 entitas (guru, kelas, mapel, ruangan) telah lengkap terpetakan
    // dan tidak mengalami konflik/tabrakan benturan waktu, baris ini otomatis tergolong Matched.
    const hasAllEntities = Boolean(
      (r.matched_class_id || r.matched_class?.id) &&
      (r.matched_teacher_id || r.matched_teacher?.id) &&
      (r.matched_subject_id || r.matched_subject?.id) &&
      (r.matched_room_id || r.matched_room?.id)
    );
    if (hasAllEntities && matchStatus !== 'conflict' && r.status !== 'Conflict') {
      normalizedStatus = 'Matched';
    } else {
      normalizedStatus = 'Unmatched';
    }
  }

  const isMatchedRow = normalizedStatus === 'Matched';
  const issueDetail = isMatchedRow ? null : (r.issue_detail || raw.issue_detail || null);
  const recommendations = isMatchedRow ? null : (r.recommendations || raw.recommendations || null);

  return {
    id: r.id,
    day: NUMBER_TO_DAY[r.day_of_week] || r.day || r.day_of_week_text || 'Senin',
    day_of_week: r.day_of_week,
    period_number: r.period_number || raw.period_number || 1,
    duration_periods: r.duration_periods || raw.duration_periods || 1,
    className: r.matched_class?.name || raw.kelas_mentah || r.className || 'Kelas Belum Terpetakan',
    teacherNip: r.matched_teacher?.nis_nip || r.matched_teacher?.nip || '-',
    teacherFetId: '-',
    teacherName: r.matched_teacher?.name || raw.guru_mentah || r.teacherName || 'Guru Belum Terpetakan',
    teacherRawName: raw.guru_mentah || raw.teacher || null,
    teacherCandidates: raw.teacher_candidates || recommendations?.teacher_candidates || [],
    subjectName: r.matched_subject?.name || raw.mapel_mentah || r.subjectName || 'Mata Pelajaran Belum Terpetakan',
    roomName: r.matched_room?.name || raw.ruang_final || r.roomName || 'Ruang Belum Terpetakan',
    status: normalizedStatus,
    match_status: matchStatus,
    is_excluded: isDuplicateOrExcluded,
    is_manual: Boolean(r.resolved_by_waka || r.is_manual),
    room_source_conflict: isMatchedRow ? false : Boolean(r.room_source_conflict),
    raw_data: raw,
    issue_detail: issueDetail,
    recommendations: recommendations,
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

  // Redirection guard: Jika rute /review dibuka tanpa parameter ID, arahkan ke halaman upload
  useEffect(() => {
    if (location.pathname.includes('/review') && !paramId) {
      navigate('/web/schedule-import', { replace: true });
    }
  }, [location.pathname, paramId, navigate]);

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
  const [reviewBatchStatus, setReviewBatchStatus] = useState(null); // 'uploaded' | 'parsing' | 'preview_ready' | 'failed' | 'confirmed'
  const [reviewErrorMessage, setReviewErrorMessage] = useState('');
  const [ignoredRowIds, setIgnoredRowIds] = useState(new Set());
  const [activeTab, setActiveTab] = useState('all'); // 'all' | 'unmatched' | 'conflict' | 'matched' | 'ignored'

  // Master datasets for resolution dropdowns
  const [classList, setClassList] = useState([]);
  const [roomList, setRoomList] = useState([]);
  const [subjectList, setSubjectList] = useState([]);
  const [teacherList, setTeacherList] = useState([]);
  const [masterDataTruncationWarnings, setMasterDataTruncationWarnings] = useState([]);

  // Resolution modal state
  const [editingRow, setEditingRow] = useState(null);
  const [liveRecommendations, setLiveRecommendations] = useState(null);
  const [loadingRecommendations, setLoadingRecommendations] = useState(false);
  const [overrideConflict, setOverrideConflict] = useState(false);
  const [resolutionWarning, setResolutionWarning] = useState('');
  const [isSavingResolution, setIsSavingResolution] = useState(false);
  const [applyToSameTeacher, setApplyToSameTeacher] = useState(true);
  const [resolvedForm, setResolvedForm] = useState({
    class_id: '',
    teacher_id: '',
    room_id: '',
    subject_id: '',
  });

  // Bulk teacher resolution state
  const [isBulkTeacherModalOpen, setIsBulkTeacherModalOpen] = useState(false);
  const [bulkTeacherMappings, setBulkTeacherMappings] = useState({});
  const [isSubmittingBulkTeachers, setIsSubmittingBulkTeachers] = useState(false);
  const [bulkTeacherFeedback, setBulkTeacherFeedback] = useState(null);

  // Commit / Password modal state
  const [isPasswordModalOpen, setIsPasswordModalOpen] = useState(false);
  const [isCommitting, setIsCommitting] = useState(false);
  const [commitError, setCommitError] = useState('');
  const [commitSuccess, setCommitSuccess] = useState(false);

  // Cancel / Rollback modal state
  const [isCancelModalOpen, setIsCancelModalOpen] = useState(false);
  const [isCancelling, setIsCancelling] = useState(false);
  const [cancelBatchTargetId, setCancelBatchTargetId] = useState(null);

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

        const studentData = studentRes.status === 'fulfilled' ? unwrapPagination(studentRes.value) : { items: [], meta: null };
        const teacherData = teacherRes.status === 'fulfilled' ? unwrapPagination(teacherRes.value) : { items: [], meta: null };

        const students = studentData.items;
        const totalStudents = studentData.meta?.total ?? students.length;

        const teachers = teacherData.items;
        const totalTeachers = teacherData.meta?.total ?? teachers.length;

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

  // Load master datasets for resolution dropdowns (P-10: per_page: 100 + truncation indicator)
  useEffect(() => {
    let isMounted = true;

    async function loadMasterData() {
      try {
        const [cRes, rRes, sRes, tRes] = await Promise.allSettled([
          classApi.getClasses({ all: 1, per_page: 100 }),
          roomApi.getRooms({ per_page: 100 }),
          subjectApi.getSubjects({ per_page: 100 }),
          teacherApi.getTeachers({ per_page: 100 }),
        ]);
        if (isMounted) {
          const warnings = [];

          if (cRes.status === 'fulfilled') {
            const { items, meta } = unwrapPagination(cRes.value);
            setClassList(items);
            if (meta && meta.total > items.length) {
              warnings.push(`Kelas (${items.length}/${meta.total})`);
            }
          }
          if (rRes.status === 'fulfilled') {
            const { items, meta } = unwrapPagination(rRes.value);
            setRoomList(items);
            if (meta && meta.total > items.length) {
              warnings.push(`Ruangan (${items.length}/${meta.total})`);
            }
          }
          if (sRes.status === 'fulfilled') {
            const { items, meta } = unwrapPagination(sRes.value);
            setSubjectList(items);
            if (meta && meta.total > items.length) {
              warnings.push(`Mata Pelajaran (${items.length}/${meta.total})`);
            }
          }
          if (tRes.status === 'fulfilled') {
            const { items, meta } = unwrapPagination(tRes.value);
            setTeacherList(items);
            if (meta && meta.total > items.length) {
              warnings.push(`Guru (${items.length}/${meta.total})`);
            }
          }

          setMasterDataTruncationWarnings(warnings);
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
    let pollTimeout = null;

    async function loadReviewData() {
      setReviewLoading(true);
      try {
        const res = await scheduleImportApi.getImportDetail(activeBatchId);
        if (isMounted && res?.data) {
          const currentStatus = res.data.status;
          setReviewBatchStatus(currentStatus);
          setReviewErrorMessage(res.data.error_message || res.message || '');

          // Jika job masih diproses oleh worker di background, lakukan polling otomatis
          if (currentStatus === 'uploaded' || currentStatus === 'parsing') {
            pollTimeout = setTimeout(loadReviewData, 2500);
            return;
          }

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
        if (isMounted) {
          setReviewBatchStatus('failed');
          setReviewErrorMessage(err?.response?.data?.message || err?.message || 'Gagal memuat pratinjau impor.');
        }
      } finally {
        if (isMounted) {
          setReviewLoading(false);
        }
      }
    }

    loadReviewData();

    return () => {
      isMounted = false;
      if (pollTimeout) {
        clearTimeout(pollTimeout);
      }
    };
  }, [activeBatchId]);

  // Polling clear helper (P-7: aman untuk setTimeout maupun setInterval)
  const clearPolling = () => {
    if (pollingRef.current) {
      clearInterval(pollingRef.current);
      clearTimeout(pollingRef.current);
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

      if (res.data?.status === 'preview_ready') {
        clearPolling();
        setProgressValue(100);
        setProcessStatus('preview_ready');
        setStatusMessage('Ekstraksi selesai! Data siap ditinjau dan divalidasi.');
        return;
      }

      setProgressValue(50);
      setProcessStatus('parsing');
      setStatusMessage('Berkas diterima. Memproses ekstraksi koordinat FET...');

      // P-7: Polling adaptif bertahap (2s -> 3.5s -> 5s) dengan cek visibilityState & jitter
      const runAdaptivePoll = async () => {
        // Tunda polling bila tab diminimalkan / tidak aktif agar tidak membebani server
        if (typeof document !== 'undefined' && document.hidden) {
          pollingRef.current = setTimeout(runAdaptivePoll, 3000);
          return;
        }

        pollingCountRef.current += 1;

        if (pollingCountRef.current > 40) {
          clearPolling();
          setProcessStatus('error');
          setErrorMessage(
            'Proses ekstraksi memakan waktu lebih lama dari biasanya (melebihi batas waktu 120 detik). Anda dapat memeriksa halaman tinjauan secara manual atau mencoba kembali.'
          );
          return;
        }

        try {
          const checkRes = await scheduleImportApi.getImportDetail(importedId);
          const currentStatus = checkRes?.data?.status;

          if (currentStatus === 'preview_ready') {
            clearPolling();
            setProgressValue(100);
            setProcessStatus('preview_ready');
            setStatusMessage('Ekstraksi selesai! Data siap ditinjau dan divalidasi.');
            return;
          } else if (currentStatus === 'failed') {
            clearPolling();
            setProcessStatus('error');
            setErrorMessage(
              checkRes?.message ||
                'Proses ekstraksi berkas PDF gagal. Pastikan format tabel sesuai dengan ekspor FET.'
            );
            return;
          } else {
            setProgressValue((prev) => Math.min(prev + 5, 92));
            setStatusMessage('Mencocokkan entri kelas, guru, dan alokasi fisik ruangan...');
          }
        } catch {
          // Abaikan kegagalan sementara saat polling transport
        }

        // Hitung interval adaptif berdasarkan iterasi + jitter (±200ms)
        const count = pollingCountRef.current;
        let nextInterval = count <= 5 ? 2000 : count <= 12 ? 3500 : 5000;
        nextInterval += Math.floor(Math.random() * 400) - 200;

        pollingRef.current = setTimeout(runAdaptivePoll, nextInterval);
      };

      pollingRef.current = setTimeout(runAdaptivePoll, 1500);
    } catch (apiErr) {
      clearPolling();
      setProcessStatus('error');
      if (apiErr.status === 422 || apiErr.response?.status === 422) {
        setErrorMessage(
          apiErr.response?.data?.message ||
            apiErr.message ||
            'Prasyarat Master Data belum terpenuhi. Pastikan data siswa dan guru aktif sudah terdaftar di sistem.'
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

  // Group unmapped teachers from PDF that have candidates
  const unmappedTeachersWithCandidates = useMemo(() => {
    const map = new Map();
    rows.forEach((r) => {
      const isIgnored = ignoredRowIds.has(r.id) || r.is_excluded;
      if (!r.matched_teacher_id && !isIgnored) {
        const rawName = r.teacherRawName || r.raw_data?.guru_mentah || r.raw_data?.teacher;
        if (rawName && rawName.trim() !== '') {
          if (!map.has(rawName)) {
            map.set(rawName, {
              raw_teacher_name: rawName,
              count: 0,
              candidates: r.teacherCandidates || r.raw_data?.teacher_candidates || [],
            });
          }
          map.get(rawName).count += 1;
        }
      }
    });
    return Array.from(map.values());
  }, [rows, ignoredRowIds]);

  const handleOpenBulkTeacherModal = () => {
    const initial = {};
    unmappedTeachersWithCandidates.forEach((item) => {
      const candidateId = item.candidates?.[0]?.id || teacherList[0]?.id || '';
      initial[item.raw_teacher_name] = String(candidateId);
    });
    setBulkTeacherMappings(initial);
    setBulkTeacherFeedback(null);
    setIsBulkTeacherModalOpen(true);
  };

  const handleSaveBulkTeachers = async () => {
    const currentId = activeBatchId || uploadedBatchId;
    if (!currentId || isNaN(Number(currentId))) return;

    const mappings = Object.entries(bulkTeacherMappings)
      .filter(([_, teacherId]) => Boolean(teacherId))
      .map(([raw_teacher_name, teacher_id]) => ({
        raw_teacher_name,
        teacher_id: Number(teacher_id),
      }));

    if (mappings.length === 0) return;

    setIsSubmittingBulkTeachers(true);
    setBulkTeacherFeedback(null);

    try {
      const res = await scheduleImportApi.resolveTeachersBulk(currentId, { mappings });
      if (res?.data) {
        const detailRes = await scheduleImportApi.getImportDetail(currentId);
        if (detailRes?.data?.rows) {
          setRows(detailRes.data.rows.map(mapImportRow));
        }
        setIsBulkTeacherModalOpen(false);
      }
    } catch (err) {
      console.error('Gagal menyelaraskan guru massal:', err);
      setBulkTeacherFeedback({
        type: 'error',
        message: err.response?.data?.message || 'Gagal menyimpan penyelarasan guru.',
      });
    } finally {
      setIsSubmittingBulkTeachers(false);
    }
  };

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
    setOverrideConflict(Boolean(row.raw_data?.overridden_by_waka));
    setResolutionWarning('');
    setLiveRecommendations(row.recommendations || row.raw_data?.recommendations || null);

    const matchingClass = classList.find((c) => c.name.toLowerCase() === row.className.toLowerCase());
    const matchingTeacher = teacherList.find(
      (t) => t.id === row.matched_teacher_id || t.name.toLowerCase() === (row.teacherName || '').toLowerCase()
    );
    const matchingRoom = roomList.find((r) => r.name.toLowerCase() === row.roomName.toLowerCase());
    const matchingSubject = subjectList.find(
      (s) => s.name.toLowerCase() === row.subjectName.toLowerCase()
    );

    const topCandidateId =
      !row.matched_teacher_id && row.teacherCandidates && row.teacherCandidates.length > 0
        ? row.teacherCandidates[0].id
        : null;

    setResolvedForm({
      class_id: row.matched_class_id || matchingClass?.id || classList[0]?.id || '',
      teacher_id: row.matched_teacher_id || topCandidateId || matchingTeacher?.id || teacherList[0]?.id || '',
      room_id: row.matched_room_id || matchingRoom?.id || roomList[0]?.id || '',
      subject_id: row.matched_subject_id || matchingSubject?.id || subjectList[0]?.id || '',
    });
    setApplyToSameTeacher(true);

    const currentId = activeBatchId || uploadedBatchId;
    if (currentId && !isNaN(Number(currentId))) {
      setLoadingRecommendations(true);
      scheduleImportApi
        .getRowRecommendations(currentId, row.id)
        .then((res) => {
          if (res?.data?.data) {
            setLiveRecommendations(res.data.data);
            if (res.data.data.issue_detail) {
              setEditingRow((prev) => (prev ? { ...prev, issue_detail: res.data.data.issue_detail } : prev));
            }
          }
        })
        .catch((err) => {
          console.warn('Gagal memuat rekomendasi live:', err);
        })
        .finally(() => {
          setLoadingRecommendations(false);
        });
    }
  };

  const handleSaveResolution = async () => {
    if (!editingRow) return;
    setIsSavingResolution(true);
    setResolutionWarning('');

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
          override_conflict: true, // Resolusi manual Waka selalu menyetujui pemetaan dan menandai status Matched
          apply_to_same_teacher_raw: applyToSameTeacher,
        });

        if (res?.data) {
          try {
            const detailRes = await scheduleImportApi.getImportDetail(currentId);
            if (detailRes?.data?.rows) {
              setRows(detailRes.data.rows.map(mapImportRow));
            } else {
              const updatedRow = mapImportRow(res.data);
              setRows((prev) => prev.map((r) => (r.id === editingRow.id ? updatedRow : r)));
            }
          } catch {
            const updatedRow = mapImportRow(res.data);
            setRows((prev) => prev.map((r) => (r.id === editingRow.id ? updatedRow : r)));
          }

          if (ignoredRowIds.has(editingRow.id)) {
            const next = new Set(ignoredRowIds);
            next.delete(editingRow.id);
            setIgnoredRowIds(next);
          }

          setEditingRow(null);
        }
      } catch (err) {
        console.error('Gagal menyimpan resolusi baris:', err);
        setResolutionWarning(
          err?.response?.data?.message || 'Terjadi kesalahan saat menyimpan perubahan. Silakan coba lagi.'
        );
      } finally {
        setIsSavingResolution(false);
      }
    } else {
      setRows((prev) =>
        prev.map((r) =>
          r.id === editingRow.id
            ? {
                ...r,
                className: selectedClass?.name || r.className,
                teacherName: selectedTeacher?.name || r.teacherName,
                teacherNip: selectedTeacher?.nis_nip || selectedTeacher?.nip || r.teacherNip,
                roomName: selectedRoom?.name || r.roomName,
                subjectName: selectedSubject?.name || r.subjectName,
                status: 'Matched',
                is_excluded: false,
              }
            : r
        )
      );
      setEditingRow(null);
      setIsSavingResolution(false);
    }
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

  // Open cancel confirmation dialog
  const handleTriggerCancel = (batchId = null) => {
    const target = batchId || activeBatchId || uploadedBatchId || draftBatchId;
    setCancelBatchTargetId(target);
    setIsCancelModalOpen(true);
  };

  // Execute cancel and rollback after confirmation
  const handleExecuteCancel = async () => {
    const targetId = cancelBatchTargetId || activeBatchId || uploadedBatchId || draftBatchId;
    setIsCancelling(true);
    try {
      if (targetId && !isNaN(Number(targetId))) {
        await scheduleImportApi.cancelImport(targetId);
      }
    } catch (err) {
      console.error('Gagal membatalkan draf import:', err);
    } finally {
      try {
        sessionStorage.removeItem('scp_last_schedule_import_id');
      } catch {
        // Ignore
      }
      setDraftBatchId(null);
      setUploadedBatchId(null);
      setRows([]);
      setIsCancelling(false);
      setIsCancelModalOpen(false);
      setCancelBatchTargetId(null);
      handleResetUpload();
      navigate('/web/schedules');
    }
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
      label: 'Guru Pengampu',
      renderCell: (r) => {
        const hasSuggestion = !r.matched_teacher_id && r.teacherCandidates && r.teacherCandidates.length > 0;
        const topCandidate = hasSuggestion ? r.teacherCandidates[0] : null;

        return (
          <div className="flex flex-col items-start gap-0.5">
            <span className="text-xs text-gray-900 font-medium">{r.teacherName}</span>
            {r.teacherNip && r.teacherNip !== '-' && (
              <span className="font-mono text-[11px] text-gray-400">NIP: {r.teacherNip}</span>
            )}
            {hasSuggestion && (
              <span className="inline-flex items-center gap-1 text-[11px] text-amber-800 bg-amber-50 px-1.5 py-0.5 rounded border border-amber-200 mt-0.5">
                <Sparkles size={11} className="text-amber-600 shrink-0" />
                <span>Saran: {topCandidate.name} ({topCandidate.similarity}%)</span>
              </span>
            )}
          </div>
        );
      },
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
        </div>
      ),
    },
    {
      key: 'status',
      label: 'Status & Diagnosa',
      align: 'left',
      renderCell: (r) => {
        const isIgnored = ignoredRowIds.has(r.id) || r.is_excluded;
        if (isIgnored) {
          return <Badge variant="neutral">Diabaikan</Badge>;
        }
        if (r.status === 'Matched') {
          return (
            <div className="flex flex-col items-start gap-0.5">
              <Badge variant="success">Matched</Badge>
              {r.is_manual && (
                <span className="text-[10px] text-emerald-700 font-medium">Disesuaikan manual</span>
              )}
            </div>
          );
        }
        if (r.status === 'Conflict') {
          const hasAltRooms = (r.recommendations?.alternative_rooms?.length || 0) > 0;
          return (
            <div className="flex flex-col items-start gap-1">
              <div className="flex items-center gap-1">
                <Badge variant="warning">Conflict</Badge>
                {hasAltRooms && (
                  <span className="text-[10px] text-emerald-800 font-semibold bg-emerald-50 px-1 py-0.2 rounded border border-emerald-200">
                    💡 Opsi Ruang
                  </span>
                )}
              </div>
              {r.issue_detail?.title && (
                <span className="text-[10px] text-amber-900 font-medium bg-amber-50 px-1.5 py-0.5 rounded border border-amber-200 leading-tight">
                  {r.issue_detail.title}
                </span>
              )}
            </div>
          );
        }
        return (
          <div className="flex flex-col items-start gap-1">
            <Badge variant="error">Unmatched</Badge>
            {r.issue_detail?.title && (
              <span className="text-[10px] text-rose-800 font-medium bg-rose-50 px-1.5 py-0.5 rounded border border-rose-200 leading-tight">
                {r.issue_detail.title}
              </span>
            )}
          </div>
        );
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
    // 1. Initial Loading State
    if (reviewLoading && !reviewBatchStatus) {
      return (
        <div className="schedule-import-container flex flex-col items-center justify-center min-h-[400px] gap-4">
          <RefreshCw size={28} className="animate-spin text-amber-500" />
          <p className="text-sm font-medium text-gray-700">Memuat data pratinjau impor jadwal...</p>
        </div>
      );
    }

    // 2. Berkas Sedang Diproses Worker di Background (Mencegah Preview Kosong Sebelum Parsing Selesai)
    if (reviewBatchStatus === 'uploaded' || reviewBatchStatus === 'parsing') {
      return (
        <div className="schedule-import-container">
          <div className="p-8 bg-white border border-gray-200 rounded-xl shadow-sm text-center max-w-xl mx-auto my-12">
            <div className="flex justify-center mb-4">
              <RefreshCw size={36} className="animate-spin text-amber-500" />
            </div>
            <h2 className="text-lg font-bold text-gray-900 mb-2">Dokumen Sedang Diekstraksi &amp; Dipetakan</h2>
            <p className="text-xs text-gray-600 mb-6 leading-relaxed">
              Antrean server sedang memproses dokumen PDF jadwal FET (Batch #{activeBatchId}) serta mencocokkan guru, rombel kelas, dan alokasi fisik ruangan. Halaman ini akan diperbarui secara otomatis begitu ekstraksi siap ditinjau.
            </p>
            <div className="flex justify-center gap-3">
              <Button
                variant="danger"
                onClick={() => handleTriggerCancel(activeBatchId)}
              >
                Batalkan Impor
              </Button>
              <Button
                variant="outline"
                onClick={() => navigate('/web/schedules')}
              >
                Kembali ke Manajemen Jadwal
              </Button>
            </div>
          </div>
        </div>
      );
    }

    // 3. Ekstraksi Gagal
    if (reviewBatchStatus === 'failed') {
      return (
        <div className="schedule-import-container">
          <div className="p-8 bg-red-50 border border-red-200 rounded-xl shadow-sm text-center max-w-xl mx-auto my-12">
            <div className="flex justify-center mb-4">
              <XCircle size={40} className="text-red-500" />
            </div>
            <h2 className="text-lg font-bold text-red-900 mb-2">Proses Ekstraksi Berkas PDF Gagal</h2>
            <p className="text-xs text-red-700 mb-6 leading-relaxed">
              {reviewErrorMessage || 'Format tabel PDF tidak sesuai dengan ketentuan FET Timetable atau berkas rusak. Silakan pastikan kedua berkas PDF valid.'}
            </p>
            <div className="flex justify-center gap-3">
              <Button
                variant="primary"
                onClick={() => navigate('/web/schedule-import')}
              >
                Unggah Ulang Berkas
              </Button>
              <Button
                variant="outline"
                onClick={() => navigate('/web/schedules')}
              >
                Kembali ke Manajemen Jadwal
              </Button>
            </div>
          </div>
        </div>
      );
    }

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
              variant="danger"
              onClick={() => handleTriggerCancel(activeBatchId)}
            >
              Batalkan Impor
            </Button>
            <Button
              variant="outline"
              onClick={() => navigate('/web/schedule-import')}
            >
              Unggah Ulang
            </Button>
            <Button
              variant="primary"
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
          <div className="review-stat-flat-card accent-border-top--neutral">
            <div className="review-stat-card-top">
              <span className="review-stat-label">Total Entri Jadwal</span>
              <Badge variant="neutral" dot>Semua</Badge>
            </div>
            <div className="review-stat-value font-mono">{stats.total}</div>
            <p className="review-stat-desc">Total slot jadwal diekstrak dari kedua dokumen PDF.</p>
          </div>

          <div className="review-stat-flat-card accent-border-top--success">
            <div className="review-stat-card-top">
              <span className="review-stat-label">Baris Cocok (Matched)</span>
              <Badge variant="success" dot>Siap Komit</Badge>
            </div>
            <div className="review-stat-value text-emerald-700 font-mono">{stats.matched}</div>
            <p className="review-stat-desc">Kelas, guru, mapel, dan ruangan terpetakan 100%.</p>
          </div>

          <div className="review-stat-flat-card accent-border-top--danger">
            <div className="review-stat-card-top">
              <span className="review-stat-label">Belum Cocok (Unmatched)</span>
              <Badge variant="error" dot>{stats.unmatched} Perlu Aksi</Badge>
            </div>
            <div className="review-stat-value text-red-700 font-mono">{stats.unmatched}</div>
            <p className="review-stat-desc">Perlu dipetakan manual atau diabaikan sebelum komit.</p>
          </div>

          <div className="review-stat-flat-card accent-border-top--warning">
            <div className="review-stat-card-top">
              <span className="review-stat-label">Konflik Tabrakan (Conflict)</span>
              <Badge variant="warning" dot>{stats.conflict} Bentrok</Badge>
            </div>
            <div className="review-stat-value text-amber-700 font-mono">{stats.conflict}</div>
            <p className="review-stat-desc">Alokasi ruang atau guru bentrok pada slot bersamaan.</p>
          </div>
        </div>

        {/* Banner Penyelarasan Massal Guru PDF */}
        {unmappedTeachersWithCandidates.length > 0 && (
          <div className="mb-4 p-4 bg-gradient-to-r from-amber-50 to-orange-50 border border-amber-300 rounded-xl shadow-xs flex flex-col md:flex-row items-start md:items-center justify-between gap-3">
            <div className="flex items-start gap-3">
              <div className="p-2 bg-amber-100 rounded-lg text-amber-700 shrink-0">
                <Sparkles size={20} />
              </div>
              <div>
                <h3 className="text-sm font-bold text-amber-950 m-0">
                  Ditemukan {unmappedTeachersWithCandidates.length} Guru di PDF dengan Ejaan atau Gelar Berbeda
                </h3>
                <p className="text-xs text-amber-800 mt-0.5 mb-0">
                  Terdapat {unmappedTeachersWithCandidates.reduce((acc, curr) => acc + curr.count, 0)} jam pelajaran yang belum terpetakan namun memiliki rekomendasi kemiripan di Master Guru. Anda dapat menyelaraskannya sekaligus dengan satu klik.
                </p>
              </div>
            </div>
            <Button
              variant="primary"
              size="sm"
              className="shrink-0 bg-amber-600 hover:bg-amber-700 border-amber-700 text-white font-medium cursor-pointer"
              icon={Wrench}
              onClick={handleOpenBulkTeacherModal}
            >
              Cocokkan {unmappedTeachersWithCandidates.length} Guru Sekaligus
            </Button>
          </div>
        )}

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
          <Button variant="danger" icon={Ban} onClick={() => handleTriggerCancel(activeBatchId)}>
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
          size="lg"
          footer={
            <div className="flex items-center justify-end w-full gap-2">
              <Button variant="secondary" onClick={() => setEditingRow(null)} disabled={isSavingResolution}>
                Batal
              </Button>
              <Button
                variant="primary"
                icon={Check}
                loading={isSavingResolution}
                onClick={handleSaveResolution}
              >
                Simpan & Tandai Matched
              </Button>
            </div>
          }
        >
          {editingRow && (
            <div className="flex flex-col gap-4 text-xs">
              {/* Alert Peringatan Benturan Masih Ada */}
              {resolutionWarning && (
                <div className="p-3 bg-rose-50 border-2 border-rose-400 rounded-lg flex items-start gap-2.5 text-xs text-rose-950">
                  <AlertTriangle size={18} className="text-rose-600 shrink-0 mt-0.5" />
                  <div>
                    <strong className="font-bold text-rose-900 block text-xs">
                      Peringatan: Jadwal Masih Mengalami Konflik!
                    </strong>
                    <p className="mt-0.5 leading-relaxed m-0 text-rose-800">{resolutionWarning}</p>
                  </div>
                </div>
              )}

              {/* 1. Diagnosa Masalah / Penjelasan Konflik & Unmatched */}
              {(editingRow.status === 'Conflict' || editingRow.status === 'Unmatched') && editingRow.issue_detail && (
                <div
                  className={`p-3.5 rounded-lg border flex flex-col gap-1.5 ${
                    editingRow.status === 'Conflict'
                      ? 'bg-rose-50/90 border-rose-300 text-rose-950'
                      : 'bg-amber-50/90 border-amber-300 text-amber-950'
                  }`}
                >
                  <div className="flex items-center gap-2 font-semibold text-xs">
                    {editingRow.status === 'Conflict' ? (
                      <AlertTriangle size={16} className="text-rose-600 shrink-0" />
                    ) : (
                      <AlertCircle size={16} className="text-amber-600 shrink-0" />
                    )}
                    <span>{editingRow.issue_detail?.title || (editingRow.status === 'Conflict' ? 'Terdeteksi Tabrakan Jadwal' : 'Data Belum Terpetakan')}</span>
                    <Badge variant={editingRow.status === 'Conflict' ? 'warning' : 'error'} className="ml-auto text-[10px]">
                      {editingRow.status}
                    </Badge>
                  </div>
                  <p className="text-xs text-gray-700 m-0 leading-relaxed font-normal">
                    {editingRow.issue_detail?.description ||
                      (editingRow.status === 'Conflict'
                        ? 'Terdapat benturan waktu dengan jadwal lain pada hari dan jam yang sama.'
                        : 'Salah satu entitas (kelas, guru, mata pelajaran, atau ruangan) belum berhasil dicocokkan.')}
                  </p>
                  {(liveRecommendations?.action_hint || editingRow.recommendations?.action_hint) && (
                    <div className="flex items-start gap-1.5 mt-1 pt-1.5 border-t border-black/5 text-[11px] text-gray-700">
                      <Info size={13} className="text-blue-600 shrink-0 mt-0.5" />
                      <span>
                        <strong>Petunjuk:</strong>{' '}
                        {liveRecommendations?.action_hint || editingRow.recommendations?.action_hint}
                      </span>
                    </div>
                  )}
                </div>
              )}

              {/* 2. Resolusi Khusus Tabrakan Ruangan (Hanya muncul jika berstatus CONFLICT) */}
              {editingRow.status === 'Conflict' && (() => {
                const diag =
                  liveRecommendations?.room_source_options ||
                  editingRow.recommendations?.room_source_options ||
                  editingRow.issue_detail?.data;
                const altRooms =
                  liveRecommendations?.alternative_rooms ||
                  editingRow.recommendations?.alternative_rooms ||
                  [];

                const isKelasAvailable = diag?.room_kelas?.is_available;
                const roomKelasName = diag?.room_kelas?.name;
                const roomKelasId = diag?.room_kelas?.id;

                return (
                  <div className="flex flex-col gap-3">
                    {/* Opsi Pemulihan: Ruang dari PDF Jadwal Kelas yang terbukti KOSONG */}
                    {isKelasAvailable && roomKelasId && (
                      <div className="p-3 bg-indigo-50/90 border border-indigo-200 rounded-lg flex flex-col gap-2">
                        <div className="flex items-center gap-1.5 text-xs font-semibold text-indigo-950">
                          <Info size={14} className="text-indigo-600 shrink-0" />
                          <span>Opsi Pemulihan dari Berkas PDF Jadwal Kelas:</span>
                        </div>
                        <p className="text-[11px] text-indigo-900 m-0">
                          Jadwal kelas ini mencantumkan ruangan <strong>{roomKelasName}</strong> yang terverifikasi 100% kosong pada jam ini:
                        </p>
                        <div className="flex items-center justify-between p-2.5 bg-white border border-indigo-200 rounded-md">
                          <div>
                            <div className="flex items-center gap-2">
                              <span className="font-mono font-bold text-sm text-gray-900">{roomKelasName}</span>
                              <span className="text-[10px] bg-emerald-100 text-emerald-800 px-1.5 py-0.5 rounded font-semibold">
                                ✓ Tersedia Kosong
                              </span>
                            </div>
                            <span className="text-[11px] text-gray-500">Ruangan dari Jadwal Kelas</span>
                          </div>
                          <button
                            type="button"
                            onClick={() => {
                              setResolvedForm({ ...resolvedForm, room_id: String(roomKelasId) });
                              setResolutionWarning('');
                            }}
                            className={`px-3 py-1.5 text-xs font-medium rounded transition-colors cursor-pointer ${
                              String(resolvedForm.room_id) === String(roomKelasId)
                                ? 'bg-indigo-600 text-white cursor-default'
                                : 'bg-indigo-50 text-indigo-700 border border-indigo-300 hover:bg-indigo-100'
                            }`}
                          >
                            {String(resolvedForm.room_id) === String(roomKelasId) ? '✓ Terpilih' : `Gunakan ${roomKelasName}`}
                          </button>
                        </div>
                      </div>
                    )}

                    {/* Rekomendasi Ruangan Alternatif yang 100% Bebas Benturan */}
                    {altRooms.length > 0 && (
                      <div className="p-3 bg-emerald-50/80 border border-emerald-300 rounded-lg flex flex-col gap-2">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-1.5 text-xs font-semibold text-emerald-950">
                            <Sparkles size={14} className="text-emerald-600 shrink-0" />
                            <span>Rekomendasi Ruangan Alternatif (Bebas Benturan):</span>
                          </div>
                          <span className="text-[10px] text-emerald-800 font-medium">
                            {altRooms.length} Ruangan Kosong
                          </span>
                        </div>
                        <p className="text-[11px] text-emerald-800 m-0">
                          Ruangan berikut telah diverifikasi 100% kosong pada {editingRow.day} Jam Ke-{editingRow.period_number} ({editingRow.duration_periods} JP):
                        </p>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 mt-1">
                          {altRooms.map((alt) => {
                            const isSelected = String(resolvedForm.room_id) === String(alt.room_id);
                            return (
                              <div
                                key={alt.room_id}
                                className={`p-2.5 rounded-md border text-xs flex flex-col justify-between gap-2 transition-all ${
                                  isSelected
                                    ? 'bg-emerald-100/90 border-emerald-500 font-medium shadow-xs ring-1 ring-emerald-400'
                                    : 'bg-white border-emerald-200 hover:border-emerald-300'
                                }`}
                              >
                                <div>
                                  <div className="flex items-center justify-between">
                                    <span className="text-[10px] font-semibold text-emerald-700 uppercase">
                                      {alt.type_label || (alt.category === 'lab' ? 'Laboratorium Komputer' : 'Ruang Teori')}
                                    </span>
                                    <span className="text-[10px] bg-emerald-100 text-emerald-800 px-1 rounded">
                                      ✓ Kosong
                                    </span>
                                  </div>
                                  <div className="text-sm font-bold font-mono text-gray-900 mt-0.5">
                                    {alt.room_name}
                                  </div>
                                  {alt.capacity && (
                                    <div className="text-[10px] text-gray-500">
                                      Kapasitas: {alt.capacity} siswa
                                    </div>
                                  )}
                                </div>
                                <button
                                  type="button"
                                  onClick={() => {
                                    setResolvedForm({ ...resolvedForm, room_id: String(alt.room_id) });
                                    setResolutionWarning('');
                                  }}
                                  className={`w-full py-1 text-[11px] font-medium rounded transition-colors cursor-pointer ${
                                    isSelected
                                      ? 'bg-emerald-600 text-white cursor-default'
                                      : 'bg-white text-emerald-800 border border-emerald-300 hover:bg-emerald-100'
                                  }`}
                                >
                                  {isSelected ? '✓ Terpilih' : 'Gunakan'}
                                </button>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    )}
                  </div>
                );
              })()}

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

              {masterDataTruncationWarnings.length > 0 && (
                <div className="p-3 bg-amber-50 border border-amber-200 rounded-lg flex items-start gap-2 text-xs text-amber-800">
                  <AlertTriangle size={15} className="text-amber-600 shrink-0 mt-0.5" />
                  <div>
                    <span className="font-semibold">Indikator Batas Data Dropdown:</span>
                    <p className="mt-0.5">
                      Data master berikut memiliki lebih dari 100 entri dan dipotong pada pilihan dropdown:{' '}
                      <strong>{masterDataTruncationWarnings.join(', ')}</strong>.
                    </p>
                  </div>
                </div>
              )}

              <Select
                label="Petakan ke Rombel Kelas"
                value={String(resolvedForm.class_id)}
                options={classList.map((c) => ({
                  value: String(c.id),
                  label: `${c.name} (Tingkat ${c.level})`,
                }))}
                onChange={(e) => setResolvedForm({ ...resolvedForm, class_id: e.target.value })}
              />

              {/* Rekomendasi Kandidat Guru jika tersedia */}
              {editingRow.teacherCandidates && editingRow.teacherCandidates.length > 0 && (
                <div className="p-3 bg-amber-50/70 border border-amber-200 rounded-lg flex flex-col gap-2">
                  <div className="flex items-center gap-1.5 text-xs font-semibold text-amber-900">
                    <Sparkles size={14} className="text-amber-600" />
                    <span>Rekomendasi Kemiripan Nama Guru (Master Data):</span>
                  </div>
                  <div className="flex flex-col gap-1.5">
                    {editingRow.teacherCandidates.map((c) => {
                      const isSelected = String(resolvedForm.teacher_id) === String(c.id);
                      return (
                        <div
                          key={c.id}
                          className={`flex items-center justify-between p-2 rounded-md border text-xs transition-colors ${
                            isSelected
                              ? 'bg-amber-100/80 border-amber-400 font-medium text-amber-950'
                              : 'bg-white border-amber-200 hover:bg-amber-50 text-gray-800'
                          }`}
                        >
                          <div className="flex flex-col">
                            <span className="font-semibold text-gray-900">{c.name}</span>
                            <span className="text-[11px] text-gray-500 font-mono">
                              {c.nis_nip ? `NIP: ${c.nis_nip}` : 'NIP: -'} &bull; Kemiripan:{' '}
                              <strong className="text-amber-700">{c.similarity}%</strong> ({c.match_reason})
                            </span>
                          </div>
                          <button
                            type="button"
                            onClick={() => setResolvedForm({ ...resolvedForm, teacher_id: String(c.id) })}
                            className={`px-2.5 py-1 text-[11px] font-medium rounded transition-colors cursor-pointer ${
                              isSelected
                                ? 'bg-amber-600 text-white cursor-default'
                                : 'bg-white text-amber-800 border border-amber-300 hover:bg-amber-100'
                            }`}
                          >
                            {isSelected ? '✓ Terpilih' : 'Pilih Guru Ini'}
                          </button>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              <Select
                label="Petakan ke Guru Pengampu"
                value={String(resolvedForm.teacher_id)}
                options={teacherList.map((t) => ({
                  value: String(t.id),
                  label: `${t.name} ${t.nis_nip ? `[NIP: ${t.nis_nip}]` : ''}`,
                }))}
                onChange={(e) => setResolvedForm({ ...resolvedForm, teacher_id: e.target.value })}
              />

              {/* Opsi Terapkan ke semua baris dengan teks mentah yang sama */}
              {(() => {
                const rawName = editingRow.teacherRawName || editingRow.raw_data?.guru_mentah || editingRow.raw_data?.teacher;
                const sameCount = rows.filter(
                  (r) =>
                    r.id !== editingRow.id &&
                    !r.matched_teacher_id &&
                    (r.teacherRawName || r.raw_data?.guru_mentah || r.raw_data?.teacher) === rawName
                ).length;

                if (sameCount === 0) return null;

                return (
                  <label className="flex items-start gap-2 cursor-pointer text-xs text-gray-700 bg-indigo-50/70 p-2.5 rounded-lg border border-indigo-200">
                    <input
                      type="checkbox"
                      checked={applyToSameTeacher}
                      onChange={(e) => setApplyToSameTeacher(e.target.checked)}
                      className="mt-0.5 rounded border-gray-300 text-indigo-600 focus:ring-indigo-500 h-4 w-4"
                    />
                    <div>
                      <span className="font-semibold text-indigo-950">
                        Terapkan pilihan guru ini ke semua ({sameCount}) baris jadwal lain
                      </span>
                      <p className="text-[11px] text-indigo-800 m-0">
                        Baris dengan teks mentah <code className="bg-indigo-100/70 px-1 py-0.5 rounded font-mono">"{rawName}"</code> akan otomatis menggunakan guru yang dipilih ini.
                      </p>
                    </div>
                  </label>
                );
              })()}

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

        {/* Confirmation Modal for Cancelling Import */}
        <ConfirmDialog
          isOpen={isCancelModalOpen}
          onClose={() => {
            if (!isCancelling) {
              setIsCancelModalOpen(false);
              setCancelBatchTargetId(null);
            }
          }}
          onConfirm={handleExecuteCancel}
          title="Konfirmasi Pembatalan Impor Jadwal"
          message={`Apakah Anda yakin ingin membatalkan proses impor ini${cancelBatchTargetId ? ` (Batch #${cancelBatchTargetId})` : ''}? Seluruh data draf penampung sementara (staging) dan berkas PDF yang telah diunggah akan dihapus secara permanen dari server. Jadwal aktif yang sudah berjalan di sistem tidak akan terpengaruh sama sekali.`}
          confirmLabel="Ya, Batalkan Impor"
          cancelLabel="Kembali / Tetap Simpan"
          confirmVariant="danger"
          loading={isCancelling}
        />

        {/* Modal Penyelarasan Massal Guru PDF */}
        <Modal
          isOpen={isBulkTeacherModalOpen}
          onClose={() => {
            if (!isSubmittingBulkTeachers) {
              setIsBulkTeacherModalOpen(false);
              setBulkTeacherFeedback(null);
            }
          }}
          title="Penyelarasan Nama Guru dari Dokumen PDF"
          size="lg"
          footer={
            <div className="flex items-center justify-end gap-2 w-full">
              <Button
                variant="secondary"
                disabled={isSubmittingBulkTeachers}
                onClick={() => setIsBulkTeacherModalOpen(false)}
              >
                Batal
              </Button>
              <Button
                variant="primary"
                icon={Check}
                loading={isSubmittingBulkTeachers}
                onClick={handleSaveBulkTeachers}
              >
                Terapkan Semua Padanan ({unmappedTeachersWithCandidates.reduce((acc, curr) => acc + curr.count, 0)} Jam Pelajaran)
              </Button>
            </div>
          }
        >
          <div className="flex flex-col gap-4 text-xs">
            {bulkTeacherFeedback && (
              <div className="p-3 bg-red-50 border border-red-200 text-red-800 rounded-lg">
                {bulkTeacherFeedback.message}
              </div>
            )}

            <p className="text-gray-600 m-0">
              Dokumen PDF jadwal mencantumkan nama guru dengan sedikit perbedaan ejaan atau gelar. Tentukan padanan guru yang benar dari Master Data di bawah ini. Sekali diterapkan, seluruh jam pelajaran terkait akan langsung terpetakan otomatis.
            </p>

            <div className="flex flex-col gap-3 max-h-[60vh] overflow-y-auto pr-1">
              {unmappedTeachersWithCandidates.map((item) => {
                const currentVal = bulkTeacherMappings[item.raw_teacher_name] || '';
                return (
                  <div
                    key={item.raw_teacher_name}
                    className="p-3 bg-gray-50/70 border border-gray-200 rounded-lg flex flex-col gap-2.5"
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <span className="font-semibold text-gray-900 text-sm">
                          {item.raw_teacher_name}
                        </span>
                        <Badge variant="neutral">{item.count} Jam Pelajaran</Badge>
                      </div>
                    </div>

                    {item.candidates && item.candidates.length > 0 && (
                      <div className="flex flex-wrap items-center gap-1.5">
                        <span className="text-[11px] text-gray-500 font-medium">Saran Kemiripan:</span>
                        {item.candidates.map((c) => {
                          const isSelected = String(currentVal) === String(c.id);
                          return (
                            <button
                              key={c.id}
                              type="button"
                              onClick={() =>
                                setBulkTeacherMappings((prev) => ({
                                  ...prev,
                                  [item.raw_teacher_name]: String(c.id),
                                }))
                              }
                              className={`px-2 py-0.5 rounded text-[11px] font-medium border transition-colors cursor-pointer ${
                                isSelected
                                  ? 'bg-amber-600 text-white border-amber-700'
                                  : 'bg-white text-amber-800 border-amber-300 hover:bg-amber-50'
                              }`}
                            >
                              {c.name} ({c.similarity}%)
                            </button>
                          );
                        })}
                      </div>
                    )}

                    <Select
                      label="Petakan ke Master Guru"
                      value={String(currentVal)}
                      options={teacherList.map((t) => ({
                        value: String(t.id),
                        label: `${t.name} ${t.nis_nip ? `[NIP: ${t.nis_nip}]` : ''}`,
                      }))}
                      onChange={(e) =>
                        setBulkTeacherMappings((prev) => ({
                          ...prev,
                          [item.raw_teacher_name]: e.target.value,
                        }))
                      }
                    />
                  </div>
                );
              })}
            </div>
          </div>
        </Modal>
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

      {/* Prerequisite Checklist Banner (SCP v4.5 Zero-Manual) */}
      {prerequisiteLoading ? (
        <div className="upload-prerequisite-card upload-prerequisite-card--loading">
          <RefreshCw size={16} className="animate-spin text-gray-500 shrink-0" />
          <span className="text-xs text-gray-600">
            Memverifikasi kelayakan Master Data prasyarat (Siswa &amp; Guru aktif)...
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

              {/* Item 2: Guru Aktif Terdaftar */}
              <div className="upload-prerequisite-item">
                <div className="flex items-center gap-2">
                  {prerequisiteStatus.checks.hasTeachers ? (
                    <CheckCircle2 size={15} className="text-emerald-600 shrink-0" />
                  ) : (
                    <XCircle size={15} className="text-red-500 shrink-0" />
                  )}
                  <span className="text-xs text-gray-700">
                    Data Guru Terdaftar:{' '}
                    <strong className={prerequisiteStatus.checks.hasTeachers ? 'text-gray-900' : 'text-amber-800'}>
                      {prerequisiteStatus.counts.teacherCount} guru
                    </strong>
                  </span>
                </div>
                {!prerequisiteStatus.checks.hasTeachers && (
                  <Button
                    variant="outline"
                    size="sm"
                    icon={ExternalLink}
                    onClick={() => navigate('/web/master-data')}
                  >
                    Kelola Guru
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
                ? 'Lengkapi prasyarat Master Data (Siswa & Guru aktif) terlebih dahulu.'
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
              <Button
                variant="danger"
                icon={Ban}
                onClick={() => handleTriggerCancel(uploadedBatchId)}
              >
                Batalkan Draf #{uploadedBatchId}
              </Button>
              <Button variant="secondary" icon={RefreshCw} onClick={handleResetUpload}>
                Unggah Berkas Lain
              </Button>
              <Button
                variant="primary"
                icon={ArrowRight}
                disabled={!uploadedBatchId}
                onClick={() => {
                  if (uploadedBatchId) {
                    navigate(`/web/schedule-import/${uploadedBatchId}`);
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

      {/* Confirmation Modal for Cancelling Import */}
      <ConfirmDialog
        isOpen={isCancelModalOpen}
        onClose={() => {
          if (!isCancelling) {
            setIsCancelModalOpen(false);
            setCancelBatchTargetId(null);
          }
        }}
        onConfirm={handleExecuteCancel}
        title="Konfirmasi Pembatalan Impor Jadwal"
        message={`Apakah Anda yakin ingin membatalkan proses impor ini${cancelBatchTargetId ? ` (Batch #${cancelBatchTargetId})` : ''}? Seluruh data draf penampung sementara (staging) dan berkas PDF yang telah diunggah akan dihapus secara permanen dari server. Jadwal aktif yang sudah berjalan di sistem tidak akan terpengaruh sama sekali.`}
        confirmLabel="Ya, Batalkan Impor"
        cancelLabel="Kembali / Tetap Simpan"
        confirmVariant="danger"
        loading={isCancelling}
      />
    </div>
  );
}
