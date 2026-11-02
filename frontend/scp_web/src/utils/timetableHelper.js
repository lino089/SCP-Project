/**
 * Helper Utilitas Timetable & Resolusi Jam Dinamis KBM
 * Menghitung jam riil pelajaran per slot berdasarkan hari dan status Upacara Senin
 * mengintegrasikan template jam resmi (period_templates) serta mendeteksi bentrok jadwal lokal.
 */

export const DAYS_LIST = ['Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat'];

export const DAY_TO_NUMBER = {
  Senin: 1,
  Selasa: 2,
  Rabu: 3,
  Kamis: 4,
  Jumat: 5,
};

export const NUMBER_TO_DAY = {
  1: 'Senin',
  2: 'Selasa',
  3: 'Rabu',
  4: 'Kamis',
  5: 'Jumat',
};

/**
 * Format string jam HH:mm:ss atau HH:mm menjadi HH:mm
 */
export const formatTime = (timeStr) => {
  if (!timeStr) return '';
  const parts = String(timeStr).split(':');
  if (parts.length >= 2) {
    return `${parts[0].padStart(2, '0')}:${parts[1].padStart(2, '0')}`;
  }
  return timeStr;
};

/**
 * Menentukan tipe hari (day_type) yang bersesuaian dengan tabel period_templates
 */
export const getDayTypeFor = (day, mondayIsUpacara = true) => {
  const dayNum = typeof day === 'number' ? day : DAY_TO_NUMBER[day] || 1;
  switch (dayNum) {
    case 1:
      return mondayIsUpacara ? 'senin_upacara' : 'senin_reguler';
    case 2:
      return 'selasa';
    case 3:
    case 4:
      return 'rabu_kamis';
    case 5:
      return 'jumat';
    default:
      return 'rabu_kamis';
  }
};

/**
 * Definisi kegiatan pembiasaan pagi institusi pukul 07:00 WIB per tipe hari (PRD 5.3)
 * Menetapkan jam masuk sekolah resmi pukul 07:00 WIB untuk seluruh hari sekolah.
 */
export const MORNING_ACTIVITIES = {
  senin_upacara: {
    title: 'Upacara Bendera',
    time: '07:00 - 08:00',
    badge: 'Upacara',
    variant: 'warning',
    kbmStart: '08:00',
    description: 'Upacara Bendera Hari Senin & Penghormatan Sang Merah Putih',
  },
  senin_reguler: {
    title: 'Tadarus / Pembiasaan Pagi',
    time: '07:00 - 07:15',
    badge: 'Pembiasaan',
    variant: 'neutral',
    kbmStart: '07:15',
    description: 'Tadarus Al-Qur\'an, Doa Pagi & Menyanyikan Lagu Kebangsaan',
  },
  selasa: {
    title: 'Literasi Pagi',
    time: '07:00 - 07:30',
    badge: 'Literasi',
    variant: 'info',
    kbmStart: '07:30',
    description: 'Gerakan Literasi Sekolah (Membaca, Menulis & Review Buku)',
  },
  rabu_kamis: {
    title: 'Tadarus / Pendalaman Iman',
    time: '07:00 - 07:15',
    badge: 'Tadarus',
    variant: 'neutral',
    kbmStart: '07:15',
    description: 'Pendalaman Iman, Tadarus & Penguatan Karakter',
  },
  jumat: {
    title: 'Pembiasaan Pagi / Senam',
    time: '07:00 - 07:15',
    badge: 'Pembiasaan',
    variant: 'neutral',
    kbmStart: '07:15',
    description: 'Pembiasaan Karakter, Senam Kesegaran Jasmani / Jumat Bersih',
  },
};

/**
 * Mendapatkan detail kegiatan pembiasaan pagi untuk hari tertentu
 * @param {string|number} day - Nama hari ('Senin', dsb.) atau nomor hari (1..5)
 * @param {boolean} mondayIsUpacara - Apakah hari Senin melaksanakan upacara bendera
 * @returns {object} Objek kegiatan pagi { title, time, badge, variant, kbmStart, description }
 */
export const getMorningActivity = (day, mondayIsUpacara = true) => {
  const normDay = typeof day === 'number' ? NUMBER_TO_DAY[day] : day;
  const dayType = getDayTypeFor(normDay, mondayIsUpacara);
  return MORNING_ACTIVITIES[dayType] || MORNING_ACTIVITIES.rabu_kamis;
};

/**
 * Mendapatkan jam mulai KBM resmi (Jam Ke-1) per hari
 * @param {string|number} day - Nama hari atau nomor hari
 * @param {boolean} mondayIsUpacara - Status upacara hari Senin
 * @returns {string} Jam mulai KBM ('07:15', '07:30', atau '08:00')
 */
export const getDayKbmStartTime = (day, mondayIsUpacara = true) => {
  const activity = getMorningActivity(day, mondayIsUpacara);
  return activity?.kbmStart || '07:15';
};

/**
 * Template Slot Hari Senin dengan Upacara Bendera (Upacara 07:00-08:00, JP 1 mulai 08:00, 10 JP)
 */
