import { createBrowserRouter, Navigate } from "react-router";
import { LoginPage } from "./pages/login";
import { UserDashboardPage } from "./pages/user-dashboard";
import { ProfilePage } from "./pages/profile";
import { UserPayrollPage } from "./pages/user-payroll";
import { UserPayslipDetailsPage } from "./pages/user-payslip-details";
import { UserShiftChangeRequestsPage } from "./pages/user-shift-change-requests";
import { UserLeavePage } from "./pages/user-leave";
import { UserPolicyDocumentsPage } from "./pages/user-policy-documents";

import { AdminDashboardPage } from "./pages/admin-dashboard";
import { AdminReportsPage } from "./pages/admin-reports";

import { UserManagementPage } from "./pages/user-management";
import { DepartmentManagementPage } from "./pages/department-management";
import { LocationManagementPage } from "./pages/location-management";
import ShiftManagementPage from "./pages/ShiftManagementPage";
import { ManualAttendanceManagementPage } from "./pages/manual-attendance-management";
import { AttendanceAdjustmentsManagementPage } from "./pages/attendance-adjustments-management";
import { AttendanceActivityLogManagementPage } from "./pages/attendance-activity-log-management";
import { OvertimeApprovalsPage } from "./pages/overtime-approvals-page";
import { AdminShiftChangeRequestsPage } from "./pages/admin-shift-change-requests";

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
import { AdminGovernmentContributionsPage } from "./pages/admin-government-contributions";
import { AdminGovernmentReportsPage } from "./pages/admin-government-reports";
import { AdminSettingsPage } from "./pages/admin-settings";
import { AdminAnnouncementsPage } from "./pages/admin-announcements";
import { AdminPolicyDocumentsPage } from "./pages/admin-policy-documents";

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
  {
    path: "/my-payroll",
    element: (
      <ProtectedRoute>
        <UserPayrollPage />
      </ProtectedRoute>
    ),
  },
  {
    path: "/my-payroll/:id",
    element: (
      <ProtectedRoute>
        <UserPayslipDetailsPage />
      </ProtectedRoute>
    ),
  },
  {
    path: "/shift-change-requests",
    element: (
      <ProtectedRoute>
        <UserShiftChangeRequestsPage />
      </ProtectedRoute>
    ),
  },
  {
    path: "/my-leave",
    element: (
      <ProtectedRoute>
        <UserLeavePage />
      </ProtectedRoute>
    ),
  },
  {
    path: "/policies",
    element: (
      <ProtectedRoute>
        <UserPolicyDocumentsPage />
      </ProtectedRoute>
    ),
  },

  // ADMIN / STAFF PORTAL ENTRY
  {
    path: "/admin",
    element: <Navigate to="/admin/dashboard" replace />,
  },

  // OVERVIEW
  {
    path: "/admin/dashboard",
    element: (
      <ProtectedRoute allowedRoles={["admin", "hr", "payroll"]}>
        <AdminDashboardPage />
      </ProtectedRoute>
    ),
  },
  {
    path: "/admin/reports",
    element: (
      <ProtectedRoute allowedRoles={["admin", "hr", "payroll"]}>
        <AdminReportsPage />
      </ProtectedRoute>
    ),
  },

  // ORGANIZATION
  {
    path: "/admin/users",
    element: (
      <ProtectedRoute allowedRoles={["admin", "hr", "payroll"]}>
        <UserManagementPage />
      </ProtectedRoute>
    ),
  },
  {
    path: "/admin/departments",
    element: (
      <ProtectedRoute allowedRoles={["admin", "hr", "payroll"]}>
        <DepartmentManagementPage />
      </ProtectedRoute>
    ),
  },
  {
    path: "/admin/locations",
    element: (
      <ProtectedRoute allowedRoles={["admin", "hr", "payroll"]}>
        <LocationManagementPage />
      </ProtectedRoute>
    ),
  },
  {
    path: "/admin/shifts",
    element: (
      <ProtectedRoute allowedRoles={["admin", "hr", "payroll"]}>
        <ShiftManagementPage />
      </ProtectedRoute>
    ),
  },

  // ATTENDANCE & LEAVE
  {
    path: "/admin/manual-attendance",
    element: (
      <ProtectedRoute allowedRoles={["admin", "hr", "payroll"]}>
        <ManualAttendanceManagementPage />
      </ProtectedRoute>
    ),
  },
  {
    path: "/admin/attendance-adjustments",
    element: (
      <ProtectedRoute allowedRoles={["admin", "hr", "payroll"]}>
        <AttendanceAdjustmentsManagementPage />
      </ProtectedRoute>
    ),
  },
  {
    path: "/admin/overtime-approvals",
    element: (
      <ProtectedRoute allowedRoles={["admin", "hr", "payroll"]}>
        <OvertimeApprovalsPage />
      </ProtectedRoute>
    ),
  },
  {
    path: "/admin/shift-change-requests",
    element: (
      <ProtectedRoute allowedRoles={["admin", "hr", "payroll"]}>
        <AdminShiftChangeRequestsPage />
      </ProtectedRoute>
    ),
  },
  {
    path: "/admin/activity-logs",
    element: (
      <ProtectedRoute allowedRoles={["admin", "hr", "payroll"]}>
        <AttendanceActivityLogManagementPage />
      </ProtectedRoute>
    ),
  },
  {
    path: "/admin/holidays",
    element: (
      <ProtectedRoute allowedRoles={["admin", "hr", "payroll"]}>
        <ManageHolidaysPage />
      </ProtectedRoute>
    ),
  },
  {
    path: "/admin/leave-types",
    element: (
      <ProtectedRoute allowedRoles={["admin", "hr", "payroll"]}>
        <ManageLeaveTypesPage />
      </ProtectedRoute>
    ),
  },
  {
    path: "/admin/leave-balances",
    element: (
      <ProtectedRoute allowedRoles={["admin", "hr", "payroll"]}>
        <ManageLeaveBalancesPage />
      </ProtectedRoute>
    ),
  },
  {
    path: "/admin/leave-requests",
    element: (
      <ProtectedRoute allowedRoles={["admin", "hr", "payroll"]}>
        <ManageLeaveRequestsPage />
      </ProtectedRoute>
    ),
  },

  // PAYROLL
  {
    path: "/admin/payroll-periods",
    element: (
      <ProtectedRoute allowedRoles={["admin", "hr", "payroll"]}>
        <AdminPayrollPeriodsPage />
      </ProtectedRoute>
    ),
  },
  {
    path: "/admin/employee-compensation",
    element: (
      <ProtectedRoute allowedRoles={["admin", "hr", "payroll"]}>
        <AdminEmployeeCompensationPage />
      </ProtectedRoute>
    ),
  },
  {
    path: "/admin/payroll-generate",
    element: (
      <ProtectedRoute allowedRoles={["admin", "hr", "payroll"]}>
        <AdminPayrollGeneratePage />
      </ProtectedRoute>
    ),
  },
  {
    path: "/admin/payroll-records",
    element: (
      <ProtectedRoute allowedRoles={["admin", "hr", "payroll"]}>
        <AdminPayrollRecordsPage />
      </ProtectedRoute>
    ),
  },
  {
    path: "/admin/payroll-records/:id",
    element: (
      <ProtectedRoute allowedRoles={["admin", "hr", "payroll"]}>
        <AdminPayrollDetailsPage />
      </ProtectedRoute>
    ),
  },
  {
    path: "/admin/payroll-adjustments",
    element: (
      <ProtectedRoute allowedRoles={["admin", "hr", "payroll"]}>
        <AdminPayrollAdjustmentsPage />
      </ProtectedRoute>
    ),
  },
  {
    path: "/admin/recurring-deductions",
    element: (
      <ProtectedRoute allowedRoles={["admin", "hr", "payroll"]}>
        <AdminRecurringDeductionsPage />
      </ProtectedRoute>
    ),
  },
  {
    path: "/admin/payroll-settings",
    element: (
      <ProtectedRoute allowedRoles={["admin", "hr", "payroll"]}>
        <AdminPayrollSettingsPage />
      </ProtectedRoute>
    ),
  },
  {
    path: "/admin/government-contributions",
    element: (
      <ProtectedRoute allowedRoles={["admin", "hr", "payroll"]}>
        <AdminGovernmentContributionsPage />
      </ProtectedRoute>
    ),
  },
  {
    path: "/admin/government-reports",
    element: (
      <ProtectedRoute allowedRoles={["admin", "hr", "payroll"]}>
        <AdminGovernmentReportsPage />
      </ProtectedRoute>
    ),
  },
  {
    path: "/admin/announcements",
    element: (
      <ProtectedRoute allowedRoles={["admin", "hr", "payroll"]}>
        <AdminAnnouncementsPage />
      </ProtectedRoute>
    ),
  },
  {
    path: "/admin/policy-documents",
    element: (
      <ProtectedRoute allowedRoles={["admin", "hr", "payroll"]}>
        <AdminPolicyDocumentsPage />
      </ProtectedRoute>
    ),
  },
  {
    path: "/admin/settings",
    element: (
      <ProtectedRoute allowedRoles={["admin"]}>
        <AdminSettingsPage />
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
