import { useMemo } from 'react';
import {
  Calendar,
  FileText,
  AlertCircle,
  CheckCircle2,
  Users,
  ChevronRight,
} from 'lucide-react';

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

export default function UpcomingEventsList({
  events = [],
  onEventClick,
  userRole = 'student',
  emptyMessage = 'Tidak ada agenda kegiatan pada periode ini.',
}) {
  // Urutkan agenda secara kronologis berdasarkan start_date
  const sortedEvents = useMemo(() => {
    return [...(events || [])].sort((a, b) => {
      if (a.start_date !== b.start_date) {
        return a.start_date.localeCompare(b.start_date);
      }
      return (a.title || '').localeCompare(b.title || '');
    });
  }, [events]);

  const getTypeBadgeClass = (type) => {
    switch (type) {
      case 'holiday':
        return 'bg-red-50 text-red-700 border-red-200';
      case 'school_event':
        return 'bg-amber-50 text-amber-700 border-amber-200';
      case 'class_event':
        return 'bg-purple-50 text-purple-700 border-purple-200';
      case 'exam':
        return 'bg-blue-50 text-blue-700 border-blue-200';
      default:
        return 'bg-gray-50 text-gray-700 border-gray-200';
    }
  };

  const getTypeName = (type) => {
    switch (type) {
      case 'holiday':
        return 'Libur Resmi';
      case 'school_event':
        return 'Kegiatan Sekolah';
      case 'class_event':
        return 'Kegiatan Khusus';
      case 'exam':
        return 'Ujian / Asesmen';
      default:
        return type;
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

  if (!sortedEvents || sortedEvents.length === 0) {
    return (
      <div className="bg-white border border-gray-200 rounded-xl p-8 text-center">
        <div className="w-12 h-12 rounded-full bg-gray-50 text-gray-400 mx-auto flex items-center justify-center mb-3">
          <Calendar size={22} />
        </div>
        <p className="text-sm font-medium text-gray-600">{emptyMessage}</p>
        <p className="text-xs text-gray-400 mt-1">
          KBM reguler berjalan seperti biasa sesuai jadwal yang telah ditentukan.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {sortedEvents.map((evt) => {
        const isMultiDay = evt.start_date !== evt.end_date;
        const formattedDate = isMultiDay
          ? `${formatIndonesianDate(evt.start_date)} — ${formatIndonesianDate(evt.end_date)}`
          : formatIndonesianDate(evt.start_date);

        return (
          <div
            key={evt.id}
            onClick={() => onEventClick && onEventClick(evt)}
            className="group bg-white border border-gray-200 hover:border-gray-400 rounded-xl p-4 sm:p-5 transition cursor-pointer relative"
          >
            {/* Header Tanggal & Badges */}
            <div className="flex flex-wrap items-center justify-between gap-2 mb-2.5">
              <div className="flex items-center gap-2 text-xs sm:text-sm font-semibold text-gray-800">
                <Calendar size={16} className="text-blue-600 shrink-0" />
                <span>{formattedDate}</span>
              </div>

              <div className="flex flex-wrap items-center gap-1.5">
                {/* Badge Kategori */}
                <span
                  className={`text-[11px] font-semibold px-2 py-0.5 rounded-full border ${getTypeBadgeClass(
                    evt.type
                  )}`}
                >
                  {getTypeName(evt.type)}
                </span>

                {/* Badge Cakupan */}
                <span className="text-[11px] font-medium px-2 py-0.5 rounded-full bg-gray-100 text-gray-600 border border-gray-200 flex items-center gap-1">
                  <Users size={11} />
                  <span>{getScopeLabel(evt)}</span>
                </span>

                {/* Badge Guru Impact */}
                {userRole === 'teacher' && evt.affects_my_teaching && (
                  <span className="text-[11px] font-semibold px-2 py-0.5 rounded-full bg-indigo-50 text-indigo-700 border border-indigo-200">
                    Berdampak pada Jadwal Anda
                  </span>
                )}

                {/* Tag Anak (Orang Tua) */}
                {userRole === 'parent' &&
                  Array.isArray(evt.applicable_children) &&
                  evt.applicable_children.map((child) => (
                    <span
                      key={child.id}
                      className="text-[11px] font-semibold px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200"
                    >
                      {child.tag_label || child.name}
                    </span>
                  ))}
              </div>
            </div>

            {/* Judul Kegiatan */}
            <div className="flex items-start justify-between gap-3 mb-2">
              <h3 className="text-sm sm:text-base font-bold text-gray-900 group-hover:text-blue-600 transition">
                {evt.title}
              </h3>
              <ChevronRight
                size={18}
                className="text-gray-400 group-hover:text-blue-600 group-hover:translate-x-0.5 transition shrink-0 mt-0.5"
              />
            </div>

            {/* Status KBM / Presensi */}
            <div className="mb-2.5 flex flex-wrap items-center gap-2 text-xs">
              {evt.disables_teaching ? (
                <span className="inline-flex items-center gap-1 text-rose-600 font-semibold bg-rose-50 px-2 py-0.5 rounded border border-rose-200">
                  <AlertCircle size={12} />
                  <span>KBM Reguler Ditiadakan</span>
                </span>
              ) : (
                <span className="inline-flex items-center gap-1 text-emerald-600 font-semibold bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200">
                  <CheckCircle2 size={12} />
                  <span>KBM Reguler Berjalan</span>
                </span>
              )}

              {evt.attendance_guidance && (
                <span className="text-gray-500 font-medium">
                  • {evt.attendance_guidance}
                </span>
              )}
            </div>

            {/* Deskripsi / Instruksi / Catatan */}
            {evt.description && (
              <div className="mt-2 pt-2 border-t border-gray-100 flex items-start gap-2 text-xs text-gray-600 leading-relaxed">
                <FileText size={13} className="text-gray-400 shrink-0 mt-0.5" />
                <p className="line-clamp-2">{evt.description}</p>
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
