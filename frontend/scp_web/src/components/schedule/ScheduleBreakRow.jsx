import { Coffee, UtensilsCrossed } from 'lucide-react';
import { getBreaksForDay } from '../../utils/timetableHelper';

/**
 * ScheduleBreakRow: Baris pemisah visual waktu istirahat KBM (Istirahat I & Istirahat II)
 * Menampilkan rentang waktu riil istirahat per hari sesuai Jadwal_Ruangan.pdf
 */
export default function ScheduleBreakRow({
  breakNumber = 1,
  matrixDays = [],
  mondayIsUpacara = true,
}) {
  const isBreak1 = breakNumber === 1;

  return (
    <tr className="schedule-break-row">
      <td className="schedule-slot-cell schedule-break-header-cell whitespace-nowrap">
        <div className="schedule-slot-header flex items-center gap-1.5 py-1">
          {isBreak1 ? (
            <Coffee size={13} className="text-amber-600 shrink-0" />
          ) : (
            <UtensilsCrossed size={13} className="text-emerald-600 shrink-0" />
          )}
          <div className="flex flex-col">
            <span className="text-[11px] font-bold text-slate-800 tracking-tight">
              {isBreak1 ? 'Istirahat I' : 'Istirahat II'}
            </span>
            <span className="text-[10px] text-slate-500 font-normal">
              {isBreak1 ? '15 Menit' : 'Ishoma'}
            </span>
          </div>
        </div>
      </td>

      {matrixDays.map((dayName) => {
        const breaks = getBreaksForDay(dayName, mondayIsUpacara);
        const brk = breaks[breakNumber - 1];
        const isFridayIshoma = !isBreak1 && dayName === 'Jumat';

        return (
          <td key={`break-${breakNumber}-${dayName}`} className="schedule-break-cell">
            <div
              className={`schedule-break-pill ${
                isFridayIshoma
                  ? 'schedule-break-pill--friday'
                  : isBreak1
                  ? 'schedule-break-pill--break1'
                  : 'schedule-break-pill--break2'
              }`}
            >
              <span className="schedule-break-name">
                {isFridayIshoma ? 'Sholat Jumat & Ishoma' : brk?.name || 'Istirahat'}
              </span>
              <span className="schedule-break-time font-mono">
                {brk?.time} WIB ({brk?.duration}m)
              </span>
            </div>
          </td>
        );
      })}
    </tr>
  );
}
