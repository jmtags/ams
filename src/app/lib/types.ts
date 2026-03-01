export interface User {
  id: string;
  name: string;
  email: string;
  department: string;
  role: 'user' | 'admin';
  sss: string;
  pagibig: string;
  philhealth: string;
  atmNumber: string;
  createdAt: string;
}

export interface AttendanceRecord {
  id: string;
  userId: string;
  clockIn: string;
  clockOut: string | null;
  date: string;
  status: 'present' | 'late' | 'absent';
  locationId: string;
}

export interface Department {
  id: string;
  name: string;
  description: string;
  createdAt: string;
}

export interface Location {
  id: string;
  name: string;
  address: string;
  latitude: number;
  longitude: number;
  createdAt: string;
}

export interface AuthState {
  user: User | null;
  isAuthenticated: boolean;
}

export interface LoginCredentials {
  email: string;
  password: string;
}

export interface ClockInOutPayload {
  userId: string;
  locationId: string;
  timestamp: string;
}
