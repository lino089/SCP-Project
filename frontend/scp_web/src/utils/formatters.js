/**
 * Format a date string or timestamp into Indonesian localized date
 * @param {string|Date} dateString 
 * @param {Intl.DateTimeFormatOptions} options 
 * @returns {string}
 */
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

/**
 * Format time string (HH:mm:ss -> HH:mm)
 * @param {string} timeString 
 * @returns {string}
 */
export function formatTime(timeString) {
  if (!timeString) return '-';
  if (typeof timeString === 'string' && timeString.length >= 5) {
    return timeString.slice(0, 5);
  }
  return String(timeString);
}

/**
 * Format number into Indonesian locale standard
 * @param {number|string} num 
 * @returns {string}
 */
export function formatNumber(num) {
  if (num === null || num === undefined || isNaN(Number(num))) return '0';
  return new Intl.NumberFormat('id-ID').format(Number(num));
}

/**
 * Format decimal to percentage string
 * @param {number|string} num 
 * @param {number} decimals 
 * @returns {string}
 */
export function formatPercent(num, decimals = 1) {
  if (num === null || num === undefined || isNaN(Number(num))) return '0%';
  return `${Number(num).toFixed(decimals)}%`;
}

/**
 * Resolves a storage path or URL to an absolute URL pointing to backend storage.
 * Handles relative paths, leading slashes, and already-absolute URLs safely.
 * @param {string} path 
 * @returns {string}
 */
export function getStorageUrl(path) {
  if (!path) return '';
  if (path.startsWith('http://') || path.startsWith('https://')) return path;

  // Jika ada custom storage URL (misal: Supabase Storage public bucket)
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

/**
 * Fallback direct URL pointing to local Laravel public storage if Supabase is unreachable.
 * @param {string} path 
 * @returns {string}
 */
export function getFallbackStorageUrl(path) {
  if (!path) return '';
  const apiBase = import.meta.env.VITE_API_BASE_URL || 'http://localhost:8000/api';
  const backendBase = apiBase.replace(/\/api\/?$/, '');
  const cleanPath = path.startsWith('/') ? path.slice(1) : path;
  const storagePath = cleanPath.startsWith('storage/') ? cleanPath : `storage/${cleanPath}`;
  return `${backendBase}/${storagePath}`;
}
