/**
 * ScheduleTableSkeleton Component
 * Placeholder skeleton yang menyerupai struktur tabel matriks jadwal pelajaran KBM
 * Menampilkan kartu rombel kelas, header hari, jam pelajaran, dan blok jadwal KBM.
 *
 * @param {number} count - Jumlah kartu tabel kelas yang ditampilkan (default: 2)
 * @param {string[]} days - Daftar nama kolom hari (default: ['Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat'])
 * @param {number} rowsCount - Jumlah baris jam pelajaran (default: 10)
 * @param {boolean} hasCeremony - Menampilkan baris Upacara Bendera Senin (default: true)
 */
export default function ScheduleTableSkeleton({
  count = 2,
  days = ['Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat'],
  rowsCount = 10,
  hasCeremony = true,
  className = '',
}) {
  const classCards = Array.from({ length: Math.max(1, count) });
  const dayNames = days && days.length > 0 ? days : ['Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat'];

  return (
    <div className={`schedule-classes-container ${className}`.trim()} role="status" aria-label="Memuat jadwal pelajaran">
      {classCards.map((_, cIdx) => (
        <div key={`schedule-skeleton-class-${cIdx}`} className="schedule-class-section animate-pulse">
          {/* Header Identitas Rombel Kelas Skeleton */}
          <div className="schedule-class-header">
            <div className="schedule-class-title-group">
              <div className="schedule-class-title-row">
                <div className="h-5 w-5 bg-gray-200 rounded shrink-0" />
                <div className="h-5 w-36 bg-gray-200 rounded" />
                <div className="h-5 w-20 bg-gray-200 rounded" />
              </div>
              <div className="h-3.5 w-48 bg-gray-100 rounded mt-1.5" />
            </div>

            <div className="schedule-class-actions">
              <div className="h-6 w-24 bg-gray-100 rounded" />
              <div className="h-6 w-20 bg-gray-100 rounded" />
              <div className="h-6 w-20 bg-gray-100 rounded" />
              <div className="h-8 w-28 bg-gray-200 rounded" />
            </div>
          </div>

          {/* Table Matrix Skeleton */}
          <div className="schedule-matrix-container border-0 rounded-none overflow-x-auto">
            <table className="schedule-matrix w-full">
              <thead>
                <tr>
                  <th scope="col" className="whitespace-nowrap" style={{ width: '110px' }}>
                    <div className="h-3.5 w-20 bg-gray-200 rounded" />
                  </th>
                  {dayNames.map((d) => (
                    <th key={d} scope="col" className="whitespace-nowrap">
                      <div className="flex items-center gap-1.5">
                        <div className="h-3.5 w-12 bg-gray-200 rounded" />
                        <div className="h-2.5 w-16 bg-gray-100 rounded" />
                      </div>
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {/* Morning Opening Row Skeleton (07:00 WIB) */}
                <tr className="schedule-morning-row border-b border-gray-200/50 bg-slate-50/30">
                  <td className="schedule-slot-cell whitespace-nowrap bg-slate-50/80">
                    <div className="schedule-slot-header">
                      <div className="h-3 w-16 bg-gray-200 rounded mb-1" />
                      <div className="h-2.5 w-14 bg-gray-100 rounded" />
                    </div>
                  </td>
                  {dayNames.map((d) => {
                    const isMonCeremony = d === 'Senin' && hasCeremony;
                    return (
                      <td key={`morning-skel-${d}`} className="schedule-morning-cell align-top p-2.5">
                        <div
                          className={`p-2.5 rounded-lg border ${
                            isMonCeremony
                              ? 'bg-amber-50/60 border-amber-200/60'
                              : 'bg-slate-50/60 border-slate-200/60'
                          }`}
                        >
                          <div className="flex items-center justify-between mb-2">
                            <div className={`h-3 w-14 rounded ${isMonCeremony ? 'bg-amber-200/70' : 'bg-gray-200'}`} />
                            <div className="h-2.5 w-16 bg-gray-100 rounded" />
                          </div>
                          <div className={`h-3.5 w-28 rounded mb-1.5 ${isMonCeremony ? 'bg-amber-200/80' : 'bg-gray-200'}`} />
                          <div className="h-2.5 w-32 bg-gray-100 rounded" />
                        </div>
                      </td>
                    );
                  })}
                </tr>

                {/* Slots Rows Skeleton */}
                {Array.from({ length: rowsCount }).map((_, rIdx) => (
                  <tr key={`skeleton-slot-${rIdx}`}>
                    <td className="schedule-slot-cell whitespace-nowrap">
                      <div className="schedule-slot-header">
                        <div className="h-3.5 w-14 bg-gray-200 rounded" />
                      </div>
                    </td>

                    {dayNames.map((dayName, dIdx) => {
                      const isCard = (rIdx * 3 + dIdx * 2 + cIdx) % 3 !== 0;
                      const isFridayOff = dayName === 'Jumat' && rIdx >= 8;

                      return (
                        <td key={`cell-${dayName}-${rIdx}`}>
                          {isFridayOff ? (
                            <div className="schedule-cell-off opacity-60">-x-</div>
                          ) : isCard ? (
                            <div className="schedule-cell-content">
                              <div className="p-2.5 bg-gray-50 border border-gray-200 rounded-md flex flex-col gap-2">
                                <div className="flex items-center justify-between gap-2">
                                  <div
                                    className="h-3.5 bg-gray-200 rounded"
                                    style={{ width: `${45 + ((rIdx * 7 + dIdx * 13 + cIdx * 5) % 25)}%` }}
                                  />
                                  <div className="h-2.5 w-14 bg-gray-200/70 rounded shrink-0" />
                                </div>
                                <div
                                  className="h-3 bg-gray-100 rounded"
                                  style={{ width: `${40 + ((rIdx * 5 + dIdx * 9) % 30)}%` }}
                                />
                                <div className="flex items-center gap-1.5 mt-1">
                                  <div className="h-3 w-14 bg-gray-100 rounded" />
                                  <div className="h-3 w-12 bg-gray-100 rounded" />
                                </div>
                              </div>
                            </div>
                          ) : (
                            <div className="schedule-cell--empty opacity-60">
                              <div className="h-14 w-full rounded border border-dashed border-gray-200 flex items-center justify-center">
                                <div className="h-3 w-12 bg-gray-100 rounded" />
                              </div>
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
        </div>
      ))}
    </div>
  );
}
