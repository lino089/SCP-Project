import { Outlet, Navigate } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';
import { ForbiddenState } from '../components/feedback';

/**
 * Route guard that validates user role and specialized assignments
 */
export default function RoleRoute({
  allowedRoles = [],
  requireKesiswaan = false,
  requireWaliKelas = false,
  requireKesiswaanOrWaliKelas = false,
  requireTeacherLeaveVerifier = false,
  redirectTo = null,
}) {
  const { hasRole, isKesiswaan, isWaliKelas } = useAuth();

  let isAuthorized = false;

  if (allowedRoles.length > 0) {
    if (hasRole(allowedRoles)) {
      isAuthorized = true;
    }
  }

  // Handle special teacher assignments
  if (requireKesiswaan) {
    if (!isKesiswaan()) {
      isAuthorized = false;
    }
  }

  if (requireWaliKelas) {
    if (!isWaliKelas()) {
      isAuthorized = false;
    }
  }

  if (requireKesiswaanOrWaliKelas) {
    if (!isKesiswaan() && !isWaliKelas() && !hasRole('waka')) {
      isAuthorized = false;
    }
  }

  // Verifikator perizinan guru (Waka Kurikulum atau Guru Kesiswaan)
  if (requireTeacherLeaveVerifier) {
    if (!isKesiswaan() && !hasRole('waka')) {
      isAuthorized = false;
    }
  }

  if (!isAuthorized) {
    if (redirectTo) {
      return <Navigate to={redirectTo} replace />;
    }

    return (
      <div className="p-6 md:p-10 max-w-4xl mx-auto">
        <ForbiddenState
          title="Wewenang Tidak Mencukupi"
          message="Anda tidak memiliki izin akses untuk membuka modul atau menu ini dengan peran akun saat ini."
        />
      </div>
    );
  }

  return <Outlet />;
}