export const MONDAY_CEREMONY_SLOTS = [
  { slot: 1, start: '08:00', end: '08:45', label: 'Jam Ke-1' },
  { slot: 2, start: '08:45', end: '09:30', label: 'Jam Ke-2' },
  { slot: 3, start: '09:30', end: '10:15', label: 'Jam Ke-3' },
  { slot: 4, start: '10:45', end: '11:30', label: 'Jam Ke-4' },
  { slot: 5, start: '11:30', end: '12:15', label: 'Jam Ke-5' },
  { slot: 6, start: '13:00', end: '13:45', label: 'Jam Ke-6' },
  { slot: 7, start: '13:45', end: '14:30', label: 'Jam Ke-7' },
  { slot: 8, start: '14:30', end: '15:15', label: 'Jam Ke-8' },
  { slot: 9, start: '15:15', end: '16:00', label: 'Jam Ke-9' },
  { slot: 10, start: '16:00', end: '16:45', label: 'Jam Ke-10' },
];

/**
 * Template Slot Hari Senin Reguler Tanpa Upacara (Tadarus 07:00-07:15, JP 1 mulai 07:15, 10 JP)
 */
export const SENIN_REGULER_SLOTS = [
  { slot: 1, start: '07:15', end: '08:00', label: 'Jam Ke-1' },
  { slot: 2, start: '08:00', end: '08:45', label: 'Jam Ke-2' },
  { slot: 3, start: '08:45', end: '09:30', label: 'Jam Ke-3' },
  { slot: 4, start: '10:00', end: '10:45', label: 'Jam Ke-4' },
  { slot: 5, start: '10:45', end: '11:30', label: 'Jam Ke-5' },
  { slot: 6, start: '11:30', end: '12:15', label: 'Jam Ke-6' },
  { slot: 7, start: '13:00', end: '13:45', label: 'Jam Ke-7' },
  { slot: 8, start: '13:45', end: '14:30', label: 'Jam Ke-8' },
  { slot: 9, start: '14:30', end: '15:15', label: 'Jam Ke-9' },
  { slot: 10, start: '15:15', end: '16:00', label: 'Jam Ke-10' },
];

/**
 * Template Slot Hari Selasa (Literasi 07:00-07:30, JP 1 mulai 07:30, 10 JP)
 */
export const TUESDAY_SLOTS = [
  { slot: 1, start: '07:30', end: '08:15', label: 'Jam Ke-1' },
  { slot: 2, start: '08:15', end: '09:00', label: 'Jam Ke-2' },
  { slot: 3, start: '09:00', end: '09:45', label: 'Jam Ke-3' },
  { slot: 4, start: '10:15', end: '11:00', label: 'Jam Ke-4' },
  { slot: 5, start: '11:00', end: '11:45', label: 'Jam Ke-5' },
  { slot: 6, start: '12:30', end: '13:15', label: 'Jam Ke-6' },
  { slot: 7, start: '13:15', end: '14:00', label: 'Jam Ke-7' },
  { slot: 8, start: '14:00', end: '14:45', label: 'Jam Ke-8' },
  { slot: 9, start: '14:45', end: '15:30', label: 'Jam Ke-9' },
  { slot: 10, start: '15:30', end: '16:15', label: 'Jam Ke-10' },
];

/**
 * Template Slot Jam Reguler Rabu & Kamis (Tadarus 07:00-07:15, JP 1 mulai 07:15, 10 JP)
 */
export const STANDARD_SLOTS = [
  { slot: 1, start: '07:15', end: '08:00', label: 'Jam Ke-1' },
  { slot: 2, start: '08:00', end: '08:45', label: 'Jam Ke-2' },
  { slot: 3, start: '08:45', end: '09:30', label: 'Jam Ke-3' },
  { slot: 4, start: '10:00', end: '10:45', label: 'Jam Ke-4' },
  { slot: 5, start: '10:45', end: '11:30', label: 'Jam Ke-5' },
  { slot: 6, start: '11:30', end: '12:15', label: 'Jam Ke-6' },
  { slot: 7, start: '13:00', end: '13:45', label: 'Jam Ke-7' },
  { slot: 8, start: '13:45', end: '14:30', label: 'Jam Ke-8' },
  { slot: 9, start: '14:30', end: '15:15', label: 'Jam Ke-9' },
  { slot: 10, start: '15:15', end: '16:00', label: 'Jam Ke-10' },
];

/**
 * Template Slot Hari Jumat (10 JP, 40 mnt/JP, Sholat Jumat 11:45-13:00)
 */
export const FRIDAY_SLOTS = [
  { slot: 1, start: '07:15', end: '07:55', label: 'Jam Ke-1' },
  { slot: 2, start: '07:55', end: '08:35', label: 'Jam Ke-2' },
  { slot: 3, start: '08:35', end: '09:15', label: 'Jam Ke-3' },
  { slot: 4, start: '09:45', end: '10:25', label: 'Jam Ke-4' },
  { slot: 5, start: '10:25', end: '11:05', label: 'Jam Ke-5' },
  { slot: 6, start: '11:05', end: '11:45', label: 'Jam Ke-6' },
  { slot: 7, start: '13:00', end: '13:40', label: 'Jam Ke-7' },
  { slot: 8, start: '13:40', end: '14:20', label: 'Jam Ke-8' },
  { slot: 9, start: '14:20', end: '15:00', label: 'Jam Ke-9' },
  { slot: 10, start: '15:00', end: '15:40', label: 'Jam Ke-10' },
];

