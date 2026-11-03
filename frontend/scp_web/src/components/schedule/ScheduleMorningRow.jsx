import { Flag } from 'lucide-react';
import { getMorningActivity } from '../../utils/timetableHelper';

/**
 * Baris Kegiatan Masuk Pagi & Pembiasaan Karakter (07:00 WIB)
 * Menampilkan Upacara Bendera (Senin) atau Literasi / Karakter (Selasa - Jumat)
 */
export default function ScheduleMorningRow({ matrixDays = [], mondayIsUpacara = true }) {
  return (
    <tr className="schedule-morning-row">
      <td className="schedule-slot-cell whitespace-nowrap">
        <div className="schedule-slot-header">
          <span className="schedule-slot-num text-slate-900">Jam Masuk</span>
          <span className="schedule-slot-time text-blue-600 font-semibold">07:00 WIB</span>
        </div>
      </td>

      {matrixDays.map((dayName) => {
        const morning = getMorningActivity(dayName, mondayIsUpacara);
        const isMondayUpacara = dayName === 'Senin' && mondayIsUpacara;

        return (
          <td key={`morning-${dayName}`} className="schedule-morning-cell">
            <div
              className={`schedule-morning-card ${
                isMondayUpacara ? 'schedule-morning-card--upacara' : 'schedule-morning-card--regular'
              }`}
            >
              <div className="schedule-morning-card__header">
                <span
                  className={`schedule-morning-badge ${
                    isMondayUpacara
                      ? 'schedule-morning-badge--upacara'
                      : 'schedule-morning-badge--regular'
                  }`}
                >
                  {isMondayUpacara && <Flag size={10} className="inline mr-1 text-amber-700 shrink-0" />}
                  {morning.badge}
                </span>
                <span className="schedule-morning-time">{morning.time}</span>
              </div>
              <div className="schedule-morning-title">{morning.title}</div>
              <div className="schedule-morning-desc">
                {isMondayUpacara
                  ? 'KBM Jam Ke-1 dimulai 08:00 WIB'
                  : `KBM Jam Ke-1 dimulai ${morning.kbmStart} WIB`}
              </div>
            </div>
          </td>
        );
      })}
    </tr>
  );
}
