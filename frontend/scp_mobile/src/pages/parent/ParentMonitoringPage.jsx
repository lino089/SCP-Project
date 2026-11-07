import { useState, useEffect, useMemo, useCallback } from 'react';
import {
  FileText,
  Eye,
  AlertCircle,
  RotateCw,
  Calendar,
  GraduationCap,
  Sparkles,
  ExternalLink,
} from 'lucide-react';
import { useAuth } from '../../hooks/useAuth';
import leaveApi from '../../services/leaveApi';
import { quizApi } from '../../services/quizApi';
import { scheduleApi, academicSettingApi } from '../../services/scheduleApi';
import academicEventApi from '../../services/academicEventApi';
import { getStorageUrl, getFallbackStorageUrl } from '../../utils/formatters';
import { MobileScheduleTimeline } from '../../components/schedule';
import {
  Badge,
  Button,
  BottomSheetModal,
  Card,
} from '../../components/shared';

export default function ParentMonitoringPage() {
  const { user } = useAuth();
  const [activeTab, setActiveTab] = useState('attendance');
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(null);

  // Monitoring Data
  const [attendances, setAttendances] = useState([]);
  const [leaveRequests, setLeaveRequests] = useState([]);
  const [quizzes, setQuizzes] = useState([]);
  const [childSchedules, setChildSchedules] = useState([]);
  const [childEvent, setChildEvent] = useState(null);
  const [previewDoc, setPreviewDoc] = useState(null);
  const [docLoadError, setDocLoadError] = useState(false);
  const [docSourceUrl, setDocSourceUrl] = useState('');

  // Schedule Timeline Settings
  const currentDayOfWeek = useMemo(() => {
    const day = new Date().getDay();
    if (day >= 1 && day <= 5) return day;
    return 1;
  }, []);
  const [selectedCycle, setSelectedCycle] = useState(() => Number(user?.active_cycle || 1));
  const [selectedDay, setSelectedDay] = useState(currentDayOfWeek);
  const [periodTemplates, setPeriodTemplates] = useState([]);
  const [mondayIsUpacara, setMondayIsUpacara] = useState(true);

  // Child Profile Information
  const child = useMemo(() => {
    const student = user?.linked_student || user?.linkedStudent;
    const schoolClass = student?.school_class || student?.schoolClass;
    const isLinked = Boolean(user?.linked_student_id && student);

    return {
      studentName: student?.name || (isLinked ? '-' : 'Siswa Belum Ditautkan'),
      nis: student?.nis_nip || student?.nis || '-',
      className: schoolClass?.name || (isLinked ? '-' : 'Kelas Belum Ditentukan'),
      classId: student?.class_id || null,
      guardianName: user?.name || 'Wali Siswa',
      academicYear: user?.academic_year || '2025/2026 Ganjil',
      isLinked,
    };
  }, [user]);

  // Fetch Data Monitoring
  const fetchMonitoringData = useCallback(async () => {
    setLoadError(null);
    try {
      const todayStr = new Date().toISOString().split('T')[0];

      const [attRes, leaveRes, quizRes, schedRes, eventRes, tplRes, setRes] = await Promise.all([
        leaveApi.getAttendances({ per_page: 50 }).catch(() => ({ data: [] })),
        leaveApi.getLeaveRequests({ per_page: 50 }).catch(() => ({ data: [] })),
        quizApi.getQuizzes({ status: 'published_result', per_page: 50 }).catch(() => ({ data: [] })),
        child.classId
          ? scheduleApi.getSchedules({ class_id: child.classId, cycle: selectedCycle, per_page: 100 }).catch(() => ({ data: [] }))
          : Promise.resolve({ data: [] }),
        child.classId
          ? academicEventApi.checkExemption({ class_id: child.classId, date: todayStr }).catch(() => ({ data: { data: {} } }))
          : Promise.resolve({ data: { data: {} } }),
        academicSettingApi.getPeriodTemplates().catch(() => ({ data: [] })),
        academicSettingApi.getSettings().catch(() => ({ data: {} })),
      ]);

      // Presensi
      const attList = Array.isArray(attRes) ? attRes : Array.isArray(attRes?.data) ? attRes.data : [];
      setAttendances(attList);

      // Surat Izin
      const leaveList = Array.isArray(leaveRes) ? leaveRes : Array.isArray(leaveRes?.data) ? leaveRes.data : [];
      setLeaveRequests(leaveList);

      // Kuis yang sudah dipublikasikan nilainya
      const quizList = Array.isArray(quizRes) ? quizRes : Array.isArray(quizRes?.data) ? quizRes.data : [];
      setQuizzes(quizList.filter((q) => q.status === 'published_result'));

      // Jadwal Belajar
      const schedList = Array.isArray(schedRes) ? schedRes : Array.isArray(schedRes?.data) ? schedRes.data : [];
      setChildSchedules(schedList);

      // Agenda Hari Ini
      const eventData = eventRes?.data?.data;
      if (eventData?.disabling_event) {
        setChildEvent(eventData.disabling_event);
      } else {
        setChildEvent(null);
      }

      // Templates
      if (tplRes?.data && Array.isArray(tplRes.data)) {
        setPeriodTemplates(tplRes.data);
      }
      if (typeof setRes?.data?.monday_is_upacara === 'boolean') {
        setMondayIsUpacara(setRes.data.monday_is_upacara);
      }
    } catch (err) {
      console.warn('Gagal memuat data monitoring anak:', err);
      setLoadError(err.message || 'Gagal memuat data monitoring anak dari server.');
    } finally {
      setLoading(false);
    }
  }, [child.classId, selectedCycle]);

  useEffect(() => {
    let cancel = false;
    async function init() {
      try {
        await fetchMonitoringData();
      } catch {
        if (!cancel) setLoadError('Gagal menghubungkan ke server.');
      }
    }
    init();
    return () => {
      cancel = true;
    };
  }, [fetchMonitoringData]);

  const handleRefresh = async () => {
    setLoading(true);
    await fetchMonitoringData();
  };

  // Ringkasan Kehadiran
  const summary = useMemo(() => {
    return attendances.reduce(
      (acc, item) => {
        const st = (item.status || '').toLowerCase();
        if (st === 'hadir' || st === 'present') acc.hadir += 1;
        else if (st === 'sakit' || st === 'sick') acc.sakit += 1;
        else if (st === 'izin' || st === 'permit') acc.izin += 1;
        else if (st === 'alpa' || st === 'absent') acc.alpa += 1;
        return acc;
      },
      { hadir: 0, sakit: 0, izin: 0, alpa: 0 }
    );
  }, [attendances]);

  // Attendance Alert Warning
  const attendanceWarning = useMemo(() => {
    if (summary.alpa > 0) {
      return {
        type: 'danger',
        title: 'Peringatan Ketidakhadiran (Alpa)',
        message: `Terdeteksi ${summary.alpa} catatan alpa tanpa keterangan pada KBM aktif. Mohon koordinasi dengan Wali Kelas ${child.className}.`,
      };
    }
    if (summary.sakit + summary.izin >= 5) {
      return {
        type: 'warning',
        title: 'Pemberitahuan Akumulasi Izin/Sakit',
        message: `Ananda telah tercatat izin/sakit sebanyak ${summary.sakit + summary.izin} hari. Pastikan materi KBM yang tertinggal tetap dipelajari.`,
      };
    }
    return null;
  }, [summary, child.className]);

  // Open Document Preview
  const handleOpenDocPreview = (item) => {
    setPreviewDoc(item);
    setDocLoadError(false);
    const targetPath = item.document_url || item.document_path;
    setDocSourceUrl(getStorageUrl(targetPath));
  };

  const isImageDoc = useMemo(() => {
    if (!previewDoc?.document_path && !previewDoc?.document_url) return false;
    const path = previewDoc.document_path || previewDoc.document_url;
    const ext = path.split('.').pop()?.toLowerCase();
    return ['jpg', 'jpeg', 'png', 'webp', 'gif'].includes(ext);
  }, [previewDoc]);

  return (
    <div className="space-y-4">
      {/* Kartu Profil Anak Tertaut */}
      <div className="surface-card p-4 mb-4">
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-full bg-[var(--color-info-bg)] border border-[var(--color-info-border)] text-[var(--color-info-fg)] flex items-center justify-center font-bold text-base shrink-0">
              {child.studentName.charAt(0).toUpperCase()}
            </div>
            <div>
              <div className="flex items-center gap-1.5 flex-wrap">
                <span className="font-semibold text-[var(--color-text-primary)] text-sm">
                  {child.studentName}
                </span>
                <Badge variant={child.isLinked ? 'info' : 'warning'} className="text-[11px] px-1.5 py-0">
                  {child.isLinked ? 'Anak Tertaut' : 'Belum Tertaut'}
                </Badge>
              </div>
              <div className="text-xs text-[var(--color-text-secondary)] flex items-center gap-2 mt-0.5 font-mono">
                <span>NIS: {child.nis}</span>
                <span>•</span>
                <span className="text-[var(--color-text-primary)] font-sans font-medium flex items-center gap-1">
                  <GraduationCap className="w-3.5 h-3.5 text-[var(--color-text-muted)]" />
                  {child.className}
                </span>
              </div>
            </div>
          </div>

          <button
            onClick={handleRefresh}
            disabled={loading}
            aria-label="Refresh data"
            className="p-2 rounded-[10px] text-[var(--color-text-muted)] hover:text-[var(--color-text-secondary)] hover:bg-[var(--color-surface-subtle)] transition-colors"
          >
            <RotateCw className={`w-4 h-4 ${loading ? 'animate-spin text-[var(--color-warning-fg)]' : ''}`} />
          </button>
        </div>

        <div className="mt-3 pt-3 border-t border-[var(--color-border-light)] flex items-center justify-between text-xs text-[var(--color-text-secondary)]">
          <span>Wali: <strong className="text-[var(--color-text-primary)]">{child.guardianName}</strong></span>
          <span className="font-mono text-[11px] bg-[var(--color-surface-subtle)] text-[var(--color-text-primary)] px-2 py-0.5 rounded-[6px]">
            {child.academicYear}
          </span>
        </div>
      </div>

      {/* Warning Banner */}
      {attendanceWarning && (
        <div
          className={`mb-4 p-3.5 rounded-[14px] border flex items-start gap-3 text-xs ${
            attendanceWarning.type === 'danger'
              ? 'bg-[var(--color-danger-bg)] border-[var(--color-danger-border)] text-[var(--color-danger-fg)]'
              : 'bg-[var(--color-warning-bg)] border-[var(--color-warning-border)] text-[var(--color-warning-fg)]'
          }`}
        >
          <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
          <div>
            <span className="font-semibold block">{attendanceWarning.title}</span>
            <span className="text-[var(--color-text-secondary)] mt-0.5 block">{attendanceWarning.message}</span>
          </div>
        </div>
      )}

      {/* Disabling Event Banner */}
      {childEvent && (
        <div className="mb-4 p-3.5 bg-[var(--color-info-bg)] border border-[var(--color-info-border)] rounded-[14px] flex items-start gap-3 text-[var(--color-info-fg)] text-xs">
          <Calendar className="w-4 h-4 shrink-0 text-[var(--color-info-fg)] mt-0.5" />
          <div>
            <span className="font-semibold block">{childEvent.title}</span>
            <span className="text-[var(--color-text-secondary)] mt-0.5 block">
              Agenda sekolah hari ini meniadakan kegiatan pembelajaran reguler di kelas ananda.
            </span>
          </div>
        </div>
      )}

      {/* Error Alert */}
      {loadError && (
        <div className="mb-4 p-3.5 bg-[var(--color-danger-bg)] border border-[var(--color-danger-border)] rounded-[10px] flex items-center justify-between gap-3 text-[var(--color-danger-fg)] text-xs">
          <div className="flex items-center gap-2">
            <AlertCircle className="w-4 h-4 shrink-0 text-[var(--color-danger-fg)]" />
            <span>{loadError}</span>
          </div>
          <Button
            size="sm"
            variant="outline"
            onClick={handleRefresh}
            className="shrink-0 text-[var(--color-danger-fg)] border-[var(--color-danger-border)] hover:bg-[var(--color-danger-bg)]"
          >
            Coba Lagi
          </Button>
        </div>
      )}

      {/* 4 Stat Ringkasan Kehadiran */}
      <div className="grid grid-cols-4 gap-2 mb-4">
        <div className="bg-[var(--color-surface)] border border-[var(--color-success-border)] rounded-[14px] p-2.5 text-center shadow-[var(--shadow-card)]">
          <span className="block text-[11px] text-[var(--color-success-fg)] font-semibold mb-0.5">Hadir</span>
          <span className="text-lg font-bold font-mono text-[var(--color-success-fg)]">
            {loading ? '…' : summary.hadir}
          </span>
        </div>
        <div className="bg-[var(--color-surface)] border border-[var(--color-info-border)] rounded-[14px] p-2.5 text-center shadow-[var(--shadow-card)]">
          <span className="block text-[11px] text-[var(--color-info-fg)] font-semibold mb-0.5">Sakit</span>
          <span className="text-lg font-bold font-mono text-[var(--color-info-fg)]">
            {loading ? '…' : summary.sakit}
          </span>
        </div>
        <div className="bg-[var(--color-surface)] border border-[var(--color-warning-border)] rounded-[14px] p-2.5 text-center shadow-[var(--shadow-card)]">
          <span className="block text-[11px] text-[var(--color-warning-fg)] font-semibold mb-0.5">Izin</span>
          <span className="text-lg font-bold font-mono text-[var(--color-warning-fg)]">
            {loading ? '…' : summary.izin}
          </span>
        </div>
        <div className="bg-[var(--color-surface)] border border-[var(--color-danger-border)] rounded-[14px] p-2.5 text-center shadow-[var(--shadow-card)]">
          <span className="block text-[11px] text-[var(--color-danger-fg)] font-semibold mb-0.5">Alpa</span>
          <span className="text-lg font-bold font-mono text-[var(--color-danger-fg)]">
            {loading ? '…' : summary.alpa}
          </span>
        </div>
      </div>

      {/* Segmented Tab Pemantauan (4 Tab) */}
      <div className="bg-[var(--color-surface-subtle)] p-1 rounded-[14px] grid grid-cols-4 gap-1 mb-4 text-center">
        <button
          onClick={() => setActiveTab('attendance')}
          className={`py-1.5 text-[11px] font-semibold rounded-[10px] transition-all ${
            activeTab === 'attendance'
              ? 'bg-[var(--color-surface)] text-[var(--color-text-primary)] shadow-[var(--shadow-card)]'
              : 'text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)]'
          }`}
        >
          Presensi
        </button>
        <button
          onClick={() => setActiveTab('permissions')}
          className={`py-1.5 text-[11px] font-semibold rounded-[10px] transition-all ${
            activeTab === 'permissions'
              ? 'bg-[var(--color-surface)] text-[var(--color-text-primary)] shadow-[var(--shadow-card)]'
              : 'text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)]'
          }`}
        >
          Surat Izin
        </button>
        <button
          onClick={() => setActiveTab('quizzes')}
          className={`py-1.5 text-[11px] font-semibold rounded-[10px] transition-all ${
            activeTab === 'quizzes'
              ? 'bg-[var(--color-surface)] text-[var(--color-text-primary)] shadow-[var(--shadow-card)]'
              : 'text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)]'
          }`}
        >
          Nilai Kuis
        </button>
        <button
          onClick={() => setActiveTab('schedule')}
          className={`py-1.5 text-[11px] font-semibold rounded-[10px] transition-all ${
            activeTab === 'schedule'
              ? 'bg-[var(--color-surface)] text-[var(--color-text-primary)] shadow-[var(--shadow-card)]'
              : 'text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)]'
          }`}
        >
          Jadwal
        </button>
      </div>

      {/* =====================================
          TAB 1: PRESENSI KBM
         ===================================== */}
      {activeTab === 'attendance' && (
        <div className="space-y-2.5">
          <h2 className="text-xs font-bold text-[var(--color-text-primary)] uppercase tracking-wider px-0.5">
            Riwayat Presensi KBM Ananda
          </h2>

          {loading ? (
            <div className="space-y-2">
              {[1, 2, 3].map((i) => (
                <div key={i} className="h-20 bg-[var(--color-surface-subtle)] rounded-[14px] animate-pulse" />
              ))}
            </div>
          ) : attendances.length === 0 ? (
            <Card className="p-8 text-center bg-[var(--color-surface)] border border-dashed border-[var(--color-border-subtle)]">
              <Calendar className="w-8 h-8 text-[var(--color-text-muted)] mx-auto mb-2" />
              <p className="text-xs font-semibold text-[var(--color-text-primary)]">Belum ada data presensi tercatat</p>
              <p className="text-[11px] text-[var(--color-text-muted)] mt-0.5">
                Presensi akan tercatat setiap guru membuka dan menyelesaikan sesi KBM.
              </p>
            </Card>
          ) : (
            attendances.map((item, idx) => {
              const st = (item.status || '').toLowerCase();
              return (
                <div
                  key={item.id || idx}
                  className="surface-card p-3.5 space-y-2"
                >
                  <div className="flex items-center justify-between text-xs">
                    <span className="font-mono font-semibold text-[var(--color-text-primary)]">
                      {item.date || (item.created_at ? item.created_at.split('T')[0] : '-')}
                    </span>
                    {st === 'hadir' || st === 'present' ? (
                      <Badge variant="success">Hadir</Badge>
                    ) : st === 'sakit' || st === 'sick' ? (
                      <Badge variant="info">Sakit</Badge>
                    ) : st === 'izin' || st === 'permit' ? (
                      <Badge variant="warning">Izin</Badge>
                    ) : (
                      <Badge variant="error">Alpa</Badge>
                    )}
                  </div>

                  <p className="text-xs text-[var(--color-text-primary)]">
                    {item.journal?.topic_description ||
                      item.journal?.schedule?.subject?.name ||
                      'Sesi pembelajaran reguler'}
                  </p>

                  {item.notes && (
                    <div className="text-[11px] text-[var(--color-warning-fg)] bg-[var(--color-warning-bg)] border border-[var(--color-warning-border)]/60 rounded-[6px] px-2 py-1 font-medium">
                      Catatan Guru: {item.notes}
                    </div>
                  )}
                </div>
              );
            })
          )}
        </div>
      )}

      {/* =====================================
          TAB 2: SURAT IZIN
         ===================================== */}
      {activeTab === 'permissions' && (
        <div className="space-y-2.5">
          <h2 className="text-xs font-bold text-[var(--color-text-primary)] uppercase tracking-wider px-0.5">
            Riwayat Surat Izin Ananda
          </h2>

          {loading ? (
            <div className="space-y-2">
              {[1, 2, 3].map((i) => (
                <div key={i} className="h-20 bg-[var(--color-surface-subtle)] rounded-[14px] animate-pulse" />
              ))}
            </div>
          ) : leaveRequests.length === 0 ? (
            <Card className="p-8 text-center bg-[var(--color-surface)] border border-dashed border-[var(--color-border-subtle)]">
              <FileText className="w-8 h-8 text-[var(--color-text-muted)] mx-auto mb-2" />
              <p className="text-xs font-semibold text-[var(--color-text-primary)]">Tidak ada pengajuan perizinan</p>
              <p className="text-[11px] text-[var(--color-text-muted)] mt-0.5">
                Surat izin sakit atau dispensasi yang diajukan akan tampil di sini.
              </p>
            </Card>
          ) : (
            leaveRequests.map((item) => {
              const statusKey = (item.status_approval || item.status || '').toLowerCase();
              const isApproved = statusKey === 'approved' || statusKey === 'disetujui';
              const isPending = statusKey === 'pending';

              return (
                <div
                  key={item.id}
                  className="surface-card p-3.5 space-y-2"
                >
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <div className="flex items-center gap-1.5">
                        <span className="font-semibold text-xs text-[var(--color-text-primary)]">
                          {item.type === 'tidak_masuk'
                            ? 'Tidak Masuk Sekolah'
                            : 'Dispensasi Keluar'}
                        </span>
                        <Badge variant="outline" className="text-[11px] capitalize px-1 py-0">
                          {item.category}
                        </Badge>
                      </div>
                      <span className="text-[11px] text-[var(--color-text-secondary)] font-mono mt-0.5 block">
                        {item.start_date === item.end_date
                          ? item.start_date
                          : `${item.start_date} s/d ${item.end_date}`}
                      </span>
                    </div>

                    <Badge
                      variant={isApproved ? 'success' : isPending ? 'warning' : 'error'}
                      className="text-[11px] shrink-0"
                    >
                      {isApproved ? 'Disetujui' : isPending ? 'Menunggu' : 'Ditolak'}
                    </Badge>
                  </div>

                  {item.notes && (
                    <p className="text-[11px] text-[var(--color-text-secondary)] bg-[var(--color-bg-app)] p-2 rounded-[6px] border border-[var(--color-border-subtle)]/60">
                      Catatan: {item.notes}
                    </p>
                  )}

                  {(item.document_path || item.document_url) && (
                    <div className="pt-1.5 border-t border-[var(--color-border-light)] flex justify-end">
                      <button
                        onClick={() => handleOpenDocPreview(item)}
                        className="text-[11px] font-semibold text-[var(--color-info-fg)] hover:text-[var(--color-info-fg)] flex items-center gap-1"
                      >
                        <Eye className="w-3.5 h-3.5" />
                        Pratinjau Surat Lampiran
                      </button>
                    </div>
                  )}
                </div>
              );
            })
          )}
        </div>
      )}

      {/* =====================================
          TAB 3: NILAI KUIS AI
         ===================================== */}
      {activeTab === 'quizzes' && (
        <div className="space-y-2.5">
          <h2 className="text-xs font-bold text-[var(--color-text-primary)] uppercase tracking-wider px-0.5">
            Hasil Evaluasi Kuis AI
          </h2>

          {loading ? (
            <div className="space-y-2">
              {[1, 2, 3].map((i) => (
                <div key={i} className="h-24 bg-[var(--color-surface-subtle)] rounded-[14px] animate-pulse" />
              ))}
            </div>
          ) : quizzes.length === 0 ? (
            <Card className="p-8 text-center bg-[var(--color-surface)] border border-dashed border-[var(--color-border-subtle)]">
              <Sparkles className="w-8 h-8 text-[var(--color-text-muted)] mx-auto mb-2" />
              <p className="text-xs font-semibold text-[var(--color-text-primary)]">Belum ada hasil kuis yang dirilis</p>
              <p className="text-[11px] text-[var(--color-text-muted)] mt-0.5">
                Nilai dan ulasan AI akan tampil setelah guru merilis hasil evaluasi kuis kelas.
              </p>
            </Card>
          ) : (
            quizzes.map((quiz) => (
              <div
                key={quiz.id}
                className="surface-card p-3.5 space-y-2"
              >
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <h3 className="font-semibold text-xs text-[var(--color-text-primary)]">{quiz.title}</h3>
                    <span className="text-[11px] text-[var(--color-text-secondary)] block mt-0.5">
                      Guru: {quiz.teacher?.name || '-'}
                    </span>
                  </div>
                  <Badge variant="success" size="sm" dot>
                    Hasil Dirilis
                  </Badge>
                </div>

                <div className="p-2.5 rounded-[10px] bg-[var(--color-surface-subtle)] border border-[var(--color-border-subtle)]">
                  <p className="text-[11.5px] font-medium text-[var(--color-text-primary)]">
                    Nilai belum tersedia
                  </p>
                  <p className="text-[10.5px] text-[var(--color-text-muted)] leading-snug mt-0.5">
                    Rincian skor dan ulasan AI untuk kuis ini belum dapat ditampilkan pada aplikasi
                    mobile. Silakan lihat melalui aplikasi web sekolah.
                  </p>
                </div>
              </div>
            ))
          )}
        </div>
      )}

      {/* =====================================
          TAB 4: JADWAL KELAS ANAK
         ===================================== */}
      {activeTab === 'schedule' && (
        <div className="space-y-3">
          <div className="flex items-center justify-between px-0.5">
            <h2 className="section-label">
              Jadwal Kelas {child.className}
            </h2>

            {/* Cycle Selector */}
            <div className="flex gap-1 bg-[var(--color-surface-subtle)] p-0.5 rounded-[10px] border border-[var(--color-border-subtle)]">
              <button
                onClick={() => {
                  setSelectedCycle(1);
                  setLoading(true);
                }}
                className={`px-2.5 py-0.5 rounded-[6px] text-[11px] font-semibold transition-all ${
                  selectedCycle === 1
                    ? 'bg-[var(--color-surface)] text-[var(--color-text-primary)] shadow-[var(--shadow-card)]'
                    : 'text-[var(--color-text-secondary)]'
                }`}
              >
                Siklus 1
              </button>
              <button
                onClick={() => {
                  setSelectedCycle(2);
                  setLoading(true);
                }}
                className={`px-2.5 py-0.5 rounded-[6px] text-[11px] font-semibold transition-all ${
                  selectedCycle === 2
                    ? 'bg-[var(--color-surface)] text-[var(--color-text-primary)] shadow-[var(--shadow-card)]'
                    : 'text-[var(--color-text-secondary)]'
                }`}
              >
                Siklus 2
              </button>
            </div>
          </div>

          <MobileScheduleTimeline
            schedules={childSchedules}
            mondayIsUpacara={mondayIsUpacara}
            periodTemplates={periodTemplates}
            role="student"
            selectedDay={selectedDay}
            onChangeDay={setSelectedDay}
            isLoading={loading}
          />
        </div>
      )}

      {/* Modal Preview Bukti Berkas */}
      <BottomSheetModal
        isOpen={Boolean(previewDoc)}
        onClose={() => setPreviewDoc(null)}
        title="Dokumen Lampiran Izin"
        subtitle={`Pengajuan ${previewDoc?.category || ''}`}
        size="lg"
      >
        {previewDoc && (
          <div className="space-y-3 pb-2 text-center text-xs">
            {isImageDoc ? (
              <div className="rounded-[10px] overflow-hidden border border-[var(--color-border-subtle)] bg-[var(--color-text-primary)] flex items-center justify-center min-h-48 max-h-96">
                <img
                  src={docSourceUrl}
                  alt="Dokumen Bukti"
                  className="max-h-96 max-w-full object-contain"
                  onError={() => {
                    if (!docLoadError) {
                      setDocLoadError(true);
                      setDocSourceUrl(
                        getFallbackStorageUrl(
                          previewDoc.document_url || previewDoc.document_path
                        )
                      );
                    }
                  }}
                />
              </div>
            ) : (
              <div className="p-6 bg-[var(--color-bg-app)] surface-card space-y-2">
                <FileText className="w-10 h-10 text-[var(--color-text-muted)] mx-auto" />
                <p className="text-xs font-semibold text-[var(--color-text-primary)]">Berkas Dokumen PDF</p>
                <div className="pt-2">
                  <a
                    href={docSourceUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1.5 text-xs text-[var(--color-info-fg)] font-semibold hover:underline"
                  >
                    Buka Berkas di Tab Baru
                    <ExternalLink className="w-3.5 h-3.5" />
                  </a>
                </div>
              </div>
            )}

            <Button
              variant="outline"
              onClick={() => setPreviewDoc(null)}
              className="w-full mt-2"
            >
              Tutup Pratinjau
            </Button>
          </div>
        )}
      </BottomSheetModal>
    </div>
  );
}
