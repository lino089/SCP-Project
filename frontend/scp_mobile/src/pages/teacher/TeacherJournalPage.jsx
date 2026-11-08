import { useState, useEffect, useMemo, useCallback } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import {
  PlayCircle,
  CheckCircle2,
  ShieldCheck,
  ArrowLeft,
  X,
  Camera,
  CheckSquare,
  AlertCircle,
} from 'lucide-react';
import { useAuth } from '../../hooks/useAuth';
import journalApi from '../../services/journalApi';
import { Button, Badge } from '../../components/shared';
import CameraModal from '../../components/teacher/journal/CameraModal';
import { SkeletonCard, EmptyState } from '../../components/feedback';
import { getStorageUrl, formatDateIndo } from '../../utils/formatters';
import { unwrapList } from '../../utils/responseHelper';
import { todayLocalISO, getJakartaDayInfo } from '../../utils/dateUtils';

export default function TeacherJournalPage() {
  const location = useLocation();
  const navigate = useNavigate();
  const { user, isKesiswaan, isWaliKelas } = useAuth();

  const passedSchedule = location.state?.schedule;
  const [schedule, setSchedule] = useState(passedSchedule || null);
  const [isLoadingInitial, setIsLoadingInitial] = useState(() => !passedSchedule);

  // Journal Session States
  const [journalId, setJournalId] = useState(null);
  const [sessionStatus, setSessionStatus] = useState('not_started'); // 'not_started' | 'ongoing' | 'completed' | 'teacher_absent'
  const [isOpeningSession, setIsOpeningSession] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submittedSuccess, setSubmittedSuccess] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');

  // Form Fields
  const [topic, setTopic] = useState('');
  const [photoFile, setPhotoFile] = useState(null);
  const [photoPreview, setPhotoPreview] = useState(null);
  const [isCameraModalOpen, setIsCameraModalOpen] = useState(false);

  // Clean up object URL on unmount or before new capture
  useEffect(() => {
    return () => {
      if (photoPreview && photoPreview.startsWith('blob:')) {
        URL.revokeObjectURL(photoPreview);
      }
    };
  }, [photoPreview]);

  // Student Attendance (Exception-based)
  const [students, setStudents] = useState([]);
  const [attendanceMap, setAttendanceMap] = useState({});
  const [notesMap, setNotesMap] = useState({});
  const [approvedLeavesMap, setApprovedLeavesMap] = useState({});

  const todayIso = useMemo(() => todayLocalISO(), []);

  // Check substitute mode
  const isSubstitute = useMemo(() => {
    if (!schedule || !user) return false;
    const isOwner = Number(schedule.teacher_id) === Number(user.id);
    const hasSubstituteAuth = Boolean(
      isKesiswaan?.() || isWaliKelas?.(schedule.class_id)
    );
    return !isOwner && hasSubstituteAuth;
  }, [schedule, user, isKesiswaan, isWaliKelas]);

  // Load schedule if not passed via state (P-13: perbaiki fallback jadwal hari ini)
  useEffect(() => {
    if (schedule) return;
    let isMounted = true;
    async function loadDefaultSchedule() {
      try {
        const dayInfo = getJakartaDayInfo();
        const cycle = Number(user?.academic_setting?.active_cycle || user?.active_cycle || 1);
        const res = await journalApi.getTeacherSchedules({ day: dayInfo.dayOfWeek, cycle, per_page: 50 });
        const list = unwrapList(res);
        if (isMounted && list.length > 0) {
          const sorted = [...list].sort(
            (a, b) => Number(a.period_number || 1) - Number(b.period_number || 1)
          );
          setSchedule(sorted[0]);
        }
      } catch {
        // ignore
      } finally {
        if (isMounted) setIsLoadingInitial(false);
      }
    }
    loadDefaultSchedule();
    return () => {
      isMounted = false;
    };
  }, [schedule, user?.academic_setting?.active_cycle, user?.active_cycle]);

  // Check active journal for this schedule & date
  useEffect(() => {
    let isMounted = true;
    async function checkSession() {
      if (!schedule) return;
      try {
        const res = await journalApi.getJournals({
          schedule_id: schedule.id,
          date: todayIso,
        });
        const list = Array.isArray(res) ? res : Array.isArray(res?.data) ? res.data : [];
        if (isMounted && list.length > 0) {
          const j = list[0];
          setJournalId(j.id);
          setSessionStatus(j.status);
          if (j.topic_description) setTopic(j.topic_description);
          if (j.photo_url || j.photo_path) {
            setPhotoPreview(getStorageUrl(j.photo_url || j.photo_path));
          }
        }
      } catch {
        // ignore
      }
    }
    checkSession();
    return () => {
      isMounted = false;
    };
  }, [schedule, todayIso]);

  // Load students for class
  const loadClassStudents = useCallback(async (approvedLeaves = []) => {
    if (!schedule?.class_id) return;
    try {
      const res = await journalApi.getClassStudents(schedule.class_id);
      const list = Array.isArray(res) ? res : Array.isArray(res?.data) ? res.data : [];
      setStudents(list);

      const appMap = {};
      approvedLeaves.forEach((al) => {
        appMap[al.student_id] = al;
      });
      setApprovedLeavesMap(appMap);

      const initialAtt = {};
      list.forEach((st) => {
        if (appMap[st.id]) {
          const leaveType = appMap[st.id].type === 'sakit' ? 'Sakit' : 'Izin';
          initialAtt[st.id] = leaveType;
        } else {
          initialAtt[st.id] = 'Hadir';
        }
      });
      setAttendanceMap(initialAtt);
    } catch (err) {
      console.warn('Gagal memuat siswa kelas:', err);
    }
  }, [schedule]);

  // Open Class Session (Buka Sesi Kelas)
  const handleOpenSession = async () => {
    setIsOpeningSession(true);
    setErrorMessage('');
    try {
      const res = await journalApi.openJournal({
        schedule_id: schedule.id,
        date: todayIso,
      });

      const journalData = res.data?.journal || res.data || res;
      setJournalId(journalData.id);
      setSessionStatus('ongoing');

      const approvedLeaves = res.data?.meta?.approved_leaves || [];
      await loadClassStudents(approvedLeaves);
    } catch (err) {
      setErrorMessage(
        err.response?.data?.message || err.message || 'Gagal membuka sesi kelas KBM.'
      );
    } finally {
      setIsOpeningSession(false);
    }
  };

  // Toggle student status (H / S / I / A)
  const handleStatusChange = (studentId, status) => {
    if (approvedLeavesMap[studentId]) return;
    setAttendanceMap((prev) => ({
      ...prev,
      [studentId]: status,
    }));
  };

  // Attendance summary count
  const attSummary = useMemo(() => {
    let h = 0;
    let s = 0;
    let i = 0;
    let a = 0;
    Object.values(attendanceMap).forEach((val) => {
      if (val === 'Hadir') h++;
      else if (val === 'Sakit') s++;
      else if (val === 'Izin') i++;
      else if (val === 'Alpa') a++;
    });
    return { h, s, i, a };
  }, [attendanceMap]);

  // Complete and Submit Journal
  const handleCompleteJournal = async (e) => {
    if (e) e.preventDefault();
    if (!topic || topic.trim().length < 10) {
      setErrorMessage('Uraian materi KBM wajib diisi minimal 10 karakter.');
      return;
    }
    if (!photoFile && !photoPreview) {
      setErrorMessage('Foto bukti dokumentasi KBM wajib diambil/diunggah.');
      return;
    }

    setIsSubmitting(true);
    setErrorMessage('');

    try {
      const formData = new FormData();
      formData.append('_method', 'PUT');
      formData.append('topic_description', topic.trim());
      if (photoFile) {
        formData.append('photo', photoFile);
      }

      let excIdx = 0;
      Object.entries(attendanceMap).forEach(([stId, status]) => {
        if (status !== 'Hadir') {
          formData.append(`exceptions[${excIdx}][student_id]`, Number(stId));
          formData.append(`exceptions[${excIdx}][status]`, status);
          if (notesMap[stId]) {
            formData.append(`exceptions[${excIdx}][notes]`, notesMap[stId]);
          }
          excIdx++;
        }
      });

      let noteIdx = 0;
      Object.entries(notesMap).forEach(([stId, noteText]) => {
        if (noteText && noteText.trim()) {
          formData.append(`student_notes[${noteIdx}][student_id]`, Number(stId));
          formData.append(`student_notes[${noteIdx}][notes]`, noteText.trim());
          noteIdx++;
        }
      });

      await journalApi.completeJournal(journalId, formData);
      setSessionStatus('completed');
      setSubmittedSuccess(true);
    } catch (err) {
      setErrorMessage(
        err.response?.data?.message || err.message || 'Gagal menyelesaikan jurnal KBM.'
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  if (isLoadingInitial) {
    return (
      <div className="space-y-4">
        <SkeletonCard count={3} />
      </div>
    );
  }

  if (!schedule) {
    return (
      <div className="space-y-4">
        <EmptyState
          title="Jadwal Tidak Ditemukan"
          message="Tidak ada jadwal KBM yang dipilih atau aktif saat ini."
          actionLabel="Kembali ke Dashboard"
          onAction={() => navigate('/teacher/dashboard')}
        />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Top Bar Navigation */}
      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={() => navigate(-1)}
          className="p-1.5 rounded-[14px] border border-[var(--color-border-subtle)] bg-[var(--color-surface)] text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)]"
          aria-label="Kembali"
        >
          <ArrowLeft size={16} />
        </button>
        <div>
          <h1 className="text-sm font-bold text-[var(--color-text-primary)]">Jurnal KBM &amp; Presensi</h1>
          <p className="text-[11px] text-[var(--color-text-muted)]">
            {formatDateIndo(todayIso)} • Jam Ke-{schedule.period_number}
          </p>
        </div>
      </div>

      {/* Substitute Teacher Banner */}
      {isSubstitute && (
        <div className="p-3 bg-[var(--color-warning-bg)] border border-[var(--color-warning-border)] rounded-[14px] flex items-start gap-2.5">
          <ShieldCheck className="text-[var(--color-warning-fg)] shrink-0 mt-0.5" size={16} />
          <div className="text-[11px] text-[var(--color-warning-fg)] leading-relaxed">
            <span className="font-bold">Mode Pengganti / Piket:</span> Anda bertindak sebagai guru pengganti resmi untuk jadwal <span className="font-bold">{schedule.teacher?.name}</span>.
          </div>
        </div>
      )}

      {/* Schedule Info Card */}
      <section className="surface-card p-4 space-y-2">
        <div className="flex items-center gap-2 flex-wrap">
          <Badge variant="neutral" size="sm">
            {schedule.school_class?.name || 'Rombel'}
          </Badge>
          <Badge variant="neutral" size="sm" mono>
            Jam {schedule.period_number} · {schedule.duration_periods} JP
          </Badge>
          {sessionStatus === 'completed' && (
            <Badge variant="success" size="sm" dot>
              Selesai
            </Badge>
          )}
          {sessionStatus === 'ongoing' && (
            <Badge variant="warning" size="sm" dot>
              Berjalan
            </Badge>
          )}
        </div>

        <h2 className="card-title">
          {schedule.subject?.name || 'Mata Pelajaran'}
        </h2>
        <p className="text-meta">
          Pengampu: {schedule.teacher?.name || '-'} · Ruang: {schedule.room?.name || '-'}
        </p>
      </section>

      {/* Error Banner */}
      {errorMessage && (
        <div className="p-3 bg-[var(--color-danger-bg)] border border-[var(--color-danger-border)] text-[var(--color-danger-fg)] text-xs rounded-[14px] flex items-start gap-2">
          <AlertCircle size={16} className="shrink-0 mt-0.5" />
          <span className="flex-1">{errorMessage}</span>
          <button type="button" onClick={() => setErrorMessage('')}>
            <X size={14} />
          </button>
        </div>
      )}

      {/* SUCCESS CONFIRMATION VIEW */}
      {submittedSuccess ? (
        <div className="surface-card p-6 text-center space-y-3 shadow-[var(--shadow-card)]">
          <div className="w-12 h-12 bg-[var(--color-success-bg)] text-[var(--color-success-fg)] rounded-full flex items-center justify-center mx-auto">
            <CheckCircle2 size={28} />
          </div>
          <h3 className="text-sm font-bold text-[var(--color-text-primary)]">Jurnal KBM Berhasil Disimpan</h3>
          <p className="text-xs text-[var(--color-text-secondary)] leading-relaxed">
            Laporan KBM materi "{topic}" beserta presensi {students.length} siswa telah tercatat di sistem.
          </p>
          <Button
            variant="primary"
            onClick={() => navigate('/teacher/dashboard')}
            className="w-full text-xs font-bold py-2.5 mt-2 bg-[var(--color-warning-bg)] text-[var(--color-text-primary)]"
          >
            Kembali ke Dashboard Guru
          </Button>
        </div>
      ) : sessionStatus === 'completed' ? (
        <div className="surface-card p-4 space-y-3 shadow-[var(--shadow-card)]">
          <div className="flex items-center gap-2 text-[var(--color-success-fg)]">
            <CheckCircle2 size={18} />
            <h3 className="text-xs font-bold">Sesi KBM Telah Selesai</h3>
          </div>
          <div className="p-3 bg-[var(--color-bg-app)] rounded-[14px] space-y-1 text-xs">
            <p className="font-semibold text-[var(--color-text-primary)]">Uraian Materi:</p>
            <p className="text-[var(--color-text-secondary)] italic">"{topic}"</p>
          </div>
          {photoPreview && (
            <div className="rounded-[14px] overflow-hidden border border-[var(--color-border-subtle)] max-h-48">
              <img src={photoPreview} alt="Bukti KBM" className="w-full h-full object-cover" />
            </div>
          )}
          <Button
            variant="secondary"
            onClick={() => navigate('/teacher/dashboard')}
            className="w-full text-xs font-bold py-2"
          >
            Kembali ke Dashboard
          </Button>
        </div>
      ) : sessionStatus === 'not_started' ? (
        /* STEP 1: BUKA SESI KELAS */
        <div className="surface-card p-6 text-center space-y-3 shadow-[var(--shadow-card)]">
          <div className="w-12 h-12 bg-[var(--color-brand-soft)] text-[var(--color-brand-text)] rounded-full flex items-center justify-center mx-auto">
            <PlayCircle size={28} />
          </div>
          <h3 className="text-sm font-bold text-[var(--color-text-primary)]">Mulai Sesi Kelas KBM</h3>
          <p className="text-xs text-[var(--color-text-secondary)] leading-relaxed">
            Buka sesi untuk memuat daftar presensi siswa dan mencatat waktu mulai pembelajaran.
          </p>
          <Button
            variant="primary"
            onClick={handleOpenSession}
            disabled={isOpeningSession}
            className="w-full text-xs font-bold py-3 bg-[var(--color-warning-bg)] hover:bg-[var(--color-brand)] text-[var(--color-text-primary)] gap-2"
          >
            <PlayCircle size={16} />
            {isOpeningSession ? 'Membuka Sesi...' : 'Buka Sesi Kelas Sekarang'}
          </Button>
        </div>
      ) : (
        /* STEP 2: ONGOING SESSION */
        <form onSubmit={handleCompleteJournal} className="space-y-4">
          <div className="surface-card p-3.5 shadow-[var(--shadow-card)] space-y-2">
            <div className="flex items-center justify-between">
              <label className="text-xs font-bold text-[var(--color-text-primary)]">Uraian Materi KBM</label>
              <span className={`text-[11px] font-mono ${topic.length < 10 ? 'text-rose-500' : 'text-[var(--color-success-fg)]'}`}>
                {topic.length}/10 karakter min
              </span>
            </div>
            <textarea
              rows={3}
              value={topic}
              onChange={(e) => setTopic(e.target.value)}
              placeholder="Jelaskan pokok bahasan, kompetensi dasar, atau aktivitas KBM yang diajarkan..."
              className="w-full text-xs p-3 field-area focus:outline-hidden focus:border-[var(--color-brand)] leading-relaxed"
              required
            />
          </div>

          <div className="surface-card p-3.5 shadow-[var(--shadow-card)] space-y-2.5">
            <div className="flex items-center justify-between">
              <label className="text-xs font-bold text-[var(--color-text-primary)]">Foto Dokumentasi Kelas</label>
              <span className="text-[11px] text-[var(--color-text-muted)] font-mono">&lt; 150 KB JPEG</span>
            </div>

            {photoPreview ? (
              <div className="relative rounded-[14px] overflow-hidden border border-[var(--color-border-subtle)] max-h-52 bg-[var(--color-text-primary)]">
                <img
                  src={photoPreview}
                  alt="Preview Bukti KBM"
                  className="w-full h-full object-cover max-h-52"
                />
                <button
                  type="button"
                  onClick={() => {
                    if (photoPreview && photoPreview.startsWith('blob:')) {
                      URL.revokeObjectURL(photoPreview);
                    }
                    setPhotoFile(null);
                    setPhotoPreview(null);
                  }}
                  className="absolute top-2 right-2 p-1.5 bg-black/60 text-white rounded-full hover:bg-black"
                  aria-label="Hapus Foto"
                >
                  <X size={14} />
                </button>
              </div>
            ) : (
              <Button
                type="button"
                variant="secondary"
                onClick={() => setIsCameraModalOpen(true)}
                className="btn--stacked w-full py-4 border-2 border-dashed border-[var(--color-border-strong)] rounded-[14px] flex flex-col items-center justify-center gap-1.5 text-[var(--color-text-secondary)] hover:border-[var(--color-brand)] hover:text-[var(--color-text-primary)]"
              >
                <Camera size={24} className="text-[var(--color-brand-text)]" />
                <span className="text-xs font-bold">Ambil Foto Bukti Mengajar</span>
                <span className="text-[11px] text-[var(--color-text-muted)]">Gunakan kamera langsung atau galeri HP</span>
              </Button>
            )}
          </div>

          <div className="surface-card p-3.5 shadow-[var(--shadow-card)] space-y-3">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-xs font-bold text-[var(--color-text-primary)]">Presensi Siswa Kelas</h3>
                <p className="text-[11px] text-[var(--color-text-muted)]">
                  Default: Hadir. Sentuh tombol untuk siswa yang tidak masuk.
                </p>
              </div>

              <div className="flex items-center gap-1 text-[11px] font-mono font-bold">
                <span className="text-[var(--color-success-fg)] bg-[var(--color-success-bg)] px-1.5 py-0.5 rounded-[6px]">H:{attSummary.h}</span>
                <span className="text-[var(--color-warning-fg)] bg-[var(--color-warning-bg)] px-1.5 py-0.5 rounded-[6px]">S:{attSummary.s}</span>
                <span className="text-[var(--color-info-fg)] bg-[var(--color-info-bg)] px-1.5 py-0.5 rounded-[6px]">I:{attSummary.i}</span>
                <span className="text-[var(--color-danger-fg)] bg-[var(--color-danger-bg)] px-1.5 py-0.5 rounded-[6px]">A:{attSummary.a}</span>
              </div>
            </div>

            <div className="space-y-2 max-h-96 overflow-y-auto pr-1">
              {students.map((student, idx) => {
                const currentStatus = attendanceMap[student.id] || 'Hadir';
                const approvedLeave = approvedLeavesMap[student.id];

                return (
                  <div
                    key={student.id}
                    className="p-2.5 bg-[var(--color-bg-app)]/70 border border-[var(--color-border-light)] rounded-[14px] space-y-1.5"
                  >
                    <div className="flex items-center justify-between gap-2">
                      <div className="flex-1 min-w-0">
                        <p className="text-xs font-bold text-[var(--color-text-primary)] truncate">
                          {idx + 1}. {student.name}
                        </p>
                        <p className="text-[11px] text-[var(--color-text-muted)] font-mono">
                          NIS: {student.nis_nip || '-'}
                        </p>
                      </div>

                      {approvedLeave ? (
                        <Badge variant="info" size="sm">
                          Izin Disetujui ({approvedLeave.type})
                        </Badge>
                      ) : (
                        <div className="flex gap-1 shrink-0">
                          {['Hadir', 'Sakit', 'Izin', 'Alpa'].map((st) => {
                            const isSelected = currentStatus === st;
                            const colorClass =
                              st === 'Hadir'
                                ? isSelected
                                  ? 'bg-emerald-600 text-white font-bold'
                                  : 'bg-[var(--color-surface)] text-[var(--color-text-secondary)]'
                                : st === 'Sakit'
                                ? isSelected
                                  ? 'bg-[var(--color-warning-bg)]0 text-white font-bold'
                                  : 'bg-[var(--color-surface)] text-[var(--color-text-secondary)]'
                                : st === 'Izin'
                                ? isSelected
                                  ? 'bg-blue-600 text-white font-bold'
                                  : 'bg-[var(--color-surface)] text-[var(--color-text-secondary)]'
                                : isSelected
                                ? 'bg-rose-600 text-white font-bold'
                                : 'bg-[var(--color-surface)] text-[var(--color-text-secondary)]';

                            return (
                              <button
                                key={st}
                                type="button"
                                onClick={() => handleStatusChange(student.id, st)}
                                className={`px-2 py-1 rounded-[10px] text-[11px] border border-[var(--color-border-subtle)] transition-all ${colorClass}`}
                              >
                                {st[0]}
                              </button>
                            );
                          })}
                        </div>
                      )}
                    </div>

                    {currentStatus !== 'Hadir' && !approvedLeave && (
                      <input
                        type="text"
                        placeholder="Keterangan ketidakhadiran siswa..."
                        value={notesMap[student.id] || ''}
                        onChange={(e) =>
                          setNotesMap({ ...notesMap, [student.id]: e.target.value })
                        }
                        className="w-full text-[11px] p-1.5 field-area focus:outline-hidden focus:border-[var(--color-brand)]"
                      />
                    )}
                  </div>
                );
              })}
            </div>
          </div>

          <Button
            type="submit"
            variant="primary"
            disabled={isSubmitting}
            className="w-full text-xs font-bold py-3 bg-[var(--color-warning-bg)] hover:bg-[var(--color-brand)] text-[var(--color-text-primary)] gap-2 shadow-[var(--shadow-card)]"
          >
            <CheckSquare size={16} />
            {isSubmitting ? 'Menyimpan Jurnal...' : 'Selesaikan & Simpan Jurnal KBM'}
          </Button>
        </form>
      )}

      {/* Camera Modal */}
      <CameraModal
        isOpen={isCameraModalOpen}
        onClose={() => setIsCameraModalOpen(false)}
        onPhotoCaptured={(file, previewUrl) => {
          setPhotoFile(file);
          setPhotoPreview(previewUrl);
        }}
      />
    </div>
  );
}
