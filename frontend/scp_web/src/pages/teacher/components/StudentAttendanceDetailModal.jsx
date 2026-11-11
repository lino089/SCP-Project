import { useState, useEffect, useCallback } from 'react';
import {
  Calendar,
  User,
  Clock,
  BookOpen,
  MessageSquare,
  AlertTriangle,
  CheckCircle2,
  AlertCircle,
  HelpCircle,
  RefreshCw,
  X,
} from 'lucide-react';
import Modal from '../../../components/shared/Modal';
import Badge from '../../../components/shared/Badge';
import Button from '../../../components/shared/Button';
import attendanceRecapApi from '../../../services/attendanceRecapApi';

const STATUS_CONFIG = {
  Hadir: { variant: 'success', label: 'Hadir', dot: true },
  Sakit: { variant: 'info', label: 'Sakit', dot: true },
  Izin: { variant: 'warning', label: 'Izin', dot: true },
  Alpa: { variant: 'danger', label: 'Alpa', dot: true },
};

function formatDateIndo(dateStr) {
  if (!dateStr) return '-';
  try {
    const d = new Date(dateStr);
    return d.toLocaleDateString('id-ID', {
      weekday: 'long',
      day: 'numeric',
      month: 'short',
      year: 'numeric',
    });
  } catch {
    return dateStr;
  }
}

