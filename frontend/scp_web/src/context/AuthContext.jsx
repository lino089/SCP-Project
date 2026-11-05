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
        } catch {
          // If token invalid, clean up local cache
          if (isMounted) {
            localStorage.removeItem('scp_token');
            localStorage.removeItem('scp_user');
            setToken(null);
            setUser(null);
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
        if (userData) {
          // Ensure must_change_password flag is preserved
          userData.must_change_password = mustChangePwd || Boolean(userData.must_change_password);
          setUser(userData);
          localStorage.setItem('scp_user', JSON.stringify(userData));
          return { user: userData, mustChangePassword: userData.must_change_password };
        }
      } catch {
        // Fallback user object if getMe has temporary delay
        const fallbackUser = {
          nis_nip: credentials.username || credentials.nis_nip,
          must_change_password: mustChangePwd,
        };
        setUser(fallbackUser);
        localStorage.setItem('scp_user', JSON.stringify(fallbackUser));
        return { user: fallbackUser, mustChangePassword: mustChangePwd };
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
        if (userData) {
          userData.must_change_password = mustChangePwd || Boolean(userData.must_change_password);
          setUser(userData);
          localStorage.setItem('scp_user', JSON.stringify(userData));
          return { user: userData, mustChangePassword: userData.must_change_password };
        }
      } catch {
        const fallbackUser = res?.data?.user || {
          must_change_password: mustChangePwd,
        };
        setUser(fallbackUser);
        localStorage.setItem('scp_user', JSON.stringify(fallbackUser));
        return { user: fallbackUser, mustChangePassword: mustChangePwd };
      }
    }

    return res;
  }, []);

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
