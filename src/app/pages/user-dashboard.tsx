import { useEffect, useMemo, useState } from 'react';
import {
  Clock,
  LogIn,
  LogOut as LogOutIcon,
  FilePlus2,
  XCircle,
  Paperclip,
} from 'lucide-react';
import { useAuth } from '../hooks/useAuth';
import { UserLayout } from '../layouts/user-layout';
import { Button } from '../components/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '../components/ui/card';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '../components/ui/table';
import { Badge } from '../components/ui/badge';
import { attendanceService } from "../services/attendance.service";
import { locationService } from "../services/location.service";
import { leaveTypeService, LeaveType } from "../services/leave-type.service";
import { leaveBalanceService } from "../services/leave-balance.service";
import { leaveRequestService, LeaveRequest } from "../services/leave-request.service";
import type { AttendanceRecord, Location } from '../lib/types';
import { formatDate, formatTime, getGreeting } from '../lib/utils';

type UserLeaveBalance = {
  id: string;
  user_id: string;
  leave_type_id: string;
  year: number;
  entitled: number;
  used: number;
  pending: number;
  created_at: string;
  updated_at: string | null;
  leave_type_code: string;
  leave_type_name: string;
};

type LeaveFormState = {
  leave_type_id: string;
  date_from: string;
  date_to: string;
  is_half_day: boolean;
  half_day_portion: 'AM' | 'PM' | '';
  reason: string;
  attachment: File | null;
};

const initialLeaveForm: LeaveFormState = {
  leave_type_id: '',
  date_from: '',
  date_to: '',
  is_half_day: false,
  half_day_portion: '',
  reason: '',
  attachment: null,
};

