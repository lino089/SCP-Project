import axios from 'axios';

const api = axios.create({
  baseURL: import.meta.env.VITE_API_BASE_URL || 'http://localhost:8000/api',
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

// Response interceptor to handle errors globally
api.interceptors.response.use(
  (response) => response.data,
  (error) => {
    const status = error.response?.status;
    const data = error.response?.data;

    // Handle 401: Token expired or invalid
    if (status === 401) {
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

    // Standardize error message & validation errors for caller
    const formattedError = {
      status,
      message:
        data?.message ||
        (status === 404
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
  loginWithGoogle: (idToken) => api.post('/auth/google', { id_token: idToken }),
  getMe: () => api.get('/me'),
  logout: () => api.post('/logout'),
  changePassword: (data) => api.patch('/me/password', data),
  requestEmailOtp: (email) => api.post('/me/email', { email }),
  verifyEmailOtp: (data) => api.post('/me/email/verify', data),
  requestPhoneOtp: (phone) => api.post('/me/phone', { phone_number: phone }),
  verifyPhoneOtp: (data) => api.post('/me/phone/verify', data),
  linkGoogle: (idToken) => api.post('/me/google-link', { id_token: idToken }),
};

export default api;
