/**
 * Utilitas penanggalan berbasis zona waktu lokal Asia/Jakarta (WIB, UTC+7).
 *
 * Mencegah pergeseran tanggal saat jam 00:00 - 06:59 WIB yang disebabkan
 * oleh konversi `new Date().toISOString()`, yang menggunakan zona waktu UTC.
 */

const JAKARTA_TIMEZONE = 'Asia/Jakarta';

const INDO_DAY_NAMES = ['', 'Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat', 'Sabtu', 'Minggu'];

/**
 * Mengembalikan tanggal hari ini (atau dari Date yang diberikan)
 * dalam format ISO `YYYY-MM-DD` sesuai zona waktu Asia/Jakarta.
 *
 * @param {Date|string|number} [date=new Date()]
 * @returns {string} Contoh: "2026-11-08"
 */
export function todayLocalISO(date = new Date()) {
  try {
    const d = date instanceof Date ? date : new Date(date);
    if (isNaN(d.getTime())) return '';
    return new Intl.DateTimeFormat('en-CA', { timeZone: JAKARTA_TIMEZONE }).format(d);
  } catch {
    return '';
  }
}

/**
 * Alias konversi tanggal ke string YYYY-MM-DD (Asia/Jakarta).
 * Jika input sudah berbentuk 'YYYY-MM-DD', langsung dikembalikan.
 *
 * @param {Date|string|number} date
 * @returns {string}
 */
export function toJakartaISO(date) {
  if (!date) return '';
  if (typeof date === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(date.trim())) {
    return date.trim();
  }
  return todayLocalISO(date);
}

/**
 * Mengembalikan informasi hari (1 = Senin .. 7 = Minggu) dan nama hari
 * sesuai kalender sekolah Indonesia dalam zona waktu Asia/Jakarta.
 *
 * @param {Date|string|number} [date=new Date()]
 * @returns {{ dayOfWeek: number, dayName: string, dateStr: string, formattedDate: string }}
 */
export function getJakartaDayInfo(date = new Date()) {
  const dateStr = todayLocalISO(date);
  if (!dateStr) {
    return { dayOfWeek: 1, dayName: 'Senin', dateStr: '', formattedDate: '-' };
  }

  const [y, m, d] = dateStr.split('-').map(Number);
  // Evaluasi hari pada jam 12:00 UTC tanggal bersangkutan agar tidak terkena pergeseran jam
  const noon = new Date(Date.UTC(y, m - 1, d, 12, 0, 0));
  const rawDay = noon.getUTCDay(); // 0 = Minggu, 1 = Senin .. 6 = Sabtu
  const dayOfWeek = rawDay === 0 ? 7 : rawDay;
  const dayName = INDO_DAY_NAMES[dayOfWeek] || 'Senin';

  return {
    dayOfWeek,
    dayName,
    dateStr,
    formattedDate: formatDateIndo(dateStr),
  };
}

/**
 * Format tanggal ke bahasa Indonesia (contoh: "8 Nov 2026" atau "Minggu, 8 November 2026").
 *
 * @param {Date|string|number} date
 * @param {Intl.DateTimeFormatOptions} [options={}]
 * @returns {string}
 */
export function formatDateIndo(date, options = {}) {
  if (!date) return '-';
  try {
    let d;
    if (typeof date === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(date.trim())) {
      const [y, m, dayNum] = date.trim().split('-').map(Number);
      d = new Date(Date.UTC(y, m - 1, dayNum, 12, 0, 0));
    } else {
      d = date instanceof Date ? date : new Date(date);
    }

    if (isNaN(d.getTime())) return String(date);

    return new Intl.DateTimeFormat('id-ID', {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
      timeZone: JAKARTA_TIMEZONE,
      ...options,
    }).format(d);
  } catch {
    return String(date);
  }
}

/**
 * Format jam dan menit dalam zona waktu Asia/Jakarta (HH:mm).
 *
 * @param {Date|string|number} [date=new Date()]
 * @returns {string}
 */
export function getJakartaTimeString(date = new Date()) {
  try {
    const d = date instanceof Date ? date : new Date(date);
    if (isNaN(d.getTime())) return '';
    return new Intl.DateTimeFormat('id-ID', {
      hour: '2-digit',
      minute: '2-digit',
      hour12: false,
      timeZone: JAKARTA_TIMEZONE,
    }).format(d).replace('.', ':');
  } catch {
    return '';
  }
}