export function UserDashboardPage() {
  const { user } = useAuth();
  const [currentTime, setCurrentTime] = useState(new Date());

  const [attendanceHistory, setAttendanceHistory] = useState<AttendanceRecord[]>([]);
  const [todayAttendance, setTodayAttendance] = useState<AttendanceRecord | null>(null);
  const [locations, setLocations] = useState<Location[]>([]);

  const [leaveTypes, setLeaveTypes] = useState<LeaveType[]>([]);
  const [leaveBalances, setLeaveBalances] = useState<UserLeaveBalance[]>([]);
  const [leaveRequests, setLeaveRequests] = useState<LeaveRequest[]>([]);

  const [leaveForm, setLeaveForm] = useState<LeaveFormState>(initialLeaveForm);

  const [isLoading, setIsLoading] = useState(false);
  const [isLeaveSubmitting, setIsLeaveSubmitting] = useState(false);
  const [cancellingId, setCancellingId] = useState<string | null>(null);

  const [error, setError] = useState('');
  const [leaveError, setLeaveError] = useState('');
  const [leaveSuccess, setLeaveSuccess] = useState('');

  useEffect(() => {
    const timer = setInterval(() => {
      setCurrentTime(new Date());
    }, 1000);

    return () => clearInterval(timer);
  }, []);

  useEffect(() => {
    loadAllData();
  }, [user]);

  const loadAllData = async () => {
    if (!user?.id) return;

    try {
      setIsLoading(true);
      setError('');

      const currentYear = new Date().getFullYear();

      const [history, today, locs, leaveTypeRows, balanceRows, requestRows] = await Promise.all([
        attendanceService.getAttendanceHistory(user.id, 10),
        attendanceService.getTodayAttendance(user.id),
        locationService.getAllLocations(),
        leaveTypeService.getAll(""),
        leaveBalanceService.getByUser(user.id, currentYear),
        leaveRequestService.getMyLeaveRequests(user.id),
      ]);

      setAttendanceHistory(history);
      setTodayAttendance(today);
      setLocations(locs);
      setLeaveTypes((leaveTypeRows ?? []).filter((item) => item.is_active));
      setLeaveBalances(balanceRows ?? []);
      setLeaveRequests(requestRows ?? []);
    } catch (err: any) {
      setError(err.message || 'Failed to load dashboard data.');
    } finally {
      setIsLoading(false);
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
    } catch (err) {
      console.error("Error loading attendance:", err);
    }
  };

  const refreshLeaveData = async () => {
    if (!user?.id) return;

    try {
      const currentYear = new Date().getFullYear();

      const [balanceRows, requestRows] = await Promise.all([
        leaveBalanceService.getByUser(user.id, currentYear),
        leaveRequestService.getMyLeaveRequests(user.id),
      ]);

      setLeaveBalances(balanceRows ?? []);
      setLeaveRequests(requestRows ?? []);
    } catch (err: any) {
      setLeaveError(err.message || 'Failed to refresh leave data.');
    }
  };

  const handleClockIn = async () => {
    if (!user?.id || !locations?.length) return;

    try {
      setIsLoading(true);
      setError('');

      const record = await attendanceService.clockIn(user.id, locations[0].id);
      setTodayAttendance(record);
      await loadAttendance();
    } catch (err: any) {
      setError(err.message || 'Failed to clock in.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleClockOut = async () => {
    if (!todayAttendance?.id) return;

    try {
      setIsLoading(true);
      setError('');

      const updated = await attendanceService.clockOut(todayAttendance.id);
      setTodayAttendance(updated);
      await loadAttendance();
    } catch (err: any) {
      setError(err.message || 'Failed to clock out.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleSubmitLeave = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!user?.id) return;

    try {
      setIsLeaveSubmitting(true);
      setLeaveError('');
      setLeaveSuccess('');

      const selectedLeaveType = leaveTypes.find(
        (item) => item.id === leaveForm.leave_type_id
      );

      if (!selectedLeaveType) {
        throw new Error('Please select a leave type.');
      }

      await leaveRequestService.create({
        user_id: user.id,
        leave_type_id: leaveForm.leave_type_id,
        date_from: leaveForm.date_from,
        date_to: leaveForm.date_to,
        is_half_day: leaveForm.is_half_day,
        half_day_portion: leaveForm.is_half_day
          ? (leaveForm.half_day_portion as 'AM' | 'PM')
          : null,
        reason: leaveForm.reason,
        attachment: leaveForm.attachment,
      });

      setLeaveForm(initialLeaveForm);
      setLeaveSuccess('Leave request filed successfully.');
      await refreshLeaveData();
    } catch (err: any) {
      setLeaveError(err.message || 'Failed to file leave request.');
    } finally {
      setIsLeaveSubmitting(false);
    }
  };

  const handleCancelLeave = async (requestId: string) => {
    if (!user?.id) return;

    try {
      setCancellingId(requestId);
      setLeaveError('');
      setLeaveSuccess('');

      await leaveRequestService.cancelLeaveRequest(requestId, user.id);
      setLeaveSuccess('Leave request cancelled successfully.');
      await refreshLeaveData();
    } catch (err: any) {
      setLeaveError(err.message || 'Failed to cancel leave request.');
    } finally {
      setCancellingId(null);
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

  const getLeaveStatusBadgeVariant = (status: string) => {
    switch (status) {
      case 'approved':
        return 'success';
      case 'pending':
        return 'warning';
      case 'rejected':
        return 'danger';
      case 'cancelled':
        return 'secondary';
      default:
        return 'default';
    }
  };

  const selectedLeaveType = useMemo(
    () => leaveTypes.find((item) => item.id === leaveForm.leave_type_id),
    [leaveTypes, leaveForm.leave_type_id]
  );

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
                    disabled={isLoading || todayAttendance?.clockIn !== undefined}
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

        <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <FilePlus2 className="w-5 h-5" />
                File Leave
              </CardTitle>
              <CardDescription>
                Select leave type, choose date, choose whole day or half day, enter reason, and upload attachment if required.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleSubmitLeave} className="space-y-4">
                {(leaveError || leaveSuccess) && (
                  <div className="space-y-2">
                    {leaveError && (
                      <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg text-sm">
                        {leaveError}
                      </div>
                    )}
                    {leaveSuccess && (
                      <div className="bg-green-50 border border-green-200 text-green-700 px-4 py-3 rounded-lg text-sm">
                        {leaveSuccess}
                      </div>
                    )}
                  </div>
                )}

                <div>
                  <label className="block text-sm text-neutral-700 mb-2">Leave Type</label>
                  <select
                    value={leaveForm.leave_type_id}
                    onChange={(e) =>
                      setLeaveForm((prev) => ({
                        ...prev,
                        leave_type_id: e.target.value,
                      }))
                    }
                    className="w-full rounded-lg border border-neutral-300 px-3 py-2 text-sm"
                    required
                  >
                    <option value="">Select leave type</option>
                    {leaveTypes.map((type) => (
                      <option key={type.id} value={type.id}>
                        {type.code} - {type.name}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm text-neutral-700 mb-2">Date From</label>
                    <input
                      type="date"
                      value={leaveForm.date_from}
                      onChange={(e) =>
                        setLeaveForm((prev) => ({
                          ...prev,
                          date_from: e.target.value,
                          date_to: prev.is_half_day ? e.target.value : prev.date_to,
                        }))
                      }
                      className="w-full rounded-lg border border-neutral-300 px-3 py-2 text-sm"
                      required
                    />
                  </div>

                  <div>
                    <label className="block text-sm text-neutral-700 mb-2">Date To</label>
                    <input
                      type="date"
                      value={leaveForm.date_to}
                      onChange={(e) =>
                        setLeaveForm((prev) => ({
                          ...prev,
                          date_to: e.target.value,
                        }))
                      }
                      disabled={leaveForm.is_half_day}
                      className="w-full rounded-lg border border-neutral-300 px-3 py-2 text-sm"
                      required
                    />
                  </div>
                </div>

                <div className="flex flex-wrap gap-6">
                  <label className="flex items-center gap-2 text-sm text-neutral-700">
                    <input
                      type="radio"
                      checked={!leaveForm.is_half_day}
                      onChange={() =>
                        setLeaveForm((prev) => ({
                          ...prev,
                          is_half_day: false,
                          half_day_portion: '',
                        }))
                      }
                    />
                    Whole Day
                  </label>

                  <label className="flex items-center gap-2 text-sm text-neutral-700">
                    <input
                      type="radio"
                      checked={leaveForm.is_half_day}
                      onChange={() =>
                        setLeaveForm((prev) => ({
                          ...prev,
                          is_half_day: true,
                          date_to: prev.date_from,
                        }))
                      }
                    />
                    Half Day
                  </label>
                </div>

                {leaveForm.is_half_day && (
                  <div>
                    <label className="block text-sm text-neutral-700 mb-2">Half Day Portion</label>
                    <select
                      value={leaveForm.half_day_portion}
                      onChange={(e) =>
                        setLeaveForm((prev) => ({
                          ...prev,
                          half_day_portion: e.target.value as 'AM' | 'PM',
                        }))
                      }
                      className="w-full rounded-lg border border-neutral-300 px-3 py-2 text-sm"
                      required
                    >
                      <option value="">Select AM or PM</option>
                      <option value="AM">AM</option>
                      <option value="PM">PM</option>
                    </select>
                  </div>
                )}

                <div>
                  <label className="block text-sm text-neutral-700 mb-2">Reason</label>
                  <textarea
                    value={leaveForm.reason}
                    onChange={(e) =>
                      setLeaveForm((prev) => ({
                        ...prev,
                        reason: e.target.value,
                      }))
                    }
                    rows={4}
                    className="w-full rounded-lg border border-neutral-300 px-3 py-2 text-sm"
                    placeholder="Enter your reason for leave"
                    required
                  />
                </div>

                <div>
                  <label className="block text-sm text-neutral-700 mb-2">
                    Attachment
                    {selectedLeaveType?.requires_attachment ? ' (Required)' : ' (Optional)'}
                  </label>
                  <input
                    type="file"
                    onChange={(e) =>
                      setLeaveForm((prev) => ({
                        ...prev,
                        attachment: e.target.files?.[0] ?? null,
                      }))
                    }
                    className="w-full rounded-lg border border-neutral-300 px-3 py-2 text-sm"
                  />
                  {leaveForm.attachment && (
                    <p className="mt-2 text-xs text-neutral-500">
                      Selected file: {leaveForm.attachment.name}
                    </p>
                  )}
                </div>

                <div className="flex justify-end">
                  <Button type="submit" disabled={isLeaveSubmitting}>
                    {isLeaveSubmitting ? 'Submitting...' : 'Submit Leave Request'}
                  </Button>
                </div>
              </form>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>My Leave Balances</CardTitle>
              <CardDescription>Your current leave credits for this year</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {leaveBalances.length === 0 ? (
                  <div className="text-sm text-neutral-500">No leave balances found.</div>
                ) : (
                  leaveBalances.map((item) => {
                    const available = item.entitled - item.used - item.pending;

                    return (
                      <div
                        key={item.id}
                        className="rounded-lg border border-neutral-200 p-4 bg-neutral-50"
                      >
                        <div className="flex items-center justify-between mb-2">
                          <div>
                            <p className="text-sm font-medium text-neutral-900">
                              {item.leave_type_name}
                            </p>
                            <p className="text-xs text-neutral-500">
                              {item.leave_type_code} • {item.year}
                            </p>
                          </div>
                          <Badge>{available} Available</Badge>
                        </div>

                        <div className="grid grid-cols-3 gap-3 text-sm">
                          <div>
                            <p className="text-neutral-500">Entitled</p>
                            <p className="text-neutral-900">{item.entitled}</p>
                          </div>
                          <div>
                            <p className="text-neutral-500">Used</p>
                            <p className="text-neutral-900">{item.used}</p>
                          </div>
                          <div>
                            <p className="text-neutral-500">Pending</p>
                            <p className="text-neutral-900">{item.pending}</p>
                          </div>
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            </CardContent>
          </Card>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>My Leave Requests</CardTitle>
            <CardDescription>
              View and manage your filed leaves. Pending requests may be cancelled.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Leave Type</TableHead>
                  <TableHead>Date From</TableHead>
                  <TableHead>Date To</TableHead>
                  <TableHead>Duration</TableHead>
                  <TableHead>Reason</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Attachment</TableHead>
                  <TableHead>Remarks</TableHead>
                  <TableHead>Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {leaveRequests.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={9} className="text-center text-neutral-500 py-8">
                      No leave requests found
                    </TableCell>
                  </TableRow>
                ) : (
                  leaveRequests.map((request) => (
                    <TableRow key={request.id}>
                      <TableCell>
                        <div className="font-medium">{request.leave_type_name}</div>
                        <div className="text-xs text-neutral-500">{request.leave_type_code}</div>
                      </TableCell>
                      <TableCell>{formatDate(request.date_from)}</TableCell>
                      <TableCell>{formatDate(request.date_to)}</TableCell>
                      <TableCell>
                        {request.is_half_day
                          ? `0.5 day (${request.half_day_portion})`
                          : `${request.total_days} day(s)`}
                      </TableCell>
                      <TableCell className="max-w-[220px] truncate">
                        {request.reason || '-'}
                      </TableCell>
                      <TableCell>
                        <Badge variant={getLeaveStatusBadgeVariant(request.status)}>
                          {request.status}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        {request.attachment_url ? (
                          <a
                            href={request.attachment_url}
                            target="_blank"
                            rel="noreferrer"
                            className="inline-flex items-center gap-1 text-sm text-blue-600 hover:underline"
                          >
                            <Paperclip className="w-4 h-4" />
                            View
                          </a>
                        ) : (
                          '-'
                        )}
                      </TableCell>
                      <TableCell>{request.approver_remarks || '-'}</TableCell>
                      <TableCell>
                        {request.status === 'pending' ? (
                          <Button
                            variant="outline"
                            size="sm"
                            disabled={cancellingId === request.id}
                            onClick={() => handleCancelLeave(request.id)}
                            className="flex items-center gap-2"
                          >
                            <XCircle className="w-4 h-4" />
                            {cancellingId === request.id ? 'Cancelling...' : 'Cancel'}
                          </Button>
                        ) : (
                          '-'
                        )}
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </CardContent>
        </Card>

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