import axios from 'axios';

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:8000/api';

const api = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    'Content-Type': 'application/json',
    'Accept': 'application/json',
  },
  timeout: 15000,
});

// Request interceptor — attach auth token if available
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

// Response interceptor — unwrap data & handle global errors
api.interceptors.response.use(
  (response) => response.data,
  (error) => {
    const status = error.response?.status;
    const data = error.response?.data;

    if (status === 401) {
      // Only force redirect if user already had a token (expired session),
      // not during login attempts, forgot password, or password confirmation modals
      const url = error.config?.url || '';
      const isAuthCheck =
        url.includes('/login') ||
        url.includes('/confirm-password') ||
        url.includes('/verify-password') ||
        url.includes('/forgot-password');

      if (!isAuthCheck) {
        localStorage.removeItem('scp_token');
        localStorage.removeItem('scp_user');
        if (typeof window !== 'undefined' && !window.location.pathname.startsWith('/login')) {
          window.location.href = '/login';
        }
      }
    }

    return Promise.reject({
      status,
      message:
        data?.message ||
        (status === 404
          ? 'Data atau endpoint tidak ditemukan'
          : status === 403
          ? 'Akses ditolak'
          : status === 429
          ? 'Terlalu banyak permintaan. Silakan tunggu beberapa saat.'
          : error.message || 'Terjadi kesalahan jaringan'),
      errors: data?.errors || {},
      data: data || null,
      raw: error,
    });
  }
);

export const authApi = {
  login: (credentials) => api.post('/login', credentials),
  loginWithGoogle: (idToken, deviceName = 'Mobile Browser') =>
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
