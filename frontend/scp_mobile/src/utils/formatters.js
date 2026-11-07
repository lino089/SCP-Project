/**
 * Date, Time & Text Formatters (Indonesian Locale)
 */

const DAYS_ID = ['Minggu', 'Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat', 'Sabtu'];
const MONTHS_ID = [
  'Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni',
  'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember'
];

export function formatDateID(dateStr) {
  if (!dateStr) return '-';
  const d = new Date(dateStr);
  if (isNaN(d.getTime())) return dateStr;
  return `${DAYS_ID[d.getDay()]}, ${d.getDate()} ${MONTHS_ID[d.getMonth()]} ${d.getFullYear()}`;
}

export function formatDateIndo(dateStr) {
  if (!dateStr) return '-';
  const d = new Date(dateStr);
  if (isNaN(d.getTime())) return dateStr;
  return `${d.getDate()} ${MONTHS_ID[d.getMonth()]} ${d.getFullYear()}`;
}

export function formatDate(dateString, options = {}) {
  if (!dateString) return '-';
  try {
    const date = new Date(dateString);
    if (isNaN(date.getTime())) return String(dateString);
    return new Intl.DateTimeFormat('id-ID', {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
      ...options,
    }).format(date);
  } catch {
    return String(dateString);
  }
}

export function formatShortDateID(dateStr) {
  if (!dateStr) return '-';
  const d = new Date(dateStr);
  if (isNaN(d.getTime())) return dateStr;
  return `${d.getDate()} ${MONTHS_ID[d.getMonth()].slice(0, 3)} ${d.getFullYear()}`;
}

export function formatTimeRange(startTime, endTime) {
  const s = startTime ? startTime.slice(0, 5) : '--:--';
  const e = endTime ? endTime.slice(0, 5) : '--:--';
  return `${s} - ${e}`;
}

export function formatTime(timeString) {
  if (!timeString) return '-';
  if (typeof timeString === 'string' && timeString.length >= 5) {
    return timeString.slice(0, 5);
  }
  return String(timeString);
}

export function formatNumber(num) {
  if (num === null || num === undefined || isNaN(Number(num))) return '0';
  return new Intl.NumberFormat('id-ID').format(Number(num));
}

export function formatPercent(num, decimals = 1) {
  if (num === null || num === undefined || isNaN(Number(num))) return '0%';
  return `${Number(num).toFixed(decimals)}%`;
}

export function getInitials(name = '') {
  return name
    .split(' ')
    .filter(Boolean)
    .slice(0, 2)
    .map((n) => n[0].toUpperCase())
    .join('');
}

/**
 * Resolves a storage path or URL to an absolute URL pointing to backend storage.
 */
export function getStorageUrl(path) {
  if (!path) return '';
  if (path.startsWith('http://') || path.startsWith('https://')) return path;

  const customStorageUrl = import.meta.env.VITE_STORAGE_BASE_URL;
  if (customStorageUrl) {
    const cleanBase = customStorageUrl.replace(/\/+$/, '');
    const cleanPath = path.startsWith('/') ? path.slice(1) : path;
    return `${cleanBase}/${cleanPath}`;
  }

  const apiBase = import.meta.env.VITE_API_BASE_URL || 'http://localhost:8000/api';
  const backendBase = apiBase.replace(/\/api\/?$/, '');
  const cleanPath = path.startsWith('/') ? path.slice(1) : path;
  const storagePath = cleanPath.startsWith('storage/') ? cleanPath : `storage/${cleanPath}`;
  return `${backendBase}/${storagePath}`;
}

export function getFallbackStorageUrl(path) {
  return getStorageUrl(path);
}
