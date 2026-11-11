import { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import {
  PlayCircle,
  CheckCircle,
  CheckCircle2,
  AlertTriangle,
  AlertCircle,
  ShieldCheck,
  ArrowLeft,
  X,
  FileCheck2,
  RotateCw,
  Eye,
  Edit3,
  MessageSquare,
  FileText,
  Calendar,
  Clock,
  MapPin,
  User,
  Camera,
  Lock,
  Ban,
  Layers,
  ChevronRight,
} from 'lucide-react';
import { useAuth } from '../../hooks/useAuth';
import { journalApi } from '../../services/journalApi';
import { compressImage } from '../../utils/imageCompressor';
import { getStorageUrl } from '../../utils/formatters';
import { unwrapList } from '../../utils/responseHelper';
import { todayLocalISO, getJakartaDayInfo, getJakartaTimeString } from '../../utils/dateUtils';
import { calculateSessionStatus } from '../../utils/sessionStatusHelper';
import { Button, Badge, useToast, useConfirm } from '../../components/shared';
import { ForbiddenState, EmptyState } from '../../components/feedback';
import './TeacherJournal.css';

export default function TeacherJournalPage() {
  const location = useLocation();
  const navigate = useNavigate();
  const { user, hasRole, isKesiswaan, isWaliKelas } = useAuth();
  const { toast } = useToast();
  const { confirm } = useConfirm();

  // Jadwal yang dikirimkan via route state saat navigasi dari Kalender/Dashboard
  const passedSchedule = location.state?.schedule;

  // State Daftar Seluruh Jadwal Hari Ini
  const [todaySchedules, setTodaySchedules] = useState([]);
  const [isLoadingInitial, setIsLoadingInitial] = useState(true);
  const [currentTime, setCurrentTime] = useState(getJakartaTimeString() || '08:00');

  // State Sesi KBM yang Sedang Dipilih / Aktif untuk Pengisian Jurnal
  const [schedule, setSchedule] = useState(passedSchedule || null);
  const [journalId, setJournalId] = useState(null);
  const [classOpened, setClassOpened] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');

  // Form Fields
  const [topic, setTopic] = useState('');
  const [uploadedPhoto, setUploadedPhoto] = useState(null);
  const [photoPreview, setPhotoPreview] = useState(null);
  const [compressedFileSize, setCompressedFileSize] = useState(null);

  // Live Camera State
  const [isCameraActive, setIsCameraActive] = useState(false);
  const [cameraFacing, setCameraFacing] = useState('environment'); // 'environment' | 'user'
  const [cameraError, setCameraError] = useState('');
  const [isCapturing, setIsCapturing] = useState(false);
  const videoRef = useRef(null);
  const streamRef = useRef(null);
  const fileInputRef = useRef(null);
  const activeWorkingRef = useRef(null);

  // Data Siswa & Presensi
  const [students, setStudents] = useState([]);
  const [attendance, setAttendance] = useState({});
  const [approvedLeaves, setApprovedLeaves] = useState([]);
  const [studentNotes, setStudentNotes] = useState({});
  const [savedJournalData, setSavedJournalData] = useState(null);

  // Timer Real-Time untuk memperbarui waktu setiap 15 detik agar status sesi berganti otomatis
  useEffect(() => {
    const timer = setInterval(() => {
      setCurrentTime(getJakartaTimeString() || '08:00');
    }, 15000);
    return () => clearInterval(timer);
  }, []);

  // Muat seluruh jadwal mengajar guru pada hari ini
  const loadTodaySchedules = useCallback(async () => {
    setIsLoadingInitial(true);
    setErrorMessage('');
    try {
      const dayInfo = getJakartaDayInfo();
      const cycle = Number(user?.academic_setting?.active_cycle || user?.active_cycle || 1);
      const res = await journalApi.getTeacherSchedules({
        day: dayInfo.dayOfWeek,
        cycle,
        per_page: 50,
        all: 1,
      });

      const list = unwrapList(res);
      // Urutkan jadwal secara kronologis berdasarkan period_number (Jam Ke-1 s/d Jam Ke-10)
      const sorted = [...list].sort(
        (a, b) => Number(a.period_number || 1) - Number(b.period_number || 1)
      );
      setTodaySchedules(sorted);

      // Jika ada passedSchedule dari navigasi, sinkronkan dengan data terbaru
      if (passedSchedule) {
        const found = sorted.find((s) => s.id === passedSchedule.id);
        if (found) {
          setSchedule(found);
        } else {
          setSchedule(passedSchedule);
        }
      }
    } catch (err) {
      console.warn('Gagal memuat jadwal hari ini guru:', err);
      setErrorMessage('Gagal memuat jadwal mengajar hari ini. Silakan muat ulang halaman.');
    } finally {
      setIsLoadingInitial(false);
    }
  }, [user?.academic_setting?.active_cycle, user?.active_cycle, passedSchedule]);

  useEffect(() => {
    loadTodaySchedules();
  }, [loadTodaySchedules]);

  // Statistik Ringkasan Sesi Hari Ini
  const sessionSummary = useMemo(() => {
    const counts = {
      total: todaySchedules.length,
      completed: 0,
      ready: 0,
      upcoming: 0,
      expired: 0,
      exempted: 0,
    };

    todaySchedules.forEach((item) => {
      const calc = calculateSessionStatus(item, currentTime);
      if (calc.status === 'completed') counts.completed += 1;
      else if (calc.status === 'ready') counts.ready += 1;
      else if (calc.status === 'upcoming') counts.upcoming += 1;
      else if (calc.status === 'expired') counts.expired += 1;
      else if (calc.status === 'exempted' || calc.status === 'teacher_absent') counts.exempted += 1;
    });

    return counts;
  }, [todaySchedules, currentTime]);

  // Penegakan Otorisasi untuk Sesi yang Sedang Dipilih
  const isOriginalTeacher = useMemo(() => {
    if (!schedule || !user) return true;
    return schedule.teacher_id === user.id;
  }, [schedule, user]);

  const isSubstituteMode = useMemo(() => {
    const isHomeroom = schedule?.class_id ? isWaliKelas(schedule.class_id) : false;
    return (isKesiswaan() || isHomeroom) && !isOriginalTeacher;
  }, [schedule, isKesiswaan, isWaliKelas, isOriginalTeacher]);

  const isAccessDenied = useMemo(() => {
    if (!schedule || !user) return false;
    const isHomeroom = schedule?.class_id ? isWaliKelas(schedule.class_id) : false;
    return !isOriginalTeacher && !isKesiswaan() && !hasRole('waka') && !isHomeroom;
  }, [schedule, user, isOriginalTeacher, isKesiswaan, hasRole, isWaliKelas]);

  // Data Rombel, Mapel, Ruang untuk Sesi Aktif
  const taskTitipan = useMemo(() => {
    if (isSubstituteMode) {
      return schedule?.task_instruction || '';
    }
    return '';
  }, [isSubstituteMode, schedule?.task_instruction]);

  const className = useMemo(() => {
    return (
      schedule?.school_class?.name ||
      schedule?.schoolClass?.name ||
      schedule?.class_name ||
      schedule?.className ||
      (schedule?.class_id ? `Kelas #${schedule.class_id}` : 'Rombel Kelas')
    );
  }, [schedule]);

  const subjectName = useMemo(() => {
    return schedule?.subject?.name || schedule?.subject_name || 'Mata Pelajaran';
  }, [schedule]);

  const roomName = useMemo(() => {
    const raw = schedule?.room?.name || schedule?.room_name || '';
    if (!raw) return 'Ruang Belajar';
    return String(raw).toLowerCase().startsWith('ruang') || String(raw).toLowerCase().startsWith('lab')
      ? String(raw)
      : `Ruang ${raw}`;
  }, [schedule]);

  const teacherName = useMemo(() => {
    return schedule?.teacher?.name || user?.name || 'Guru Pengampu';
  }, [schedule, user]);

  const startPeriod = schedule?.period_number || 1;
  const duration = schedule?.duration_periods || 2;
  const endPeriod = startPeriod + duration - 1;

  const sessionDateFormatted = useMemo(() => {
    const targetDate = schedule?.date || new Date();
    try {
      const d = typeof targetDate === 'string' ? new Date(targetDate) : targetDate;
      return new Intl.DateTimeFormat('id-ID', {
        weekday: 'long',
        day: 'numeric',
        month: 'long',
        year: 'numeric',
      }).format(d);
    } catch {
      return 'Hari ini';
    }
  }, [schedule]);

  // Helper kompresi foto
  const handlePhotoSelect = async (file) => {
    if (!file) {
      setUploadedPhoto(null);
      setPhotoPreview(null);
      setCompressedFileSize(null);
      return;
    }

    try {
      const compressed = await compressImage(file, { maxWidth: 1280, quality: 0.8 });
      setUploadedPhoto(compressed);
      setPhotoPreview(URL.createObjectURL(compressed));
      setCompressedFileSize((compressed.size / 1024).toFixed(1));
    } catch {
      setUploadedPhoto(file);
      setPhotoPreview(URL.createObjectURL(file));
      setCompressedFileSize((file.size / 1024).toFixed(1));
    }
  };

  useEffect(() => {
    return () => {
      if (photoPreview) {
        URL.revokeObjectURL(photoPreview);
      }
    };
  }, [photoPreview]);

  // Kamera stream
  const stopCamera = useCallback(() => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
    }
    if (videoRef.current) {
      videoRef.current.srcObject = null;
    }
    setIsCameraActive(false);
    setIsCapturing(false);
  }, []);

  const startCamera = async (facing = cameraFacing) => {
    setCameraError('');
    setIsCapturing(false);

    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
    }

    if (!navigator?.mediaDevices?.getUserMedia) {
      if (fileInputRef.current) {
        fileInputRef.current.click();
      } else {
        setCameraError('Perangkat atau browser ini tidak mendukung akses kamera langsung.');
      }
      return;
    }

    try {
      setIsCameraActive(true);
      const constraints = {
        video: {
          facingMode: { ideal: facing },
          width: { ideal: 1280 },
          height: { ideal: 720 },
        },
        audio: false,
      };

      const stream = await navigator.mediaDevices.getUserMedia(constraints);
      streamRef.current = stream;

      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play().catch(() => {});
      }
    } catch (err) {
      console.warn('Gagal mengakses kamera via getUserMedia:', err);
      setIsCameraActive(false);
      if (fileInputRef.current) {
        fileInputRef.current.click();
      } else {
        setCameraError(
          err.name === 'NotAllowedError' || err.name === 'PermissionDeniedError'
            ? 'Izin akses kamera ditolak. Silakan izinkan akses kamera pada peramban Anda.'
            : 'Kamera perangkat tidak dapat diakses atau sedang digunakan oleh aplikasi lain.'
        );
      }
    }
  };

  const switchCamera = () => {
    const nextFacing = cameraFacing === 'environment' ? 'user' : 'environment';
    setCameraFacing(nextFacing);
    startCamera(nextFacing);
  };

  const capturePhoto = async () => {
    if (!videoRef.current || isCapturing) return;
    setIsCapturing(true);

    try {
      const video = videoRef.current;
      const canvas = document.createElement('canvas');
      const width = video.videoWidth || 1280;
      const height = video.videoHeight || 720;
      canvas.width = width;
      canvas.height = height;

      const ctx = canvas.getContext('2d');
      ctx.drawImage(video, 0, 0, width, height);

      canvas.toBlob(
        async (blob) => {
          if (!blob) {
            setIsCapturing(false);
            return;
          }
          const timestamp = new Date().toISOString().replace(/[-:T.]/g, '').slice(0, 14);
          const file = new File([blob], `kbm_kamera_${timestamp}.jpg`, { type: 'image/jpeg' });
          await handlePhotoSelect(file);
          stopCamera();
        },
        'image/jpeg',
        0.85
      );
    } catch (err) {
      console.error('Gagal menjepret foto kamera:', err);
      setIsCapturing(false);
    }
  };

  useEffect(() => {
    if (isCameraActive && videoRef.current && streamRef.current) {
      videoRef.current.srcObject = streamRef.current;
      videoRef.current.play().catch(() => {});
    }
  }, [isCameraActive]);

  useEffect(() => {
    return () => {
      if (streamRef.current) {
        streamRef.current.getTracks().forEach((track) => track.stop());
      }
    };
  }, []);

  const handleNoteChange = useCallback((studentId, noteText) => {
    setStudentNotes((prev) => ({
      ...prev,
      [studentId]: noteText,
    }));
  }, []);

  // BUKA SESI KBM UNTUK SESI TERTENTU (POST /api/journals)
  const handleOpenClassForSchedule = async (targetSchedule) => {
    if (!targetSchedule) return;
    if (targetSchedule.is_teaching_exempted) {
      setErrorMessage(`Pengisian jurnal dibatalkan karena terdapat agenda sekolah: ${targetSchedule.exemption_reason || 'Kegiatan Khusus'}.`);
      return;
    }

    setSchedule(targetSchedule);
    setSubmitted(false);
    setClassOpened(false);
    setIsSubmitting(true);
    setErrorMessage('');

    try {
      const res = await journalApi.openJournal({
        schedule_id: targetSchedule.id,
        status: 'ongoing',
        date: todayLocalISO(),
      });

      if (res.success && res.data) {
        setJournalId(res.data.id);
        setSavedJournalData(res.data);
        if (res.data.topic_description) {
          setTopic(res.data.topic_description);
        } else {
          setTopic('');
        }
      }

      // Perbarui status lokal pada todaySchedules
      setTodaySchedules((prev) =>
        prev.map((s) =>
          s.id === targetSchedule.id
            ? { ...s, journal_status: 'ongoing', journal_id: res.data?.id || s.journal_id }
            : s
        )
      );

      // Ambil daftar siswa kelas terkait
      const classId = targetSchedule.school_class_id || targetSchedule.class_id;
      if (!classId) {
        setErrorMessage('Data rombel kelas pada jadwal ini tidak ditemukan.');
        return;
      }
      const studRes = await journalApi.getClassStudents(classId);
      const studentList = studRes.data || [];
      setStudents(studentList);

      const leaves = res.meta?.approved_leaves || [];
      setApprovedLeaves(leaves);

      const initAttendance = {};
      const initNotes = {};
      const existingAttendances = res.data?.attendances || [];
      const existingAttMap = new Map(existingAttendances.map((a) => [a.student_id, a]));

      studentList.forEach((st) => {
        const existingAtt = existingAttMap.get(st.id);
        if (existingAtt) {
          initAttendance[st.id] = existingAtt.status || 'Hadir';
          if (existingAtt.notes) {
            initNotes[st.id] = existingAtt.notes;
          }
        } else {
          const leave = leaves.find((l) => l.student_id === st.id);
          if (leave) {
            initAttendance[st.id] = leave.default_status || (leave.category === 'sakit' ? 'Sakit' : 'Izin');
          } else {
            initAttendance[st.id] = 'Hadir';
          }
        }
      });

      setAttendance(initAttendance);
      setStudentNotes(initNotes);
      setClassOpened(true);

      // Scroll halus ke form kerja
      setTimeout(() => {
        activeWorkingRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }, 100);
    } catch (err) {
      const status = err.status || err.response?.status;
      const msg = err.message || err.response?.data?.message;
      if (status === 403) {
        setErrorMessage(msg || 'Akses ditolak (403). Anda tidak memiliki wewenang untuk membuka kelas ini.');
      } else {
        setErrorMessage(msg || 'Gagal membuka sesi KBM. Silakan periksa koneksi Anda.');
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  // LIHAT DETAIL JURNAL SESI YANG SUDAH SELESAI
  const handleViewJournalDetailForSchedule = async (targetSchedule) => {
    const targetId = targetSchedule?.journal_id || (schedule?.id === targetSchedule?.id ? journalId : null);
    if (!targetId) {
      setErrorMessage('ID jurnal untuk sesi ini tidak ditemukan.');
      return;
    }

    setSchedule(targetSchedule);
    setClassOpened(false);
    setIsSubmitting(true);
    setErrorMessage('');

    try {
      const res = await journalApi.getJournalDetail(targetId);
      if (res.success && res.data) {
        const jData = res.data;
        setSavedJournalData(jData);
        setJournalId(jData.id);
        setTopic(jData.topic_description || '');
        if (jData.photo_url || jData.photo_path) {
          setPhotoPreview(getStorageUrl(jData.photo_url || jData.photo_path));
        } else {
          setPhotoPreview(null);
        }

        const existingAttendances = jData.attendances || [];
        const initAtt = {};
        const initNts = {};
        const studList = [];

        existingAttendances.forEach((att) => {
          initAtt[att.student_id] = att.status;
          if (att.notes) {
            initNts[att.student_id] = att.notes;
          }
          if (att.student) {
            studList.push({
              id: att.student.id,
              name: att.student.name,
              nis_nip: att.student.nis_nip,
            });
          }
        });

        if (studList.length > 0) {
          setStudents(studList);
        }
        setAttendance(initAtt);
        setStudentNotes(initNts);
        setSubmitted(true);

        setTimeout(() => {
          activeWorkingRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
        }, 100);
      }
    } catch (err) {
      setErrorMessage(err.message || 'Gagal memuat detail jurnal & catatan presensi.');
    } finally {
      setIsSubmitting(false);
    }
  };

  // Menandai Guru Berhalangan Hadir
  const handleMarkTeacherAbsent = async (targetSchedule) => {
    const s = targetSchedule || schedule;
    if (!s) return;
    const ok = await confirm({
      title: 'Konfirmasi Guru Berhalangan Hadir',
      message: 'Apakah Anda yakin ingin menandai sesi KBM ini sebagai Guru Berhalangan Hadir (Jam Kosong)? Status ini akan dicatat pada rekap kehadiran.',
      confirmLabel: 'Ya, Tandai Jam Kosong',
      confirmVariant: 'danger',
    });
    if (!ok) return;

    try {
      await journalApi.markTeacherAbsent(s.journal_id, {
        schedule_id: s.id,
      });
      toast.success('Jadwal berhasil ditandai sebagai Guru Berhalangan Hadir (teacher_absent).');
      loadTodaySchedules();
      setClassOpened(false);
      setSubmitted(false);
    } catch (err) {
      const msg = err.response?.data?.message || err.message || 'Gagal menandai status jam kosong.';
      toast.error(msg);
    }
  };

  const handleStatusChange = useCallback((studentId, newStatus) => {
    setAttendance((prev) => ({
      ...prev,
      [studentId]: newStatus,
    }));
  }, []);

  const counts = useMemo(() => {
    const res = { hadir: 0, sakit: 0, izin: 0, alpa: 0 };
    Object.values(attendance).forEach((status) => {
      const key = (status || '').toLowerCase();
      if (Object.prototype.hasOwnProperty.call(res, key)) {
        res[key] += 1;
      }
    });
    return res;
  }, [attendance]);

  // SUBMIT PENYELESAIAN JURNAL (PUT /api/journals/{id})
  const handleSubmit = async (e) => {
    e.preventDefault();

    if (!isSubstituteMode && (!topic || topic.trim().length < 10)) {
      setErrorMessage('Deskripsi topik materi pembelajaran wajib diisi minimal 10 karakter.');
      return;
    }

    const targetJournalId = journalId || schedule?.journal_id;
    if (!targetJournalId) {
      setErrorMessage('Sesi jurnal belum terdaftar di sistem. Silakan buka kelas terlebih dahulu.');
      return;
    }

    if (!uploadedPhoto) {
      setErrorMessage('Wajib mengunggah minimal 1 foto bukti dokumentasi KBM via kamera.');
      return;
    }

    setIsSubmitting(true);
    setErrorMessage('');

    try {
      const exceptions = [];
      Object.entries(attendance).forEach(([stId, status]) => {
        if (status !== 'Hadir') {
          const parsedId = parseInt(stId, 10);
          const note = (studentNotes[stId] || studentNotes[parsedId] || '').trim();
          exceptions.push({
            student_id: parsedId,
            status: status,
            notes: note || undefined,
          });
        }
      });

      const formData = new FormData();
      formData.append(
        'topic_description',
        topic.trim() || (isSubstituteMode ? 'Pendampingan Jam Kosong oleh Tim Kesiswaan' : 'KBM Kelas')
      );
      formData.append('photo', uploadedPhoto);

      exceptions.forEach((exc, index) => {
        formData.append(`exceptions[${index}][student_id]`, exc.student_id);
        formData.append(`exceptions[${index}][status]`, exc.status);
        if (exc.notes) {
          formData.append(`exceptions[${index}][notes]`, exc.notes);
        }
      });

      let noteIndex = 0;
      Object.entries(studentNotes).forEach(([stId, noteText]) => {
        const cleanNote = (noteText || '').trim();
        if (cleanNote) {
          formData.append(`student_notes[${noteIndex}][student_id]`, parseInt(stId, 10));
          formData.append(`student_notes[${noteIndex}][notes]`, cleanNote);
          noteIndex += 1;
        }
      });

      const res = await journalApi.completeJournal(targetJournalId, formData);
      if (res.data) {
        setSavedJournalData(res.data);
      }
      setSubmitted(true);

      // Perbarui status sesi yang bersangkutan pada todaySchedules
      setTodaySchedules((prev) =>
        prev.map((s) =>
          s.id === schedule.id
            ? { ...s, journal_status: 'completed', journal_id: targetJournalId }
            : s
        )
      );
    } catch (err) {
      const status = err.status || err.response?.status;
      const msg = err.message || err.response?.data?.message;
      if (status === 422) {
        setErrorMessage(
          msg || 'Data tidak valid. Pastikan topik minimal 10 karakter dan foto terunggah.'
        );
      } else if (status === 403) {
        setErrorMessage(msg || 'Akses ditolak (403). Anda tidak memiliki izin menyelesaikan jurnal ini.');
      } else {
        setErrorMessage(msg || 'Terjadi kendala saat menyimpan jurnal. Silakan coba kembali.');
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  // Tutup panel kerja aktif untuk kembali ke daftar sesi penuh
  const handleCloseWorkingSession = () => {
    setClassOpened(false);
    setSubmitted(false);
    setSchedule(null);
    setUploadedPhoto(null);
    setPhotoPreview(null);
    stopCamera();
  };

  // Jika hak akses ditolak (403) pada sesi yang dipilih
  if (isAccessDenied && schedule) {
    return (
      <div className="teacher-journal">
        <ForbiddenState
          title="Akses Jurnal Ditolak (403 Forbidden)"
          message="Hanya guru pengajar jadwal atau Tim Kesiswaan (Piket) yang berhak membuka, mengisi, atau menggantikan jurnal KBM kelas ini."
          actionText="Kembali ke Daftar Sesi Hari Ini"
          onAction={handleCloseWorkingSession}
        />
      </div>
    );
  }

  return (
    <div className="teacher-journal">
      {/* 1. Header Halaman Terpadu */}
      <div className="teacher-journal__header">
        <div className="teacher-journal__title-group">
          <h1>Jurnal KBM &amp; Presensi Kelas</h1>
          <p className="teacher-journal__subtitle">
            Daftar seluruh sesi mengajar Anda hari ini. Buka sesi aktif, isi topik pembelajaran, verifikasi presensi, dan lampirkan foto dokumentasi kelas.
          </p>
        </div>

        <div className="teacher-journal__header-badges">
          <Badge variant="neutral">
            <Calendar size={13} className="mr-1 inline text-gray-500" />
            {sessionDateFormatted}
          </Badge>
          <Badge variant="default">
            Putaran {user?.academic_setting?.active_cycle || user?.active_cycle || 1}
          </Badge>
          <span className="font-mono text-xs text-gray-500 bg-gray-100 px-2.5 py-1 rounded-md border border-gray-200">
            Waktu: <strong>{currentTime} WIB</strong>
          </span>
        </div>
      </div>

      {/* 2. Banner Ringkasan Sesi KBM Hari Ini */}
      <div className="teacher-journal__summary-bar">
        <div className="teacher-journal__summary-title">
          <Layers size={16} className="text-blue-600" />
          <span>Agenda Mengajar Hari Ini:</span>
        </div>
        <Badge variant="default">Total: {sessionSummary.total} Sesi</Badge>
        <Badge variant="success">Selesai: {sessionSummary.completed}</Badge>
        <Badge variant="primary">Dapat Diisi: {sessionSummary.ready}</Badge>
        <Badge variant="neutral">Segera: {sessionSummary.upcoming}</Badge>
        {sessionSummary.expired > 0 && (
          <Badge variant="error">Telah Berakhir: {sessionSummary.expired}</Badge>
        )}
        {sessionSummary.exempted > 0 && (
          <Badge variant="warning">Dikecualikan: {sessionSummary.exempted}</Badge>
        )}
      </div>

      {/* Tampilan Error Banner */}
      {errorMessage && (
        <div className="mb-5 p-3.5 bg-red-50 border border-red-200 rounded-lg flex items-center gap-2.5 text-xs text-red-800">
          <AlertTriangle size={16} className="text-red-600 shrink-0" />
          <span>{errorMessage}</span>
        </div>
      )}

      {/* 3. DAFTAR SELURUH SESI MENGAJAR HARI INI */}
      <div className="mb-6">
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-sm font-bold text-gray-900 flex items-center gap-2">
            <Clock size={16} className="text-amber-500" />
            Daftar Sesi Mengajar Hari Ini
          </h2>
          <span className="text-xs text-gray-500">
            Diurutkan berdasarkan jadwal jam pelajaran (pagi s.d. sore)
          </span>
        </div>

        {isLoadingInitial ? (
          <div className="bg-white rounded-xl border border-gray-200 p-10 text-center">
            <RotateCw className="w-8 h-8 animate-spin text-slate-700 mx-auto mb-3" />
            <p className="text-xs text-slate-500">Memuat seluruh sesi KBM hari ini...</p>
          </div>
        ) : todaySchedules.length === 0 ? (
          <div className="bg-white rounded-xl border border-gray-200 p-8 text-center max-w-lg mx-auto">
            <EmptyState
              title="Tidak Ada Jadwal Mengajar Hari Ini"
              message="Anda tidak memiliki jadwal KBM yang terdaftar pada hari ini. Silakan periksa kalender mengajar mingguan Anda."
              actionText="Buka Kalender Jadwal Mengajar"
              onAction={() => navigate('/teacher/schedule')}
            />
          </div>
        ) : (
          <div className="teacher-journal__sessions-grid">
            {todaySchedules.map((item, idx) => {
              const calc = calculateSessionStatus(item, currentTime);
              const isSelected = schedule?.id === item.id;
              const itemClassName =
                item.school_class?.name ||
                item.schoolClass?.name ||
                item.class_name ||
                (item.class_id ? `Kelas #${item.class_id}` : 'Rombel Kelas');
              const itemSubject = item.subject?.name || item.subject_name || 'Mata Pelajaran';
              const rawRoom = item.room?.name || item.room_name || '';
              const itemRoom = rawRoom
                ? String(rawRoom).toLowerCase().startsWith('ruang') || String(rawRoom).toLowerCase().startsWith('lab')
                  ? String(rawRoom)
                  : `Ruang ${rawRoom}`
                : 'Ruang Belajar';
              const startP = item.period_number || 1;
              const durP = item.duration_periods || 1;
              const endP = startP + durP - 1;

              // Card styling modifier
              let cardModifier = '';
              if (isSelected) cardModifier += ' teacher-journal__session-card--active';
              if (calc.status === 'ready') cardModifier += ' teacher-journal__session-card--ready';
              else if (calc.status === 'upcoming') cardModifier += ' teacher-journal__session-card--upcoming';
              else if (calc.status === 'expired') cardModifier += ' teacher-journal__session-card--expired';
              else if (calc.status === 'completed') cardModifier += ' teacher-journal__session-card--completed';
              else if (calc.status === 'exempted') cardModifier += ' teacher-journal__session-card--exempted';

              return (
                <div key={item.id} className={`teacher-journal__session-card ${cardModifier}`}>
                  {/* Header Kartu Sesi */}
                  <div className="teacher-journal__session-card-header">
                    <div className="teacher-journal__session-card-tags">
                      <span className="font-mono text-xs font-bold text-gray-800 bg-gray-100 px-2 py-0.5 rounded border border-gray-200">
                        Sesi {idx + 1}: Jam Ke-{startP} s/d {endP} ({durP} JP)
                      </span>
                      <span className="text-xs font-medium text-gray-600 bg-gray-50 px-2 py-0.5 rounded border border-gray-200 flex items-center gap-1">
                        <Clock size={12} className="text-gray-400" />
                        {calc.startTime || '07:15'} - {calc.endTime || '08:35'} WIB
                      </span>
                    </div>

                    <div className="flex items-center gap-2">
                      {calc.status === 'ready' && (
                        <span className="flex items-center gap-1.5 text-xs font-bold text-blue-700 bg-blue-50 border border-blue-200 px-2.5 py-1 rounded-md">
                          <span className="teacher-journal__pulse-dot teacher-journal__pulse-dot--active" />
                          {calc.label}
                        </span>
                      )}
                      {calc.status === 'completed' && (
                        <span className="flex items-center gap-1.5 text-xs font-bold text-emerald-700 bg-emerald-50 border border-emerald-200 px-2.5 py-1 rounded-md">
                          <CheckCircle2 size={14} className="text-emerald-600" />
                          Selesai Disimpan
                        </span>
                      )}
                      {calc.status === 'upcoming' && (
                        <span className="flex items-center gap-1.5 text-xs font-semibold text-slate-600 bg-slate-100 border border-slate-200 px-2.5 py-1 rounded-md">
                          <Lock size={13} className="text-slate-500" />
                          Segera
                        </span>
                      )}
                      {calc.status === 'expired' && (
                        <span className="flex items-center gap-1.5 text-xs font-bold text-red-700 bg-red-50 border border-red-200 px-2.5 py-1 rounded-md">
                          <AlertCircle size={14} className="text-red-600" />
                          Sesi Telah Berakhir
                        </span>
                      )}
                      {calc.status === 'exempted' && (
                        <span className="flex items-center gap-1.5 text-xs font-semibold text-amber-800 bg-amber-50 border border-amber-200 px-2.5 py-1 rounded-md">
                          <AlertTriangle size={13} className="text-amber-600" />
                          Agenda Sekolah
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Body Kartu Sesi */}
                  <div className="teacher-journal__session-card-body">
                    <div className="teacher-journal__session-card-info">
                      <h3 className="teacher-journal__session-card-title">
                        <span>{itemSubject}</span>
                        <span className="teacher-journal__class-badge">{itemClassName}</span>
                        {item.is_substitute && (
                          <span className="px-2 py-0.5 rounded text-[10px] bg-amber-100 text-amber-900 font-semibold border border-amber-300">
                            Sesi Inval (Pengganti)
                          </span>
                        )}
                      </h3>

                      <div className="teacher-journal__session-card-meta">
                        <span className="flex items-center gap-1">
                          <MapPin size={13} className="text-rose-500" />
                          {itemRoom}
                        </span>
                        <span>&bull;</span>
                        <span className="flex items-center gap-1">
                          <User size={13} className="text-emerald-600" />
                          {item.is_substitute ? (
                            <span>
                              Menggantikan: <strong>{item.original_teacher_name}</strong>
                            </span>
                          ) : (
                            <span>{item.teacher?.name || user?.name || 'Guru Pengampu'}</span>
                          )}
                        </span>
                      </div>

                      {/* Tampilan Tugas Titipan KBM untuk Sesi Pengganti */}
                      {item.is_substitute && (item.leave_task_instruction || item.leave_task_attachment_path) && (
                        <div className="my-2 p-2.5 bg-amber-50 border border-amber-200 rounded-lg text-xs text-amber-950">
                          <div className="flex items-center gap-1.5 font-semibold text-amber-900 mb-1">
                            <BookOpen size={13} className="text-amber-700" />
                            <span>Tugas Titipan dari {item.original_teacher_name}:</span>
                          </div>
                          {item.leave_task_instruction && (
                            <p className="text-[11.5px] text-amber-900 whitespace-pre-line mb-1">
                              {item.leave_task_instruction}
                            </p>
                          )}
                          {item.leave_task_attachment_path && (
                            <a
                              href={getStorageUrl(item.leave_task_attachment_path)}
                              target="_blank"
                              rel="noreferrer"
                              className="inline-flex items-center gap-1 text-[11px] font-semibold text-indigo-700 hover:text-indigo-900 underline mt-0.5"
                            >
                              <ExternalLink size={11} />
                              <span>Unduh Lampiran Berkas Tugas Siswa</span>
                            </a>
                          )}
                        </div>
                      )}

                      <p className="teacher-journal__session-card-desc">
                        {calc.status === 'ready' && (
                          <span className="text-blue-700 font-medium">
                            {calc.description}
                          </span>
                        )}
                        {calc.status === 'upcoming' && (
                          <span className="text-slate-500">
                            {calc.description}
                          </span>
                        )}
                        {calc.status === 'expired' && (
                          <span className="text-red-600">
                            {calc.description} Sesi tidak lagi dapat diisi mandiri.
                          </span>
                        )}
                        {calc.status === 'completed' && (
                          <span className="text-emerald-700 font-medium">
                            Jurnal pembelajaran dan kehadiran siswa telah tersimpan.
                          </span>
                        )}
                        {calc.status === 'exempted' && (
                          <span className="text-amber-800">
                            {calc.description}
                          </span>
                        )}
                      </p>
                    </div>

                    {/* Tombol Aksi per Sesi */}
                    <div className="teacher-journal__session-card-actions">
                      {calc.status === 'ready' && (
                        <Button
                          variant="primary"
                          size="sm"
                          icon={PlayCircle}
                          loading={isSubmitting && isSelected}
                          disabled={isSubmitting}
                          onClick={() => handleOpenClassForSchedule(item)}
                        >
                          {isSelected && classOpened
                            ? 'Sedang Mengisi Form'
                            : calc.isOngoing
                            ? 'Lanjutkan Jurnal'
                            : 'Mulai Jurnal'}
                        </Button>
                      )}

                      {calc.status === 'completed' && (
                        <>
                          <Button
                            variant="outline"
                            size="sm"
                            icon={Eye}
                            loading={isSubmitting && isSelected}
                            disabled={isSubmitting}
                            onClick={() => handleViewJournalDetailForSchedule(item)}
                          >
                            Lihat Detail
                          </Button>
                          <Button
                            variant="secondary"
                            size="sm"
                            icon={Edit3}
                            disabled={isSubmitting}
                            onClick={() => handleOpenClassForSchedule(item)}
                            title="Buka form untuk memperbarui data jurnal"
                          >
                            Perbarui
                          </Button>
                        </>
                      )}

                      {calc.status === 'upcoming' && (
                        <Button
                          variant="secondary"
                          size="sm"
                          icon={Lock}
                          disabled
                          title="Sesi KBM belum dimulai"
                        >
                          Belum Dimulai
                        </Button>
                      )}

                      {calc.status === 'expired' && (
                        <Button
                          variant="secondary"
                          size="sm"
                          icon={Ban}
                          disabled
                          title="Batas waktu toleransi pengisian KBM telah berakhir"
                        >
                          Sesi Berakhir
                        </Button>
                      )}

                      {calc.status === 'exempted' && (
                        <Button
                          variant="secondary"
                          size="sm"
                          icon={AlertTriangle}
                          disabled
                        >
                          KBM Ditiadakan
                        </Button>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* 4. AREA KERJA FORM JURNAL / DETAIL PRESENSI (DITAMPILKAN KETIKA SESI DIPILIH) */}
      {schedule && (classOpened || submitted) && (
        <div ref={activeWorkingRef} className="teacher-journal__working-section">
          {/* Header Area Kerja Sesi Terpilih */}
          <div className="teacher-journal__working-header">
            <div>
              <div className="text-[11px] font-bold uppercase tracking-wider text-blue-700 flex items-center gap-1.5 mb-1">
                <ChevronRight size={14} />
                <span>
                  {submitted ? 'Detail & Rekapitulasi Jurnal Tersimpan' : 'Form Pengisian Jurnal & Presensi Sesi'}
                </span>
              </div>
              <h3 className="text-base font-bold text-gray-900">
                {subjectName} &bull; {className} (Jam Ke-{startPeriod} s/d {endPeriod} - {roomName})
              </h3>
            </div>

            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                icon={X}
                onClick={handleCloseWorkingSession}
              >
                Tutup / Pilih Sesi Lain
              </Button>
            </div>
          </div>

          {/* Banner Ambil Alih Kelas oleh Tim Kesiswaan */}
          {isSubstituteMode && (
            <div className="teacher-journal__kesiswaan-banner mb-5">
              <div className="flex items-center gap-3">
                <ShieldCheck size={22} className="text-amber-500 shrink-0" />
                <div>
                  <div className="teacher-journal__kesiswaan-banner-title">
                    Ambil Alih Kelas KBM oleh Tim Kesiswaan (Piket)
                  </div>
                  <div className="teacher-journal__kesiswaan-banner-sub">
                    Guru Pengampu Asli (<strong>{teacherName}</strong>) sedang berhalangan hadir.
                  </div>
                </div>
              </div>
              <span className="teacher-journal__kesiswaan-pill">
                Topik Pembelajaran Bersifat Opsional
              </span>
            </div>
          )}

          {/* KONDISI A: TAMPILAN DETAIL JURNAL SELESAI (COMPLETED) */}
          {submitted ? (
            <div className="flex flex-col gap-6 max-w-4xl mx-auto my-2">
              <div className="border border-emerald-200 bg-emerald-50/40 rounded-xl p-5 flex flex-col sm:flex-row items-center justify-between gap-4">
                <div className="flex items-center gap-3.5">
                  <div className="w-12 h-12 rounded-full bg-emerald-100 text-emerald-700 flex items-center justify-center shrink-0 border border-emerald-200">
                    <CheckCircle size={28} />
                  </div>
                  <div>
                    <h2 className="text-base font-bold text-gray-900">
                      {isSubstituteMode ? 'Presensi Piket Kesiswaan Selesai' : 'Jurnal KBM & Presensi Selesai Disimpan'}
                    </h2>
                    <p className="text-xs text-gray-600 mt-0.5">
                      Materi pembelajaran, bukti foto dokumentasi KBM, dan data kehadiran siswa serta catatan individual tercatat secara permanen di database.
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    icon={Edit3}
                    onClick={() => {
                      setSubmitted(false);
                      setClassOpened(true);
                    }}
                  >
                    Edit / Perbarui Data
                  </Button>
                </div>
              </div>

              {/* Ringkasan Jurnal: Topik & Foto */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="bg-white border border-gray-200 rounded-xl p-4">
                  <div className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1">
                    Topik Materi Pembelajaran
                  </div>
                  <p className="text-xs text-gray-900 leading-relaxed font-medium">
                    {topic || savedJournalData?.topic_description || '-'}
                  </p>
                </div>

                <div className="bg-white border border-gray-200 rounded-xl p-4 flex items-center justify-between">
                  <div>
                    <div className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1">
                      Statistik Presensi Siswa
                    </div>
                    <div className="flex items-center gap-1.5 flex-wrap">
                      <Badge variant="success">Hadir: {counts.hadir}</Badge>
                      <Badge variant="info">Sakit: {counts.sakit}</Badge>
                      <Badge variant="warning">Izin: {counts.izin}</Badge>
                      <Badge variant="error">Alpa: {counts.alpa}</Badge>
                    </div>
                  </div>
                  {(photoPreview || savedJournalData?.photo_url || savedJournalData?.photo_path) && (
                    <a
                      href={photoPreview || getStorageUrl(savedJournalData?.photo_url || savedJournalData?.photo_path)}
                      target="_blank"
                      rel="noreferrer"
                      className="text-xs text-blue-600 hover:text-blue-800 font-medium inline-flex items-center gap-1"
                    >
                      <Eye size={13} /> Lihat Foto
                    </a>
                  )}
                </div>
              </div>

              {/* Tabel Detail Presensi Siswa */}
              <div className="bg-white border border-gray-200 rounded-xl p-5">
                <div className="flex items-center justify-between mb-3">
                  <h3 className="text-sm font-bold text-gray-900 flex items-center gap-2">
                    <FileText size={16} className="text-amber-500" />
                    Detail Kehadiran &amp; Catatan Siswa ({students.length} Siswa)
                  </h3>
                </div>

                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs border-collapse min-w-[640px]">
                    <thead>
                      <tr className="border-b border-gray-200 bg-gray-50">
                        <th className="py-2 px-3 font-semibold text-gray-600 text-[11px] uppercase tracking-wider w-12">No</th>
                        <th className="py-2 px-3 font-semibold text-gray-600 text-[11px] uppercase tracking-wider w-24">NIS</th>
                        <th className="py-2 px-3 font-semibold text-gray-600 text-[11px] uppercase tracking-wider">Nama Siswa</th>
                        <th className="py-2 px-3 font-semibold text-gray-600 text-[11px] uppercase tracking-wider w-32">Status</th>
                        <th className="py-2 px-3 font-semibold text-gray-600 text-[11px] uppercase tracking-wider">Catatan Siswa</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100">
                      {students.map((st, idx) => {
                        const stStatus = attendance[st.id] || 'Hadir';
                        const note = (studentNotes[st.id] || '').trim();
                        return (
                          <tr key={st.id} className="hover:bg-gray-50/50">
                            <td className="py-2.5 px-3 text-gray-400 font-mono text-xs">{String(idx + 1).padStart(2, '0')}</td>
                            <td className="py-2.5 px-3 font-mono text-gray-700">{st.nis_nip || st.nis || '-'}</td>
                            <td className="py-2.5 px-3 font-medium text-gray-900">{st.name}</td>
                            <td className="py-2.5 px-3">
                              {stStatus === 'Hadir' && <Badge variant="success">Hadir</Badge>}
                              {stStatus === 'Sakit' && <Badge variant="info">Sakit</Badge>}
                              {stStatus === 'Izin' && <Badge variant="warning">Izin</Badge>}
                              {stStatus === 'Alpa' && <Badge variant="error">Alpa</Badge>}
                            </td>
                            <td className="py-2.5 px-3">
                              {note ? (
                                <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded bg-amber-50 text-amber-900 border border-amber-200 font-medium text-xs">
                                  <MessageSquare size={12} className="text-amber-600 shrink-0" />
                                  {note}
                                </span>
                              ) : (
                                <span className="text-gray-400 italic">-</span>
                              )}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          ) : (
            /* KONDISI B: FORM PENGISIAN JURNAL AKTIF & PRESENSI KELAS */
            <form onSubmit={handleSubmit} className="flex flex-col gap-6">
              {/* Box Tugas Titipan Guru jika Kesiswaan */}
              {isSubstituteMode && taskTitipan && (
                <div className="p-4 bg-amber-50 border border-amber-200 rounded-lg text-xs text-amber-950">
                  <span className="font-bold block text-sm mb-1 text-amber-900">
                    📢 Instruksi Tugas Titipan Guru Pengampu Asli:
                  </span>
                  <p className="text-amber-900 text-xs leading-relaxed font-medium">
                    "{taskTitipan}"
                  </p>
                  <span className="text-[11px] text-amber-700 block mt-1.5">
                    Bacakan instruksi di atas kepada siswa di kelas sebelum mengisi absensi kehadiran.
                  </span>
                </div>
              )}

              {/* GRID: Topik Materi & Dokumentasi Foto */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {/* 1. Topik & Materi Pembelajaran */}
                <div className="border border-gray-200 rounded-xl p-5 bg-white flex flex-col gap-3">
                  <div className="flex items-center justify-between">
                    <h2 className="text-sm font-bold text-gray-900">
                      {isSubstituteMode
                        ? '1. Catatan / Kondisi Kelas (Opsional)'
                        : '1. Topik & Materi Pembelajaran'}
                    </h2>
                    {!isSubstituteMode && (
                      <span
                        className={`text-[11px] font-mono ${topic.trim().length >= 10 ? 'text-emerald-600' : 'text-gray-400'}`}
                      >
                        {topic.trim().length}/10 karakter min
                      </span>
                    )}
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-gray-700 mb-1.5">
                      {isSubstituteMode ? (
                        'Catatan Pengawasan Kelas (Opsional - Diisi Kesiswaan)'
                      ) : (
                        <>
                          Topik Pembelajaran <span className="text-red-500">*</span>
                        </>
                      )}
                    </label>
                    <textarea
                      rows={4}
                      required={!isSubstituteMode}
                      value={topic}
                      onChange={(e) => setTopic(e.target.value)}
                      placeholder={
                        isSubstituteMode
                          ? 'Kosongkan jika hanya mengabsen siswa & menyampaikan tugas titipan guru asli...'
                          : 'Contoh: Pemfaktoran Persamaan Kuadrat dan Aplikasi Kontekstual Latihan Soal Bab 2'
                      }
                      className="w-full px-3 py-2 text-xs border border-gray-300 rounded-md focus:outline-none focus:border-gray-900 bg-white"
                    />
                    <span className="text-[11px] text-gray-400 mt-1 block">
                      {isSubstituteMode
                        ? 'Tidak wajib diisi jika materi telah tercakup dalam tugas titipan guru asli.'
                        : 'Wajib diisi minimal 10 karakter untuk rekapitulasi kurikulum sekolah.'}
                    </span>
                  </div>
                </div>

                {/* 2. Dokumentasi Foto Kelas (Wajib Kamera Langsung) */}
                <div className="border border-gray-200 rounded-xl p-5 bg-white flex flex-col gap-3">
                  <div className="flex items-center justify-between">
                    <h2 className="text-sm font-bold text-gray-900">
                      2. Dokumentasi Foto Kelas <span className="text-red-500">*</span>
                    </h2>
                    {compressedFileSize && (
                      <span className="text-[11px] font-mono text-emerald-600 font-semibold">
                        Terkonversi: {compressedFileSize} KB
                      </span>
                    )}
                  </div>

                  <p className="text-xs text-gray-500">
                    Ambil bukti foto kegiatan KBM secara langsung via kamera perangkat.
                  </p>

                  <input
                    ref={fileInputRef}
                    type="file"
                    accept="image/*"
                    capture="environment"
                    className="hidden"
                    style={{ display: 'none' }}
                    onChange={(e) => {
                      const f = e.target.files?.[0];
                      if (f) handlePhotoSelect(f);
                    }}
                  />

                  {photoPreview ? (
                    <div className="teacher-journal__photo-preview">
                      <img
                        src={photoPreview}
                        alt="Pratinjau Foto Dokumentasi KBM"
                        className="teacher-journal__photo-img"
                      />
                      <div className="teacher-journal__photo-badge">
                        <ShieldCheck size={13} />
                        <span>Foto Kamera Terverifikasi</span>
                      </div>
                      <div className="teacher-journal__photo-info">
                        <span className="font-mono text-xs text-gray-700 truncate max-w-[200px] sm:max-w-[280px]">
                          {uploadedPhoto?.name || 'Dokumentasi_KBM.jpg'} ({compressedFileSize || 0} KB)
                        </span>
                        <div className="flex items-center gap-2">
                          <button
                            type="button"
                            className="text-xs font-semibold text-gray-700 hover:text-black flex items-center gap-1 cursor-pointer bg-gray-100 hover:bg-gray-200 px-2 py-1 rounded transition-colors"
                            onClick={() => {
                              handlePhotoSelect(null);
                              startCamera();
                            }}
                          >
                            <RotateCw size={13} /> Ambil Ulang
                          </button>
                          <button
                            type="button"
                            className="text-xs font-semibold text-red-600 hover:text-red-800 flex items-center gap-1 cursor-pointer px-1 py-1"
                            onClick={() => handlePhotoSelect(null)}
                          >
                            <X size={14} /> Hapus
                          </button>
                        </div>
                      </div>
                    </div>
                  ) : isCameraActive ? (
                    <div className="teacher-journal__camera-viewfinder">
                      <video
                        ref={videoRef}
                        autoPlay
                        playsInline
                        muted
                        className="teacher-journal__camera-stream"
                      />
                      <div className="teacher-journal__camera-topbar">
                        <span className="teacher-journal__camera-live-badge">
                          <span className="teacher-journal__live-pulse"></span>
                          KAMERA LANGSUNG
                        </span>
                        <div className="teacher-journal__camera-controls">
                          <button
                            type="button"
                            className="teacher-journal__camera-ctrl-btn"
                            onClick={switchCamera}
                            title="Putar Kamera Depan / Belakang"
                          >
                            <RotateCw size={13} />
                            <span>Putar</span>
                          </button>
                          <button
                            type="button"
                            className="teacher-journal__camera-ctrl-btn"
                            onClick={stopCamera}
                            title="Tutup Kamera"
                          >
                            <X size={14} />
                            <span>Tutup</span>
                          </button>
                        </div>
                      </div>

                      <div className="teacher-journal__camera-bottombar">
                        <button
                          type="button"
                          className="teacher-journal__shutter-btn"
                          onClick={capturePhoto}
                          disabled={isCapturing}
                          title="Ambil Foto Dokumentasi"
                        >
                          <Camera size={26} />
                        </button>
                        <p className="teacher-journal__shutter-hint">
                          {isCapturing ? 'Memproses foto...' : 'Ketuk tombol untuk mengambil foto'}
                        </p>
                      </div>
                    </div>
                  ) : (
                    <div className="teacher-journal__camera-box">
                      <div className="teacher-journal__camera-icon-wrap">
                        <Camera size={24} />
                      </div>
                      <div>
                        <h3 className="teacher-journal__camera-title">Ambil Foto Dokumentasi Langsung</h3>
                        <p className="teacher-journal__camera-desc mt-1">
                          Wajib mengambil foto dokumentasi kelas secara langsung melalui kamera perangkat. Pemilihan dari galeri atau disk dinonaktifkan.
                        </p>
                      </div>

                      <button
                        type="button"
                        onClick={() => startCamera()}
                        className="px-4 py-2 bg-[#FFDE00] hover:bg-[#F5C200] active:scale-95 text-black font-semibold text-xs rounded-lg flex items-center gap-2 cursor-pointer shadow-sm transition-all"
                      >
                        <Camera size={15} />
                        <span>Buka Kamera Perangkat</span>
                      </button>

                      <div className="teacher-journal__camera-warning">
                        <AlertTriangle size={13} />
                        <span>Pengunggahan berkas galeri / disk dinonaktifkan untuk menjaga keaslian dokumentasi.</span>
                      </div>

                      {cameraError && (
                        <div className="text-xs text-red-600 bg-red-50 border border-red-200 rounded p-2 text-center max-w-sm mt-1">
                          {cameraError}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              </div>

              {/* 3. Presensi Kehadiran Siswa (Exception-Based) */}
              <div className="border border-gray-200 rounded-xl p-5 bg-white">
                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-4">
                  <div>
                    <h2 className="text-sm font-bold text-gray-900">
                      3. Presensi Kehadiran Siswa ({students.length} Siswa Terdaftar)
                    </h2>
                    <p className="text-xs text-gray-500 mt-0.5">
                      Secara default seluruh siswa berstatus <strong>Hadir</strong>. Ubah status hanya untuk siswa yang berhalangan hadir.
                    </p>
                  </div>

                  {/* Status Chips Summary */}
                  <div className="teacher-journal__counts-bar">
                    <span className="teacher-journal__count-chip teacher-journal__count-chip--hadir">
                      Hadir: {counts.hadir}
                    </span>
                    <span className="teacher-journal__count-chip teacher-journal__count-chip--sakit">
                      Sakit: {counts.sakit}
                    </span>
                    <span className="teacher-journal__count-chip teacher-journal__count-chip--izin">
                      Izin: {counts.izin}
                    </span>
                    <span className="teacher-journal__count-chip teacher-journal__count-chip--alpa">
                      Alpa: {counts.alpa}
                    </span>
                  </div>
                </div>

                {/* Tabel Presensi Exception-Based */}
                <div className="w-full overflow-x-auto">
                  <table className="w-full text-left text-xs border-collapse min-w-[760px]">
                    <thead>
                      <tr className="border-b border-gray-200 bg-gray-50/70">
                        <th className="py-2.5 px-3 font-semibold text-gray-600 text-[11px] uppercase tracking-wider w-12">
                          No
                        </th>
                        <th className="py-2.5 px-3 font-semibold text-gray-600 text-[11px] uppercase tracking-wider w-24">
                          NIS
                        </th>
                        <th className="py-2.5 px-3 font-semibold text-gray-600 text-[11px] uppercase tracking-wider min-w-[180px]">
                          Nama Peserta Didik
                        </th>
                        <th className="py-2.5 px-3 font-semibold text-gray-600 text-[11px] uppercase tracking-wider min-w-[240px]">
                          Catatan Siswa (Opsional)
                        </th>
                        <th className="py-2.5 px-3 font-semibold text-gray-600 text-[11px] uppercase tracking-wider text-right w-64">
                          Status Kehadiran (Pilih Jika Absen)
                        </th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100">
                      {students.map((st, idx) => {
                        const currentStatus = attendance[st.id] || 'Hadir';
                        const hasApprovedLeave = approvedLeaves.some(
                          (l) => l.student_id === st.id
                        );
                        const currentNote = studentNotes[st.id] || '';

                        return (
                          <tr key={st.id} className="hover:bg-gray-50/50">
                            <td className="py-2.5 px-3 text-gray-400 font-mono text-xs">
                              {String(idx + 1).padStart(2, '0')}
                            </td>
                            <td className="py-2.5 px-3">
                              <code className="font-mono text-[11px] text-gray-700 bg-gray-50 px-1.5 py-0.5 rounded border border-gray-200">
                                {st.nis_nip || st.nis || '-'}
                              </code>
                            </td>
                            <td className="py-2.5 px-3 font-medium text-gray-900">
                              <div className="flex items-center gap-2">
                                <span>{st.name}</span>
                                {hasApprovedLeave && (
                                  <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-semibold bg-blue-50 text-blue-700 border border-blue-200">
                                    <FileCheck2 size={11} /> Surat Izin Resmi
                                  </span>
                                )}
                              </div>
                            </td>
                            <td className="py-2 px-3">
                              <div className="relative flex items-center">
                                <input
                                  type="text"
                                  value={currentNote}
                                  onChange={(e) => handleNoteChange(st.id, e.target.value)}
                                  placeholder="Tulis catatan siswa (opsional)..."
                                  maxLength={500}
                                  className={`w-full text-xs py-1.5 px-2.5 pr-7 rounded border transition-all text-gray-800 placeholder:text-gray-400 outline-none ${
                                    currentNote.trim()
                                      ? 'border-amber-400 bg-amber-50/40 focus:border-amber-500 focus:ring-1 focus:ring-amber-300'
                                      : 'border-gray-200 bg-white hover:bg-gray-50/80 focus:border-gray-400 focus:ring-1 focus:ring-gray-300'
                                  }`}
                                />
                                {currentNote.trim() && (
                                  <button
                                    type="button"
                                    onClick={() => handleNoteChange(st.id, '')}
                                    className="absolute right-2 text-gray-400 hover:text-gray-600 p-0.5 cursor-pointer"
                                    title="Hapus catatan"
                                  >
                                    <X size={12} />
                                  </button>
                                )}
                              </div>
                            </td>
                            <td className="py-2.5 px-3 text-right">
                              <div className="teacher-journal__status-group">
                                {['Hadir', 'Sakit', 'Izin', 'Alpa'].map((stOpt) => {
                                  const isSelected = currentStatus === stOpt;
                                  let activeClass = '';
                                  if (isSelected) {
                                    if (stOpt === 'Hadir') activeClass = 'teacher-journal__status-btn--active-hadir';
                                    if (stOpt === 'Sakit') activeClass = 'teacher-journal__status-btn--active-sakit';
                                    if (stOpt === 'Izin') activeClass = 'teacher-journal__status-btn--active-izin';
                                    if (stOpt === 'Alpa') activeClass = 'teacher-journal__status-btn--active-alpa';
                                  }

                                  return (
                                    <button
                                      key={stOpt}
                                      type="button"
                                      onClick={() => handleStatusChange(st.id, stOpt)}
                                      className={`teacher-journal__status-btn ${activeClass}`}
                                    >
                                      {stOpt}
                                    </button>
                                  );
                                })}
                              </div>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Form Actions */}
              <div className="flex items-center justify-between pt-2">
                <div>
                  {(isKesiswaan() || hasRole('waka')) && (
                    <Button
                      variant="outline"
                      type="button"
                      size="sm"
                      onClick={() => handleMarkTeacherAbsent(schedule)}
                    >
                      Tandai Guru Berhalangan
                    </Button>
                  )}
                </div>

                <div className="flex items-center gap-3">
                  <Button
                    variant="secondary"
                    type="button"
                    onClick={handleCloseWorkingSession}
                  >
                    Batal
                  </Button>
                  {isSubstituteMode ? (
                    <Button
                      type="submit"
                      variant="primary"
                      loading={isSubmitting}
                      disabled={isSubmitting}
                    >
                      Simpan Presensi Piket
                    </Button>
                  ) : (
                    <Button
                      type="submit"
                      variant="primary"
                      loading={isSubmitting}
                    >
                      Simpan Jurnal &amp; Selesaikan Sesi
                    </Button>
                  )}
                </div>
              </div>
            </form>
          )}
        </div>
      )}
    </div>
  );
}
