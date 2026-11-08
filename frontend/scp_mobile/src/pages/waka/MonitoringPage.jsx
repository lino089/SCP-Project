import { useState, useEffect, useMemo, useCallback } from 'react';
import {
  FileText,
  Users,
  RotateCw,
  X,
  Eye,
} from 'lucide-react';
import { useAuth } from '../../hooks/useAuth';
import journalApi from '../../services/journalApi';
import leaveApi from '../../services/leaveApi';
import { classApi } from '../../services/masterDataApi';
import {
  Button,
  Badge,
  Modal,
  Input,
  Select,
  SearchInput,
  SegmentedTabs,
} from '../../components/shared';
import { SkeletonCard, EmptyState, ErrorState } from '../../components/feedback';
import { getStorageUrl, formatDateIndo } from '../../utils/formatters';
import { unwrap, unwrapList } from '../../utils/responseHelper';
import { todayLocalISO } from '../../utils/dateUtils';

export default function MonitoringPage() {
  const { hasRole, isKesiswaan } = useAuth();

  // Active Tab
  const [activeTab, setActiveTab] = useState('jurnal'); // 'jurnal' | 'presensi'

  // Date Filter
  const [selectedDate, setSelectedDate] = useState(() => todayLocalISO());
  const [selectedClassId, setSelectedClassId] = useState('ALL');
  const [searchQuery, setSearchQuery] = useState('');

  // Data states
  const [journals, setJournals] = useState([]);
  const [dailyRecap, setDailyRecap] = useState(null);
  const [attendances, setAttendances] = useState([]);
  const [classesList, setClassesList] = useState([]);

  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState(null);

  // Toast
  const [toastMessage, setToastMessage] = useState(null);
  const [toastType, setToastType] = useState('success');

  // Preview Photo Modal
  const [previewPhotoUrl, setPreviewPhotoUrl] = useState(null);
  const [previewPhotoTitle, setPreviewPhotoTitle] = useState('');

  // Mark teacher absent action
  const [markingAbsentId, setMarkingAbsentId] = useState(null);

  const canMarkAbsent = useMemo(() => {
    return hasRole('waka') || isKesiswaan?.();
  }, [hasRole, isKesiswaan]);

  const showToast = (msg, type = 'success') => {
    setToastMessage(msg);
    setToastType(type);
    setTimeout(() => setToastMessage(null), 3500);
  };

  // Fetch classes for dropdown
  useEffect(() => {
    classApi.getClasses({ per_page: 100 })
      .then((res) => {
        setClassesList(unwrapList(res));
      })
      .catch(() => {});
  }, []);

  const fetchMonitoringData = useCallback(async () => {
    try {
      if (activeTab === 'jurnal') {
        const [jRes, recapRes] = await Promise.allSettled([
          journalApi.getJournals({ date: selectedDate }),
          journalApi.getDailyRecap({ date: selectedDate }),
        ]);

        if (jRes.status === 'fulfilled') {
          setJournals(unwrapList(jRes.value));
        }

        if (recapRes.status === 'fulfilled') {
          setDailyRecap(unwrap(recapRes.value));
        }
      } else {
        const params = { date: selectedDate };
        if (selectedClassId !== 'ALL') params.class_id = selectedClassId;
        const aRes = await leaveApi.getAttendances(params);
        setAttendances(unwrapList(aRes));
      }
      setLoadError(null);
    } catch (err) {
      setLoadError(err.message || 'Gagal memuat data monitoring.');
    } finally {
      setIsLoading(false);
    }
  }, [activeTab, selectedDate, selectedClassId]);

  useEffect(() => {
    let isMounted = true;
    async function init() {
      try {
        if (activeTab === 'jurnal') {
          const [jRes, recapRes] = await Promise.allSettled([
            journalApi.getJournals({ date: selectedDate }),
            journalApi.getDailyRecap({ date: selectedDate }),
          ]);

          if (isMounted && jRes.status === 'fulfilled') {
            const list = Array.isArray(jRes.value)
              ? jRes.value
              : Array.isArray(jRes.value?.data)
              ? jRes.value.data
              : [];
            setJournals(list);
          }

          if (isMounted && recapRes.status === 'fulfilled') {
            setDailyRecap(recapRes.value?.data || recapRes.value || null);
          }
        } else {
          const params = { date: selectedDate };
          if (selectedClassId !== 'ALL') params.class_id = selectedClassId;
          const aRes = await leaveApi.getAttendances(params);
          const list = Array.isArray(aRes) ? aRes : Array.isArray(aRes?.data) ? aRes.data : [];
          if (isMounted) setAttendances(list);
        }
        if (isMounted) setLoadError(null);
      } catch (err) {
        if (isMounted) setLoadError(err.message || 'Gagal memuat data monitoring.');
      } finally {
        if (isMounted) setIsLoading(false);
      }
    }
    init();
    return () => {
      isMounted = false;
    };
  }, [activeTab, selectedDate, selectedClassId]);

  const handleRefresh = () => {
    setIsLoading(true);
    fetchMonitoringData();
  };

  // Handle Mark Teacher Absent
  const handleMarkTeacherAbsent = async (journalId) => {
    if (!window.confirm('Tandai sesi ini sebagai Guru Berhalangan Hadir (Jam Kosong)?')) return;
    setMarkingAbsentId(journalId);
    try {
      await journalApi.markTeacherAbsent(journalId);
      showToast('Sesi KBM berhasil ditandai sebagai Guru Berhalangan Hadir.');
      handleRefresh();
    } catch (err) {
      showToast(err.response?.data?.message || err.message || 'Gagal mengubah status.', 'error');
    } finally {
      setMarkingAbsentId(null);
    }
  };

  // Filtered Journals
  const filteredJournals = useMemo(() => {
    if (!searchQuery.trim()) return journals;
    const q = searchQuery.toLowerCase();
    return journals.filter((j) => {
      const cls = j.schedule?.school_class?.name?.toLowerCase() || '';
      const teacher = j.schedule?.teacher?.name?.toLowerCase() || '';
      const subject = j.schedule?.subject?.name?.toLowerCase() || '';
      const topic = j.topic_description?.toLowerCase() || '';
      return cls.includes(q) || teacher.includes(q) || subject.includes(q) || topic.includes(q);
    });
  }, [journals, searchQuery]);

  // Filtered Attendances
  const filteredAttendances = useMemo(() => {
    if (!searchQuery.trim()) return attendances;
    const q = searchQuery.toLowerCase();
    return attendances.filter((a) => {
      const name = a.student?.name?.toLowerCase() || '';
      const cls = a.school_class?.name?.toLowerCase() || '';
      return name.includes(q) || cls.includes(q);
    });
  }, [attendances, searchQuery]);

  return (
    <div className="space-y-4">
      {/* Toast Feedback */}
      {toastMessage && (
        <div
          className={`p-3 rounded-[14px] text-xs flex items-center justify-between animate-fade-in ${
            toastType === 'success'
              ? 'bg-[var(--color-success-bg)] border border-[var(--color-success-border)] text-[var(--color-success-fg)]'
              : 'bg-[var(--color-danger-bg)] border border-[var(--color-danger-border)] text-[var(--color-danger-fg)]'
          }`}
        >
          <span>{toastMessage}</span>
          <button
            type="button"
            onClick={() => setToastMessage(null)}
            className="text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)]"
          >
            <X size={14} />
          </button>
        </div>
      )}

      {/* Header Info */}
      <div className="surface-card p-3.5 shadow-[var(--shadow-card)] flex items-center justify-between">
        <div>
          <h1 className="text-sm font-bold text-[var(--color-text-primary)]">Monitoring &amp; Rekapitulasi KBM</h1>
          <p className="text-[11px] text-[var(--color-text-muted)]">
            Pemantauan kepatuhan jurnal dan presensi harian
          </p>
        </div>
        <Button
          size="sm"
          variant="ghost"
          onClick={handleRefresh}
          className="p-1.5 h-8 w-8 min-h-0"
          aria-label="Segarkan"
        >
          <RotateCw size={14} />
        </Button>
      </div>

      {/* Date Filter & Tab Switcher */}
      <div className="space-y-2">
        <Input
          type="date"
          value={selectedDate}
          onChange={(e) => setSelectedDate(e.target.value)}
          className="text-xs font-semibold"
        />

        <div className="pt-1">
          <SegmentedTabs
            fullWidth
            tabs={[
              { id: 'jurnal', label: 'Jurnal KBM', icon: FileText },
              { id: 'presensi', label: 'Presensi', icon: Users },
            ]}
            activeTab={activeTab}
            onChange={setActiveTab}
          />
        </div>
      </div>

      {/* Daily Recap Summary Cards (when in 'jurnal' tab) */}
      {activeTab === 'jurnal' && dailyRecap && (
        <div className="grid grid-cols-3 gap-2">
          <div className="surface-card p-2.5 text-center shadow-[var(--shadow-card)]">
            <p className="text-[11px] text-[var(--color-text-secondary)] font-semibold">Total Sesi</p>
            <p className="text-sm font-bold text-[var(--color-text-primary)] mt-0.5">
              {dailyRecap.total_sessions || dailyRecap.total_schedules || 0}
            </p>
          </div>
          <div className="surface-card p-2.5 text-center shadow-[var(--shadow-card)]">
            <p className="text-[11px] text-[var(--color-success-fg)] font-semibold">Selesai</p>
            <p className="text-sm font-bold text-[var(--color-success-fg)] mt-0.5">
              {dailyRecap.completed_count || 0}
            </p>
          </div>
          <div className="surface-card p-2.5 text-center shadow-[var(--shadow-card)]">
            <p className="text-[11px] text-[var(--color-danger-fg)] font-semibold">Jam Kosong</p>
            <p className="text-sm font-bold text-[var(--color-danger-fg)] mt-0.5">
              {dailyRecap.teacher_absent_count || 0}
            </p>
          </div>
        </div>
      )}

      {/* Filter Rombel & Search Input */}
      <div className="space-y-2">
        {activeTab === 'presensi' && (
          <Select
            value={selectedClassId}
            onChange={(e) => setSelectedClassId(e.target.value)}
            className="text-xs"
          >
            <option value="ALL">Semua Rombel</option>
            {classesList.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </Select>
        )}

        <SearchInput
          placeholder={
            activeTab === 'jurnal'
              ? 'Cari guru, kelas, mapel, atau topik...'
              : 'Cari nama siswa...'
          }
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
        />
      </div>

      {/* Tab Content 1: Jurnal KBM */}
      {activeTab === 'jurnal' && (
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <span className="section-label">
              Daftar Jurnal KBM ({filteredJournals.length})
            </span>
          </div>

          {isLoading ? (
            <SkeletonCard count={3} />
          ) : loadError ? (
            <ErrorState message={loadError} onRetry={handleRefresh} />
          ) : filteredJournals.length === 0 ? (
            <EmptyState
              title="Tidak Ada Jurnal"
              message={`Belum ada sesi KBM yang tercatat pada tanggal ${formatDateIndo(selectedDate)}.`}
            />
          ) : (
            <div className="space-y-2">
              {filteredJournals.map((j) => {
                const isCompleted = j.status === 'completed';
                const isOngoing = j.status === 'ongoing';
                const isTeacherAbsent = j.status === 'teacher_absent';
                const photoUrl = j.photo_url || j.photo_path;

                return (
                  <div
                    key={j.id}
                    className="surface-card p-3 space-y-2"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-1.5 flex-wrap">
                          <Badge variant="neutral" size="sm">
                            {j.schedule?.school_class?.name || 'Rombel'}
                          </Badge>
                          <Badge variant="warning" size="sm">
                            Jam Ke-{j.schedule?.period_number || 1}
                          </Badge>
                          {isCompleted ? (
                            <Badge variant="success" size="sm">
                              Selesai
                            </Badge>
                          ) : isOngoing ? (
                            <Badge variant="info" size="sm">
                              Sedang Berjalan
                            </Badge>
                          ) : isTeacherAbsent ? (
                            <Badge variant="danger" size="sm">
                              Guru Berhalangan
                            </Badge>
                          ) : (
                            <Badge variant="neutral" size="sm">
                              {j.status}
                            </Badge>
                          )}
                        </div>

                        <h3 className="text-xs font-bold text-[var(--color-text-primary)] mt-1 truncate">
                          {j.schedule?.subject?.name || 'Mata Pelajaran'}
                        </h3>
                        <p className="text-[11px] text-[var(--color-text-secondary)] truncate mt-0.5">
                          {j.schedule?.teacher?.name || 'Guru Pengampu'}
                          {j.substitute_teacher && (
                            <span className="text-[var(--color-warning-fg)] font-semibold ml-1">
                              (Diganti: {j.substitute_teacher.name})
                            </span>
                          )}
                        </p>

                        {j.topic_description && (
                          <div className="mt-1.5 p-2 bg-[var(--color-bg-app)] border border-[var(--color-border-light)] rounded-[10px]">
                            <p className="text-[11px] text-[var(--color-text-primary)] leading-relaxed italic">
                              "{j.topic_description}"
                            </p>
                          </div>
                        )}
                      </div>

                      <div className="shrink-0 flex flex-col items-end gap-1.5">
                        {photoUrl && (
                          <button
                            type="button"
                            onClick={() => {
                              setPreviewPhotoUrl(getStorageUrl(photoUrl));
                              setPreviewPhotoTitle(
                                `${j.schedule?.school_class?.name} - ${j.schedule?.subject?.name}`
                              );
                            }}
                            className="w-11 h-11 rounded-[10px] border border-[var(--color-border-subtle)] overflow-hidden relative group"
                            aria-label="Lihat Foto Bukti"
                          >
                            <img
                              src={getStorageUrl(photoUrl)}
                              alt="Bukti KBM"
                              className="w-full h-full object-cover"
                            />
                            <div className="absolute inset-0 bg-[var(--color-overlay-soft)] flex items-center justify-center text-white">
                              <Eye size={14} />
                            </div>
                          </button>
                        )}

                        {canMarkAbsent && !isCompleted && !isTeacherAbsent && (
                          <button
                            type="button"
                            disabled={markingAbsentId === j.id}
                            onClick={() => handleMarkTeacherAbsent(j.id)}
                            className="px-2 py-1 bg-[var(--color-danger-bg)] text-[var(--color-danger-fg)] border border-[var(--color-danger-border)] rounded-[10px] text-[11px] font-bold hover:bg-[var(--color-danger-bg)] transition-all"
                          >
                            {markingAbsentId === j.id ? 'Memproses...' : 'Tandai Jam Kosong'}
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* Tab Content 2: Presensi Siswa */}
      {activeTab === 'presensi' && (
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <span className="section-label">
              Rekapitulasi Presensi ({filteredAttendances.length})
            </span>
          </div>

          {isLoading ? (
            <SkeletonCard count={3} />
          ) : loadError ? (
            <ErrorState message={loadError} onRetry={handleRefresh} />
          ) : filteredAttendances.length === 0 ? (
            <EmptyState
              title="Tidak Ada Data Presensi"
              message="Belum ada catatan presensi siswa untuk kriteria filter ini."
            />
          ) : (
            <div className="space-y-2">
              {filteredAttendances.map((a) => {
                const status = a.status || 'Hadir';
                const badgeVariant =
                  status === 'Hadir'
                    ? 'success'
                    : status === 'Sakit'
                    ? 'info'
                    : status === 'Izin'
                    ? 'warning'
                    : 'danger';

                return (
                  <div
                    key={a.id}
                    className="surface-card p-3 space-y-1"
                  >
                    <div className="flex items-center justify-between gap-2">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-1.5">
                          <span className="text-[11px] text-[var(--color-text-muted)] font-mono">
                            {a.school_class?.name || 'Rombel'}
                          </span>
                        </div>
                        <h3 className="text-xs font-bold text-[var(--color-text-primary)] truncate">
                          {a.student?.name || 'Siswa'}
                        </h3>
                        {a.notes && (
                          <p className="text-[11px] text-[var(--color-text-secondary)] italic mt-0.5">
                            Catatan: {a.notes}
                          </p>
                        )}
                      </div>

                      <Badge variant={badgeVariant} size="sm">
                        {status}
                      </Badge>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* Modal Pratinjau Foto KBM */}
      <Modal
        isOpen={Boolean(previewPhotoUrl)}
        onClose={() => setPreviewPhotoUrl(null)}
        title={previewPhotoTitle || 'Foto Bukti KBM'}
      >
        <div className="space-y-3">
          <div className="rounded-[14px] overflow-hidden border border-[var(--color-border-subtle)] bg-[var(--color-text-primary)] flex items-center justify-center max-h-[70vh]">
            {previewPhotoUrl && (
              <img
                src={previewPhotoUrl}
                alt="Dokumentasi KBM"
                className="max-h-[65vh] w-auto object-contain"
              />
            )}
          </div>
          <Button
            type="button"
            variant="secondary"
            onClick={() => setPreviewPhotoUrl(null)}
            className="w-full"
          >
            Tutup
          </Button>
        </div>
      </Modal>
    </div>
  );
}
