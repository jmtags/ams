import { useState, useEffect } from 'react';
import { Users, Building2, MapPin, Clock } from 'lucide-react';
import { AdminLayout } from '../layouts/admin-layout';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '../components/ui/table';
import { Badge } from '../components/ui/badge';
import { userService } from '../services/user.service';
import { departmentService } from '../services/department.service';
import { locationService } from '../services/location.service';
import { attendanceService } from '../services/attendance.service';
import type { User, Department, Location, AttendanceRecord } from '../lib/types';
import { formatDate, formatTime } from '../lib/utils';

export function AdminDashboardPage() {
  const [users, setUsers] = useState<User[]>([]);
  const [departments, setDepartments] = useState<Department[]>([]);
  const [locations, setLocations] = useState<Location[]>([]);
  const [recentAttendance, setRecentAttendance] = useState<AttendanceRecord[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    setIsLoading(true);
    try {
      const [usersData, departmentsData, locationsData, attendanceData] = await Promise.all([
        userService.getAllUsers(),
        departmentService.getAllDepartments(),
        locationService.getAllLocations(),
        attendanceService.getAllAttendance(),
      ]);

      setUsers(usersData);
      setDepartments(departmentsData);
      setLocations(locationsData);
      setRecentAttendance(attendanceData.slice(0, 10));
    } catch (error) {
      console.error('Error loading dashboard data:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const getStatusBadgeVariant = (status: string) => {
    switch (status) {
      case 'present':
        return 'success';
      case 'late':
        return 'warning';
      case 'absent':
        return 'danger';
      default:
        return 'default';
    }
  };

  const getUserName = (userId: string) => {
    const user = users.find((u) => u.id === userId);
    return user?.name || 'Unknown';
  };

  if (isLoading) {
    return (
      <AdminLayout>
        <div className="flex items-center justify-center h-64">
          <p className="text-neutral-600">Loading...</p>
        </div>
      </AdminLayout>
    );
  }

  return (
    <AdminLayout>
      <div className="space-y-6">
        <div>
          <h1 className="text-neutral-900 mb-1">Dashboard</h1>
          <p className="text-neutral-600">Overview of your attendance monitoring system</p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-neutral-600 mb-1">Total Users</p>
                  <p className="text-3xl text-neutral-900">{users.length}</p>
                </div>
                <div className="w-12 h-12 bg-neutral-100 rounded-lg flex items-center justify-center">
                  <Users className="w-6 h-6 text-neutral-700" />
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-neutral-600 mb-1">Departments</p>
                  <p className="text-3xl text-neutral-900">{departments.length}</p>
                </div>
                <div className="w-12 h-12 bg-neutral-100 rounded-lg flex items-center justify-center">
                  <Building2 className="w-6 h-6 text-neutral-700" />
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-neutral-600 mb-1">Locations</p>
                  <p className="text-3xl text-neutral-900">{locations.length}</p>
                </div>
                <div className="w-12 h-12 bg-neutral-100 rounded-lg flex items-center justify-center">
                  <MapPin className="w-6 h-6 text-neutral-700" />
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-neutral-600 mb-1">Today's Records</p>
                  <p className="text-3xl text-neutral-900">
                    {recentAttendance.filter((r) => r.date === new Date().toISOString().split('T')[0]).length}
                  </p>
                </div>
                <div className="w-12 h-12 bg-neutral-100 rounded-lg flex items-center justify-center">
                  <Clock className="w-6 h-6 text-neutral-700" />
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Recent Attendance</CardTitle>
            <CardDescription>Latest attendance records across all users</CardDescription>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Employee</TableHead>
                  <TableHead>Date</TableHead>
                  <TableHead>Clock In</TableHead>
                  <TableHead>Clock Out</TableHead>
                  <TableHead>Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {recentAttendance.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={5} className="text-center text-neutral-500 py-8">
                      No attendance records found
                    </TableCell>
                  </TableRow>
                ) : (
                  recentAttendance.map((record) => (
                    <TableRow key={record.id}>
                      <TableCell>{getUserName(record.userId)}</TableCell>
                      <TableCell>{formatDate(record.date)}</TableCell>
                      <TableCell>{formatTime(record.clockIn)}</TableCell>
                      <TableCell>{record.clockOut ? formatTime(record.clockOut) : '-'}</TableCell>
                      <TableCell>
                        <Badge variant={getStatusBadgeVariant(record.status)}>
                          {record.status}
                        </Badge>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </div>
    </AdminLayout>
  );
}
