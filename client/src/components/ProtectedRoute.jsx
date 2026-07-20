import { Navigate, Outlet } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

export default function ProtectedRoute({ permission }) {
  const { user, loading, can } = useAuth();

  if (loading) {
    return <div className="page-loading">Loading...</div>;
  }
  if (!user) {
    return <Navigate to="/login" replace />;
  }
  if (permission && !can(permission)) {
    return <Navigate to="/" replace />;
  }
  return <Outlet />;
}
