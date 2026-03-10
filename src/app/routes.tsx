import { createBrowserRouter, Navigate } from 'react-router';
import { LoginPage } from './pages/login';
import { UserDashboardPage } from './pages/user-dashboard';
import { ProfilePage } from './pages/profile';
import { AdminDashboardPage } from './pages/admin-dashboard';
import { UserManagementPage } from './pages/user-management';
import { DepartmentManagementPage } from './pages/department-management';
import { LocationManagementPage } from './pages/location-management';
import ShiftManagementPage from './pages/ShiftManagementPage';
import { ProtectedRoute } from './components/protected-route';

export const router = createBrowserRouter([
  {
    path: '/',
    element: <Navigate to="/login" replace />,
  },
  {
    path: '/login',
    element: <LoginPage />,
  },
  {
    path: '/dashboard',
    element: (
      <ProtectedRoute>
        <UserDashboardPage />
      </ProtectedRoute>
    ),
  },
  {
    path: '/profile',
    element: (
      <ProtectedRoute>
        <ProfilePage />
      </ProtectedRoute>
    ),
  },
  {
    path: '/admin',
    element: (
      <ProtectedRoute requireAdmin>
        <AdminDashboardPage />
      </ProtectedRoute>
    ),
  },
  {
    path: '/admin/users',
    element: (
      <ProtectedRoute requireAdmin>
        <UserManagementPage />
      </ProtectedRoute>
    ),
  },
  {
    path: '/admin/departments',
    element: (
      <ProtectedRoute requireAdmin>
        <DepartmentManagementPage />
      </ProtectedRoute>
    ),
  },
  {
    path: '/admin/locations',
    element: (
      <ProtectedRoute requireAdmin>
        <LocationManagementPage />
      </ProtectedRoute>
    ),
  },
  {
    path: '/admin/shifts',
    element: (
      <ProtectedRoute requireAdmin>
        <ShiftManagementPage />
      </ProtectedRoute>
    ),
  },
  {
    path: '*',
    element: (
      <div className="min-h-screen bg-neutral-50 flex items-center justify-center">
        <div className="text-center">
          <h1 className="text-4xl text-neutral-900 mb-2">404</h1>
          <p className="text-neutral-600">Page not found</p>
        </div>
      </div>
    ),
  },
]);