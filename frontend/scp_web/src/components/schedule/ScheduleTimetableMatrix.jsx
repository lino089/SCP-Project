import { useMemo } from 'react';
import { Plus } from 'lucide-react';
import ScheduleMorningRow from './ScheduleMorningRow';
import ScheduleCardItem from './ScheduleCardItem';
import {
  DAYS_LIST,
  NUMBER_TO_DAY,
  getDayKbmStartTime,
  getTimeSlotsForDay,
  resolveSlotTime,
} from '../../utils/timetableHelper';
import './ScheduleMatrix.css';

/**
 * ScheduleTimetableMatrix: Komponen matriks jadwal universal
 * Dipakai secara konsisten oleh Waka, Guru, Wali Kelas, dan Siswa
 */
export default function ScheduleTimetableMatrix({
  schedules = [],
  matrixDays = DAYS_LIST,
  mondayIsUpacara = true,
  periodTemplates = [],
  conflictIds = new Set(),
  role = 'teacher',
  onCardClick = null,
  renderCardStatus = null,
  emptySlotAction = null,
  emptySlotDisabled = false,
}) {
  const displaySlots = useMemo(() => {
    return Array.from({ length: 10 }, (_, i) => ({
      slot: i + 1,
      label: `Jam Ke-${i + 1}`,
    }));
  }, []);

  return (
    <div className="schedule-matrix-container">
      <table className="schedule-matrix">
        <thead>
          <tr>
            <th scope="col" className="whitespace-nowrap">
              Jam / Waktu Riil
            </th>
            {matrixDays.map((dayName) => {
              const kbmStartTime = getDayKbmStartTime(dayName, mondayIsUpacara);
              return (
                <th key={dayName} scope="col" className="whitespace-nowrap">
                  <div className="flex items-center gap-1.5">
                    <span>{dayName}</span>
                    <span className="text-[10px] text-slate-400 font-normal tracking-normal lowercase">
                      &bull; mulai {kbmStartTime} WIB
                    </span>
                  </div>
                </th>
              );
            })}
          </tr>
        </thead>
        <tbody>
          {/* Row Jam Masuk 07:00 WIB (Upacara vs Pembiasaan Karakter) */}
          <ScheduleMorningRow matrixDays={matrixDays} mondayIsUpacara={mondayIsUpacara} />

          {/* Slots 1 s/d 10 */}
          {displaySlots.map((slotObj) => (
            <tr key={slotObj.slot}>
              <td className="schedule-slot-cell whitespace-nowrap">
                <div className="schedule-slot-header">
                  <span className="schedule-slot-num">{slotObj.label}</span>
                </div>
              </td>

              {matrixDays.map((dayName) => {
                // Cari jadwal yang mulai pada slot ini
                const cellSchedules = schedules.filter((s) => {
                  const sDay =
                    typeof s.day_of_week === 'number'
                      ? NUMBER_TO_DAY[s.day_of_week] || 'Senin'
                      : s.day || 'Senin';
                  if (sDay !== dayName) return false;
                  const sSlot = Number(s.slot || s.period_number);
                  return sSlot === slotObj.slot;
                });

                // Cari jadwal multi-JP yang berlanjut di slot ini dari jam sebelumnya
                const continuationSchedule = schedules.find((s) => {
                  const sDay =
                    typeof s.day_of_week === 'number'
                      ? NUMBER_TO_DAY[s.day_of_week] || 'Senin'
                      : s.day || 'Senin';
                  if (sDay !== dayName) return false;
                  const start = Number(s.slot || s.period_number);
                  const dur = Number(s.duration || s.duration_periods || 1);
                  return start < slotObj.slot && slotObj.slot < start + dur;
                });

                // Cek apakah slot ini di luar jam operasional KBM untuk hari tersebut
                const daySlots = getTimeSlotsForDay(dayName, mondayIsUpacara, periodTemplates);
                const isDayOff = !daySlots.some((s) => s.slot === Number(slotObj.slot));

                return (
                  <td key={dayName}>
                    {cellSchedules.length > 0 ? (
                      <div className="schedule-cell-content">
                        {cellSchedules.map((item) => {
                          const isConflict = conflictIds.has(item.id);
                          const slotTime = resolveSlotTime(
                            dayName,
                            item.slot || item.period_number,
                            item.duration || item.duration_periods || 1,
                            mondayIsUpacara,
                            periodTemplates
                          );

                          return (
                            <ScheduleCardItem
                              key={item.id}
                              item={item}
                              slotTime={slotTime}
                              role={role}
                              isConflict={isConflict}
                              statusBadge={renderCardStatus ? renderCardStatus(item) : null}
                              onClick={onCardClick}
                            />
                          );
                        })}
                      </div>
                    ) : continuationSchedule ? (
                      <div
                        className="schedule-continuation-block"
                        onClick={() => onCardClick && onCardClick(continuationSchedule)}
                        title={`Lanjutan dari Jam Ke-${continuationSchedule.slot || continuationSchedule.period_number}: ${
                          continuationSchedule.subject?.name || continuationSchedule.subjectName
                        }`}
                      >
                        <span className="schedule-continuation-text">
                          ↳ Lanjutan:{' '}
                          {continuationSchedule.subject?.name || continuationSchedule.subjectName}{' '}
                          (
                          {role === 'teacher'
                            ? continuationSchedule.school_class?.name ||
                              continuationSchedule.schoolClass?.name ||
                              continuationSchedule.className
                            : continuationSchedule.room?.name || continuationSchedule.roomName}
                          )
                        </span>
                      </div>
                    ) : isDayOff ? (
                      <div className="schedule-cell-off" title={`Di luar alokasi jam KBM ${dayName} (Off)`}>
                        -x-
                      </div>
                    ) : role === 'waka' && emptySlotAction ? (
                      <div className="schedule-cell--empty">
                        <button
                          type="button"
                          className="schedule-cell__empty-btn"
                          disabled={emptySlotDisabled}
                          onClick={() => emptySlotAction(slotObj.slot, dayName)}
                          title={`Tambah jadwal hari ${dayName} Jam Ke-${slotObj.slot}`}
                        >
                          <Plus size={12} />
                          <span>Kosong</span>
                        </button>
                      </div>
                    ) : (
                      <div className="schedule-cell--empty">
                        <span className="schedule-cell__empty-dash">-</span>
                      </div>
                    )}
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
