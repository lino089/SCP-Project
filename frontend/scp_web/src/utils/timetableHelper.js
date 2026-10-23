/**
 * Helper Utilitas Timetable & Resolusi Jam Dinamis KBM
 * Menghitung jam riil pelajaran per slot berdasarkan hari dan status Upacara Senin
 * serta mendeteksi bentrok jadwal lokal.
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
 * Template Slot Jam Reguler (Selasa - Kamis & Senin Non-Upacara)
 */
export const STANDARD_SLOTS = [
  { slot: 1, start: '07:15', end: '08:00', label: 'Jam Ke-1' },
  { slot: 2, start: '08:00', end: '08:45', label: 'Jam Ke-2' },
  { slot: 3, start: '08:45', end: '09:30', label: 'Jam Ke-3' },
  { slot: 4, start: '09:45', end: '10:30', label: 'Jam Ke-4' },
  { slot: 5, start: '10:30', end: '11:15', label: 'Jam Ke-5' },
  { slot: 6, start: '11:15', end: '12:00', label: 'Jam Ke-6' },
  { slot: 7, start: '12:45', end: '13:30', label: 'Jam Ke-7' },
  { slot: 8, start: '13:30', end: '14:15', label: 'Jam Ke-8' },
  { slot: 9, start: '14:15', end: '15:00', label: 'Jam Ke-9' },
  { slot: 10, start: '15:00', end: '15:45', label: 'Jam Ke-10' },
];

/**
 * Template Slot Hari Senin dengan Upacara Bendera (Jam 1 mulai 08:00)
 */
export const MONDAY_CEREMONY_SLOTS = [
  { slot: 1, start: '08:00', end: '08:45', label: 'Jam Ke-1' },
  { slot: 2, start: '08:45', end: '09:30', label: 'Jam Ke-2' },
  { slot: 3, start: '09:30', end: '10:15', label: 'Jam Ke-3' },
  { slot: 4, start: '10:30', end: '11:15', label: 'Jam Ke-4' },
  { slot: 5, start: '11:15', end: '12:00', label: 'Jam Ke-5' },
  { slot: 6, start: '12:45', end: '13:30', label: 'Jam Ke-6' },
  { slot: 7, start: '13:30', end: '14:15', label: 'Jam Ke-7' },
  { slot: 8, start: '14:15', end: '15:00', label: 'Jam Ke-8' },
  { slot: 9, start: '15:00', end: '15:45', label: 'Jam Ke-9' },
  { slot: 10, start: '15:45', end: '16:30', label: 'Jam Ke-10' },
];

/**
 * Template Slot Hari Jumat (8 JP)
 */
export const FRIDAY_SLOTS = [
  { slot: 1, start: '07:15', end: '07:55', label: 'Jam Ke-1' },
  { slot: 2, start: '07:55', end: '08:35', label: 'Jam Ke-2' },
  { slot: 3, start: '08:35', end: '09:15', label: 'Jam Ke-3' },
  { slot: 4, start: '09:15', end: '09:55', label: 'Jam Ke-4' },
  { slot: 5, start: '10:15', end: '10:55', label: 'Jam Ke-5' },
  { slot: 6, start: '10:55', end: '11:35', label: 'Jam Ke-6' },
  { slot: 7, start: '12:45', end: '13:25', label: 'Jam Ke-7' },
  { slot: 8, start: '13:25', end: '14:05', label: 'Jam Ke-8' },
];

/**
 * Mendapatkan daftar slot waktu untuk hari tertentu
 */
export const getTimeSlotsForDay = (dayName, mondayIsUpacara = true) => {
  const normDay = typeof dayName === 'number' ? NUMBER_TO_DAY[dayName] : dayName;
  if (normDay === 'Jumat') return FRIDAY_SLOTS;
  if (normDay === 'Senin' && mondayIsUpacara) return MONDAY_CEREMONY_SLOTS;
  return STANDARD_SLOTS;
};

/**
 * Menghitung waktu mulai dan selesai riil untuk satu sesi KBM
 */
export const resolveSlotTime = (dayName, startSlot, duration = 1, mondayIsUpacara = true) => {
  const slots = getTimeSlotsForDay(dayName, mondayIsUpacara);
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
