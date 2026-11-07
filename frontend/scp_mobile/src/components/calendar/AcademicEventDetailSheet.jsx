import {
  Calendar,
  Clock,
  Layers,
  Info,
  CheckCircle2,
  AlertTriangle,
  Users,
  ShieldCheck,
} from 'lucide-react';
import BottomSheetModal from '../shared/BottomSheetModal';
import Button from '../shared/Button';
import Badge from '../shared/Badge';

const TYPE_CONFIG = {
  holiday: { label: 'Libur Nasional / Resmi', variant: 'danger' },
  school_event: { label: 'Kegiatan Sekolah', variant: 'warning' },
  class_event: { label: 'Kegiatan Khusus Tingkat/Rombel', variant: 'neutral' },
  exam: { label: 'Masa Penilaian / Ujian', variant: 'primary' },
};

export default function AcademicEventDetailSheet({
  isOpen = false,
  onClose,
  event = null,
  userRole = 'student',
}) {
  if (!event) return null;

  const typeMeta = TYPE_CONFIG[event.type] || {
    label: event.type || 'Agenda Kegiatan',
    variant: 'neutral',
  };

  const formatDateRange = () => {
    if (!event.start_date) return '-';
    if (!event.end_date || event.start_date === event.end_date) {
      return new Date(event.start_date + 'T00:00:00').toLocaleDateString('id-ID', {
        weekday: 'long',
        day: 'numeric',
        month: 'long',
        year: 'numeric',
      });
    }

    const d1 = new Date(event.start_date + 'T00:00:00').toLocaleDateString('id-ID', {
      weekday: 'long',
      day: 'numeric',
      month: 'long',
      year: 'numeric',
    });
    const d2 = new Date(event.end_date + 'T00:00:00').toLocaleDateString('id-ID', {
      weekday: 'long',
      day: 'numeric',
      month: 'long',
      year: 'numeric',
    });

    return `${d1} s/d ${d2}`;
  };

  const formatScopeText = () => {
    if (event.scope_type === 'all') {
      return 'Berlaku untuk Seluruh Sekolah (Kelas X, XI, XII)';
    }
    if (event.scope_type === 'grade') {
      const grades = (event.scope_targets || []).join(', ');
      return `Berlaku khusus untuk Tingkat: ${grades}`;
    }
    if (event.scope_type === 'class') {
      if (Array.isArray(event.target_classes) && event.target_classes.length > 0) {
        return `Berlaku untuk Rombel: ${event.target_classes.map((c) => c.name).join(', ')}`;
      }
      return `Berlaku untuk ${(event.scope_targets || []).length} Rombel terpilih`;
    }
    return 'Cakupan Terbatas';
  };

  const footer = (
    <div className="w-full">
      <Button variant="secondary" onClick={onClose} fullWidth>
        Tutup Rincian
      </Button>
    </div>
  );

  return (
    <BottomSheetModal
      isOpen={isOpen}
      onClose={onClose}
      title="Rincian Agenda Kegiatan"
      subtitle={event.title || event.name}
      footer={footer}
      size="md"
    >
      <div className="space-y-4 text-sm text-[var(--color-text-primary)]">
        {/* Badges Bar */}
        <div className="flex items-center gap-2 flex-wrap">
          <Badge variant={typeMeta.variant}>{typeMeta.label}</Badge>
          {event.disables_teaching ? (
            <Badge variant="danger">KBM Ditiadakan</Badge>
          ) : (
            <Badge variant="success">KBM Berjalan Normal</Badge>
          )}
        </div>

        {/* Title */}
        <h3 className="text-base font-bold text-[var(--color-text-primary)] leading-snug">
          {event.title || event.name}
        </h3>

        {/* Status KBM Banner */}
        {event.disables_teaching ? (
          <div className="p-3 bg-[var(--color-danger-bg)] border border-[var(--color-danger-border)] rounded-[14px] flex items-start gap-2.5">
            <AlertTriangle size={18} className="text-[var(--color-danger-fg)] shrink-0 mt-0.5" />
            <div>
              <p className="text-xs font-bold text-[var(--color-danger-fg)]">
                KBM Reguler Ditiadakan
              </p>
              <p className="text-xs text-[var(--color-danger-fg)] mt-0.5 leading-relaxed">
                Agenda ini menonaktifkan kegiatan belajar mengajar bagi rombel yang
                tercakup. Presensi harian disesuaikan dengan agenda terkait.
              </p>
            </div>
          </div>
        ) : (
          <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-[14px] flex items-start gap-2.5">
            <CheckCircle2 size={18} className="text-emerald-600 shrink-0 mt-0.5" />
            <div>
              <p className="text-xs font-bold text-emerald-900">
                KBM Tetap Berjalan Normal
              </p>
              <p className="text-xs text-emerald-700 mt-0.5 leading-relaxed">
                Kegiatan ini tidak menonaktifkan jadwal KBM reguler. Guru dan siswa tetap
                melaksanakan pembelajaran seperti biasa.
              </p>
            </div>
          </div>
        )}

        {/* Attendance Guidance */}
        {event.attendance_guidance && (
          <div className="p-3 bg-[var(--color-bg-app)] border border-[var(--color-border-subtle)] rounded-[14px] flex items-start gap-2.5">
            <Info size={16} className="text-[var(--color-text-secondary)] shrink-0 mt-0.5" />
            <div>
              <span className="text-xs font-bold text-[var(--color-text-primary)]">
                Panduan Presensi:
              </span>
              <p className="text-xs text-[var(--color-text-secondary)] mt-0.5 leading-relaxed">
                {event.attendance_guidance}
              </p>
            </div>
          </div>
        )}

        {/* Teacher Impact Warning */}
        {userRole === 'teacher' && event.affects_my_teaching && (
          <div className="p-3 bg-amber-50 border border-[var(--color-warning-border)] rounded-[14px] space-y-1">
            <div className="flex items-center gap-1.5 text-amber-900 font-bold text-xs">
              <AlertTriangle size={15} className="text-amber-600" />
              <span>Berdampak pada Jadwal Mengajar Anda</span>
            </div>
            <p className="text-xs text-amber-800">
              Kelas Anda yang terkena peniadaan KBM:{' '}
              <strong>{(event.affected_my_classes || []).join(', ') || 'Semua Kelas'}</strong>
            </p>
          </div>
        )}

        {/* Parent Applicable Children */}
        {userRole === 'parent' &&
          Array.isArray(event.applicable_children) &&
          event.applicable_children.length > 0 && (
            <div className="p-3 bg-blue-50 border border-blue-200 rounded-[14px] space-y-1.5">
              <div className="flex items-center gap-1.5 text-blue-900 font-bold text-xs">
                <Users size={15} className="text-blue-600" />
                <span>Relevan untuk Anak Anda:</span>
              </div>
              <div className="flex flex-wrap gap-1.5">
                {event.applicable_children.map((child) => (
                  <span
                    key={child.id}
                    className="text-xs px-2 py-0.5 rounded-full bg-[var(--color-surface)] border border-[var(--color-info-border)] text-blue-800 font-medium"
                  >
                    {child.name} ({child.class_name})
                  </span>
                ))}
              </div>
            </div>
          )}

        {/* Metadata Details */}
        <div className="p-3.5 bg-[var(--color-bg-app)] border border-[var(--color-border-subtle)] rounded-[14px] space-y-2.5 text-xs">
          <div className="flex items-start gap-2.5">
            <Calendar size={15} className="text-[var(--color-text-muted)] shrink-0 mt-0.5" />
            <div>
              <span className="font-semibold text-[var(--color-text-primary)]">Waktu Pelaksanaan</span>
              <p className="text-[var(--color-text-secondary)] font-mono mt-0.5">{formatDateRange()}</p>
            </div>
          </div>

          {(event.start_time || event.end_time) && (
            <div className="flex items-start gap-2.5">
              <Clock size={15} className="text-[var(--color-text-muted)] shrink-0 mt-0.5" />
              <div>
                <span className="font-semibold text-[var(--color-text-primary)]">Jam Kegiatan</span>
                <p className="text-[var(--color-text-secondary)] font-mono mt-0.5">
                  {event.start_time ? String(event.start_time).slice(0, 5) : '--:--'} s/d{' '}
                  {event.end_time ? String(event.end_time).slice(0, 5) : '--:--'} WIB
                </p>
              </div>
            </div>
          )}

          <div className="flex items-start gap-2.5">
            <Layers size={15} className="text-[var(--color-text-muted)] shrink-0 mt-0.5" />
            <div>
              <span className="font-semibold text-[var(--color-text-primary)]">Cakupan Agenda</span>
              <p className="text-[var(--color-text-secondary)] mt-0.5">{formatScopeText()}</p>
            </div>
          </div>

          {event.creator?.name && (
            <div className="flex items-start gap-2.5 pt-1 border-t border-[var(--color-border-subtle)]/60">
              <ShieldCheck size={15} className="text-[var(--color-text-muted)] shrink-0 mt-0.5" />
              <div>
                <span className="font-semibold text-[var(--color-text-primary)]">Dibuat Oleh</span>
                <p className="text-[var(--color-text-secondary)] mt-0.5">
                  {event.creator.name} ({event.creator.role === 'vice_principal' ? 'Waka Kurikulum' : event.creator.role})
                </p>
              </div>
            </div>
          )}
        </div>

        {/* Description */}
        {event.description ? (
          <div className="space-y-1">
            <span className="text-xs font-bold text-[var(--color-text-primary)]">
              Keterangan / Catatan:
            </span>
            <p className="text-xs text-[var(--color-text-secondary)] leading-relaxed whitespace-pre-line p-3 bg-[var(--color-surface)] border border-[var(--color-border-subtle)] rounded-[14px]">
              {event.description}
            </p>
          </div>
        ) : (
          <p className="text-xs text-[var(--color-text-muted)] italic">
            Tidak ada deskripsi tambahan untuk agenda ini.
          </p>
        )}
      </div>
    </BottomSheetModal>
  );
}


