import { Navigate, Outlet } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

export default function ProtectedRoute({ requireSenior = false }) {
  const { user, loading, isSenior } = useAuth();

  if (loading) {
    return <div className="page-loading">Loading...</div>;
  }
  if (!user) {
    return <Navigate to="/login" replace />;
  }
  if (requireSenior && !isSenior) {
    return <Navigate to="/" replace />;
  }
  return <Outlet />;
}
