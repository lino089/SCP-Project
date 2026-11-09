import { getJakartaTimeString } from './dateUtils.js';
import { formatTime, resolveSlotTime } from './timetableHelper.js';

/**
 * Mengonversi string jam 'HH:mm' ke total menit dari 00:00
 */
export function timeToMinutes(timeStr) {
  if (!timeStr) return 0;
  const parts = String(timeStr).split(':');
  const h = parseInt(parts[0] || '0', 10);
  const m = parseInt(parts[1] || '0', 10);
  return h * 60 + m;
}

/**
 * Mengonversi total menit ke format jam 'HH:mm'
 */
export function minutesToTime(minutes) {
  const norm = ((minutes % 1440) + 1440) % 1440;
  const h = Math.floor(norm / 60);
  const m = norm % 60;
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
}

/**
 * Helper kalkulasi status sesi KBM berbasis jam mengajar dan aturan toleransi (Opsi A: end_time + 30 menit).
 *
 * Status yang dihasilkan:
 * 1. 'exempted': KBM Dikecualikan oleh agenda kalender akademik
 * 2. 'teacher_absent': Guru Berhalangan Hadir (Jam Kosong)
 * 3. 'completed': Selesai Disimpan (Jurnal & presensi sudah tuntas diisi)
 * 4. 'upcoming': Segera (Sesi belum dimulai, guru belum dapat mengisi)
 * 5. 'ready': Mulai Jurnal (Sedang berlangsung atau masih dalam toleransi pengisian +30 menit)
 * 6. 'expired': Sesi Telah Berakhir (Lewat batas toleransi pengisian, tidak dapat diisi lagi)
 */
export function calculateSessionStatus(schedule, currentTimeStr = null, toleranceMinutes = 30) {
  if (!schedule) {
    return {
      status: 'unknown',
      label: 'Tidak Diketahui',
      badgeVariant: 'neutral',
      description: '-',
      canOpen: false,
    };
  }

  // 1. Sesi Dikecualikan oleh Agenda Kalender Akademik
  if (schedule.is_teaching_exempted || schedule.journal_status === 'exempted') {
    return {
      status: 'exempted',
      label: 'Agenda Sekolah',
      badgeVariant: 'warning',
      description: schedule.exemption_reason || 'KBM Dikecualikan oleh Agenda Khusus Sekolah',
      canOpen: false,
    };
  }

  // 2. Guru Berhalangan Hadir (Ditandai Kesiswaan/Waka)
  if (schedule.journal_status === 'teacher_absent') {
    return {
      status: 'teacher_absent',
      label: 'Guru Berhalangan',
      badgeVariant: 'error',
      description: 'Ditandai sebagai Guru Berhalangan Hadir (Jam Kosong)',
      canOpen: false,
    };
  }

  // 3. Jurnal Sudah Selesai Disimpan
  if (schedule.journal_status === 'completed') {
    return {
      status: 'completed',
      label: 'Selesai Disimpan',
      badgeVariant: 'success',
      description: 'Jurnal pembelajaran dan presensi siswa telah tercatat permanen di sistem.',
      canOpen: true,
    };
  }

  // Resolusi waktu mulai dan selesai sesi
  let startRaw = schedule.resolved_times?.start_time || schedule.start_time;
  let endRaw = schedule.resolved_times?.end_time || schedule.end_time;

  // Fallback ke timetableHelper jika resolved_times tidak tersedia
  if (!startRaw || !endRaw) {
    const slotTimes = resolveSlotTime(
      schedule.day_of_week || 1,
      schedule.period_number || 1,
      schedule.duration_periods || 1
    );
    startRaw = startRaw || slotTimes.startTime;
    endRaw = endRaw || slotTimes.endTime;
  }

  const startTime = formatTime(startRaw) || '07:15';
  const endTime = formatTime(endRaw) || '08:35';

  const startMin = timeToMinutes(startTime);
  const endMin = timeToMinutes(endTime);
  const deadlineMin = endMin + toleranceMinutes;
  const deadlineTime = minutesToTime(deadlineMin);

  // Waktu saat ini di Jakarta
  const nowStr = currentTimeStr || getJakartaTimeString() || '08:00';
  const nowMin = timeToMinutes(nowStr);

  // 4. SEGERA: Waktu saat ini belum memasuki jam mengajar
  if (nowMin < startMin) {
    const diff = startMin - nowMin;
    const hours = Math.floor(diff / 60);
    const mins = diff % 60;
    const diffText = hours > 0 ? `${hours} jam ${mins} menit lagi` : `${mins} menit lagi`;

    return {
      status: 'upcoming',
      label: 'Segera',
      badgeVariant: 'neutral',
      startTime,
      endTime,
      deadlineTime,
      description: `Sesi KBM dimulai pukul ${startTime} WIB (${diffText})`,
      canOpen: false,
    };
  }

  // 5. MULAI JURNAL: Sedang dalam jam KBM atau dalam masa toleransi +30 menit
  if (nowMin >= startMin && nowMin <= deadlineMin) {
    const isOngoing = schedule.journal_status === 'ongoing';
    const remaining = deadlineMin - nowMin;
    const remHours = Math.floor(remaining / 60);
    const remMins = remaining % 60;
    const remText = remHours > 0 ? `${remHours} jam ${remMins} mnt` : `${remMins} mnt`;

    return {
      status: 'ready',
      label: isOngoing ? 'Lanjutkan Jurnal' : 'Mulai Jurnal',
      badgeVariant: isOngoing ? 'success' : 'primary',
      startTime,
      endTime,
      deadlineTime,
      isOngoing,
      description: `Waktu mengajar aktif s/d ${endTime} WIB (Batas toleransi pengisian s/d ${deadlineTime} WIB, sisa ${remText})`,
      canOpen: true,
    };
  }

  // 6. SESI TELAH BERAKHIR: Telah melewati jam selesai KBM + batas toleransi 30 menit
  return {
    status: 'expired',
    label: 'Sesi Telah Berakhir',
    badgeVariant: 'error',
    startTime,
    endTime,
    deadlineTime,
    description: `Waktu KBM dan batas toleransi pengisian telah berakhir pada pukul ${deadlineTime} WIB.`,
    canOpen: false,
  };
}
