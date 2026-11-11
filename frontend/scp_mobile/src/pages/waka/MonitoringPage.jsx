import { useState, useEffect, useMemo, useCallback } from 'react';
import { useSearchParams } from 'react-router-dom';
import {
  FileText,
  Users,
  RotateCw,
  X,
  Eye,
  AlertTriangle,
  Filter,
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
  Badge,
} from '../../components/shared';
import { EmptyState, ErrorState } from '../../components/feedback';
import { getStorageUrl, formatDateIndo } from '../../utils/formatters';
import { unwrap, unwrapList } from '../../utils/responseHelper';
import { todayLocalISO } from '../../utils/dateUtils';

export default function MonitoringPage() {
  const { hasRole, isKesiswaan } = useAuth();
  const [searchParams, setSearchParams] = useSearchParams();

  // Active Tab
  const [activeTab, setActiveTab] = useState('jurnal'); // 'jurnal' | 'presensi'

  // Date Filter & Criteria
  const [selectedDate, setSelectedDate] = useState(() => todayLocalISO());
  const [selectedClassId, setSelectedClassId] = useState('ALL');
  const [filterStatus, setFilterStatus] = useState(() => searchParams.get('status') || 'ALL');
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

  // Sync search param status if changed externally
  useEffect(() => {
    const statusParam = searchParams.get('status');
    if (statusParam && statusParam !== filterStatus) {
      setFilterStatus(statusParam);
    }
  }, [searchParams]);

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
            setJournals(unwrapList(jRes.value));
          }

          if (isMounted && recapRes.status === 'fulfilled') {
            setDailyRecap(unwrap(recapRes.value));
          }
        } else {
          const params = { date: selectedDate };
          if (selectedClassId !== 'ALL') params.class_id = selectedClassId;
          const aRes = await leaveApi.getAttendances(params);
          if (isMounted) setAttendances(unwrapList(aRes));
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

  // Handle Mark Teacher Absent (Jam Kosong)
  const handleMarkTeacherAbsent = async (item) => {
    if (!window.confirm('Tandai sesi ini sebagai Guru Berhalangan Hadir (Jam Kosong)?')) return;
    const actionKey = item.journal_id || item.schedule_id || item.id;
    setMarkingAbsentId(actionKey);
    try {
      if (item.journal_id) {
        await journalApi.markTeacherAbsent(item.journal_id);
      } else {
        await journalApi.markTeacherAbsent(null, {
          schedule_id: item.schedule_id || item.id,
          date: item.date || selectedDate,
        });
      }
      showToast('Sesi KBM berhasil ditandai sebagai Guru Berhalangan Hadir.');
      handleRefresh();
    } catch (err) {
      showToast(err.response?.data?.message || err.message || 'Gagal mengubah status.', 'error');
    } finally {
      setMarkingAbsentId(null);
    }
  };

  // Filtered Journals (Adaptif: Mengutamakan Daily Recap Items untuk tanggal harian)
  const filteredJournals = useMemo(() => {
    // Gunakan dailyRecap.items jika tersedia untuk tanggal yang dipilih
    const source = selectedDate && dailyRecap?.items ? dailyRecap.items : journals;

    return source.filter((item) => {
      // 1. Filter Rombel
      if (selectedClassId !== 'ALL') {
        const itemClassId = item.class_id || item.schedule?.class_id;
        if (String(itemClassId) !== String(selectedClassId)) return false;
      }

      // 2. Filter Status KBM
      if (filterStatus !== 'ALL') {
        if (filterStatus === 'unfilled' && item.status !== 'unfilled') return false;
        if (filterStatus === 'completed' && item.status !== 'completed') return false;
        if (filterStatus === 'teacher_absent' && item.status !== 'teacher_absent') return false;
        if (filterStatus === 'exempted' && item.status !== 'exempted') return false;
        if (filterStatus === 'ongoing' && item.status !== 'ongoing') return false;
      }

      // 3. Filter Pencarian Teks
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase().trim();
        const cls = (item.class_name || item.schedule?.school_class?.name || '').toLowerCase();
        const teacher = (item.teacher_name || item.schedule?.teacher?.name || '').toLowerCase();
        const subject = (item.subject_name || item.schedule?.subject?.name || '').toLowerCase();
        const topic = (item.topic_description || item.exemption_reason || '').toLowerCase();
        if (!cls.includes(q) && !teacher.includes(q) && !subject.includes(q) && !topic.includes(q)) {
          return false;
        }
      }

      return true;
    });
  }, [selectedDate, dailyRecap, journals, selectedClassId, filterStatus, searchQuery]);

  // Filtered Attendances
  const filteredAttendances = useMemo(() => {
    return attendances.filter((a) => {
      if (selectedClassId !== 'ALL') {
        const itemClassId = a.class_id || a.student?.class_id || a.school_class_id;
        if (String(itemClassId) !== String(selectedClassId)) return false;
      }

      if (!searchQuery.trim()) return true;
      const q = searchQuery.toLowerCase().trim();
      const name = (a.student?.name || '').toLowerCase();
      const cls = (a.school_class?.name || '').toLowerCase();
      return name.includes(q) || cls.includes(q);
    });
  }, [attendances, selectedClassId, searchQuery]);

  const activeList = activeTab === 'jurnal' ? filteredJournals : filteredAttendances;
  const totalItems = activeList.length;
  const totalPages = Math.max(1, Math.ceil(totalItems / perPage));
  const pagedItems = activeList.slice((page - 1) * perPage, page * perPage);

  useEffect(() => {
    setPage(1);
  }, [activeTab, selectedDate, selectedClassId, filterStatus, searchQuery, perPage]);

  // Metrik Daily Recap
  const totalSesi = dailyRecap?.total_mandatory ?? dailyRecap?.effective_mandatory ?? dailyRecap?.items?.length ?? 0;
  const belumDiisiCount = dailyRecap?.unfilled_count ?? 0;
  const selesaiCount = dailyRecap?.completed_count ?? 0;
  const jamKosongCount = dailyRecap?.absent_count ?? 0;

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
        <div className="grid grid-cols-4 gap-2">
          <button
            type="button"
            onClick={() => setFilterStatus('ALL')}
            className={`surface-card p-2 text-center transition-all rounded-[10px] ${
              filterStatus === 'ALL'
                ? 'border-[var(--color-brand-primary,#2563eb)] ring-2 ring-[var(--color-brand-primary,#2563eb)]/30'
                : 'border border-[var(--color-border-subtle)]'
            }`}
          >
            <p className="text-[10px] text-[var(--color-text-secondary)] font-semibold truncate">Total Sesi</p>
            <p className="text-sm font-bold text-[var(--color-text-primary)] mt-0.5">
              {totalSesi}
            </p>
          </button>
          <button
            type="button"
            onClick={() => setFilterStatus(filterStatus === 'unfilled' ? 'ALL' : 'unfilled')}
            className={`surface-card p-2 text-center transition-all rounded-[10px] ${
              filterStatus === 'unfilled'
                ? 'border-amber-500 ring-2 ring-amber-500/30'
                : 'border border-[var(--color-border-subtle)]'
            }`}
          >
            <p className="text-[10px] text-amber-500 font-semibold truncate">Belum Diisi</p>
            <p className="text-sm font-bold text-amber-500 mt-0.5">
              {belumDiisiCount}
            </p>
          </button>
          <button
            type="button"
            onClick={() => setFilterStatus(filterStatus === 'completed' ? 'ALL' : 'completed')}
            className={`surface-card p-2 text-center transition-all rounded-[10px] ${
              filterStatus === 'completed'
                ? 'border-emerald-500 ring-2 ring-emerald-500/30'
                : 'border border-[var(--color-border-subtle)]'
            }`}
          >
            <p className="text-[10px] text-[var(--color-success-fg)] font-semibold truncate">Selesai</p>
            <p className="text-sm font-bold text-[var(--color-success-fg)] mt-0.5">
              {selesaiCount}
            </p>
          </button>
          <button
            type="button"
            onClick={() => setFilterStatus(filterStatus === 'teacher_absent' ? 'ALL' : 'teacher_absent')}
            className={`surface-card p-2 text-center transition-all rounded-[10px] ${
              filterStatus === 'teacher_absent'
                ? 'border-rose-500 ring-2 ring-rose-500/30'
                : 'border border-[var(--color-border-subtle)]'
            }`}
          >
            <p className="text-[10px] text-[var(--color-danger-fg)] font-semibold truncate">Jam Kosong</p>
            <p className="text-sm font-bold text-[var(--color-danger-fg)] mt-0.5">
              {jamKosongCount}
            </p>
          </button>
        </div>
      )}

      {/* Filter Rombel & Filter Status & Search Input */}
      <div className="space-y-2">
        <div className="grid grid-cols-2 gap-2">
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

          {activeTab === 'jurnal' ? (
            <Select
              value={filterStatus}
              onChange={(e) => setFilterStatus(e.target.value)}
              className="text-xs"
            >
              <option value="ALL">Semua Status</option>
              <option value="unfilled">Belum Diisi</option>
              <option value="completed">Selesai</option>
              <option value="teacher_absent">Jam Kosong</option>
              <option value="exempted">Dikecualikan</option>
              <option value="ongoing">Berjalan</option>
            </Select>
          ) : (
            <div className="flex items-center justify-end text-xs text-[var(--color-text-secondary)] font-medium px-2">
              Total Presensi: {totalItems}
            </div>
          )}
        </div>

        {filterStatus !== 'ALL' && activeTab === 'jurnal' && (
          <div className="flex items-center gap-1.5 px-1">
            <span className="text-[11px] text-[var(--color-text-secondary)] flex items-center gap-1">
              <Filter size={11} /> Filter aktif:
            </span>
            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-semibold bg-[var(--color-surface-subtle)] border border-[var(--color-border-light)] text-[var(--color-text-primary)]">
              {filterStatus === 'unfilled'
                ? 'Belum Diisi'
                : filterStatus === 'completed'
                ? 'Selesai'
                : filterStatus === 'teacher_absent'
                ? 'Jam Kosong'
                : filterStatus === 'exempted'
                ? 'Dikecualikan'
                : filterStatus}
              <button
                type="button"
                onClick={() => setFilterStatus('ALL')}
                className="hover:text-[var(--color-danger-fg)] ml-0.5"
                title="Hapus filter"
              >
                <X size={12} />
              </button>
            </span>
          </div>
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

      {/* Tabel Jurnal KBM / Rekap Presensi */}
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <span className="section-label">
            {activeTab === 'jurnal'
              ? `Daftar Sesi KBM (${totalItems})`
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
                  title={filterStatus !== 'ALL' ? 'Tidak Ada Sesi yang Cocok' : 'Tidak Ada Sesi KBM'}
                  message={
                    filterStatus === 'unfilled'
                      ? 'Semua sesi KBM telah diisi jurnalnya.'
                      : filterStatus !== 'ALL'
                      ? `Tidak ditemukan sesi KBM dengan status "${filterStatus}" untuk kriteria ini.`
                      : `Belum ada sesi KBM yang tercatat pada tanggal ${formatDateIndo(selectedDate)}.`
                  }
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
                const status = j.status;
                const isCompleted = status === 'completed';
                const isTeacherAbsent = status === 'teacher_absent';
                const isExempted = status === 'exempted';
                const isUnfilled = status === 'unfilled';
                const photoUrl = j.photo_url || j.photo_path;

                const jp = j.period_number ?? j.schedule?.period_number ?? 1;
                const subjectName = j.subject_name || j.schedule?.subject?.name || 'Mata Pelajaran';
                const className = j.class_name || j.schedule?.school_class?.name || 'Rombel';
                const teacherName = j.teacher_name || j.schedule?.teacher?.name || 'Guru Pengampu';

                let statusLabel = 'Berjalan';
                let badgeVariant = 'neutral';

                if (isCompleted) {
                  statusLabel = 'Selesai';
                  badgeVariant = 'success';
                } else if (isTeacherAbsent) {
                  statusLabel = 'Jam Kosong';
                  badgeVariant = 'danger';
                } else if (isExempted) {
                  statusLabel = 'Dikecualikan';
                  badgeVariant = 'warning';
                } else if (isUnfilled) {
                  statusLabel = 'Belum Diisi';
                  badgeVariant = 'warning';
                }

                return (
                  <tr key={j.id || `sched-${j.schedule_id}-${index}`}>
                    <td className="data-table__no">
                      <span className="data-table__mono">{jp}</span>
                    </td>
                    <td>
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <span className="data-table__cell-title">{subjectName}</span>
                        <Badge variant={badgeVariant} size="sm">
                          {statusLabel}
                        </Badge>
                      </div>
                      <span className="data-table__cell-sub">
                        {className} · {teacherName}
                        {j.substitute_teacher_name && (
                          <span className="text-amber-500 font-medium"> (Pengganti: {j.substitute_teacher_name})</span>
                        )}
                      </span>
                      {j.topic_description ? (
                        <span className="data-table__cell-meta">{j.topic_description}</span>
                      ) : isExempted ? (
                        <span className="data-table__cell-meta text-amber-500">
                          Agenda: {j.exemption_reason || 'Kegiatan Sekolah'}
                        </span>
                      ) : isUnfilled ? (
                        <span className="data-table__cell-meta text-amber-500/80 italic">
                          Jurnal belum diisi oleh guru pengampu
                        </span>
                      ) : null}
                    </td>
                    <td>
                      <div className="data-table__actions">
                        {photoUrl && (
                          <button
                            type="button"
                            className="data-table__action"
                            onClick={() => {
                              setPreviewPhotoUrl(getStorageUrl(photoUrl));
                              setPreviewPhotoTitle(`${className} - ${subjectName}`);
                            }}
                            aria-label="Lihat foto bukti KBM"
                          >
                            <Eye size={13} />
                          </button>
                        )}
                        {canMarkAbsent && !isCompleted && !isTeacherAbsent && !isExempted && (
                          <button
                            type="button"
                            disabled={markingAbsentId === (j.journal_id || j.schedule_id || j.id)}
                            onClick={() => handleMarkTeacherAbsent(j)}
                            className="data-table__action data-table__action--danger"
                            title="Tandai Jam Kosong"
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
