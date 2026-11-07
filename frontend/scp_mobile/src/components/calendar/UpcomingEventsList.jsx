import { useMemo } from 'react';
import {
  Calendar,
  ChevronRight,
  AlertTriangle,
  Users,
  X,
} from 'lucide-react';
import Badge from '../shared/Badge';
import './UpcomingEventsList.css';

const INDONESIAN_MONTHS = [
  'Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni',
  'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember',
];

const INDONESIAN_DAYS = [
  'Minggu', 'Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat', 'Sabtu',
];

function formatIndonesianDate(dateStr) {
  if (!dateStr) return '';
  const [y, m, d] = dateStr.split('-').map(Number);
  const dateObj = new Date(y, m - 1, d);
  const dayName = INDONESIAN_DAYS[dateObj.getDay()];
  const monthName = INDONESIAN_MONTHS[m - 1];
  return `${dayName}, ${d} ${monthName} ${y}`;
}

function formatDateRange(startDate, endDate) {
  if (!startDate) return '';
  if (!endDate || startDate === endDate) {
    return formatIndonesianDate(startDate);
  }
  const [y1, m1, d1] = startDate.split('-').map(Number);
  const [y2, m2, d2] = endDate.split('-').map(Number);

  if (m1 === m2 && y1 === y2) {
    return `${d1} - ${d2} ${INDONESIAN_MONTHS[m1 - 1]} ${y1}`;
  }
  return `${d1} ${INDONESIAN_MONTHS[m1 - 1]} - ${d2} ${INDONESIAN_MONTHS[m2 - 1]} ${y2}`;
}

