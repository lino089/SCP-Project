import { useState, useEffect, useCallback, useMemo } from 'react';
import { authApi } from '../services/api';
import { AuthContext } from './authContextInstance';

export function AuthProvider({ children }) {
  const [token, setToken] = useState(() => localStorage.getItem('scp_token') || null);
  const [user, setUser] = useState(() => {
    try {
      const savedUser = localStorage.getItem('scp_user');
      return savedUser ? JSON.parse(savedUser) : null;
    } catch {
      return null;
    }
  });
  const [isLoading, setIsLoading] = useState(true);

  // Initialize & verify session on mount
  useEffect(() => {
    let isMounted = true;

    async function initAuth() {
      const savedToken = localStorage.getItem('scp_token');
      if (savedToken) {
        // Auto-cleanup legacy demo tokens from previous test sessions
        if (savedToken.startsWith('demo_')) {
          localStorage.removeItem('scp_token');
          localStorage.removeItem('scp_user');
          if (isMounted) {
            setToken(null);
            setUser(null);
            setIsLoading(false);
          }
          return;
        }

        try {
          const res = await authApi.getMe();
          if (isMounted && res?.data) {
            setUser(res.data);
            localStorage.setItem('scp_user', JSON.stringify(res.data));
          }
        } catch (err) {
          // P-5: Hapus token HANYA jika server secara sah mengembalikan 401 (token expired/invalid)
          const is401 = err?.status === 401 || err?.raw?.response?.status === 401;
          if (is401) {
            if (isMounted) {
              localStorage.removeItem('scp_token');
              localStorage.removeItem('scp_user');
              setToken(null);
              setUser(null);
            }
          } else {
            // Gangguan jaringan, timeout, atau server 5xx: JANGAN logout!
            // Pertahankan token dan profil dari cache localStorage agar sesi tidak hilang saat offline/jaringan putus
            console.warn('[SCP Web Auth] Gagal menyegarkan /me karena gangguan jaringan/server. Sesi lokal tetap dipertahankan.');
          }
        }
      }
      if (isMounted) {
        setIsLoading(false);
      }
    }

    initAuth();
    return () => {
      isMounted = false;
    };
  }, []);

  // Standard Login via Backend API
  const login = useCallback(async (credentials) => {
    const res = await authApi.login(credentials);
    const authToken = res?.data?.token;
    const mustChangePwd = Boolean(res?.data?.must_change_password);

    if (authToken) {
      localStorage.setItem('scp_token', authToken);
      setToken(authToken);

      try {
        const meRes = await authApi.getMe();
        const userData = meRes?.data;
        if (userData && userData.role) {
          // Ensure must_change_password flag is preserved
          userData.must_change_password = mustChangePwd || Boolean(userData.must_change_password);
          setUser(userData);
          localStorage.setItem('scp_user', JSON.stringify(userData));
          return { user: userData, mustChangePassword: userData.must_change_password };
        }
        throw new Error('Data profil pengguna tidak memuat informasi role yang sah.');
      } catch (meErr) {
        // P-5: Jangan buat user parsial tanpa role yang merusak routing!
        localStorage.removeItem('scp_token');
        localStorage.removeItem('scp_user');
        setToken(null);
        setUser(null);
        throw (meErr?.message ? meErr : new Error('Gagal memuat profil pengguna setelah login.'));
      }
    }

    return res;
  }, []);

  // Login via Google SSO ID Token
  const loginWithGoogle = useCallback(async (idToken, deviceName = 'Web Browser') => {
    const res = await authApi.loginWithGoogle(idToken, deviceName);
    const authToken = res?.data?.token;
    const mustChangePwd = Boolean(res?.data?.must_change_password);

    if (authToken) {
      localStorage.setItem('scp_token', authToken);
      setToken(authToken);

      try {
        const meRes = await authApi.getMe();
        const userData = meRes?.data;
        if (userData && userData.role) {
          userData.must_change_password = mustChangePwd || Boolean(userData.must_change_password);
          setUser(userData);
          localStorage.setItem('scp_user', JSON.stringify(userData));
          return { user: userData, mustChangePassword: userData.must_change_password };
        }
        throw new Error('Data profil pengguna tidak memuat informasi role yang sah.');
      } catch (meErr) {
        localStorage.removeItem('scp_token');
        localStorage.removeItem('scp_user');
        setToken(null);
        setUser(null);
        throw (meErr?.message ? meErr : new Error('Gagal memuat profil Google SSO setelah login.'));
      }
    }

    return res;
  }, []);

  // Helper to establish session from auth token
  const establishSessionFromToken = useCallback(async (authToken, mustChangePwd = false) => {
    localStorage.setItem('scp_token', authToken);
    setToken(authToken);

    try {
      const meRes = await authApi.getMe();
      const userData = meRes?.data;
      if (userData && userData.role) {
        userData.must_change_password = mustChangePwd || Boolean(userData.must_change_password);
        setUser(userData);
        localStorage.setItem('scp_user', JSON.stringify(userData));
        return { user: userData, mustChangePassword: userData.must_change_password };
      }
      throw new Error('Data profil pengguna tidak memuat informasi role yang sah.');
    } catch (meErr) {
      localStorage.removeItem('scp_token');
      localStorage.removeItem('scp_user');
      setToken(null);
      setUser(null);
      throw (meErr?.message ? meErr : new Error('Gagal memuat profil pengguna setelah verifikasi nomor HP.'));
    }
  }, []);

  // Request WhatsApp OTP for Login
  const requestPhoneLoginOtp = useCallback(async (phoneNumber, deviceName = 'Web Browser') => {
    return await authApi.requestPhoneLoginOtp(phoneNumber, deviceName);
  }, []);

  // Verify WhatsApp OTP for Login
  const verifyPhoneLoginOtp = useCallback(async (sessionToken, code, deviceName = 'Web Browser') => {
    const res = await authApi.verifyPhoneLoginOtp(sessionToken, code, deviceName);

    if (res?.multiple_accounts) {
      return res;
    }

    const authToken = res?.data?.token;
    const mustChangePwd = Boolean(res?.data?.must_change_password);

    if (authToken) {
      return await establishSessionFromToken(authToken, mustChangePwd);
    }

    return res;
  }, [establishSessionFromToken]);

  // Select account from Multi-Account picker
  const selectAccountPhoneLogin = useCallback(async (selectionToken, userId, deviceName = 'Web Browser') => {
    const res = await authApi.selectAccountPhoneLogin(selectionToken, userId, deviceName);
    const authToken = res?.data?.token;
    const mustChangePwd = Boolean(res?.data?.must_change_password);

    if (authToken) {
      return await establishSessionFromToken(authToken, mustChangePwd);
    }

    return res;
  }, [establishSessionFromToken]);

  // Logout method
  const logout = useCallback(async () => {
    try {
      if (token) {
        await authApi.logout();
      }
    } catch {
      // Ignore network errors on logout
    } finally {
      localStorage.removeItem('scp_token');
      localStorage.removeItem('scp_user');
      setToken(null);
      setUser(null);
    }
  }, [token]);

  // Update profile in local state
  const updateUserProfile = useCallback((partialData) => {
    setUser((prev) => {
      const updated = { ...prev, ...partialData };
      localStorage.setItem('scp_user', JSON.stringify(updated));
      return updated;
    });
  }, []);

  // Change password method
  const changePassword = useCallback(async (passwords) => {
    const res = await authApi.changePassword(passwords);
    updateUserProfile({ must_change_password: false });
    return res;
  }, [updateUserProfile]);

  // Role & Permission Checks
  const hasRole = useCallback((roleOrRoles) => {
    if (!user?.role) return false;
    const allowed = Array.isArray(roleOrRoles) ? roleOrRoles : [roleOrRoles];

    // Treat 'waka' and 'vice_principal' as identical
    const normalizedUserRole = user.role === 'vice_principal' ? 'waka' : user.role;
    const normalizedAllowed = allowed.map((r) => (r === 'vice_principal' ? 'waka' : r));

    return normalizedAllowed.includes(normalizedUserRole);
  }, [user]);

  const isKesiswaan = useCallback(() => {
    if (!user) return false;
    if (user.is_kesiswaan) return true;
    return Boolean(user.assignments?.some((a) => a.type === 'kesiswaan'));
  }, [user]);

  const isWaliKelas = useCallback((classId = null) => {
    if (!user) return false;
    if (classId) {
      return Boolean(
        user.assignments?.some(
          (a) => a.type === 'wali_kelas' && Number(a.class_id) === Number(classId)
        )
      );
    }
    return Boolean(user.assignments?.some((a) => a.type === 'wali_kelas'));
  }, [user]);

  // Get home route dynamically based on active role
  const getHomeRoute = useCallback(() => {
    if (!user) return '/login';
    if (hasRole('waka')) return '/web/dashboard';
    if (hasRole('teacher')) return '/teacher/dashboard';
    if (hasRole('student')) return '/student/home';
    if (hasRole('parent')) return '/parent/monitoring';
    return '/web/dashboard';
  }, [user, hasRole]);

  const value = useMemo(() => ({
    user,
    token,
    isAuthenticated: Boolean(token && user),
    isLoading,
    mustChangePassword: Boolean(user?.must_change_password),
    login,
    loginWithGoogle,
    requestPhoneLoginOtp,
    verifyPhoneLoginOtp,
    selectAccountPhoneLogin,
    logout,
    updateUserProfile,
    changePassword,
    hasRole,
    isKesiswaan,
    isWaliKelas,
    getHomeRoute,
  }), [
    user,
    token,
    isLoading,
    login,
    loginWithGoogle,
    requestPhoneLoginOtp,
    verifyPhoneLoginOtp,
    selectAccountPhoneLogin,
    logout,
    updateUserProfile,
    changePassword,
    hasRole,
    isKesiswaan,
    isWaliKelas,
    getHomeRoute,
  ]);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export default AuthProvider;
