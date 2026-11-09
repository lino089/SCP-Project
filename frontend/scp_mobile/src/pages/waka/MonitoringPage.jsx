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
  Modal,
  Input,
  Select,
  SearchInput,
  DataTable,
  PaginationBar,
  SegmentedTabs,
} from '../../components/shared';
import { EmptyState, ErrorState } from '../../components/feedback';
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

  // Pagination tabel (client-side)
  const [page, setPage] = useState(1);
  const [perPage, setPerPage] = useState(10);

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

  const activeList = activeTab === 'jurnal' ? filteredJournals : filteredAttendances;
  const totalItems = activeList.length;
  const totalPages = Math.max(1, Math.ceil(totalItems / perPage));
  const pagedItems = activeList.slice((page - 1) * perPage, page * perPage);

  useEffect(() => {
    setPage(1);
  }, [activeTab, selectedDate, selectedClassId, searchQuery, perPage]);

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
      {/* Tabel Jurnal KBM / Rekap Presensi */}
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <span className="section-label">
            {activeTab === 'jurnal'
              ? `Daftar Jurnal KBM (${totalItems})`
              : `Rekapitulasi Presensi (${totalItems})`}
          </span>
        </div>

        {loadError ? (
          <ErrorState message={loadError} onRetry={handleRefresh} />
        ) : (
          <DataTable
            columns={
              activeTab === 'jurnal'
                ? [
                    { key: 'jp', label: 'JP', width: 40, align: 'center' },
                    { key: 'subject', label: 'Jurnal KBM' },
                    { key: 'actions', label: 'Aksi', width: 74, align: 'right' },
                  ]
                : [
                    { key: 'no', label: '#', width: 30, align: 'center' },
                    { key: 'student', label: 'Siswa / Rombel' },
                    { key: 'status', label: 'Status', width: 74, align: 'right' },
                  ]
            }
            rows={pagedItems}
            isLoading={isLoading}
            skeletonRows={Math.min(perPage, 8)}
            ariaLabel={activeTab === 'jurnal' ? 'Daftar jurnal KBM' : 'Rekap presensi siswa'}
            empty={
              activeTab === 'jurnal' ? (
                <EmptyState
                  title="Tidak Ada Jurnal"
                  message={`Belum ada sesi KBM yang tercatat pada tanggal ${formatDateIndo(selectedDate)}.`}
                />
              ) : (
                <EmptyState
                  title="Tidak Ada Data Presensi"
                  message="Belum ada catatan presensi siswa untuk kriteria filter ini."
                />
              )
            }
            renderRow={(item, index) => {
              const rowNo = String((page - 1) * perPage + index + 1).padStart(2, '0');

              if (activeTab === 'jurnal') {
                const j = item;
                const isCompleted = j.status === 'completed';
                const isTeacherAbsent = j.status === 'teacher_absent';
                const photoUrl = j.photo_url || j.photo_path;
                const statusLabel = isCompleted
                  ? 'Selesai'
                  : j.status === 'ongoing'
                  ? 'Berjalan'
                  : isTeacherAbsent
                  ? 'Guru berhalangan'
                  : j.status;

                return (
                  <tr key={j.id}>
                    <td className="data-table__no">
                      <span className="data-table__mono">{j.schedule?.period_number || 1}</span>
                    </td>
                    <td>
                      <span className="data-table__cell-title">
                        {j.schedule?.subject?.name || 'Mata Pelajaran'}
                      </span>
                      <span className="data-table__cell-sub">
                        {j.schedule?.school_class?.name || 'Rombel'} ·{' '}
                        {j.schedule?.teacher?.name || 'Guru Pengampu'}
                      </span>
                      <span className="data-table__cell-meta">
                        {statusLabel}
                        {j.topic_description ? ` · ${j.topic_description}` : ''}
                      </span>
                    </td>
                    <td>
                      <div className="data-table__actions">
                        {photoUrl && (
                          <button
                            type="button"
                            className="data-table__action"
                            onClick={() => {
                              setPreviewPhotoUrl(getStorageUrl(photoUrl));
                              setPreviewPhotoTitle(
                                `${j.schedule?.school_class?.name} - ${j.schedule?.subject?.name}`
                              );
                            }}
                            aria-label="Lihat foto bukti KBM"
                          >
                            <Eye size={13} />
                          </button>
                        )}
                        {canMarkAbsent && !isCompleted && !isTeacherAbsent && (
                          <button
                            type="button"
                            disabled={markingAbsentId === j.id}
                            onClick={() => handleMarkTeacherAbsent(j.id)}
                            className="data-table__action data-table__action--danger"
                            aria-label="Tandai jam kosong"
                          >
                            <AlertTriangle size={13} />
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              }

              const a = item;
              const status = a.status || 'Hadir';
              const badgeVariant =
                status === 'Hadir'
                  ? 'success'
                  : status === 'Sakit'
                  ? 'info'
                  : status === 'Izin'
                  ? 'warning'
                  : 'error';

              return (
                <tr key={a.id}>
                  <td className="data-table__no">{rowNo}</td>
                  <td>
                    <span className="data-table__cell-title">{a.student?.name || 'Siswa'}</span>
                    <span className="data-table__cell-meta">
                      {a.school_class?.name || 'Rombel'}
                      {a.notes ? ` · ${a.notes}` : ''}
                    </span>
                  </td>
                  <td>
                    <div className="data-table__actions">
                      <span className={`badge badge--${badgeVariant} badge--sm`}>{status}</span>
                    </div>
                  </td>
                </tr>
              );
            }}
            footer={
              <PaginationBar
                currentPage={page}
                totalPages={totalPages}
                totalItems={totalItems}
                perPage={perPage}
                onPageChange={setPage}
                onPerPageChange={setPerPage}
                disabled={isLoading}
              />
            }
          />
        )}
      </div>

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
