import { Navigate, Outlet, useLocation } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';
import LoadingOverlay from '../components/feedback/LoadingOverlay';

export default function ProtectedRoute() {
  const { isAuthenticated, loading, mustChangePassword } = useAuth();
  const location = useLocation();

  if (loading) {
    return <LoadingOverlay active fixed text="Memverifikasi sesi akses..." />;
  }

  if (!isAuthenticated) {
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  if (mustChangePassword && location.pathname !== '/change-password') {
    return <Navigate to="/change-password" replace />;
  }

  return <Outlet />;
}
