import { Navigate, Outlet } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';
import LoadingOverlay from '../components/feedback/LoadingOverlay';

export default function PublicRoute() {
  const { isAuthenticated, loading, mustChangePassword, getHomeRoute } = useAuth();

  if (loading) {
    return <LoadingOverlay active fixed text="Memeriksa sesi pengguna..." />;
  }

  if (isAuthenticated) {
    if (mustChangePassword) {
      return <Navigate to="/change-password" replace />;
    }
    return <Navigate to={getHomeRoute()} replace />;
  }

  return <Outlet />;
}
