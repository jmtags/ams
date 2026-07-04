
export type User = {
  id: string;
  name: string | null;
  email: string | null;
  department: string | null;
  role: "user" | "admin" | "hr" | "payroll" ;
  shift_id?: string | null;
  shift_name?: string | null;
  sss?: string | null;
  pagibig?: string | null;
  philhealth?: string | null;
  atm_number?: string | null;
  profile_picture_url?: string | null;
  profile_picture_path?: string | null;
};
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
