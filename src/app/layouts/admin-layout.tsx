import { ReactNode, useEffect, useMemo, useState } from "react";
import { NavLink, useLocation } from "react-router";
import {
  LayoutDashboard,
  Users,
  Building2,
  MapPin,
  Clock3,
  CalendarDays,
  CalendarRange,
  Wallet,
  Banknote,
  FileText,
  ClipboardPenLine,
  ClipboardCheck,
  ClipboardList,
  CalendarClock,
  Megaphone,
  ChevronDown,
  Menu,
  X,
  Settings,
  LogOut,
} from "lucide-react";

import { Button } from "../components/ui/button";
import { Badge } from "../components/ui/badge";
import { cn } from "../lib/utils";
import { supabase } from "../lib/supabase";
import { useAuth } from "../hooks/useAuth";
import { appSettingsService } from "../services/app-settings.service";

type AppRole = "user" | "admin" | "hr" | "payroll";

type AdminLayoutProps = {
  children: ReactNode;
};

type NavItem = {
  label: string;
  to: string;
  icon: ReactNode;
  badgeKey?: "leaveRequests" | "attendanceAdjustments" | "shiftChangeRequests";
};

type NavGroup = {
  label: string;
  roles: AppRole[];
  items: NavItem[];
};

const navGroups: NavGroup[] = [
  {
    label: "Overview",
    roles: ["admin", "hr", "payroll"],
    items: [
      {
        label: "Dashboard",
        to: "/admin/dashboard",
        icon: <LayoutDashboard className="h-4 w-4" />,
      },
      {
        label: "Reports",
        to: "/admin/reports",
        icon: <FileText className="h-4 w-4" />,
      },
    ],
  },
  {
    label: "Organization",
    roles: ["admin", "hr", "payroll"],
    items: [
      {
        label: "Users",
        to: "/admin/users",
        icon: <Users className="h-4 w-4" />,
      },
      {
        label: "Departments",
        to: "/admin/departments",
        icon: <Building2 className="h-4 w-4" />,
      },
      {
        label: "Locations",
        to: "/admin/locations",
        icon: <MapPin className="h-4 w-4" />,
      },
      {
        label: "Shifts",
        to: "/admin/shifts",
        icon: <Clock3 className="h-4 w-4" />,
      },
    ],
  },
  {
    label: "Attendance & Leave",
    roles: ["admin", "hr", "payroll"],
    items: [
      {
        label: "Manual Attendance",
        to: "/admin/manual-attendance",
        icon: <ClipboardPenLine className="h-4 w-4" />,
      },
      {
        label: "Attendance Adjustments",
        to: "/admin/attendance-adjustments",
        icon: <ClipboardCheck className="h-4 w-4" />,
        badgeKey: "attendanceAdjustments",
      },
      {
        label: "Overtime Approvals",
        to: "/admin/overtime-approvals",
        icon: <Clock3 className="h-4 w-4" />,
      },
      {
        label: "Shift Change Requests",
        to: "/admin/shift-change-requests",
        icon: <CalendarClock className="h-4 w-4" />,
        badgeKey: "shiftChangeRequests",
      },
      {
        label: "Activity Logs",
        to: "/admin/activity-logs",
        icon: <ClipboardList className="h-4 w-4" />,
      },
      {
        label: "Holidays",
        to: "/admin/holidays",
        icon: <CalendarDays className="h-4 w-4" />,
      },
      {
        label: "Leave Types",
        to: "/admin/leave-types",
        icon: <CalendarRange className="h-4 w-4" />,
      },
      {
        label: "Leave Balances",
        to: "/admin/leave-balances",
        icon: <Wallet className="h-4 w-4" />,
      },
      {
        label: "Leave Requests",
        to: "/admin/leave-requests",
        icon: <FileText className="h-4 w-4" />,
        badgeKey: "leaveRequests",
      },
    ],
  },
  {
    label: "Payroll",
    roles: ["admin", "payroll"],
    items: [
      {
        label: "Payroll Periods",
        to: "/admin/payroll-periods",
        icon: <CalendarRange className="h-4 w-4" />,
      },
      {
        label: "Employee Compensation",
        to: "/admin/employee-compensation",
        icon: <Banknote className="h-4 w-4" />,
      },
      {
        label: "Generate Payroll",
        to: "/admin/payroll-generate",
        icon: <Wallet className="h-4 w-4" />,
      },
      {
        label: "Payroll Records",
        to: "/admin/payroll-records",
        icon: <FileText className="h-4 w-4" />,
      },
      {
        label: "Payroll Adjustments",
        to: "/admin/payroll-adjustments",
        icon: <FileText className="h-4 w-4" />,
      },
      {
        label: "Recurring Payroll Items",
        to: "/admin/recurring-deductions",
        icon: <Wallet className="h-4 w-4" />,
      },
      {
        label: "Payroll Settings",
        to: "/admin/payroll-settings",
        icon: <Settings className="h-4 w-4" />,
      },
      {
        label: "Government Tables",
        to: "/admin/government-contributions",
        icon: <Banknote className="h-4 w-4" />,
      },
      {
        label: "Government Reports",
        to: "/admin/government-reports",
        icon: <FileText className="h-4 w-4" />,
      },
    ],
  },
  {
    label: "System",
    roles: ["admin"],
    items: [
      {
        label: "Settings",
        to: "/admin/settings",
        icon: <Settings className="h-4 w-4" />,
      },
    ],
  },
];