export default function StudentAttendanceDetailModal({
  isOpen = false,
  onClose,
  student = null,
  startDate = null,
  endDate = null,
}) {
  const [data, setData] = useState(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState(null);
  const [statusFilter, setStatusFilter] = useState('all');

  const fetchHistory = useCallback(async () => {
    if (!student?.id) return;
    setIsLoading(true);
    setError(null);
    try {
      const params = {};
      if (startDate) params.start_date = startDate;
      if (endDate) params.end_date = endDate;
      if (statusFilter !== 'all') params.status = statusFilter;

      const res = await attendanceRecapApi.getStudentHistory(student.id, params);
      const payload = res?.data ?? res;
      if (res?.success || payload?.history) {
        setData(payload);
      } else {
        setError(res?.message || 'Gagal memuat riwayat presensi siswa.');
      }
    } catch (err) {
      setError(
        err?.message ||
          err?.response?.data?.message ||
          'Terjadi kesalahan saat mengambil riwayat presensi siswa.'
      );
    } finally {
      setIsLoading(false);
    }
  }, [student?.id, startDate, endDate, statusFilter]);

  useEffect(() => {
    if (isOpen && student?.id) {
      fetchHistory();
    } else {
      setData(null);
      setError(null);
      setStatusFilter('all');
    }
  }, [isOpen, student?.id, fetchHistory]);

  const summary = data?.summary;
  const history = data?.history || [];
  const studentInfo = data?.student || student;

  const getRateBadge = (rate, totalSessions) => {
    if (!totalSessions || rate === null || rate === undefined) {
      return { variant: 'default', label: 'Belum Ada Sesi KBM' };
    }
    if (rate >= 90) return { variant: 'success', label: `${rate}% (Sangat Baik)` };
    if (rate >= 85) return { variant: 'warning', label: `${rate}% (Waspada)` };
    return { variant: 'danger', label: `${rate}% (Kritis)` };
  };

  const rateInfo = summary ? getRateBadge(summary.attendance_rate, summary.total_sessions) : null;

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Riwayat Presensi & Catatan Guru"
      size="xl"
      footer={
        <div className="flex items-center justify-between w-full">
          <div className="text-xs text-gray-500">
            {startDate && endDate ? (
              <span>
                Periode: <strong>{startDate}</strong> s.d. <strong>{endDate}</strong>
              </span>
            ) : (
              <span>Periode: Bulan Berjalan</span>
            )}
          </div>
          <Button variant="secondary" onClick={onClose}>
            Tutup
          </Button>
        </div>
      }
    >
      <div className="space-y-6">
        {/* Header Profil Siswa */}
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 p-4 rounded-xl bg-gray-50 border border-gray-100">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-full bg-blue-100 text-blue-700 font-bold flex items-center justify-center text-lg shadow-inner">
              {studentInfo?.name?.charAt(0)?.toUpperCase() || 'S'}
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="font-semibold text-gray-900 text-base">
                  {studentInfo?.name || 'Nama Siswa'}
                </h3>
                <span className="text-xs px-2 py-0.5 rounded-full bg-gray-200 text-gray-700 font-medium">
                  {studentInfo?.gender === 'P' ? 'Perempuan' : 'Laki-Laki'}
                </span>
              </div>
              <p className="text-xs text-gray-500 mt-0.5">
                NIS: <span className="font-mono text-gray-700">{studentInfo?.nis || '-'}</span> | Kelas:{' '}
                <span className="font-medium text-gray-700">{studentInfo?.class_name || studentInfo?.schoolClass?.name || '-'}</span>
              </p>
            </div>
          </div>

          {rateInfo && (
            <div className="flex flex-col items-start sm:items-end">
              <span className="text-xs text-gray-500 uppercase tracking-wider font-semibold">
                Tingkat Kehadiran
              </span>
              <div className="mt-1">
                <Badge variant={rateInfo.variant} dot>
                  {rateInfo.label}
                </Badge>
              </div>
            </div>
          )}
        </div>

        {/* Ringkasan Statistik Siswa */}
        {summary && (
          <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
            <div className="p-3 rounded-lg border border-gray-100 bg-white shadow-sm text-center">
              <div className="text-xs text-gray-500 font-medium uppercase tracking-wider">Hadir</div>
              <div className="text-xl font-bold text-emerald-600 mt-1">{summary.hadir}</div>
              <div className="text-[10px] text-gray-400">Pertemuan</div>
            </div>
            <div className="p-3 rounded-lg border border-gray-100 bg-white shadow-sm text-center">
              <div className="text-xs text-gray-500 font-medium uppercase tracking-wider">Sakit</div>
              <div className="text-xl font-bold text-blue-600 mt-1">{summary.sakit}</div>
              <div className="text-[10px] text-gray-400">Pertemuan</div>
            </div>
            <div className="p-3 rounded-lg border border-gray-100 bg-white shadow-sm text-center">
              <div className="text-xs text-gray-500 font-medium uppercase tracking-wider">Izin</div>
              <div className="text-xl font-bold text-amber-600 mt-1">{summary.izin}</div>
              <div className="text-[10px] text-gray-400">Pertemuan</div>
            </div>
            <div className="p-3 rounded-lg border border-gray-100 bg-white shadow-sm text-center">
              <div className="text-xs text-gray-500 font-medium uppercase tracking-wider">Alpa</div>
              <div className="text-xl font-bold text-rose-600 mt-1">{summary.alpa}</div>
              <div className="text-[10px] text-gray-400">Tanpa Keterangan</div>
            </div>
            <div className="col-span-2 sm:col-span-1 p-3 rounded-lg border border-indigo-100 bg-indigo-50/50 text-center">
              <div className="text-xs text-indigo-700 font-medium uppercase tracking-wider">Catatan Guru</div>
              <div className="text-xl font-bold text-indigo-900 mt-1">{summary.has_notes_count}</div>
              <div className="text-[10px] text-indigo-600">Entri Keterangan</div>
            </div>
          </div>
        )}

        {/* Filter Tab Status Linimasa */}
        <div className="flex items-center justify-between gap-2 border-b border-gray-200 pb-2">
          <div className="flex items-center gap-1.5 overflow-x-auto text-xs">
            <span className="text-gray-500 font-medium mr-1">Filter:</span>
            {['all', 'Alpa', 'Sakit', 'Izin', 'Hadir'].map((st) => (
              <button
                key={st}
                type="button"
                onClick={() => setStatusFilter(st)}
                className={`px-3 py-1 rounded-full text-xs font-medium transition-colors ${
                  statusFilter === st
                    ? 'bg-blue-600 text-white shadow-sm'
                    : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                }`}
              >
                {st === 'all' ? 'Semua Status' : st}
              </button>
            ))}
          </div>

          <button
            type="button"
            onClick={fetchHistory}
            disabled={isLoading}
            className="text-xs text-blue-600 hover:text-blue-800 flex items-center gap-1 font-medium p-1"
            title="Muat Ulang"
          >
            <RefreshCw size={13} className={isLoading ? 'animate-spin' : ''} />
            <span className="hidden sm:inline">Refresh</span>
          </button>
        </div>

        {/* Error State */}
        {error && (
          <div className="p-4 rounded-xl bg-rose-50 border border-rose-200 text-rose-800 text-sm flex items-start gap-3">
            <AlertCircle size={18} className="text-rose-600 shrink-0 mt-0.5" />
            <div>
              <p className="font-semibold">Gagal Mengambil Riwayat</p>
              <p className="text-xs mt-0.5 text-rose-700">{error}</p>
            </div>
          </div>
        )}

        {/* Loading State */}
        {isLoading && (
          <div className="py-12 flex flex-col items-center justify-center text-gray-400 gap-2">
            <RefreshCw size={24} className="animate-spin text-blue-600" />
            <p className="text-xs font-medium">Memuat riwayat pertemuan &amp; catatan presensi...</p>
          </div>
        )}

        {/* Timeline Riwayat Sesi KBM */}
        {!isLoading && !error && history.length === 0 && (
          <div className="py-12 text-center text-gray-400 border border-dashed border-gray-200 rounded-xl">
            <Calendar size={32} className="mx-auto mb-2 text-gray-300" />
            <p className="text-sm font-medium text-gray-600">Tidak Ada Riwayat Pertemuan</p>
            <p className="text-xs text-gray-400 mt-1">
              Tidak ditemukan data sesi presensi dengan filter yang dipilih pada rentang tanggal ini.
            </p>
          </div>
        )}

        {!isLoading && !error && history.length > 0 && (
          <div className="space-y-3 max-h-[460px] overflow-y-auto pr-1">
            {history.map((item) => {
              const cfg = STATUS_CONFIG[item.status] || {
                variant: 'default',
                label: item.status,
                dot: false,
              };

              return (
                <div
                  key={item.id}
                  className="p-3.5 rounded-xl border border-gray-100 bg-white hover:border-gray-200 transition-all shadow-sm space-y-2.5"
                >
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                    <div className="flex items-center gap-2">
                      <Calendar size={14} className="text-gray-400 shrink-0" />
                      <span className="font-semibold text-xs text-gray-800">
                        {formatDateIndo(item.date)}
                      </span>
                    </div>
                    <div>
                      <Badge variant={cfg.variant} dot={cfg.dot}>
                        {cfg.label}
                      </Badge>
                    </div>
                  </div>

                  <div className="text-xs text-gray-600 flex flex-wrap items-center gap-x-4 gap-y-1">
                    <div className="flex items-center gap-1.5 font-medium text-gray-900">
                      <BookOpen size={13} className="text-blue-600" />
                      <span>{item.subject}</span>
                    </div>
                    <div className="flex items-center gap-1 text-gray-500">
                      <User size={13} />
                      <span>{item.teacher}</span>
                      {item.is_substitute && (
                        <span className="text-[10px] px-1.5 py-0.2 rounded bg-amber-100 text-amber-800 font-semibold">
                          Guru Pengganti
                        </span>
                      )}
                    </div>
                  </div>

                  {item.topic && (
                    <div className="text-xs text-gray-500 italic bg-gray-50 px-2.5 py-1 rounded-lg">
                      Topik KBM: &quot;{item.topic}&quot;
                    </div>
                  )}

                  {/* Catatan / Keterangan Khusus dari Guru Pengajar */}
                  {item.notes ? (
                    <div className="p-2.5 rounded-lg bg-amber-50/70 border border-amber-200/80 flex items-start gap-2.5">
                      <MessageSquare size={14} className="text-amber-700 shrink-0 mt-0.5" />
                      <div className="text-xs">
                        <span className="font-semibold text-amber-900">Catatan Guru: </span>
                        <span className="text-amber-950 font-medium leading-relaxed">
                          {item.notes}
                        </span>
                      </div>
                    </div>
                  ) : (
                    <div className="text-[11px] text-gray-400 flex items-center gap-1">
                      <span>Tidak ada catatan khusus pada sesi ini.</span>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </Modal>
  );
}
