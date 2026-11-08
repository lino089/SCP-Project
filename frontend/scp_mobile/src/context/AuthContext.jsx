import { useState, useEffect, useCallback, useMemo } from 'react';
import { authApi } from '../services/api';
import { ROLES } from './authConstants';
import { AuthContext } from './authContextInstance';

export function AuthProvider({ children }) {
  const [user, setUser] = useState(() => {
    try {
      const saved = localStorage.getItem('scp_user');
      return saved ? JSON.parse(saved) : null;
    } catch {
      return null;
    }
  });
  const [token, setToken] = useState(() => localStorage.getItem('scp_token') || null);
  const [loading, setLoading] = useState(true);

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

  // Verify session on mount
  useEffect(() => {
    let isMounted = true;

    async function verifySession() {
      const savedToken = localStorage.getItem('scp_token');
      if (!savedToken) {
        if (isMounted) setLoading(false);
        return;
      }

      // Auto-cleanup legacy test tokens
      if (savedToken.startsWith('demo_')) {
        localStorage.removeItem('scp_token');
        localStorage.removeItem('scp_user');
        if (isMounted) {
          setToken(null);
          setUser(null);
          setLoading(false);
        }
        return;
      }

      try {
        const res = await authApi.getMe();
        const userData = res?.data || res?.user || res;
        if (isMounted && userData) {
          setUser(userData);
          localStorage.setItem('scp_user', JSON.stringify(userData));
        }
      } catch (err) {
        // P-5: Token invalid or expired (401 murni dari backend)
        const is401 = err?.status === 401 || err?.raw?.response?.status === 401;
        if (is401) {
          if (isMounted) {
            localStorage.removeItem('scp_token');
            localStorage.removeItem('scp_user');
            setToken(null);
            setUser(null);
          }
        } else {
          // Gangguan jaringan seluler/Wi-Fi: JANGAN logout!
          // Pertahankan token dan profil dari cache localStorage agar sesi mobile tidak hilang tiba-tiba
          console.warn('[SCP Mobile Auth] Gagal verifikasi sesi karena jaringan. Sesi lokal tetap dipertahankan.');
        }
      } finally {
        if (isMounted) {
          setLoading(false);
        }
      }
    }

    verifySession();
    return () => {
      isMounted = false;
    };
  }, []);

  const login = useCallback(async (credentials) => {
    const res = await authApi.login(credentials);
    const authToken = res?.data?.token || res?.token;
    const mustChangePwd = Boolean(res?.data?.must_change_password || res?.must_change_password);

    if (authToken) {
      localStorage.setItem('scp_token', authToken);
      setToken(authToken);

      try {
        const meRes = await authApi.getMe();
        const userData = meRes?.data || meRes?.user || meRes;
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
        throw (meErr?.message ? meErr : new Error('Gagal memuat profil pengguna setelah login.'));
      }
    }

    return res;
  }, []);

  const loginWithGoogle = useCallback(async (idToken, deviceName = 'Mobile Browser') => {
    const res = await authApi.loginWithGoogle(idToken, deviceName);
    const authToken = res?.data?.token || res?.token;
    const mustChangePwd = Boolean(res?.data?.must_change_password || res?.must_change_password);

    if (authToken) {
      localStorage.setItem('scp_token', authToken);
      setToken(authToken);

      try {
        const meRes = await authApi.getMe();
        const userData = meRes?.data || meRes?.user || meRes;
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

  const updateUser = useCallback((updatedData) => {
    setUser((prev) => {
      const merged = { ...prev, ...updatedData };
      localStorage.setItem('scp_user', JSON.stringify(merged));
      return merged;
    });
  }, []);

  const changePassword = useCallback(
    async (passwords) => {
      const res = await authApi.changePassword(passwords);
      updateUser({ must_change_password: false });
      return res;
    },
    [updateUser]
  );

  // Role & Assignment Checkers
  const hasRole = useCallback(
    (allowedRoles) => {
      if (!user?.role) return false;
      const roles = Array.isArray(allowedRoles) ? allowedRoles : [allowedRoles];

      // Normalize backend 'vice_principal' into frontend 'waka'
      const normalizedUserRole =
        user.role === 'vice_principal' || user.role === 'waka' ? ROLES.WAKA : user.role;

      return roles.some((r) => {
        const normalizedTarget = r === 'vice_principal' || r === 'waka' ? ROLES.WAKA : r;
        return normalizedTarget === normalizedUserRole;
      });
    },
    [user]
  );

  const isKesiswaan = useCallback(() => {
    if (!user) return false;
    return Boolean(
      user.is_kesiswaan || user.assignments?.some((a) => a.type === 'kesiswaan')
    );
  }, [user]);

  const isWaliKelas = useCallback(
    (classId = null) => {
      if (!user) return false;
      if (!user.assignments) return false;
      return user.assignments.some(
        (a) =>
          a.type === 'wali_kelas' &&
          (!classId || Number(a.class_id) === Number(classId))
      );
    },
    [user]
  );

  // Determine default home route per role
  const getHomeRoute = useCallback(
    (targetUser = user) => {
      if (!targetUser?.role) return '/login';
      switch (targetUser.role) {
        case ROLES.WAKA:
        case 'vice_principal':
          return '/web/dashboard';
        case ROLES.TEACHER:
          return '/teacher/dashboard';
        case ROLES.STUDENT:
          return '/student/home';
        case ROLES.PARENT:
          return '/parent/monitoring';
        default:
          return '/login';
      }
    },
    [user]
  );

  const value = useMemo(
    () => ({
      user,
      token,
      loading,
      isLoading: loading,
      isAuthenticated: Boolean(token && user),
      mustChangePassword: Boolean(user?.must_change_password),
      login,
      loginWithGoogle,
      logout,
      updateUser,
      updateUserProfile: updateUser,
      changePassword,
      hasRole,
      isKesiswaan,
      isWaliKelas,
      getHomeRoute,
    }),
    [
      user,
      token,
      loading,
      login,
      loginWithGoogle,
      logout,
      updateUser,
      changePassword,
      hasRole,
      isKesiswaan,
      isWaliKelas,
      getHomeRoute,
    ]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export default AuthProvider;
