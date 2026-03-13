import { createBrowserRouter, Navigate } from "react-router";
import { LoginPage } from "./pages/login";
import { UserDashboardPage } from "./pages/user-dashboard";
import { ProfilePage } from "./pages/profile";

import { AdminDashboardPage } from "./pages/admin-dashboard";
import { AdminReportsPage } from "./pages/admin-reports";

import { UserManagementPage } from "./pages/user-management";
import { DepartmentManagementPage } from "./pages/department-management";
import { LocationManagementPage } from "./pages/location-management";
import ShiftManagementPage from "./pages/ShiftManagementPage";

import ManageHolidaysPage from "./pages/manage-holidays";
import ManageLeaveTypesPage from "./pages/manage-leave-types-page";
import ManageLeaveBalancesPage from "./pages/manage-leave-balances-page";
import ManageLeaveRequestsPage from "./pages/manage-leave-requests-page";

import { AdminPayrollPeriodsPage } from "./pages/admin-payroll-periods";
import { AdminEmployeeCompensationPage } from "./pages/admin-employee-compensation";
import { AdminPayrollGeneratePage } from "./pages/admin-payroll-generate";
import { AdminPayrollRecordsPage } from "./pages/admin-payroll-records";
import { AdminPayrollDetailsPage } from "./pages/admin-payroll-details";

import { AdminPayrollAdjustmentsPage } from "./pages/admin-payroll-adjustments";
import { AdminRecurringDeductionsPage } from "./pages/admin-recurring-deductions";
import { AdminPayrollSettingsPage } from "./pages/admin-payroll-settings";

import { ProtectedRoute } from "./components/protected-route";

export const router = createBrowserRouter([
  {
    path: "/",
    element: <Navigate to="/login" replace />,
  },
  {
    path: "/login",
    element: <LoginPage />,
  },

  // USER ROUTES
  {
    path: "/dashboard",
    element: (
      <ProtectedRoute>
        <UserDashboardPage />
      </ProtectedRoute>
    ),
  },
  {
    path: "/profile",
    element: (
      <ProtectedRoute>
        <ProfilePage />
      </ProtectedRoute>
    ),
  },

  // ADMIN ROUTES
  {
    path: "/admin",
    element: <Navigate to="/admin/dashboard" replace />,
  },
  {
    path: "/admin/dashboard",
    element: (
      <ProtectedRoute requireAdmin>
        <AdminDashboardPage />
      </ProtectedRoute>
    ),
  },
  {
    path: "/admin/reports",
    element: (
      <ProtectedRoute requireAdmin>
        <AdminReportsPage />
      </ProtectedRoute>
    ),
  },

  // ORGANIZATION
  {
    path: "/admin/users",
    element: (
      <ProtectedRoute requireAdmin>
        <UserManagementPage />
      </ProtectedRoute>
    ),
  },
  {
    path: "/admin/departments",
    element: (
      <ProtectedRoute requireAdmin>
        <DepartmentManagementPage />
      </ProtectedRoute>
    ),
  },
  {
    path: "/admin/locations",
    element: (
      <ProtectedRoute requireAdmin>
        <LocationManagementPage />
      </ProtectedRoute>
    ),
  },
  {
    path: "/admin/shifts",
    element: (
      <ProtectedRoute requireAdmin>
        <ShiftManagementPage />
      </ProtectedRoute>
    ),
  },

  // ATTENDANCE & LEAVE
  {
    path: "/admin/holidays",
    element: (
      <ProtectedRoute requireAdmin>
        <ManageHolidaysPage />
      </ProtectedRoute>
    ),
  },
  {
    path: "/admin/leave-types",
    element: (
      <ProtectedRoute requireAdmin>
        <ManageLeaveTypesPage />
      </ProtectedRoute>
    ),
  },
  {
    path: "/admin/leave-balances",
    element: (
      <ProtectedRoute requireAdmin>
        <ManageLeaveBalancesPage />
      </ProtectedRoute>
    ),
  },
  {
    path: "/admin/leave-requests",
    element: (
      <ProtectedRoute requireAdmin>
        <ManageLeaveRequestsPage />
      </ProtectedRoute>
    ),
  },

  // PAYROLL
  {
    path: "/admin/payroll-periods",
    element: (
      <ProtectedRoute requireAdmin>
        <AdminPayrollPeriodsPage />
      </ProtectedRoute>
    ),
  },
  {
    path: "/admin/employee-compensation",
    element: (
      <ProtectedRoute requireAdmin>
        <AdminEmployeeCompensationPage />
      </ProtectedRoute>
    ),
  },
  {
    path: "/admin/payroll-generate",
    element: (
      <ProtectedRoute requireAdmin>
        <AdminPayrollGeneratePage />
      </ProtectedRoute>
    ),
  },
  {
    path: "/admin/payroll-records",
    element: (
      <ProtectedRoute requireAdmin>
        <AdminPayrollRecordsPage />
      </ProtectedRoute>
    ),
  },
  {
  path: "/admin/payroll-records/:id",
  element: (
    <ProtectedRoute requireAdmin>
      <AdminPayrollDetailsPage />
    </ProtectedRoute>
  ),
},
{
  path: "/admin/payroll-adjustments",
  element: (
    <ProtectedRoute requireAdmin>
      <AdminPayrollAdjustmentsPage />
    </ProtectedRoute>
  ),
},
{
  path: "/admin/recurring-deductions",
  element: (
    <ProtectedRoute requireAdmin>
      <AdminRecurringDeductionsPage />
    </ProtectedRoute>
  ),
},

{
  path: "/admin/payroll-settings",
  element: (
    <ProtectedRoute requireAdmin>
      <AdminPayrollSettingsPage />
    </ProtectedRoute>
  ),
},

  {
    path: "*",
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