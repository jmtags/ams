import { ReactNode } from 'react';
import { Link, useNavigate, useLocation } from 'react-router';
import {
  LayoutDashboard,
  Users,
  Building2,
  MapPin,
  Clock3,
  CalendarDays,
  LogOut,
  User,
  FileText,
  Tags,
  Wallet,
  ClipboardList,
} from 'lucide-react';
import { useAuth } from '../hooks/useAuth';
import { Button } from '../components/ui/button';
import { cn } from '../lib/utils';

interface AdminLayoutProps {
  children: ReactNode;
}

const mainNavigationItems = [
  { name: 'Dashboard', href: '/admin', icon: LayoutDashboard },
  { name: 'User Management', href: '/admin/users', icon: Users },
  { name: 'Departments', href: '/admin/departments', icon: Building2 },
  { name: 'Locations', href: '/admin/locations', icon: MapPin },
  { name: 'Shift Management', href: '/admin/shifts', icon: Clock3 },
  { name: 'Holidays', href: '/admin/holidays', icon: CalendarDays },
];

const leaveNavigationItems = [
  { name: 'Leave Types', href: '/admin/leave-types', icon: Tags },
  { name: 'Leave Balances', href: '/admin/leave-balances', icon: Wallet },
  { name: 'Leave Requests', href: '/admin/leave-requests', icon: ClipboardList },
];

export function AdminLayout({ children }: AdminLayoutProps) {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  const handleLogout = async () => {
    await logout();
    navigate('/login');
  };

  return (
    <div className="min-h-screen bg-neutral-50">
      <div className="flex h-screen">
        <aside className="w-64 bg-white border-r border-neutral-200 flex flex-col">
          <div className="p-6 border-b border-neutral-200">
            <h1 className="text-xl text-neutral-900 font-semibold">Admin Panel</h1>
          </div>

          <nav className="flex-1 p-4 overflow-y-auto">
            <div className="space-y-1">
              {mainNavigationItems.map((item) => {
                const Icon = item.icon;
                const isActive = location.pathname === item.href;

                return (
                  <Link
                    key={item.name}
                    to={item.href}
                    className={cn(
                      'flex items-center gap-3 px-3 py-2 rounded-lg transition-colors',
                      isActive
                        ? 'bg-neutral-900 text-white'
                        : 'text-neutral-700 hover:bg-neutral-100'
                    )}
                  >
                    <Icon className="w-5 h-5" />
                    <span>{item.name}</span>
                  </Link>
                );
              })}
            </div>

            <div className="mt-6">
              <div className="flex items-center gap-2 px-3 py-2 text-xs font-semibold uppercase tracking-wide text-neutral-500">
                <FileText className="w-4 h-4" />
                <span>Leaves</span>
              </div>

              <div className="mt-1 space-y-1">
                {leaveNavigationItems.map((item) => {
                  const Icon = item.icon;
                  const isActive = location.pathname === item.href;

                  return (
                    <Link
                      key={item.name}
                      to={item.href}
                      className={cn(
                        'flex items-center gap-3 px-3 py-2 rounded-lg transition-colors',
                        isActive
                          ? 'bg-neutral-900 text-white'
                          : 'text-neutral-700 hover:bg-neutral-100'
                      )}
                    >
                      <Icon className="w-5 h-5" />
                      <span>{item.name}</span>
                    </Link>
                  );
                })}
              </div>
            </div>
          </nav>

          <div className="p-4 border-t border-neutral-200">
            <div className="flex items-center gap-2 px-3 py-2 text-sm text-neutral-700 mb-2">
              <User className="w-4 h-4" />
              <span>{user?.name}</span>
            </div>

            <Button
              variant="outline"
              size="sm"
              onClick={handleLogout}
              className="w-full flex items-center justify-center gap-2"
            >
              <LogOut className="w-4 h-4" />
              Logout
            </Button>
          </div>
        </aside>

        <main className="flex-1 overflow-auto">
          <div className="p-8">{children}</div>
        </main>
      </div>
    </div>
  );
}