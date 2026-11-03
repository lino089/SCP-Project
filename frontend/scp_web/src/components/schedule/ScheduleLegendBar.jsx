import { Flag } from 'lucide-react';

/**
 * ScheduleLegendBar: Keterangan warna dan status matriks jadwal
 */
export default function ScheduleLegendBar({
  mode = 'teacher',
  mondayIsUpacara = true,
  extraStats = null,
}) {
  return (
    <div className="schedule-legend-bar">
      <div className="schedule-legend-items">
        <div className="schedule-legend-item">
          <span className="legend-swatch legend-swatch--active" />
          <span>Jadwal Normal</span>
        </div>

        {mode === 'waka' ? (
          <div className="schedule-legend-item">
            <span className="legend-swatch legend-swatch--conflict" />
            <span>Bentrok (Guru / Ruang / Kelas)</span>
          </div>
        ) : (
          <>
            <div className="schedule-legend-item">
              <span className="legend-swatch legend-swatch--completed" />
              <span>Jurnal Selesai</span>
            </div>
            <div className="schedule-legend-item">
              <span className="legend-swatch legend-swatch--missing" />
              <span>Jurnal Belum Diisi</span>
            </div>
          </>
        )}

        {mondayIsUpacara && (
          <div className="schedule-legend-item">
            <Flag size={12} className="text-amber-600 shrink-0" />
            <span className="text-amber-800 font-medium">Senin: Upacara Bendera (KBM mulai 08:00 WIB)</span>
          </div>
        )}
      </div>

      {extraStats && <div className="font-medium text-slate-700">{extraStats}</div>}
    </div>
  );
}
