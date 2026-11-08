import axios from 'axios';

const api = axios.create({
  baseURL: import.meta.env.VITE_API_BASE_URL || '/api',
  timeout: 15000,
  headers: {
    'Content-Type': 'application/json',
    Accept: 'application/json',
  },
});

// Request interceptor to attach Bearer token
api.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem('scp_token');
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => Promise.reject(error)
);

// Helper: check if an error is eligible for retry
const isRetryableError = (error) => {
  if (axios.isCancel(error) || error.code === 'ERR_CANCELED') return false;
  if (!error.response || error.code === 'ERR_NETWORK') return true;
  if (error.code === 'ECONNABORTED' || error.message?.toLowerCase().includes('timeout')) return true;
  if (error.response?.status >= 500 && error.response?.status <= 504) return true;
  if (error.response?.status === 429) return true;
  return false;
};

// Response interceptor to handle errors globally, with bounded GET retry (P-4) and session separation (P-5)
api.interceptors.response.use(
  (response) => response.data,
  async (error) => {
    const config = error.config;
    const method = config?.method?.toLowerCase();

    // P-4: Retry terbatas HANYA untuk request GET yang aman diulang (maks 2x retry)
    if (config && method === 'get' && isRetryableError(error)) {
      config._retryCount = config._retryCount || 0;
      if (config._retryCount < 2) {
        config._retryCount += 1;
        let delayMs = 1000 * Math.pow(2, config._retryCount - 1) + Math.floor(Math.random() * 300);
        const retryAfter = error.response?.headers?.['retry-after'];
        if (retryAfter && !isNaN(retryAfter)) {
          delayMs = Math.min(Number(retryAfter) * 1000, 10000);
        }
        await new Promise((resolve) => setTimeout(resolve, delayMs));
        return api(config);
      }
    }

    const status = error.response?.status;
    const data = error.response?.data;
    const isNetworkError = !error.response || error.code === 'ERR_NETWORK';
    const isTimeout = error.code === 'ECONNABORTED' || error.message?.toLowerCase().includes('timeout');

    // P-5: Handle 401 HANYA jika benar-benar respons 401 valid dari backend (bukan gangguan jaringan)
    if (status === 401) {
      const url = config?.url || '';
      const isAuthCheck =
        url.includes('/login') ||
        url.includes('/confirm-password') ||
        url.includes('/verify-password') ||
        url.includes('/forgot-password');

      if (!isAuthCheck) {
        localStorage.removeItem('scp_token');
        localStorage.removeItem('scp_user');
        // Only redirect if not already on the login page
        if (
          typeof window !== 'undefined' &&
          !window.location.pathname.startsWith('/login')
        ) {
          window.location.href = '/login';
        }
      }
    }

    // Standardize error message & validation errors for caller
    const formattedError = {
      status,
      isNetworkError,
      isTimeout,
      message:
        data?.message ||
        (isNetworkError
          ? 'Koneksi ke server terputus. Memeriksa jaringan...'
          : isTimeout
          ? 'Waktu permintaan berakhir (timeout). Silakan periksa koneksi Anda.'
          : status === 404
          ? 'Endpoint tidak ditemukan'
          : status === 403
          ? 'Akses ditolak'
          : status === 429
          ? 'Terlalu banyak permintaan. Silakan tunggu beberapa saat.'
          : 'Gagal terhubung ke server backend.'),
      errors: data?.errors || {},
      raw: error,
    };

    return Promise.reject(formattedError);
  }
);

// Specific Auth & Profile API Services
export const authApi = {
  login: (credentials) => api.post('/login', credentials),
  loginWithGoogle: (idToken, deviceName = 'Web Browser') =>
    api.post('/auth/google', { id_token: idToken, device_name: deviceName }),
  getMe: () => api.get('/me'),
  logout: () => api.post('/logout'),
  changePassword: (data) => api.patch('/me/password', data),
  verifyPassword: (password) => api.post('/me/verify-password', { password }),
  requestEmailOtp: (email) => api.post('/me/email', { email }),
  verifyEmailOtp: (data) => api.post('/me/email/verify', data),
  requestPhoneOtp: (phone) => api.post('/me/phone', { phone_number: phone }),
  verifyPhoneOtp: (data) => api.post('/me/phone/verify', data),
  linkGoogle: (idToken) => api.post('/me/google-link', { id_token: idToken }),
  unlinkGoogle: (password) => api.post('/me/google-unlink', { password }),
};

export default api;
