import { useState, useEffect } from 'react';
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
} from 'lucide-react';
import { useAuth } from '../../hooks/useAuth';
import { journalApi } from '../../services/journalApi';
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
} from '../../components/shared';
import './TeacherSchedule.css';

export default function TeacherSchedulePage() {
  const navigate = useNavigate();
  const { user } = useAuth();

  // State tampilan & seleksi
  const [viewMode, setViewMode] = useState('daily'); // 'daily' | 'weekly'
  const [selectedDay, setSelectedDay] = useState('Senin');
  const [schedules, setSchedules] = useState([]);
  const [missingJournals, setMissingJournals] = useState([]);
  const [isLoading, setIsLoading] = useState(true);

  // Modal & Pengajuan Izin Mengajar Guru
  const [isLeaveModalOpen, setIsLeaveModalOpen] = useState(false);
  const [leaveReason, setLeaveReason] = useState('dinas_luar');
  const [taskInstructions, setTaskInstructions] = useState(
    'Kerjakan modul latihan halaman 34 soal nomor 1-10 di buku catatan. Kumpulkan hasilnya ke ketua kelas untuk diserahkan ke meja piket.'
  );
  const [isLeaveActive, setIsLeaveActive] = useState(() => {
    return localStorage.getItem('teacher_leave_active') === 'true';
  });
  const [leaveToast, setLeaveToast] = useState(false);

  // Ambil data jadwal mengajar guru saat komponen mount
  useEffect(() => {
    let isMounted = true;

    async function fetchData() {
      try {
        const [schedRes, missingRes] = await Promise.all([
          journalApi.getTeacherSchedules({ per_page: 100 }),
          journalApi.getMissingJournals(),
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

    return () => {
      isMounted = false;
    };
  }, []);

  // Handle Pengajuan Izin Guru
  const handleSendLeave = (e) => {
    e.preventDefault();
    setIsLeaveActive(true);
    localStorage.setItem('teacher_leave_active', 'true');
    localStorage.setItem('teacher_leave_reason', leaveReason);
    localStorage.setItem('teacher_leave_tasks', taskInstructions);

    // Delegasikan jadwal hari ini ke Kesiswaan / Piket
    const todaySchedules = schedules.filter(
      (s) => s.day_of_week === DAY_TO_NUMBER[selectedDay]
    );

    const currentDelegations = JSON.parse(
      localStorage.getItem('delegated_classes') || '[]'
    );

    const newDelegationItems = todaySchedules.map((s) => ({
      id: Date.now() + s.id,
      schedule_id: s.id,
      teacher_id: user?.id || s.teacher_id,
      teacherName: user?.name || s.teacher?.name || 'Guru Pengampu',
      subjectName: s.subject?.name || 'Mata Pelajaran',
      className: s.schoolClass?.name || 'Kelas',
      period_number: s.period_number,
      duration_periods: s.duration_periods,
      reason:
        leaveReason === 'sakit'
          ? 'Sakit'
          : leaveReason === 'dinas_luar'
            ? 'Izin Dinas Luar'
            : 'Izin Keperluan Pribadi',
      reasonCategory: leaveReason,
      taskInstructions: taskInstructions,
      date: new Date().toISOString().split('T')[0],
      status: 'pending',
    }));

    localStorage.setItem(
      'delegated_classes',
      JSON.stringify([...currentDelegations, ...newDelegationItems])
    );

    setIsLeaveModalOpen(false);
    setLeaveToast(true);
    setTimeout(() => setLeaveToast(false), 5000);
  };

  const handleCancelLeave = () => {
    setIsLeaveActive(false);
    localStorage.removeItem('teacher_leave_active');
    localStorage.removeItem('teacher_leave_reason');
    localStorage.removeItem('teacher_leave_tasks');
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
  const dailySchedules = schedules.filter(
    (s) => s.day_of_week === currentDayNumber
  );

  // Susun tabs hari dengan counter jumlah kelas
  const dayTabs = DAYS_LIST.map((dayName) => {
    const num = DAY_TO_NUMBER[dayName];
    const count = schedules.filter((s) => s.day_of_week === num).length;
    return {
      id: dayName,
      label: dayName,
      count,
    };
  });

  // Render Status Badge pada kartu jadwal
  const renderStatusBadge = (item) => {
    if (isLeaveActive) {
      return <Badge variant="warning">Izin (Kesiswaan)</Badge>;
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

  return (
    <div className="teacher-schedule">
      {/* Header Halaman */}
      <div className="teacher-schedule__header">
        <div className="teacher-schedule__title-group">
          <h1>Kalender Jadwal Mengajar</h1>
          <p className="teacher-schedule__subtitle">
            Pantau alokasi jam mengajar harian &amp; mingguan, rombel kelas, serta kepatuhan pengisian jurnal kelas.
          </p>
        </div>

        <div className="teacher-schedule__header-actions">
          <Button
            variant="secondary"
            size="sm"
            icon={FileText}
            onClick={() => setIsLeaveModalOpen(true)}
          >
            Ajukan Izin Hari Ini
          </Button>
          <Badge variant="default">Siklus Putaran 1</Badge>
          <Badge variant="neutral">
            Guru: {user?.name || 'Drs. Ahmad Fauzi, M.Pd.'}
          </Badge>
        </div>
      </div>

      {/* Alert Sukses Pengajuan Izin */}
      {leaveToast && (
        <div className="teacher-schedule__alert teacher-schedule__alert--success">
          <CheckCircle2 size={16} className="text-emerald-600 shrink-0" />
          <span>
            <strong>Izin berhasil diajukan!</strong> Seluruh kelas Anda hari ini telah didelegasikan ke{' '}
            <strong>Tim Kesiswaan (Piket)</strong> beserta instruksi tugas titipan.
          </span>
        </div>
      )}

      {/* Banner Status Izin Guru Aktif */}
      {isLeaveActive && (
        <div className="teacher-schedule__alert teacher-schedule__alert--leave">
          <div className="flex items-center gap-2">
            <AlertTriangle size={16} className="text-amber-600 shrink-0" />
            <span>
              <strong>Status Izin Aktif:</strong> Seluruh jam mengajar Anda hari ini didelegasikan ke{' '}
              <strong>Tim Kesiswaan (Piket)</strong> beserta instruksi tugas titipan.
            </span>
          </div>
          <button
            type="button"
            className="teacher-schedule__alert-btn"
            onClick={handleCancelLeave}
          >
            Batalkan Izin
          </button>
        </div>
      )}

      {/* Peringatan Keterlambatan Pengisian Jurnal (> 30 menit) */}
      {missingJournals.length > 0 && (
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
              Memuat data jadwal mengajar...
            </div>
          ) : dailySchedules.length === 0 ? (
            <div className="border border-gray-200 rounded-lg p-12 text-center text-gray-500 text-[13px] bg-white">
              Tidak ada alokasi jam mengajar terjadwal pada hari <strong>{selectedDay}</strong>.
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
                // Grouping berdasarkan period_number
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

                  // Kalkulasi waktu riil
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
                                  <span>{user?.name || item.teacher?.name}</span>
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
                                icon={item.journal_status === 'completed' ? BookOpen : PlayCircle}
                                onClick={() => handleOpenJournal(item)}
                              >
                                {item.journal_status === 'completed'
                                  ? 'Lihat Jurnal'
                                  : 'Buka Kelas / Isi Jurnal'}
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

      {/* TAMPILAN 2: MATRIKS MINGGUAN (READ-ONLY) */}
      {viewMode === 'weekly' && (
        <div className="teacher-schedule__matrix-container">
          <table className="teacher-schedule__matrix-table">
            <thead>
              <tr>
                <th style={{ width: '12%' }}>Slot Jam</th>
                {DAYS_LIST.map((day) => (
                  <th key={day} style={{ width: '17.6%' }}>
                    {day}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map((slot) => {
                return (
                  <tr key={slot}>
                    <td className="bg-gray-50/50 font-mono text-xs text-gray-500 font-semibold">
                      Jam ke-{slot}
                    </td>
                    {DAYS_LIST.map((dayName) => {
                      const dayNum = DAY_TO_NUMBER[dayName];
                      // Cari apakah ada jadwal di slot ini
                      const match = schedules.find(
                        (s) =>
                          s.day_of_week === dayNum &&
                          slot >= s.period_number &&
                          slot < s.period_number + (s.duration_periods || 1)
                      );

                      if (!match) {
                        return <td key={dayName} className="text-gray-300">-</td>;
                      }

                      // Render hanya di slot awal durasi blok
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
                                {match.room?.name} &bull; {match.duration_periods} JP
                              </div>
                            </div>
                          </td>
                        );
                      }

                      // Slot lanjutan dari rowspan
                      return null;
                    })}
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* Modal Pengajuan Izin Mengajar Guru */}
      <Modal
        isOpen={isLeaveModalOpen}
        onClose={() => setIsLeaveModalOpen(false)}
        title="Pengajuan Izin Mengajar & Delegasi Piket"
        size="md"
      >
        <form onSubmit={handleSendLeave} className="flex flex-col gap-4">
          <div className="p-3.5 bg-amber-50 border border-amber-200 rounded-lg text-xs text-amber-900 leading-relaxed">
            Pengajuan izin akan mendelegasikan jadwal kelas Anda hari ini ke{' '}
            <strong>Tim Kesiswaan (Piket)</strong>. Pastikan instruksi tugas ditulis dengan jelas untuk dibacakan kepada siswa di kelas.
          </div>

          <Select
            label="Alasan Berhalangan Hadir"
            options={[
              { value: 'dinas_luar', label: 'Izin Dinas Luar / Tugas Sekolah' },
              { value: 'sakit', label: 'Sakit (Dengan Keterangan)' },
              { value: 'izin_keperluan', label: 'Izin Keperluan Pribadi Mendesak' },
            ]}
            value={leaveReason}
            onChange={(e) => setLeaveReason(e.target.value)}
          />

          <div>
            <label className="block text-xs font-semibold text-gray-700 mb-1.5">
              Instruksi Tugas Titipan untuk Siswa <span className="text-red-500">*</span>
            </label>
            <textarea
              rows={4}
              required
              value={taskInstructions}
              onChange={(e) => setTaskInstructions(e.target.value)}
              placeholder="Tuliskan tugas atau latihan yang wajib dikerjakan siswa selama jam pelajaran berlangsung..."
              className="w-full px-3 py-2 text-xs border border-gray-300 rounded-md focus:outline-none focus:border-gray-900 bg-white"
            />
            <span className="text-[11px] text-gray-500 mt-1 block">
              Instruksi ini akan otomatis muncul pada layar presensi Guru Piket Kesiswaan.
            </span>
          </div>

          <div className="flex items-center justify-end gap-2.5 pt-3 border-t border-gray-100">
            <Button
              variant="secondary"
              type="button"
              onClick={() => setIsLeaveModalOpen(false)}
            >
              Batal
            </Button>
            <Button variant="primary" type="submit">
              Ajukan &amp; Delegasikan ke Kesiswaan
            </Button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
