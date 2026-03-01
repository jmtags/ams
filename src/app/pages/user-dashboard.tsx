import { useState, useEffect } from 'react';
import { Clock, LogIn, LogOut as LogOutIcon } from 'lucide-react';
import { useAuth } from '../hooks/useAuth';
import { UserLayout } from '../layouts/user-layout';
import { Button } from '../components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '../components/ui/table';
import { Badge } from '../components/ui/badge';
import { attendanceService } from "../services/attendance.service";
import { locationService } from "../services/location.service";
import type { AttendanceRecord, Location } from '../lib/types';
import { formatDate, formatTime, getGreeting } from '../lib/utils';

export function UserDashboardPage() {
  const { user } = useAuth();
  const [currentTime, setCurrentTime] = useState(new Date());
  const [attendanceHistory, setAttendanceHistory] = useState<AttendanceRecord[]>([]);
  const [todayAttendance, setTodayAttendance] = useState<AttendanceRecord | null>(null);
  const [locations, setLocations] = useState<Location[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    const timer = setInterval(() => {
      setCurrentTime(new Date());
    }, 1000);

    return () => clearInterval(timer);
  }, []);

  useEffect(() => {
    loadData();
  }, [user]);

  useEffect(() => {
  loadAttendance();
}, [user]);

 const loadData = async () => {
  if (!user?.id) return;

  try {
    const [history, today, locs] = await Promise.all([
      attendanceService.getAttendanceHistory(user.id, 10),
      attendanceService.getTodayAttendance(user.id),
      locationService.getAllLocations(),
    ]);

    setAttendanceHistory(history);
    setTodayAttendance(today);
    setLocations(locs);
  } catch (err) {
    console.error("Error loading data:", err);
  }
};

const loadAttendance = async () => {
  if (!user?.id) return;

  try {
    const [history, today] = await Promise.all([
      attendanceService.getAttendanceHistory(user.id, 10),
      attendanceService.getTodayAttendance(user.id),
    ]);

    setAttendanceHistory(history);
    setTodayAttendance(today);
  } catch (error) {
    console.error("Error loading attendance:", error);
  }
};


const handleClockIn = async () => {
  if (!user?.id || !locations?.length) return;

  const record = await attendanceService.clockIn(
    user.id,
    locations[0].id
  );

  setTodayAttendance(record); // update immediately
  await loadAttendance();
};


const handleClockOut = async () => {
  if (!todayAttendance?.id) return;

  const updated = await attendanceService.clockOut(todayAttendance.id);

  setTodayAttendance(updated);
  await loadAttendance();
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

  return (
    <UserLayout>
      <div className="space-y-6">
        <div>
          <h1 className="text-neutral-900 mb-1">
            {getGreeting()}, {user?.name}
          </h1>
          <p className="text-neutral-600">Welcome back to your dashboard</p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <Card className="lg:col-span-2">
            <CardHeader>
              <CardTitle>Clock In / Out</CardTitle>
              <CardDescription>Record your attendance for today</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-6">
                <div className="flex items-center justify-center py-8">
                  <div className="text-center">
                    <Clock className="w-12 h-12 text-neutral-400 mx-auto mb-4" />
                    <div className="text-4xl text-neutral-900 mb-2">
                      {currentTime.toLocaleTimeString('en-US', {
                        hour: '2-digit',
                        minute: '2-digit',
                        second: '2-digit',
                        hour12: true,
                      })}
                    </div>
                    <div className="text-sm text-neutral-600">
                      {currentTime.toLocaleDateString('en-US', {
                        weekday: 'long',
                        year: 'numeric',
                        month: 'long',
                        day: 'numeric',
                      })}
                    </div>
                  </div>
                </div>

                {error && (
                  <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg text-sm">
                    {error}
                  </div>
                )}

                <div className="flex gap-4">
                  <Button
                    onClick={handleClockIn}
                    disabled={isLoading || (todayAttendance?.clockIn !== undefined)}
                    className="flex-1 flex items-center justify-center gap-2"
                  >
                    <LogIn className="w-4 h-4" />
                    Clock In
                  </Button>
                  <Button
                    onClick={handleClockOut}
                    disabled={isLoading || !todayAttendance?.clockIn || todayAttendance?.clockOut !== null}
                    variant="secondary"
                    className="flex-1 flex items-center justify-center gap-2"
                  >
                    <LogOutIcon className="w-4 h-4" />
                    Clock Out
                  </Button>
                </div>

                {todayAttendance && (
                  <div className="bg-neutral-50 rounded-lg p-4 space-y-2">
                    <p className="text-sm text-neutral-600">Today's Status</p>
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <p className="text-xs text-neutral-500 mb-1">Clock In</p>
                        <p className="text-sm text-neutral-900">{formatTime(todayAttendance.clockIn)}</p>
                      </div>
                      <div>
                        <p className="text-xs text-neutral-500 mb-1">Clock Out</p>
                        <p className="text-sm text-neutral-900">
                          {todayAttendance.clockOut ? formatTime(todayAttendance.clockOut) : 'Not yet'}
                        </p>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Quick Stats</CardTitle>
              <CardDescription>Your attendance overview</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <div className="bg-neutral-50 rounded-lg p-4">
                  <p className="text-sm text-neutral-600 mb-1">Present Days</p>
                  <p className="text-2xl text-neutral-900">
                    {attendanceHistory.filter((r) => r.status === 'present').length}
                  </p>
                </div>
                <div className="bg-neutral-50 rounded-lg p-4">
                  <p className="text-sm text-neutral-600 mb-1">Late Days</p>
                  <p className="text-2xl text-neutral-900">
                    {attendanceHistory.filter((r) => r.status === 'late').length}
                  </p>
                </div>
                <div className="bg-neutral-50 rounded-lg p-4">
                  <p className="text-sm text-neutral-600 mb-1">Total Records</p>
                  <p className="text-2xl text-neutral-900">{attendanceHistory.length}</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Attendance History</CardTitle>
            <CardDescription>Your recent attendance records</CardDescription>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Date</TableHead>
                  <TableHead>Clock In</TableHead>
                  <TableHead>Clock Out</TableHead>
                  <TableHead>Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {attendanceHistory.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={4} className="text-center text-neutral-500 py-8">
                      No attendance records found
                    </TableCell>
                  </TableRow>
                ) : (
                  attendanceHistory.map((record) => (
                    <TableRow key={record.id}>
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
    </UserLayout>
  );
}