export default function UpcomingEventsList({
  events = [],
  onEventClick,
  userRole = 'student',
  emptyMessage = 'Tidak ada agenda kegiatan pada periode ini.',
  isLoading = false,
  selectedDate = null,
  onClearDateFilter = null,
}) {
  // Sort events chronologically
  const sortedEvents = useMemo(() => {
    let list = [...(events || [])];
    if (selectedDate) {
      list = list.filter((e) => {
        const start = e.start_date;
        const end = e.end_date || e.start_date;
        return selectedDate >= start && selectedDate <= end;
      });
    }

    return list.sort((a, b) => {
      if (a.start_date !== b.start_date) {
        return (a.start_date || '').localeCompare(b.start_date || '');
      }
      return (a.title || a.name || '').localeCompare(b.title || b.name || '');
    });
  }, [events, selectedDate]);

  const getTypeBadge = (type) => {
    switch (type) {
      case 'holiday':
        return <Badge variant="danger">Libur Resmi</Badge>;
      case 'school_event':
        return <Badge variant="warning">Kegiatan Sekolah</Badge>;
      case 'class_event':
        return <Badge variant="neutral">Kegiatan Khusus</Badge>;
      case 'exam':
        return <Badge variant="primary">Ujian / Asesmen</Badge>;
      default:
        return <Badge variant="neutral">{type || 'Agenda'}</Badge>;
    }
  };

  const getScopeLabel = (evt) => {
    if (evt.scope_type === 'all') return 'Seluruh Sekolah';
    if (evt.scope_type === 'grade') {
      const grades = (evt.scope_targets || []).join(', ');
      return `Tingkat ${grades}`;
    }
    if (evt.scope_type === 'class') {
      if (Array.isArray(evt.target_classes) && evt.target_classes.length > 0) {
        return evt.target_classes.map((c) => c.name).join(', ');
      }
      return `${(evt.scope_targets || []).length} Rombel`;
    }
    return 'Spesifik';
  };

  if (isLoading) {
    return (
      <div className="space-y-3">
        {[1, 2, 3].map((n) => (
          <div
            key={n}
            className="bg-[var(--color-surface)] rounded-[16px] border border-[var(--color-border-subtle)] p-4 animate-pulse space-y-3"
          >
            <div className="flex justify-between w-full">
              <div className="h-4 bg-[var(--color-border-subtle)] rounded-[8px] w-1/3" />
              <div className="h-4 bg-[var(--color-border-subtle)] rounded-[8px] w-1/5" />
            </div>
            <div className="h-5 bg-[var(--color-border-subtle)] rounded-[8px] w-3/4" />
            <div className="h-4 bg-[var(--color-surface-subtle)] rounded-[8px] w-1/2" />
          </div>
        ))}
      </div>
    );
  }

  return (
    <div className="upcoming-events-list">
      {/* Active Date Filter Banner if filtered */}
      {selectedDate && (
        <div className="flex items-center justify-between p-3 bg-[var(--color-surface-subtle)] text-[var(--color-text-primary)] rounded-[14px] text-xs font-medium mb-3">
          <div className="flex items-center gap-2">
            <Calendar size={14} className="text-amber-400" />
            <span>
              Menampilkan agenda tanggal:{' '}
              <strong className="text-amber-300 font-mono">
                {formatIndonesianDate(selectedDate)}
              </strong>
            </span>
          </div>
          {onClearDateFilter && (
            <button
              type="button"
              onClick={onClearDateFilter}
              className="flex items-center gap-1 text-[11px] font-bold text-[var(--color-text-muted)] hover:text-white px-2 py-0.5 rounded-[10px] bg-[var(--color-surface-subtle)]"
            >
              <X size={12} />
              Reset
            </button>
          )}
        </div>
      )}

      {sortedEvents.length === 0 ? (
        <div className="bg-[var(--color-surface)] border border-[var(--color-border-subtle)] rounded-[16px] p-8 text-center">
          <div className="w-12 h-12 rounded-full bg-[var(--color-surface-subtle)] text-[var(--color-text-muted)] mx-auto flex items-center justify-center mb-3">
            <Calendar size={22} />
          </div>
          <p className="text-sm font-semibold text-[var(--color-text-primary)]">{emptyMessage}</p>
          <p className="text-xs text-[var(--color-text-secondary)] mt-1 max-w-xs mx-auto">
            KBM reguler berjalan normal sesuai jadwal pelajaran resmi yang berlaku.
          </p>
        </div>
      ) : (
        sortedEvents.map((evt) => {
          const cardTypeClass = `upcoming-event-card--${evt.type || 'school_event'}`;
          const title = evt.title || evt.name || 'Agenda Sekolah';
          const isAffecting = userRole === 'teacher' && Boolean(evt.affects_my_teaching);

          return (
            <button
              key={`${evt.id}-${evt.start_date}`}
              type="button"
              onClick={() => onEventClick?.(evt)}
              className={`upcoming-event-card ${cardTypeClass}`}
            >
              <div className="upcoming-event-card__header">
                <div className="upcoming-event-card__date">
                  <Calendar size={13} className="text-[var(--color-text-muted)]" />
                  <span>{formatDateRange(evt.start_date, evt.end_date)}</span>
                </div>
                <div className="shrink-0 flex items-center gap-1">
                  {getTypeBadge(evt.type)}
                  <ChevronRight size={16} className="text-[var(--color-text-muted)]" />
                </div>
              </div>

              <h4 className="upcoming-event-card__title">{title}</h4>

              {evt.description && (
                <p className="upcoming-event-card__desc">{evt.description}</p>
              )}

              {/* Teacher impact alert */}
              {isAffecting && (
                <div className="upcoming-event-card__teacher-alert">
                  <AlertTriangle size={14} className="text-amber-600 shrink-0" />
                  <span>
                    Berdampak pada KBM Anda:{' '}
                    <strong>{(evt.affected_my_classes || []).join(', ') || 'Kelas Anda'}</strong>
                  </span>
                </div>
              )}

              {/* Parent applicable children */}
              {userRole === 'parent' &&
                Array.isArray(evt.applicable_children) &&
                evt.applicable_children.length > 0 && (
                  <div className="flex flex-wrap items-center gap-1.5 mt-2">
                    <span className="text-[11px] text-[var(--color-text-secondary)] font-semibold flex items-center gap-1">
                      <Users size={12} /> Relevan untuk:
                    </span>
                    {evt.applicable_children.map((child) => (
                      <span
                        key={child.id}
                        className="upcoming-event-card__children-tag"
                      >
                        {child.name} ({child.class_name})
                      </span>
                    ))}
                  </div>
                )}

              {/* Bottom badge row */}
              <div className="upcoming-event-card__badges">
                <Badge variant="neutral" className="text-[11px]">
                  {getScopeLabel(evt)}
                </Badge>
                {evt.disables_teaching ? (
                  <Badge variant="danger" className="text-[11px]">
                    KBM Ditiadakan
                  </Badge>
                ) : (
                  <Badge variant="success" className="text-[11px]">
                    KBM Normal
                  </Badge>
                )}
              </div>
            </button>
          );
        })
      )}
    </div>
  );
}