type PendingCounts = {
  leaveRequests: number;
  attendanceAdjustments: number;
  shiftChangeRequests: number;
};

function NotificationBubble({ count }: { count: number }) {
  if (!count || count <= 0) return null;

  return (
    <span className="ml-auto inline-flex min-w-[20px] h-5 items-center justify-center rounded-full bg-red-600 px-1.5 text-[11px] font-semibold text-white">
      {count > 99 ? "99+" : count}
    </span>
  );
}

function SidebarLink({
  item,
  count,
}: {
  item: NavItem;
  count?: number;
}) {
  return (
    <NavLink
      to={item.to}
      className={({ isActive }) =>
        cn(
          "flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm transition-all",
          "hover:bg-neutral-100",
          isActive
            ? "bg-black text-white hover:bg-black"
            : "text-neutral-700"
        )
      }
    >
      {item.icon}
      <span className="truncate">{item.label}</span>
      <NotificationBubble count={count ?? 0} />
    </NavLink>
  );
}

function SidebarGroup({
  group,
  badgeCounts,
  defaultOpen = true,
}: {
  group: NavGroup;
  badgeCounts: PendingCounts;
  defaultOpen?: boolean;
}) {
  const location = useLocation();

  const hasActiveChild = useMemo(() => {
    return group.items.some((item) => location.pathname.startsWith(item.to));
  }, [group.items, location.pathname]);

  const [open, setOpen] = useState(defaultOpen || hasActiveChild);

  return (
    <div className="space-y-2">
      <button
        type="button"
        onClick={() => setOpen((prev) => !prev)}
        className="flex w-full items-center justify-between rounded-lg px-2 py-1 text-xs font-semibold uppercase tracking-wide text-neutral-500 hover:bg-neutral-50"
      >
        <span>{group.label}</span>
        <ChevronDown
          className={cn(
            "h-4 w-4 transition-transform",
            open ? "rotate-0" : "-rotate-90"
          )}
        />
      </button>

      {open && (
        <div className="space-y-1">
          {group.items.map((item) => {
            const count =
              item.badgeKey === "leaveRequests"
                ? badgeCounts.leaveRequests
                : item.badgeKey === "attendanceAdjustments"
                ? badgeCounts.attendanceAdjustments
                : item.badgeKey === "shiftChangeRequests"
                ? badgeCounts.shiftChangeRequests
                : 0;

            return <SidebarLink key={item.to} item={item} count={count} />;
          })}
        </div>
      )}
    </div>
  );
}

