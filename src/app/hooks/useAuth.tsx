import { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import type { User, LoginCredentials, AuthState } from '../lib/types';
import { authService } from '../services/auth.service';

type AppRole = "user" | "admin" | "hr" | "payroll"; // ✅ ADD THIS

interface AuthContextType extends AuthState {
  login: (credentials: LoginCredentials) => Promise<User>;
  logout: () => Promise<void>;
  updateUser: (updates: Partial<User>) => void;
  isLoading: boolean;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [authState, setAuthState] = useState<AuthState>({
    user: null,
    isAuthenticated: false,
  });

  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const storedUser = localStorage.getItem('user');

    if (storedUser) {
      try {
        const user: User = JSON.parse(storedUser);

        // ✅ ENSURE ROLE FALLBACK
        const normalizedUser: User = {
          ...user,
          role: (user.role || 'user') as AppRole,
        };

        setAuthState({ user: normalizedUser, isAuthenticated: true });
      } catch (error) {
        console.error('Error parsing stored user:', error);
        localStorage.removeItem('user');
      }
    }

    setIsLoading(false);
  }, []);

  const login = async (credentials: LoginCredentials): Promise<User> => {
    setIsLoading(true);

    try {
      const user = await authService.login(credentials);

      if (!user) {
        throw new Error('No user returned from login');
      }

      // ✅ ENSURE ROLE SAFE
      const normalizedUser: User = {
        ...user,
        role: (user.role || 'user') as AppRole,
      };

      localStorage.setItem('user', JSON.stringify(normalizedUser));
      setAuthState({ user: normalizedUser, isAuthenticated: true });

      return normalizedUser;
    } catch (error) {
      console.error('Login error:', error);
      throw error;
    } finally {
      setIsLoading(false);
    }
  };

  const logout = async () => {
    await authService.logout();
    localStorage.removeItem('user');
    setAuthState({ user: null, isAuthenticated: false });
  };

  const updateUser = (updates: Partial<User>) => {
    if (authState.user) {
      const updatedUser: User = {
        ...authState.user,
        ...updates,
        role: (updates.role || authState.user.role) as AppRole, // ✅ SAFE ROLE UPDATE
      };

      localStorage.setItem('user', JSON.stringify(updatedUser));
      setAuthState({ user: updatedUser, isAuthenticated: true });
    }
  };

  return (
    <AuthContext.Provider
      value={{
        ...authState,
        login,
        logout,
        updateUser,
        isLoading,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);

  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }

  return context;
}