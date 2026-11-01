import { useState, useEffect, useMemo, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  AlertCircle,
  CheckCircle2,
  FileText,
  AlertTriangle,
  Coffee,
  Flag,
  PlayCircle,
  Clock,
  BookOpen,
  GraduationCap,
  Users,
  Download,
  Info,
} from 'lucide-react';
import { useAuth } from '../../hooks/useAuth';
import { journalApi } from '../../services/journalApi';
import { leaveApi } from '../../services/leaveApi';
import { scheduleApi } from '../../services/scheduleApi';
import {
  DAYS_LIST,
  DAY_TO_NUMBER,
  resolveSlotTime,
} from '../../utils/timetableHelper';
import {
  Badge,
  Button,
  Modal,
  Tabs,
  Select,
  Table,
} from '../../components/shared';
import './TeacherSchedule.css';

export default function TeacherSchedulePage() {
  const navigate = useNavigate();
  const { user, isWaliKelas } = useAuth();

  // Konteks Penugasan: Jadwal Mengajar Pribadi vs Jadwal Kelas Binaan Wali Kelas
  const homeroomAssignment = useMemo(() => {
    return user?.assignments?.find((a) => a.type === 'wali_kelas');
  }, [user]);

  const homeroomClassId = homeroomAssignment?.class_id;
  const homeroomClassName =
    homeroomAssignment?.school_class?.name ||
    homeroomAssignment?.class_name ||
    (homeroomClassId ? `Kelas #${homeroomClassId}` : 'Kelas Binaan');

  const [scheduleContext, setScheduleContext] = useState('my_schedule'); // 'my_schedule' | 'homeroom'

  // State tampilan & seleksi
  const [viewMode, setViewMode] = useState('daily'); // 'daily' | 'weekly'
  const [selectedDay, setSelectedDay] = useState('Senin');
  const [schedules, setSchedules] = useState([]);
  const [homeroomSchedules, setHomeroomSchedules] = useState([]);
  const [missingJournals, setMissingJournals] = useState([]);
  const [isLoading, setIsLoading] = useState(true);

  // Perizinan Guru dari Backend
  const [teacherLeaves, setTeacherLeaves] = useState([]);
  const [isLeaveModalOpen, setIsLeaveModalOpen] = useState(false);
  const [isHistoryModalOpen, setIsHistoryModalOpen] = useState(false);
  const [leaveReasonCategory, setLeaveReasonCategory] = useState('dinas_luar');
  const [leaveReasonDetail, setLeaveReasonDetail] = useState('');
  const [taskInstructions, setTaskInstructions] = useState(
    'Kerjakan modul latihan halaman 34 soal nomor 1-10 di buku catatan. Kumpulkan hasilnya ke ketua kelas untuk diserahkan ke meja piket.'
  );
  const [attachmentFile, setAttachmentFile] = useState(null);
  const [taskAttachmentFile, setTaskAttachmentFile] = useState(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [formError, setFormError] = useState('');
  const [fieldErrors, setFieldErrors] = useState({});
  const [leaveToast, setLeaveToast] = useState(false);

  // Ambil daftar perizinan mengajar guru dari backend
  const fetchTeacherLeaves = useCallback(async () => {
    try {
      const res = await leaveApi.getTeacherLeaveRequests({ per_page: 50 });
      const list = Array.isArray(res) ? res : Array.isArray(res?.data) ? res.data : [];
      setTeacherLeaves(list);
    } catch {
      // Fallback ditangani di service layer
    }
  }, []);

  // Izin mengajar aktif hari ini dari backend
  const todayStr = useMemo(() => new Date().toISOString().split('T')[0], []);
  const todayActiveLeave = useMemo(() => {
    return teacherLeaves.find(
      (l) => l.date === todayStr && (l.status === 'pending' || l.status === 'approved')
    );
  }, [teacherLeaves, todayStr]);

  // Ambil data jadwal mengajar guru & perizinan saat komponen mount
  useEffect(() => {
    let isMounted = true;

    async function fetchData() {
      setIsLoading(true);
      try {
        const [schedRes, missingRes] = await Promise.all([
          journalApi.getTeacherSchedules({ per_page: 100 }),
          journalApi.getMissingJournals().catch(() => ({ success: false, data: [] })),
        ]);

        if (!isMounted) return;

        if (schedRes.success && Array.isArray(schedRes.data)) {
          setSchedules(schedRes.data);
        }
        if (missingRes.success && Array.isArray(missingRes.data)) {
          setMissingJournals(missingRes.data);
        }
      } catch {
        // Fallback otomatis tertangani di service layer
      } finally {
        if (isMounted) {
          setIsLoading(false);
        }
      }
    }

    fetchData();
    fetchTeacherLeaves();

    return () => {
      isMounted = false;
    };
  }, [fetchTeacherLeaves]);

  // Pemuatan data jadwal kelas binaan jika tab kelas binaan aktif
  useEffect(() => {
    let isMounted = true;

    async function fetchHomeroomData() {
      if (scheduleContext !== 'homeroom' || !homeroomClassId) return;
      setIsLoading(true);
      try {
        const res = await scheduleApi.getSchedules({ class_id: homeroomClassId, per_page: 100 });
        if (!isMounted) return;
        const list = Array.isArray(res?.data) ? res.data : [];
        setHomeroomSchedules(list);
      } catch {
        // Fallback
      } finally {
        if (isMounted) {
          setIsLoading(false);
        }
      }
    }

    fetchHomeroomData();

    return () => {
      isMounted = false;
    };
  }, [scheduleContext, homeroomClassId]);

  // Jadwal aktif yang sedang dirender berdasarkan konteks seleksi
  const activeSchedules = useMemo(() => {
    return scheduleContext === 'homeroom' ? homeroomSchedules : schedules;
  }, [scheduleContext, homeroomSchedules, schedules]);

  // Handle Pengajuan Izin Guru via Backend API
  const handleSendLeave = async (e) => {
    e.preventDefault();
    setFormError('');
    setFieldErrors({});

    const categoryLabel =
      leaveReasonCategory === 'sakit'
        ? 'Sakit'
        : leaveReasonCategory === 'dinas_luar'
          ? 'Izin Dinas Luar'
          : 'Izin Keperluan Pribadi';

    const fullReason = leaveReasonDetail.trim()
      ? `${categoryLabel}: ${leaveReasonDetail.trim()}`
      : categoryLabel;

    // Filter jadwal hari yang dipilih untuk didelegasikan
    const todayDayNumber = DAY_TO_NUMBER[selectedDay] || 1;
    const targetSchedules = schedules.filter(
      (s) => s.day_of_week === todayDayNumber
    );
    const scheduleIds = targetSchedules.map((s) => s.id);

    setIsSubmitting(true);
    try {
      const res = await leaveApi.submitTeacherLeaveRequest({
        date: todayStr,
        reason: fullReason,
        schedule_ids: scheduleIds,
        attachment: attachmentFile,
        task_instruction: taskInstructions,
        task_attachment: taskAttachmentFile,
      });

      if (res?.success) {
        setIsLeaveModalOpen(false);
        setLeaveToast(true);
        setTimeout(() => setLeaveToast(false), 5000);
        // Refresh riwayat perizinan dari backend
        await fetchTeacherLeaves();
      }
    } catch (err) {
      const errorMsg =
        err.message ||
        err.raw?.response?.data?.message ||
        err.response?.data?.message ||
        'Gagal mengajukan izin mengajar.';
      setFormError(errorMsg);
      setFieldErrors(err.errors || err.raw?.response?.data?.errors || err.response?.data?.errors || {});
    } finally {
      setIsSubmitting(false);
    }
  };

  // Navigasi ke halaman form Jurnal & Presensi
  const handleOpenJournal = (item) => {
    navigate('/teacher/journal', {
      state: {
        schedule: item,
        fromSchedule: true,
      },
    });
  };

  // Filter jadwal per hari yang dipilih
  const currentDayNumber = DAY_TO_NUMBER[selectedDay] || 1;
  const dailySchedules = activeSchedules.filter(
    (s) => s.day_of_week === currentDayNumber
  );

  // Susun tabs hari dengan counter jumlah kelas
  const dayTabs = DAYS_LIST.map((dayName) => {
    const num = DAY_TO_NUMBER[dayName];
    const count = activeSchedules.filter((s) => s.day_of_week === num).length;
    return {
      id: dayName,
      label: dayName,
      count,
    };
  });

  // Render Status Badge pada kartu jadwal
  const renderStatusBadge = (item) => {
    // Jika guru pribadi memiliki izin mengajar aktif hari ini pada jadwal mengajarnya
    if (scheduleContext === 'my_schedule' && todayActiveLeave) {
      if (todayActiveLeave.status === 'approved') {
        return <Badge variant="warning">Izin Disetujui</Badge>;
      }
      return <Badge variant="info">Izin Menunggu Verifikasi</Badge>;
    }
    if (item.journal_status === 'completed') {
      return <Badge variant="success">Jurnal Selesai</Badge>;
    }
    if (item.journal_status === 'ongoing') {
      return <Badge variant="info">Sedang Berlangsung</Badge>;
    }
    if (item.journal_status === 'teacher_absent') {
      return <Badge variant="danger">Guru Berhalangan</Badge>;
    }
    return <Badge variant="neutral">Jurnal Belum Diisi</Badge>;
  };

  // Kolom Riwayat Izin Mengajar
  const historyColumns = [
    {
      key: 'no',
      label: 'No',
      align: 'center',
      width: '50px',
      renderCell: (_row, idx) => (
        <span className="font-mono text-xs text-gray-400">
          {String(idx + 1).padStart(2, '0')}
        </span>
      ),
    },
    {
      key: 'date',
      label: 'Tanggal Izin',
      renderCell: (row) => (
        <span className="font-mono text-xs font-semibold text-gray-900">{row.date}</span>
      ),
    },
    {
      key: 'reason',
      label: 'Alasan / Keterangan',
      renderCell: (row) => (
        <div className="max-w-xs text-xs text-gray-800 font-sans" title={row.reason}>
          {row.reason}
        </div>
      ),
    },
    {
      key: 'task',
      label: 'Instruksi Tugas Titipan',
      renderCell: (row) => (
        <div className="text-xs text-gray-700 max-w-xs truncate" title={row.task_instruction}>
          {row.task_instruction || '-'}
        </div>
      ),
    },
    {
      key: 'documents',
      label: 'Lampiran',
      renderCell: (row) => (
        <div className="flex items-center gap-1.5">
          {row.attachment_path && (
            <a
              href={`/storage/${row.attachment_path}`}
              target="_blank"
              rel="noreferrer"
              className="text-[11px] text-blue-600 hover:underline flex items-center gap-1"
            >
              <Download size={11} /> Surat
            </a>
          )}
          {row.task_attachment_path && (
            <a
              href={`/storage/${row.task_attachment_path}`}
              target="_blank"
              rel="noreferrer"
              className="text-[11px] text-emerald-600 hover:underline flex items-center gap-1 ml-1"
            >
              <Download size={11} /> Modul
            </a>
          )}
          {!row.attachment_path && !row.task_attachment_path && (
            <span className="text-[11px] text-gray-400 italic">-</span>
          )}
        </div>
      ),
    },
    {
      key: 'status',
      label: 'Status',
      renderCell: (row) => {
        if (row.status === 'approved') return <Badge variant="success">Disetujui</Badge>;
        if (row.status === 'rejected') return <Badge variant="error">Ditolak</Badge>;
        return <Badge variant="warning">Menunggu</Badge>;
      },
    },
  ];

  return (
    <div className="teacher-schedule">
      {/* Header Halaman */}
      <div className="teacher-schedule__header">
        <div className="teacher-schedule__title-group">
          <h1>Kalender Jadwal Mengajar</h1>
          <p className="teacher-schedule__subtitle">
            Pantau alokasi jam mengajar harian &amp; mingguan, rombel kelas, serta kepatuhan pengisian jurnal KBM.
          </p>
        </div>

        <div className="teacher-schedule__header-actions">
          <Button
            variant="secondary"
            size="sm"
            icon={Clock}
            onClick={() => setIsHistoryModalOpen(true)}
          >
            Riwayat Izin Saya
          </Button>

          <Button
            variant="primary"
            size="sm"
            icon={FileText}
            onClick={() => {
              setFormError('');
              setFieldErrors({});
              setIsLeaveModalOpen(true);
            }}
          >
            Ajukan Izin Hari Ini
          </Button>

          <Badge variant="default">Siklus Putaran 1</Badge>
          <Badge variant="neutral">
            Guru: {user?.name || 'Bapak/Ibu Guru'}
          </Badge>
        </div>
      </div>

      {/* Selektor Multirole Wali Kelas */}
      {isWaliKelas() && homeroomClassId && (
        <div className="mb-4 bg-gray-100 p-1 rounded-lg inline-flex items-center gap-1">
          <button
            type="button"
            className={`px-3 py-1.5 text-xs font-semibold rounded-md transition-all cursor-pointer ${
              scheduleContext === 'my_schedule'
                ? 'bg-white text-gray-900 shadow-xs'
                : 'text-gray-600 hover:text-gray-900'
            }`}
            onClick={() => setScheduleContext('my_schedule')}
          >
            Jadwal Mengajar Saya
          </button>
          <button
            type="button"
            className={`px-3 py-1.5 text-xs font-semibold rounded-md transition-all flex items-center gap-1.5 cursor-pointer ${
              scheduleContext === 'homeroom'
                ? 'bg-white text-gray-900 shadow-xs'
                : 'text-gray-600 hover:text-gray-900'
            }`}
            onClick={() => setScheduleContext('homeroom')}
          >
            <GraduationCap size={14} className="text-blue-600" />
            <span>Jadwal Kelas Binaan ({homeroomClassName})</span>
          </button>
        </div>
      )}

      {/* Banner Informasi Kelas Binaan */}
      {scheduleContext === 'homeroom' && (
        <div className="mb-4 p-3 bg-blue-50 border border-blue-200 rounded-lg flex items-center gap-2.5 text-xs text-blue-900">
          <Info size={16} className="text-blue-600 shrink-0" />
          <span>
            Menampilkan seluruh alokasi jadwal mata pelajaran pada rombel binaan <strong>{homeroomClassName}</strong>. Anda dapat memantau kehadiran guru mata pelajaran atau membuka sesi KBM darurat jika guru pengampu berhalangan hadir.
          </span>
        </div>
      )}

      {/* Alert Sukses Pengajuan Izin */}
      {leaveToast && (
        <div className="teacher-schedule__alert teacher-schedule__alert--success">
          <CheckCircle2 size={16} className="text-emerald-600 shrink-0" />
          <span>
            <strong>Izin berhasil diajukan!</strong> Pengajuan izin Anda hari ini telah tercatat di antrean verifikasi Kesiswaan/Piket beserta instruksi tugas titipan.
          </span>
        </div>
      )}

      {/* Banner Status Izin Guru Aktif Hari Ini (Berdasarkan Data Backend) */}
      {todayActiveLeave && scheduleContext === 'my_schedule' && (
        <div className="teacher-schedule__alert teacher-schedule__alert--leave">
          <div className="flex items-center gap-2">
            <AlertTriangle size={16} className="text-amber-600 shrink-0" />
            <span>
              <strong>
                Status Izin {todayActiveLeave.status === 'approved' ? 'Disetujui' : 'Menunggu Verifikasi Kesiswaan'}:
              </strong>{' '}
              {todayActiveLeave.reason} &bull; Seluruh jam mengajar Anda hari ini didelegasikan ke{' '}
              <strong>Tim Kesiswaan (Piket)</strong>.
            </span>
          </div>
          <button
            type="button"
            className="teacher-schedule__alert-btn"
            onClick={() => setIsHistoryModalOpen(true)}
          >
            Lihat Detail Izin
          </button>
        </div>
      )}

      {/* Peringatan Keterlambatan Pengisian Jurnal (> 30 menit) */}
      {missingJournals.length > 0 && scheduleContext === 'my_schedule' && (
        <div className="teacher-schedule__alert teacher-schedule__alert--warning">
          <AlertCircle size={18} className="text-amber-700 shrink-0 mt-0.5" />
          <div className="flex-1">
            <strong>Peringatan Keterlambatan Jurnal:</strong> Terdapat{' '}
            <strong>{missingJournals.length} sesi KBM</strong> yang telah selesai lebih dari 30 menit lalu
            namun belum memiliki laporan jurnal KBM terverifikasi.
          </div>
        </div>
      )}

      {/* View Mode Switcher: Tampilan Harian vs Matriks Mingguan */}
      <div className="mb-5">
        <Tabs
          activeTab={viewMode}
          onChange={setViewMode}
          tabs={[
            { id: 'daily', label: 'Tampilan Harian' },
            { id: 'weekly', label: 'Matriks Mingguan (Senin - Jumat)' },
          ]}
        />
      </div>

      {/* TAMPILAN 1: HARIAN */}
      {viewMode === 'daily' && (
        <div>
          {/* Day Selector Tabs */}
          <div className="mb-5">
            <Tabs
              tabs={dayTabs}
              activeTab={selectedDay}
              onChange={setSelectedDay}
            />
          </div>

          {isLoading ? (
            <div className="border border-gray-200 rounded-lg p-10 text-center text-gray-500 bg-white">
              Memuat data jadwal {scheduleContext === 'homeroom' ? `kelas binaan ${homeroomClassName}` : 'mengajar'}...
            </div>
          ) : dailySchedules.length === 0 ? (
            <div className="border border-gray-200 rounded-lg p-12 text-center text-gray-500 text-[13px] bg-white">
              Tidak ada alokasi jam {scheduleContext === 'homeroom' ? 'mata pelajaran' : 'mengajar'} terjadwal pada hari <strong>{selectedDay}</strong>.
            </div>
          ) : (
            <div>
              {/* Divider Upacara Bendera pada hari Senin */}
              {selectedDay === 'Senin' && (
                <div className="teacher-schedule__divider">
                  <div className="teacher-schedule__divider-line" />
                  <span className="teacher-schedule__divider-badge">
                    <Flag size={13} className="text-gray-500" />
                    Upacara Bendera &bull; 07:00 – 07:45 &bull; Lapangan Upacara
                  </span>
                  <div className="teacher-schedule__divider-line" />
                </div>
              )}

              {/* Kelompok Slot Jadwal Harian */}
              {(() => {
                const groups = {};
                dailySchedules.forEach((item) => {
                  if (!groups[item.period_number]) {
                    groups[item.period_number] = [];
                  }
                  groups[item.period_number].push(item);
                });

                const sortedSlots = Object.keys(groups)
                  .map(Number)
                  .sort((a, b) => a - b);

                let break1Rendered = false;
                let break2Rendered = false;

                return sortedSlots.map((slotNum) => {
                  const items = groups[slotNum];
                  const firstItem = items[0];
                  const duration = firstItem.duration_periods || 1;

                  const slotTime = resolveSlotTime(selectedDay, slotNum, duration);
                  const timeStr = slotTime?.timeText || `Jam Ke-${slotNum}`;

                  const sessionLabel =
                    duration > 1
                      ? `Jam ke-${slotNum} s/d ${slotNum + duration - 1}`
                      : `Jam ke-${slotNum}`;

                  const elements = [];

                  // Divider Istirahat 1 (Sebelum Slot 5)
                  if (!break1Rendered && slotNum >= 5) {
                    elements.push(
                      <div
                        key="break-1"
                        className="teacher-schedule__divider"
                      >
                        <div className="teacher-schedule__divider-line" />
                        <span className="teacher-schedule__divider-badge">
                          <Coffee size={13} className="text-gray-500" />
                          Istirahat 1 &bull; 10:00 – 10:15 (15 Menit)
                        </span>
                        <div className="teacher-schedule__divider-line" />
                      </div>
                    );
                    break1Rendered = true;
                  }

                  // Divider Istirahat 2 (Sebelum Slot 7)
                  if (!break2Rendered && slotNum >= 7) {
                    elements.push(
                      <div
                        key="break-2"
                        className="teacher-schedule__divider"
                      >
                        <div className="teacher-schedule__divider-line" />
                        <span className="teacher-schedule__divider-badge">
                          <Coffee size={13} className="text-gray-500" />
                          Istirahat 2 &bull; 11:45 – 12:30 &bull; Sholat Dzuhur &amp; Makan (45 Menit)
                        </span>
                        <div className="teacher-schedule__divider-line" />
                      </div>
                    );
                    break2Rendered = true;
                  }

                  // Item Slot Jadwal
                  elements.push(
                    <div key={slotNum} className="teacher-schedule__slot-group">
                      <div className="teacher-schedule__slot-header">
                        <span className="flex items-center gap-1.5">
                          <Clock size={14} className="text-gray-400" />
                          {timeStr} &bull; {sessionLabel}
                        </span>
                      </div>

                      <div className="teacher-schedule__cards-box">
                        {items.map((item) => (
                          <div
                            key={item.id}
                            className="teacher-schedule__card-item"
                          >
                            <div className="teacher-schedule__card-left">
                              <div className="teacher-schedule__class-badge">
                                {item.schoolClass?.name || 'Kelas'}
                              </div>
                              <div>
                                <div className="teacher-schedule__subject-title">
                                  {item.subject?.name || 'Mata Pelajaran'}
                                </div>
                                <div className="teacher-schedule__subject-meta">
                                  <span>
                                    {scheduleContext === 'homeroom'
                                      ? `Pengampu: ${item.teacher?.name || '-'}`
                                      : (user?.name || item.teacher?.name)}
                                  </span>
                                  <span>&bull;</span>
                                  <span>{duration} Jam Pelajaran (JP)</span>
                                </div>
                              </div>
                            </div>

                            <div className="teacher-schedule__card-right">
                              <span className="teacher-schedule__room-pill">
                                {item.room?.name || 'Ruang Kelas'}
                              </span>

                              {renderStatusBadge(item)}

                              <Button
                                variant="secondary"
                                size="sm"
                                icon={PlayCircle}
                                onClick={() => handleOpenJournal(item)}
                              >
                                {item.journal_status === 'completed'
                                  ? 'Detail Jurnal'
                                  : scheduleContext === 'homeroom'
                                    ? 'Sesi KBM / Pengganti'
                                    : 'Buka Jurnal & Presensi'}
                              </Button>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  );

                  return elements;
                });
              })()}
            </div>
          )}
        </div>
      )}

      {/* TAMPILAN 2: MATRIKS MINGGUAN */}
      {viewMode === 'weekly' && (
        <div className="teacher-schedule__matrix-wrap">
          <table className="teacher-schedule__matrix-table">
            <thead>
              <tr>
                <th style={{ width: '70px' }}>Slot Jam</th>
                <th style={{ width: '110px' }}>Waktu</th>
                {DAYS_LIST.map((dayName) => (
                  <th key={dayName}>{dayName}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {Array.from({ length: 10 }, (_, i) => i + 1).map((slot) => {
                const isBreak1 = slot === 5;
                const isBreak2 = slot === 7;

                return (
                  <tr key={slot}>
                    <td className="font-mono text-center font-bold text-gray-500">
                      JP {slot}
                    </td>
                    <td className="font-mono text-[11px] text-gray-500">
                      {resolveSlotTime('Senin', slot, 1)?.timeText || '-'}
                    </td>

                    {DAYS_LIST.map((dayName) => {
                      const dayNumber = DAY_TO_NUMBER[dayName];
                      const match = activeSchedules.find(
                        (s) =>
                          s.day_of_week === dayNumber &&
                          slot >= s.period_number &&
                          slot < s.period_number + (s.duration_periods || 1)
                      );

                      if (!match) {
                        return <td key={dayName} className="text-gray-300">-</td>;
                      }

                      if (slot === match.period_number) {
                        return (
                          <td
                            key={dayName}
                            rowSpan={match.duration_periods || 1}
                          >
                            <div
                              className="teacher-schedule__matrix-cell cursor-pointer hover:shadow-xs transition-shadow"
                              onClick={() => handleOpenJournal(match)}
                            >
                              <div>
                                <span className="teacher-schedule__matrix-cell-class">
                                  {match.schoolClass?.name}
                                </span>
                                <div className="teacher-schedule__matrix-cell-subject">
                                  {match.subject?.name}
                                </div>
                              </div>
                              <div className="teacher-schedule__matrix-cell-room">
                                {scheduleContext === 'homeroom'
                                  ? match.teacher?.name
                                  : `${match.room?.name} \u2022 ${match.duration_periods} JP`}
                              </div>
                            </div>
                          </td>
                        );
                      }

                      return null;
                    })}
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* Modal Riwayat Izin Mengajar Guru */}
      <Modal
        isOpen={isHistoryModalOpen}
        onClose={() => setIsHistoryModalOpen(false)}
        title="Riwayat Pengajuan Izin Mengajar Guru"
        size="lg"
      >
        <div className="space-y-4">
          <p className="text-xs text-gray-500">
            Daftar seluruh riwayat izin berhalangan hadir dan delegasi tugas piket yang telah Anda ajukan ke sistem.
          </p>

          <Table
            columns={historyColumns}
            data={teacherLeaves}
            emptyMessage="Belum ada riwayat pengajuan izin mengajar yang tercatat."
          />

          <div className="flex justify-end pt-3 border-t border-gray-100">
            <Button
              variant="secondary"
              size="sm"
              onClick={() => setIsHistoryModalOpen(false)}
            >
              Tutup
            </Button>
          </div>
        </div>
      </Modal>

      {/* Modal Pengajuan Izin Mengajar Guru */}
      <Modal
        isOpen={isLeaveModalOpen}
        onClose={() => {
          setIsLeaveModalOpen(false);
          setFormError('');
          setFieldErrors({});
        }}
        title="Pengajuan Izin Mengajar &amp; Delegasi Piket"
        size="md"
      >
        <form onSubmit={handleSendLeave} className="flex flex-col gap-4">
          {formError && (
            <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-xs text-red-700 flex items-start gap-2">
              <AlertCircle size={16} className="text-red-600 shrink-0 mt-0.5" />
              <div className="flex-1 font-medium">{formError}</div>
            </div>
          )}

          <div className="p-3.5 bg-amber-50 border border-amber-200 rounded-lg text-xs text-amber-900 leading-relaxed">
            Pengajuan izin akan mendelegasikan jadwal kelas Anda hari ini ({todayStr}) ke{' '}
            <strong>Tim Kesiswaan (Piket)</strong>. Pastikan instruksi tugas ditulis dengan jelas untuk dibacakan kepada siswa di kelas.
          </div>

          <Select
            label="Kategori Alasan Berhalangan Hadir"
            options={[
              { value: 'dinas_luar', label: 'Izin Dinas Luar / Tugas Sekolah' },
              { value: 'sakit', label: 'Sakit (Dengan Keterangan)' },
              { value: 'izin_keperluan', label: 'Izin Keperluan Pribadi Mendesak' },
            ]}
            value={leaveReasonCategory}
            onChange={(e) => setLeaveReasonCategory(e.target.value)}
          />

          <div>
            <label className="block text-xs font-semibold text-gray-700 mb-1.5">
              Detail Alasan Izin <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              required
              value={leaveReasonDetail}
              onChange={(e) => {
                setLeaveReasonDetail(e.target.value);
                if (formError) setFormError('');
              }}
              placeholder="Contoh: Rapat dinas MGMP Disdikpora / Sakit flu demam"
              className="w-full px-3 py-2 text-xs border border-gray-300 rounded-md focus:outline-none focus:border-gray-900 bg-white"
            />
            {fieldErrors.reason && (
              <span className="text-[11px] text-red-600 mt-1 block">
                {fieldErrors.reason[0]}
              </span>
            )}
          </div>

          <div>
            <label className="block text-xs font-semibold text-gray-700 mb-1.5">
              Lampiran Surat Keterangan / Izin (Opsional)
            </label>
            <input
              type="file"
              accept=".jpg,.jpeg,.png,.pdf"
              onChange={(e) => {
                const file = e.target.files?.[0] || null;
                setAttachmentFile(file);
              }}
              className="w-full text-xs text-gray-700 file:mr-3 file:py-1.5 file:px-3 file:rounded-md file:border-0 file:text-xs file:font-semibold file:bg-gray-100 hover:file:bg-gray-200 cursor-pointer"
            />
            <span className="text-[11px] text-gray-500 mt-1 block">
              Format: JPG, PNG, atau PDF (maks. 5 MB).
            </span>
            {fieldErrors.attachment && (
              <span className="text-[11px] text-red-600 mt-1 block">
                {fieldErrors.attachment[0]}
              </span>
            )}
          </div>

          <div>
            <label className="block text-xs font-semibold text-gray-700 mb-1.5">
              Instruksi Tugas Titipan untuk Siswa <span className="text-red-500">*</span>
            </label>
            <textarea
              rows={3}
              required
              value={taskInstructions}
              onChange={(e) => setTaskInstructions(e.target.value)}
              placeholder="Tuliskan tugas atau latihan yang wajib dikerjakan siswa selama jam pelajaran berlangsung..."
              className="w-full px-3 py-2 text-xs border border-gray-300 rounded-md focus:outline-none focus:border-gray-900 bg-white"
            />
            <span className="text-[11px] text-gray-500 mt-1 block">
              Instruksi ini akan otomatis muncul pada layar presensi Guru Piket Kesiswaan.
            </span>
            {fieldErrors.task_instruction && (
              <span className="text-[11px] text-red-600 mt-1 block">
                {fieldErrors.task_instruction[0]}
              </span>
            )}
          </div>

          <div>
            <label className="block text-xs font-semibold text-gray-700 mb-1.5">
              Lampiran File Soal / Modul Siswa (Opsional)
            </label>
            <input
              type="file"
              accept=".jpg,.jpeg,.png,.pdf"
              onChange={(e) => {
                const file = e.target.files?.[0] || null;
                setTaskAttachmentFile(file);
              }}
              className="w-full text-xs text-gray-700 file:mr-3 file:py-1.5 file:px-3 file:rounded-md file:border-0 file:text-xs file:font-semibold file:bg-gray-100 hover:file:bg-gray-200 cursor-pointer"
            />
            <span className="text-[11px] text-gray-500 mt-1 block">
              Format: JPG, PNG, atau PDF (maks. 5 MB).
            </span>
            {fieldErrors.task_attachment && (
              <span className="text-[11px] text-red-600 mt-1 block">
                {fieldErrors.task_attachment[0]}
              </span>
            )}
          </div>

          <div className="flex items-center justify-end gap-2.5 pt-3 border-t border-gray-100">
            <Button
              variant="secondary"
              type="button"
              disabled={isSubmitting}
              onClick={() => {
                setIsLeaveModalOpen(false);
                setFormError('');
                setFieldErrors({});
              }}
            >
              Batal
            </Button>
            <Button variant="primary" type="submit" disabled={isSubmitting}>
              {isSubmitting ? 'Mengirim...' : 'Ajukan & Delegasikan ke Kesiswaan'}
            </Button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
