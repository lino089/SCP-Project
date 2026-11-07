import { Outlet, useNavigate } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';
import ForbiddenState from '../components/feedback/ForbiddenState';

export default function RoleRoute({
  allowedRoles = [],
  requireKesiswaan = false,
  allowKesiswaan = false,
  allowWaliKelas = false,
}) {
  const { hasRole, isKesiswaan, isWaliKelas, getHomeRoute } = useAuth();
  const navigate = useNavigate();

  const roleAllowed = allowedRoles.length === 0 || hasRole(allowedRoles);
  const kesiswaanAllowed = allowKesiswaan && isKesiswaan();
  const waliKelasAllowed = allowWaliKelas && isWaliKelas();

  let isAuthorized = roleAllowed || kesiswaanAllowed || waliKelasAllowed;

  if (requireKesiswaan && !isKesiswaan() && !hasRole('waka')) {
    isAuthorized = false;
  }

  if (!isAuthorized) {
    return (
      <div className="p-4">
        <ForbiddenState
          title="Akses Tidak Diizinkan"
          message="Peran akun Anda tidak memiliki izin untuk mengakses modul atau halaman ini."
          onBack={() => navigate(getHomeRoute())}
        />
      </div>
    );
  }

  return <Outlet />;
}
