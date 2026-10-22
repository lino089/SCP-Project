import { Navigate, Outlet } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';
import { LoadingOverlay } from '../components/feedback';

/**
 * Route guard for public pages (e.g. /login), redirects to home if already logged in
 */
export default function PublicRoute() {
  const { isAuthenticated, isLoading, mustChangePassword, getHomeRoute } = useAuth();

  if (isLoading) {
    return <LoadingOverlay fixed />;
  }

  if (isAuthenticated) {
    if (mustChangePassword) {
      return <Navigate to="/change-password" replace />;
    }
    return <Navigate to={getHomeRoute()} replace />;
  }

  return <Outlet />;
}