/**
 * Membangun array slot waktu dari kumpulan record period_templates untuk suatu day_type
 */
export const buildSlotsFromTemplates = (templates, dayType) => {
  if (!Array.isArray(templates) || templates.length === 0) return null;
  const matching = templates
    .filter((t) => t.day_type === dayType)
    .sort((a, b) => Number(a.period_number) - Number(b.period_number));
  if (matching.length === 0) return null;
  return matching.map((t) => ({
    slot: Number(t.period_number),
    start: formatTime(t.start_time),
    end: formatTime(t.end_time),
    label: `Jam Ke-${t.period_number}`,
  }));
};

/**
 * Mendapatkan daftar slot waktu untuk hari tertentu
 * Mendukung data dinamis dari period_templates dengan fallback aman
 */
export const getTimeSlotsForDay = (dayName, mondayIsUpacara = true, periodTemplates = null) => {
  const normDay = typeof dayName === 'number' ? NUMBER_TO_DAY[dayName] : dayName;
  const dayType = getDayTypeFor(normDay, mondayIsUpacara);

  if (periodTemplates && Array.isArray(periodTemplates) && periodTemplates.length > 0) {
    const dynamicSlots = buildSlotsFromTemplates(periodTemplates, dayType);
    if (dynamicSlots && dynamicSlots.length > 0) {
      return dynamicSlots;
    }
  }

  switch (dayType) {
    case 'senin_upacara':
      return MONDAY_CEREMONY_SLOTS;
    case 'senin_reguler':
      return SENIN_REGULER_SLOTS;
    case 'selasa':
      return TUESDAY_SLOTS;
    case 'jumat':
      return FRIDAY_SLOTS;
    case 'rabu_kamis':
    default:
      return STANDARD_SLOTS;
  }
};

/**
 * Menghitung waktu mulai dan selesai riil untuk satu sesi KBM
 * Mendukung data dinamis dari period_templates dengan fallback aman
 */
export const resolveSlotTime = (dayName, startSlot, duration = 1, mondayIsUpacara = true, periodTemplates = null) => {
  const slots = getTimeSlotsForDay(dayName, mondayIsUpacara, periodTemplates);
  const firstSlot = slots.find((s) => s.slot === Number(startSlot));
  const endSlotIndex = slots.findIndex((s) => s.slot === Number(startSlot) + Number(duration) - 1);

  if (!firstSlot) {
    return {
      startTime: '07:15',
      endTime: '08:45',
      timeText: '07:15 - 08:45',
    };
  }

  const lastSlot = endSlotIndex >= 0 ? slots[endSlotIndex] : firstSlot;
  return {
    startTime: firstSlot.start,
    endTime: lastSlot.end,
    timeText: `${firstSlot.start} - ${lastSlot.end}`,
  };
};

/**
 * Deteksi bentrok jadwal lokal dalam satu siklus putaran
 * Mengembalikan Set berisi ID jadwal yang saling bertabrakan
 */
export const detectScheduleConflicts = (schedules) => {
  const conflicts = new Set();
  const list = schedules || [];

  for (let i = 0; i < list.length; i++) {
    for (let j = i + 1; j < list.length; j++) {
      const a = list[i];
      const b = list[j];

      // Berbeda putaran atau hari -> tidak bentrok
      if (a.cycle_type !== b.cycle_type && a.cycle !== b.cycle) continue;
      const dayA = a.day_of_week || a.day;
      const dayB = b.day_of_week || b.day;
      if (dayA !== dayB) continue;

      const slotA = Number(a.period_number || a.slot || 1);
      const durA = Number(a.duration_periods || a.duration || 1);
      const slotB = Number(b.period_number || b.slot || 1);
      const durB = Number(b.duration_periods || b.duration || 1);

      // Cek overlap rentang slot: max(start) < min(end)
      const overlap = Math.max(slotA, slotB) < Math.min(slotA + durA, slotB + durB);
      if (!overlap) continue;

      const teacherA = a.teacher_id || a.teacher?.id;
      const teacherB = b.teacher_id || b.teacher?.id;
      const roomA = a.room_id || a.room?.id;
      const roomB = b.room_id || b.room?.id;
      const classA = a.class_id || a.school_class?.id;
      const classB = b.class_id || b.school_class?.id;

      const isTeacherConflict = teacherA && teacherB && Number(teacherA) === Number(teacherB);
      const isRoomConflict = roomA && roomB && Number(roomA) === Number(roomB);
      const isClassConflict = classA && classB && Number(classA) === Number(classB);

      if (isTeacherConflict || isRoomConflict || isClassConflict) {
        conflicts.add(a.id);
        conflicts.add(b.id);
      }
    }
  }

  return conflicts;
};
