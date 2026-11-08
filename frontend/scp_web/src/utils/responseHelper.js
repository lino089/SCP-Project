/**
 * Utility helper untuk membongkar (unwrap) respons API secara konsisten.
 * 
 * Standar kontrak SCP:
 * - Axios interceptor mengembalikan envelope: { success: boolean, data?: any, message?: string, meta?: any }
 * - Data paginated Laravel: { data: [...items], current_page: number, per_page: number, total: number, last_page: number }
 * - Data collection langsung: { success: true, data: [...items] }
 */

/**
 * Mengambil payload data utama dari respons API.
 * @template T
 * @param {any} res - Objek respons dari API call
 * @param {T} [fallback=null] - Nilai fallback bila data null/undefined
 * @returns {T}
 */
export function unwrap(res, fallback = null) {
  if (res === null || res === undefined) {
    return fallback;
  }

  // Jika parameter merupakan raw Axios response (punya properti data, status, headers)
  const envelope =
    res && typeof res === 'object' && 'data' in res && 'status' in res && 'headers' in res
      ? res.data
      : res;

  if (envelope && typeof envelope === 'object' && 'data' in envelope) {
    return envelope.data !== undefined && envelope.data !== null ? envelope.data : fallback;
  }

  return envelope !== undefined && envelope !== null ? envelope : fallback;
}

/**
 * Mengambil array list dari respons API secara aman,
 * baik respons berupa direct collection [..], envelope { data: [..] },
 * maupun Laravel paginated { data: { data: [..] } }.
 *
 * @template T
 * @param {any} res - Objek respons dari API call
 * @param {T[]} [fallback=[]] - Nilai default array
 * @returns {T[]}
 */
export function unwrapList(res, fallback = []) {
  if (!res) return fallback;

  // Raw array langsung
  if (Array.isArray(res)) return res;

  const data = unwrap(res, null);
  if (Array.isArray(data)) return data;

  // Jika payload adalah objek paginated Laravel: { data: [...], current_page: ... }
  if (data && typeof data === 'object') {
    if (Array.isArray(data.data)) {
      return data.data;
    }
  }

  return fallback;
}

/**
 * Mengambil metadata pagination beserta array itemnya.
 * @param {any} res
 * @returns {{ items: any[], meta: { current_page: number, per_page: number, total: number, last_page: number } | null }}
 */
export function unwrapPagination(res) {
  const data = unwrap(res, null);

  // Bentuk standar Laravel LengthAwarePaginator: { data: [...], current_page, per_page, total, last_page }
  if (data && typeof data === 'object' && Array.isArray(data.data)) {
    return {
      items: data.data,
      meta: {
        current_page: Number(data.current_page || 1),
        per_page: Number(data.per_page || data.data.length),
        total: Number(data.total || data.data.length),
        last_page: Number(data.last_page || 1),
      },
    };
  }

  // Jika pagination ditaruh di level meta: { data: [...], meta: { current_page, total } }
  if (Array.isArray(data)) {
    const meta = res?.meta;
    return {
      items: data,
      meta: meta
        ? {
            current_page: Number(meta.current_page || 1),
            per_page: Number(meta.per_page || data.length),
            total: Number(meta.total || data.length),
            last_page: Number(meta.last_page || 1),
          }
        : {
            current_page: 1,
            per_page: data.length,
            total: data.length,
            last_page: 1,
          },
    };
  }

  return {
    items: [],
    meta: null,
  };
}

/**
 * Mengecek apakah respons API sukses secara eksplisit.
 * @param {any} res
 * @returns {boolean}
 */
export function isSuccess(res) {
  if (!res) return false;
  if (typeof res.success === 'boolean') return res.success;
  if (typeof res.status === 'number') return res.status >= 200 && res.status < 300;
  return false;
}