export function AdminLayout({ children }: AdminLayoutProps) {
  const [mobileOpen, setMobileOpen] = useState(false);
  const [isMainInstance, setIsMainInstance] = useState(false);
  const [badgeCounts, setBadgeCounts] = useState<PendingCounts>({
    leaveRequests: 0,
    attendanceAdjustments: 0,
    shiftChangeRequests: 0,
  });
  const { user } = useAuth();

  const currentRole = (user?.role ?? "user") as AppRole;

  const visibleGroups = useMemo(() => {
    const groups = navGroups.filter((group) => group.roles.includes(currentRole));

    if (isMainInstance && ["admin", "hr", "payroll"].includes(currentRole)) {
      return [
        ...groups.slice(0, -1),
        {
          label: "Communications",
          roles: ["admin", "hr", "payroll"] as AppRole[],
          items: [
            {
              label: "Announcements",
              to: "/admin/announcements",
              icon: <Megaphone className="h-4 w-4" />,
            },
            {
              label: "Policy Documents",
              to: "/admin/policy-documents",
              icon: <FileText className="h-4 w-4" />,
            },
          ],
        },
        ...groups.slice(-1),
      ];
    }

    return groups;
  }, [currentRole, isMainInstance]);

  const loadInstanceMode = async () => {
    try {
      const config = await appSettingsService.getInstanceConfig();
      setIsMainInstance(config.mode === "main");
    } catch (error) {
      console.error("Error loading instance mode:", error);
      setIsMainInstance(false);
    }
  };

  const loadPendingCounts = async () => {
    try {
      const requestsToLoad: Promise<any>[] = [];

      const shouldLoadLeaveRequests = ["admin", "hr", "payroll"].includes(currentRole);
      const shouldLoadAttendanceAdjustments = ["admin", "hr", "payroll"].includes(currentRole);
      const shouldLoadShiftChangeRequests = ["admin", "hr", "payroll"].includes(currentRole);

      if (shouldLoadLeaveRequests) {
        requestsToLoad.push(
          supabase
            .from("leave_requests")
            .select("id", { count: "exact", head: true })
            .eq("status", "pending")
        );
      } else {
        requestsToLoad.push(Promise.resolve({ count: 0 }));
      }

      if (shouldLoadAttendanceAdjustments) {
        requestsToLoad.push(
          supabase
            .from("attendance_adjustments")
            .select("id", { count: "exact", head: true })
            .eq("status", "pending")
        );
      } else {
        requestsToLoad.push(Promise.resolve({ count: 0 }));
      }

      if (shouldLoadShiftChangeRequests) {
        requestsToLoad.push(
          supabase
            .from("shift_change_requests")
            .select("id", { count: "exact", head: true })
            .eq("status", "pending")
        );
      } else {
        requestsToLoad.push(Promise.resolve({ count: 0 }));
      }

      const [
        leaveRequestsResult,
        attendanceAdjustmentsResult,
        shiftChangeRequestsResult,
      ] =
        await Promise.all(requestsToLoad);

      setBadgeCounts({
        leaveRequests:
          "count" in leaveRequestsResult ? leaveRequestsResult.count ?? 0 : 0,
        attendanceAdjustments:
          "count" in attendanceAdjustmentsResult
            ? attendanceAdjustmentsResult.count ?? 0
            : 0,
        shiftChangeRequests:
          "count" in shiftChangeRequestsResult
            ? shiftChangeRequestsResult.count ?? 0
            : 0,
      });
    } catch (error) {
      console.error("Error loading sidebar pending counts:", error);
    }
  };

  useEffect(() => {
    loadInstanceMode();
    loadPendingCounts();
  }, [currentRole]);

  useEffect(() => {
    if (!["admin", "hr", "payroll"].includes(currentRole)) return;

    const leaveChannel = supabase
      .channel("sidebar-leave-requests-count")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "leave_requests" },
        () => {
          loadPendingCounts();
        }
      )
      .subscribe();

    const adjustmentChannel = supabase
      .channel("sidebar-attendance-adjustments-count")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "attendance_adjustments" },
        () => {
          loadPendingCounts();
        }
      )
      .subscribe();

    const shiftChangeChannel = supabase
      .channel("sidebar-shift-change-requests-count")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "shift_change_requests" },
        () => {
          loadPendingCounts();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(leaveChannel);
      supabase.removeChannel(adjustmentChannel);
      supabase.removeChannel(shiftChangeChannel);
    };
  }, [currentRole]);

  const handleLogout = async () => {
    await supabase.auth.signOut();
    window.location.href = "/";
  };

  return (
    <div className="h-screen bg-neutral-50 overflow-hidden">
      <div className="flex h-full">
        <aside className="hidden w-72 shrink-0 border-r bg-white lg:flex lg:flex-col h-screen">
          <div className="border-b px-6 py-5 shrink-0">
            <div className="text-lg font-semibold">Admin Panel</div>
            <div className="text-sm text-neutral-500">HRIS Management</div>
          </div>

          <div className="flex-1 min-h-0 overflow-y-auto px-4 py-4 space-y-5">
            {visibleGroups.map((group) => (
              <SidebarGroup
                key={group.label}
                group={group}
                badgeCounts={badgeCounts}
              />
            ))}
          </div>

          <div className="border-t p-4 shrink-0 bg-white">
            <Button
              variant="outline"
              className="w-full justify-start rounded-xl"
              onClick={handleLogout}
            >
              <LogOut className="mr-2 h-4 w-4" />
              Logout
            </Button>
          </div>
        </aside>

        {mobileOpen && (
          <div className="fixed inset-0 z-40 lg:hidden">
            <div
              className="absolute inset-0 bg-black/40"
              onClick={() => setMobileOpen(false)}
            />
            <div className="absolute left-0 top-0 h-full w-72 bg-white shadow-xl flex flex-col">
              <div className="flex items-center justify-between border-b px-4 py-4 shrink-0">
                <div>
                  <div className="text-lg font-semibold">Admin Panel</div>
                  <div className="text-sm text-neutral-500">HRIS Management</div>
                </div>
                <button
                  type="button"
                  onClick={() => setMobileOpen(false)}
                  className="rounded-lg p-2 hover:bg-neutral-100"
                >
                  <X className="h-5 w-5" />
                </button>
              </div>

              <div className="flex-1 min-h-0 overflow-y-auto px-4 py-4 space-y-5">
                {visibleGroups.map((group) => (
                  <SidebarGroup
                    key={group.label}
                    group={group}
                    badgeCounts={badgeCounts}
                  />
                ))}
              </div>

              <div className="border-t p-4 shrink-0 bg-white">
                <Button
                  variant="outline"
                  className="w-full justify-start rounded-xl"
                  onClick={handleLogout}
                >
                  <LogOut className="mr-2 h-4 w-4" />
                  Logout
                </Button>
              </div>
            </div>
          </div>
        )}

        <div className="flex min-w-0 flex-1 flex-col h-screen">
          <header className="sticky top-0 z-30 border-b bg-white/90 backdrop-blur shrink-0">
            <div className="flex items-center justify-between px-4 py-3 lg:px-6">
              <div className="flex items-center gap-3">
                <button
                  type="button"
                  className="rounded-lg border p-2 hover:bg-neutral-100 lg:hidden"
                  onClick={() => setMobileOpen(true)}
                >
                  <Menu className="h-5 w-5" />
                </button>

                <div>
                  <div className="text-sm font-medium text-neutral-500">
                    Human Resource Information System
                  </div>
                  <div className="text-lg font-semibold text-neutral-900">
                    Admin Workspace
                  </div>
                </div>
              </div>

              <div className="flex items-center gap-2">
                {badgeCounts.leaveRequests > 0 ||
                badgeCounts.attendanceAdjustments > 0 ||
                badgeCounts.shiftChangeRequests > 0 ? (
                  <div className="hidden md:flex items-center gap-2">
                    {badgeCounts.leaveRequests > 0 && (
                      <Badge variant="warning">
                        {badgeCounts.leaveRequests} Pending Leave
                      </Badge>
                    )}
                    {badgeCounts.attendanceAdjustments > 0 && (
                      <Badge variant="warning">
                        {badgeCounts.attendanceAdjustments} Pending Adjustments
                      </Badge>
                    )}
                    {badgeCounts.shiftChangeRequests > 0 && (
                      <Badge variant="warning">
                        {badgeCounts.shiftChangeRequests} Pending Shift Changes
                      </Badge>
                    )}
                  </div>
                ) : null}

                <Button
                  variant="outline"
                  className="hidden rounded-xl md:inline-flex"
                  onClick={() => window.history.back()}
                >
                  Back
                </Button>
              </div>
            </div>
          </header>

          <main className="flex-1 min-h-0 overflow-y-auto p-4 lg:p-6">
            <div className="mx-auto max-w-7xl">{children}</div>
          </main>
        </div>
      </div>
    </div>
  );
}
