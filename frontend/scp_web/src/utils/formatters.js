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
