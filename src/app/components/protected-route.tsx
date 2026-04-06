import { ReactNode } from 'react';
import { Navigate } from 'react-router';
import { useAuth } from '../hooks/useAuth';

type AppRole = "user" | "admin" | "hr" | "payroll";

interface ProtectedRouteProps {
  children: ReactNode;
  requireAdmin?: boolean;
  allowedRoles?: AppRole[]; // ✅ NEW
}

export function ProtectedRoute({
  children,
  requireAdmin = false,
  allowedRoles,
}: ProtectedRouteProps) {
  const { isAuthenticated, user, isLoading } = useAuth();

  if (isLoading) {
    return (
      <div className="min-h-screen bg-neutral-50 flex items-center justify-center">
        <p className="text-neutral-600">Loading...</p>
      </div>
    );
  }

  if (!isAuthenticated) {
    return <Navigate to="/login" replace />;
  }

  // ✅ OLD ADMIN CHECK
  if (requireAdmin && user?.role !== 'admin') {
    return <Navigate to="/dashboard" replace />;
  }

  // ✅ NEW ROLE CHECK
  if (allowedRoles && !allowedRoles.includes(user?.role as AppRole)) {
    return <Navigate to="/dashboard" replace />;
  }

  return <>{children}</>;
}