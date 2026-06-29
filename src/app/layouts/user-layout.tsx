import { useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router';
import {
  LayoutDashboard,
  User,
  Wallet,
  CalendarClock,
  CalendarDays,
  BookOpen,
  Menu,
  X,
  LogOut,
} from 'lucide-react';

import { useAuth } from '../hooks/useAuth';
import { Button } from '../components/ui/button';

type UserLayoutProps = {
  children: React.ReactNode;
};

const navigation = [
  {
    name: 'Dashboard',
    href: '/dashboard',
    icon: LayoutDashboard,
  },
  {
    name: 'Profile',
    href: '/profile',
    icon: User,
  },
  {
    name: 'My Payroll',
    href: '/my-payroll',
    icon: Wallet,
  },
  {
    name: 'My Leave',
    href: '/my-leave',
    icon: CalendarDays,
  },
  {
    name: 'Company Policies',
    href: '/policies',
    icon: BookOpen,
  },
  {
    name: 'Shift Change',
    href: '/shift-change-requests',
    icon: CalendarClock,
  },
];

export function UserLayout({ children }: UserLayoutProps) {
  const location = useLocation();
  const navigate = useNavigate();
  const { user, logout } = useAuth();
  const [sidebarOpen, setSidebarOpen] = useState(false);

  const handleLogout = async () => {
    try {
      await logout();
      navigate('/login');
    } catch (error) {
      console.error('Logout failed:', error);
    }
  };

  const isActiveRoute = (href: string) => {
    if (href === '/dashboard') {
      return location.pathname === '/dashboard';
    }

    if (href === '/my-payroll') {
      return (
        location.pathname === '/my-payroll' ||
        location.pathname.startsWith('/my-payroll/')
      );
    }

    if (href === '/shift-change-requests') {
      return location.pathname === '/shift-change-requests';
    }

    return location.pathname === href;
  };

  const currentPage =
    navigation.find((item) => isActiveRoute(item.href))?.name ??
    'Employee Portal';

  return (
    <div className="min-h-screen bg-neutral-100/70 flex">
      {sidebarOpen && (
        <div
          className="fixed inset-0 z-40 bg-black/40 lg:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      <aside
        className={`
          fixed lg:static inset-y-0 left-0 z-50
          w-64 bg-white border-r border-neutral-200 shadow-2xl lg:shadow-none
          transform transition-transform duration-200 ease-in-out
          ${sidebarOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'}
        `}
      >
        <div className="h-16 px-6 border-b border-neutral-200 flex items-center justify-between">
          <div>
            <h1 className="text-lg font-semibold text-neutral-900">HRIS</h1>
            <p className="text-xs text-neutral-500">Employee Portal</p>
          </div>

          <button
            type="button"
            className="lg:hidden text-neutral-600 hover:text-neutral-900"
            onClick={() => setSidebarOpen(false)}
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="px-4 py-4 border-b border-neutral-200">
          <p className="text-sm font-medium text-neutral-900 truncate">
            {user?.name || 'User'}
          </p>
          <p className="text-xs text-neutral-500 truncate">
            {user?.email || ''}
          </p>
          <p className="text-xs text-neutral-400 capitalize mt-1">
            {user?.role || 'user'}
          </p>
        </div>

        <nav className="p-4 pb-24 space-y-1 overflow-y-auto">
          {navigation.map((item) => {
            const Icon = item.icon;
            const active = isActiveRoute(item.href);

            return (
              <Link
                key={item.name}
                to={item.href}
                onClick={() => setSidebarOpen(false)}
                className={`
                  flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all
                  ${
                    active
                      ? 'bg-neutral-900 text-white shadow-sm'
                      : 'text-neutral-700 hover:bg-neutral-100'
                  }
                `}
              >
                <Icon className="w-4 h-4" />
                <span>{item.name}</span>
              </Link>
            );
          })}
        </nav>

        <div className="absolute bottom-0 left-0 right-0 p-4 border-t border-neutral-200 bg-white">
          <Button
            variant="outline"
            onClick={handleLogout}
            className="w-full flex items-center justify-center gap-2"
          >
            <LogOut className="w-4 h-4" />
            Logout
          </Button>
        </div>
      </aside>

      <div className="flex-1 min-w-0 flex flex-col">
        <header className="sticky top-0 z-30 h-16 bg-white/85 backdrop-blur-xl border-b border-neutral-200/80 flex items-center justify-between px-4 lg:px-6">
          <div className="flex items-center gap-3">
            <button
              type="button"
              className="lg:hidden text-neutral-700 hover:text-neutral-900"
              onClick={() => setSidebarOpen(true)}
            >
              <Menu className="w-5 h-5" />
            </button>

            <div>
              <h2 className="text-base font-semibold text-neutral-900">
                {currentPage}
              </h2>
              <p className="text-xs text-neutral-500">
                Manage your attendance, leave, and payroll
              </p>
            </div>
          </div>

          <div className="text-right hidden sm:block">
            <p className="text-sm font-medium text-neutral-900">
              {user?.name || 'User'}
            </p>
            <p className="text-xs text-neutral-500 capitalize">
              {user?.role || 'user'}
            </p>
          </div>
        </header>

        <main className="flex-1 p-3 sm:p-5 lg:p-7 overflow-x-hidden">
          {children}
        </main>
      </div>
    </div>
  );
}
