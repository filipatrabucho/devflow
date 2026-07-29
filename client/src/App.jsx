import { Navigate, Route, Routes } from 'react-router-dom';
import { AuthProvider } from './context/AuthContext';
import ProtectedRoute from './components/ProtectedRoute';
import Layout from './components/Layout';
import Login from './pages/Login';
import Dashboard from './pages/Dashboard';
import Developments from './pages/Developments';
import DevelopmentDetail from './pages/DevelopmentDetail';
import MyTasks from './pages/MyTasks';
import AllTasks from './pages/AllTasks';
import Validation from './pages/Validation';
import Users from './pages/Users';
import Roles from './pages/Roles';
import Profile from './pages/Profile';
import BrandingSettings from './pages/BrandingSettings';

export default function App() {
  return (
    <AuthProvider>
      <Routes>
        <Route path="/login" element={<Login />} />

        <Route element={<ProtectedRoute />}>
          <Route element={<Layout />}>
            <Route path="/" element={<Dashboard />} />
            <Route path="/developments" element={<Developments />} />
            <Route path="/developments/:id" element={<DevelopmentDetail />} />
            <Route path="/my-tasks" element={<MyTasks />} />
            <Route path="/profile" element={<Profile />} />

            <Route element={<ProtectedRoute permission="viewAllTasks" />}>
              <Route path="/all-tasks" element={<AllTasks />} />
            </Route>

            <Route element={<ProtectedRoute permission="validateTasks" />}>
              <Route path="/validation" element={<Validation />} />
            </Route>

            <Route element={<ProtectedRoute permission="manageUsers" />}>
              <Route path="/users" element={<Users />} />
              <Route path="/roles" element={<Roles />} />
            </Route>

            <Route element={<ProtectedRoute role="admin" />}>
              <Route path="/branding" element={<BrandingSettings />} />
            </Route>
          </Route>
        </Route>

        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </AuthProvider>
  );
}
