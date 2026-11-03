import { Badge } from '../shared';

/**
 * ScheduleCardItem: Kartu interaktif jadwal KBM per slot waktu
 * Menyesuaikan tampilan berdasarkan role (Waka, Guru, Wali Kelas, Siswa)
 */
export default function ScheduleCardItem({
  item,
  slotTime = null,
  role = 'teacher',
  isConflict = false,
  statusBadge = null,
  onClick = null,
}) {
  const subjectName = item?.subject?.name || item?.subjectName || 'Mata Pelajaran';
  const className =
    item?.school_class?.name ||
    item?.schoolClass?.name ||
    item?.className ||
    (item?.class_id ? `Kelas #${item.class_id}` : '-');
  const roomName = item?.room?.name || item?.roomName || 'Ruang';
  const teacherName = item?.teacher?.name || item?.teacherName || 'Guru';
  const fetStaffId = item?.teacher?.fet_staff_id || item?.fetStaffId;
  const duration = item?.duration_periods || item?.duration || 1;

  const displayTeacher = fetStaffId ? `"${fetStaffId}. ${teacherName}"` : teacherName;

  return (
    <div
      className={`schedule-card ${isConflict ? 'schedule-card--conflict' : ''}`}
      onClick={() => onClick && onClick(item)}
      role={onClick ? 'button' : undefined}
      tabIndex={onClick ? 0 : undefined}
      onKeyDown={(e) => {
        if (onClick && (e.key === 'Enter' || e.key === ' ')) {
          e.preventDefault();
          onClick(item);
        }
      }}
      title={
        role === 'waka'
          ? 'Klik untuk mengedit atau menghapus jadwal'
          : role === 'teacher' || role === 'homeroom'
          ? 'Klik untuk membuka jurnal KBM & presensi'
          : undefined
      }
    >
      {/* Baris Atas: Judul Mapel & Waktu */}
      <div className="schedule-card__top">
        <div className="schedule-card__title-group">
          <span className="schedule-card__subject">{subjectName}</span>
          {isConflict && (
            <Badge variant="error" className="text-[9px] px-1 py-0 shrink-0">
              Bentrok
            </Badge>
          )}
        </div>
        <span className="schedule-card__time">
          {slotTime?.startTime || '--:--'} - {slotTime?.endTime || '--:--'}
        </span>
      </div>

      {/* Baris Tengah: Kelas (untuk Guru) atau Guru (untuk Waka / Wali Kelas) */}
      <div className="schedule-card__meta-line">
        {role === 'teacher' ? (
          <span className="schedule-card__class-tag">Kelas {className}</span>
        ) : (
          <span className="text-gray-600 truncate">{displayTeacher}</span>
        )}
      </div>

      {/* Baris Bawah: Tag JP, Ruang, dan Status Jurnal */}
      <div className="schedule-card__badge-row">
        <span className="schedule-card__info-tag">{duration} JP</span>
        <span className="schedule-card__info-tag">{roomName}</span>
        {statusBadge && <div className="ml-auto">{statusBadge}</div>}
      </div>
    </div>
  );
}
