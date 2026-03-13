import { ReactNode, useMemo, useState } from "react";

import { Link, useNavigate,NavLink, useLocation } from 'react-router';
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
  ChevronDown,
  Menu,
  X,
  Settings,
  LogOut,
} from "lucide-react";

import { Button } from "../components/ui/button";
import { cn } from "../lib/utils";
import { supabase } from "../lib/supabase";

type AdminLayoutProps = {
  children: ReactNode;
};

type NavItem = {
  label: string;
  to: string;
  icon: ReactNode;
};

type NavGroup = {
  label: string;
  items: NavItem[];
};

const navGroups: NavGroup[] = [
  {
    label: "Overview",
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
    items: [
      {
        label: "Attendance",
        to: "/admin/attendance",
        icon: <Clock3 className="h-4 w-4" />,
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
      },
    ],
  },
  {
    label: "Payroll",
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
        label: "Recurring Deductions",
        to: "/admin/recurring-deductions",
        icon: <Wallet className="h-4 w-4" />,
      },
      {
        label: "Payroll Settings",
        to: "/admin/payroll-settings",
        icon: <Settings className="h-4 w-4" />,
      },
    ],
  },
  {
    label: "System",
    items: [
      {
        label: "Settings",
        to: "/admin/settings",
        icon: <Settings className="h-4 w-4" />,
      },
    ],
  },
];

function SidebarLink({ item }: { item: NavItem }) {
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
      <span>{item.label}</span>
    </NavLink>
  );
}

function SidebarGroup({
  group,
  defaultOpen = true,
}: {
  group: NavGroup;
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
          {group.items.map((item) => (
            <SidebarLink key={item.to} item={item} />
          ))}
        </div>
      )}
    </div>
  );
}

export function AdminLayout({ children }: AdminLayoutProps) {
  const [mobileOpen, setMobileOpen] = useState(false);

  const handleLogout = async () => {
    await supabase.auth.signOut();
    window.location.href = "/";
  };

  return (
    <div className="min-h-screen bg-neutral-50">
      <div className="flex min-h-screen">
        <aside className="hidden w-72 shrink-0 border-r bg-white lg:flex lg:flex-col">
          <div className="border-b px-6 py-5">
            <div className="text-lg font-semibold">Admin Panel</div>
            <div className="text-sm text-neutral-500">HRIS Management</div>
          </div>

          <div className="flex-1 overflow-y-auto px-4 py-4 space-y-5">
            {navGroups.map((group) => (
              <SidebarGroup key={group.label} group={group} />
            ))}
          </div>

          <div className="border-t p-4">
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
            <div className="absolute left-0 top-0 h-full w-72 bg-white shadow-xl">
              <div className="flex items-center justify-between border-b px-4 py-4">
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

              <div className="space-y-5 overflow-y-auto px-4 py-4">
                {navGroups.map((group) => (
                  <SidebarGroup key={group.label} group={group} />
                ))}
              </div>

              <div className="border-t p-4">
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

        <div className="flex min-w-0 flex-1 flex-col">
          <header className="sticky top-0 z-30 border-b bg-white/90 backdrop-blur">
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

          <main className="flex-1 p-4 lg:p-6">
            <div className="mx-auto max-w-7xl">{children}</div>
          </main>
        </div>
      </div>
    </div>
  );
}