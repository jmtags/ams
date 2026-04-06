import { useState, useEffect, FormEvent } from "react";
import { Plus, Pencil, Trash2 } from "lucide-react";
import { AdminLayout } from "../layouts/admin-layout";
import { Button } from "../components/ui/button";
import { Input } from "../components/ui/input";
import { Select } from "../components/ui/select";
import { Card, CardContent } from "../components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "../components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogBody,
  DialogFooter,
} from "../components/ui/dialog";
import { manualAttendanceService } from "../services/manual-attendance.service";
import { formatDate } from "../lib/utils";

type UserOption = {
  id: string;
  name: string;
  email?: string;
  department?: string;
  shift_id?: string;
  shifts?: any;
};

type ShiftOption = {
  id: string;
  name: string;
  start_time: string;
  end_time: string;
  grace_minutes?: number;
  overtime_after_minutes?: number;
  location_id?: string;
  locations?: {
    id: string;
    name: string;
  };
};

type AttendanceRecord = {
  id: string;
  user_id: string;
  date: string;
  clock_in: string | null;
  clock_out: string | null;
  status: string;
  remarks?: string | null;
  minutes_late?: number;
  minutes_overtime?: number;
  is_late?: boolean;
  is_overtime?: boolean;
  scheduled_start?: string | null;
  scheduled_end?: string | null;
  shift_id?: string | null;
  location_id?: string | null;
  users?: {
    id: string;
    name: string;
    email?: string;
    department?: string;
  };
  shifts?: {
    id: string;
    name: string;
    start_time: string;
    end_time: string;
    grace_minutes?: number;
    overtime_after_minutes?: number;
    locations?: {
      id: string;
      name: string;
    };
  };
  locations?: {
    id: string;
    name: string;
  };
};

function combineDateAndTime(date: string, time: string) {
  if (!date || !time) return null;
  return `${date}T${time}:00+08:00`;
}

function getMinutesDifference(later: Date, earlier: Date) {
  return Math.max(
    0,
    Math.floor((later.getTime() - earlier.getTime()) / 1000 / 60)
  );
}

function formatDateTimeDisplay(value?: string | null) {
  if (!value) return "-";
  const date = new Date(value);
  return date.toLocaleString("en-PH", {
    year: "numeric",
    month: "short",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function formatTimeDisplay(value?: string | null) {
  if (!value) return "-";
  const date = new Date(value);
  return date.toLocaleTimeString("en-PH", {
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function ManualAttendanceManagementPage() {
  const [records, setRecords] = useState<AttendanceRecord[]>([]);
  const [users, setUsers] = useState<UserOption[]>([]);
  const [shifts, setShifts] = useState<ShiftOption[]>([]);

  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);

  const [editingRecord, setEditingRecord] = useState<AttendanceRecord | null>(null);
  const [deletingRecord, setDeletingRecord] = useState<AttendanceRecord | null>(null);

  const [isLoading, setIsLoading] = useState(false);
  const [isCheckingRecord, setIsCheckingRecord] = useState(false);
  const [error, setError] = useState("");

  const [formData, setFormData] = useState({
    user_id: "",
    date: "",
    clock_in_time: "",
    clock_out_time: "",
    shift_id: "",
    reason: "",
  });

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      const [attendanceData, usersData, shiftsData] = await Promise.all([
        manualAttendanceService.getAllManualAttendance(),
        manualAttendanceService.getAllUsers(),
        manualAttendanceService.getAllShifts(),
      ]);

      setRecords(attendanceData);
      setUsers(usersData);
      setShifts(shiftsData);
    } catch (error) {
      console.error("Error loading manual attendance data:", error);
    }
  };

  const resetForm = () => {
    setFormData({
      user_id: "",
      date: "",
      clock_in_time: "",
      clock_out_time: "",
      shift_id: "",
      reason: "",
    });
  };

  const handleOpenDialog = (record?: AttendanceRecord) => {
    if (record) {
      const clockIn = record.clock_in ? new Date(record.clock_in) : null;
      const clockOut = record.clock_out ? new Date(record.clock_out) : null;

      setEditingRecord(record);
      setFormData({
        user_id: record.user_id,
        date: record.date,
        clock_in_time: clockIn
          ? `${String(clockIn.getHours()).padStart(2, "0")}:${String(
              clockIn.getMinutes()
            ).padStart(2, "0")}`
          : "",
        clock_out_time: clockOut
          ? `${String(clockOut.getHours()).padStart(2, "0")}:${String(
              clockOut.getMinutes()
            ).padStart(2, "0")}`
          : "",
        shift_id: record.shift_id ?? "",
        reason: record.remarks?.replace(/^Manual attendance:\s*/i, "") ?? "",
      });
    } else {
      setEditingRecord(null);
      resetForm();
    }

    setError("");
    setIsDialogOpen(true);
  };

  const handleCloseDialog = () => {
    setIsDialogOpen(false);
    setEditingRecord(null);
    setError("");
    resetForm();
  };

  const handleUserChange = (userId: string) => {
    const selectedUser = users.find((user) => user.id === userId);

    setFormData((prev) => ({
      ...prev,
      user_id: userId,
      shift_id: selectedUser?.shift_id ?? "",
    }));
  };

  const computeAttendanceFields = () => {
    const selectedShift = shifts.find((shift) => shift.id === formData.shift_id);

    const clockInISO = formData.clock_in_time
      ? combineDateAndTime(formData.date, formData.clock_in_time)
      : null;

    const clockOutISO = formData.clock_out_time
      ? combineDateAndTime(formData.date, formData.clock_out_time)
      : null;

    let scheduledStart: string | null = null;
    let scheduledEnd: string | null = null;
    let minutesLate = 0;
    let minutesOvertime = 0;
    let isLate = false;
    let isOvertime = false;
    let status = "present";
    let locationId: string | null = null;

    if (selectedShift) {
      scheduledStart = combineDateAndTime(formData.date, selectedShift.start_time.slice(0, 5));
      scheduledEnd = combineDateAndTime(formData.date, selectedShift.end_time.slice(0, 5));
      locationId = selectedShift.location_id ?? null;

      if (clockInISO && scheduledStart) {
        const actualClockIn = new Date(clockInISO);
        const shiftStart = new Date(scheduledStart);
        shiftStart.setMinutes(shiftStart.getMinutes() + (selectedShift.grace_minutes ?? 0));

        minutesLate = getMinutesDifference(actualClockIn, shiftStart);
        isLate = minutesLate > 0;
      }

      if (clockOutISO && scheduledEnd) {
        const actualClockOut = new Date(clockOutISO);
        const shiftEnd = new Date(scheduledEnd);
        shiftEnd.setMinutes(
          shiftEnd.getMinutes() + (selectedShift.overtime_after_minutes ?? 0)
        );

        minutesOvertime = getMinutesDifference(actualClockOut, shiftEnd);
        isOvertime = minutesOvertime > 0;
      }
    }

    if (isLate && isOvertime) {
      status = "late_overtime";
    } else if (isLate) {
      status = "late";
    } else if (isOvertime) {
      status = "overtime";
    } else {
      status = "present";
    }

    return {
      clockInISO,
      clockOutISO,
      scheduledStart,
      scheduledEnd,
      minutesLate,
      minutesOvertime,
      isLate,
      isOvertime,
      status,
      locationId,
    };
  };

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setError("");

    try {
      if (!formData.user_id) {
        throw new Error("Please select an employee.");
      }

      if (!formData.date) {
        throw new Error("Please select a date.");
      }

      if (!formData.clock_in_time) {
        throw new Error("Please enter time in.");
      }

      if (!formData.reason.trim()) {
        throw new Error("Please provide a reason for manual attendance.");
      }

      if (!editingRecord) {
        setIsCheckingRecord(true);
        const existing = await manualAttendanceService.getAttendanceByUserAndDate(
          formData.user_id,
          formData.date
        );
        setIsCheckingRecord(false);

        if (existing) {
          throw new Error(
            "Attendance record already exists for this employee and date. Please edit the existing record instead."
          );
        }
      }

      const computed = computeAttendanceFields();

      const payload = {
        user_id: formData.user_id,
        date: formData.date,
        clock_in: computed.clockInISO,
        clock_out: computed.clockOutISO,
        shift_id: formData.shift_id || null,
        location_id: computed.locationId,
        scheduled_start: computed.scheduledStart,
        scheduled_end: computed.scheduledEnd,
        minutes_late: computed.minutesLate,
        minutes_overtime: computed.minutesOvertime,
        is_late: computed.isLate,
        is_overtime: computed.isOvertime,
        is_absent: false,
        status: computed.status,
        remarks: `Manual attendance: ${formData.reason.trim()}`,
      };

      if (editingRecord) {
        await manualAttendanceService.updateManualAttendance(editingRecord.id, payload);
      } else {
        await manualAttendanceService.createManualAttendance(payload);
      }

      await loadData();
      handleCloseDialog();
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Failed to save manual attendance"
      );
    } finally {
      setIsLoading(false);
      setIsCheckingRecord(false);
    }
  };

  const handleDeleteClick = (record: AttendanceRecord) => {
    setDeletingRecord(record);
    setIsDeleteDialogOpen(true);
  };

  const handleDeleteConfirm = async () => {
    if (!deletingRecord) return;

    setIsLoading(true);
    try {
      await manualAttendanceService.deleteManualAttendance(deletingRecord.id);
      await loadData();
      setIsDeleteDialogOpen(false);
      setDeletingRecord(null);
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Failed to delete manual attendance"
      );
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <AdminLayout>
      <div className="space-y-6">
        <div className="flex justify-between items-start">
          <div>
            <h1 className="text-neutral-900 mb-1">Manual Attendance</h1>
            <p className="text-neutral-600">
              Manually add or update employee time in and time out records
            </p>
          </div>
          <Button
            onClick={() => handleOpenDialog()}
            className="flex items-center gap-2"
          >
            <Plus className="w-4 h-4" />
            Add Manual Attendance
          </Button>
        </div>

        <Card>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Employee</TableHead>
                  <TableHead>Date</TableHead>
                  <TableHead>Time In</TableHead>
                  <TableHead>Time Out</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Reason</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {records.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={7} className="text-center text-neutral-500 py-8">
                      No manual attendance records found
                    </TableCell>
                  </TableRow>
                ) : (
                  records.map((record) => (
                    <TableRow key={record.id}>
                      <TableCell>{record.users?.name ?? "-"}</TableCell>
                      <TableCell>{formatDate(record.date)}</TableCell>
                      <TableCell>{formatTimeDisplay(record.clock_in)}</TableCell>
                      <TableCell>{formatTimeDisplay(record.clock_out)}</TableCell>
                      <TableCell className="capitalize">{record.status ?? "-"}</TableCell>
                      <TableCell className="max-w-[320px] truncate">
                        {record.remarks ?? "-"}
                      </TableCell>
                      <TableCell>
                        <div className="flex justify-end gap-2">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleOpenDialog(record)}
                          >
                            <Pencil className="w-4 h-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleDeleteClick(record)}
                          >
                            <Trash2 className="w-4 h-4 text-red-600" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </div>

      <Dialog open={isDialogOpen} onOpenChange={(open) => !open && handleCloseDialog()}>
        <DialogContent
          onClose={handleCloseDialog}
          className="w-full max-w-2xl max-h-[90vh] overflow-hidden p-0 flex flex-col"
        >
          <DialogHeader className="px-6 pt-6 pb-4 border-b">
            <DialogTitle>
              {editingRecord ? "Edit Manual Attendance" : "Add Manual Attendance"}
            </DialogTitle>
            <DialogDescription>
              {editingRecord
                ? "Update manual attendance details for the selected employee."
                : "Create a manual attendance record for an employee."}
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={handleSubmit} className="flex-1 flex flex-col min-h-0">
            <DialogBody className="flex-1 overflow-y-auto px-6 py-4 min-h-0">
              {error && (
                <div className="mb-4 bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg text-sm">
                  {error}
                </div>
              )}

              <div className="space-y-4">
                <Select
                  label="Employee"
                  value={formData.user_id}
                  onChange={(e) => handleUserChange(e.target.value)}
                  required
                  disabled={isLoading || !!editingRecord}
                >
                  <option value="">Select Employee</option>
                  {users.map((user) => (
                    <option key={user.id} value={user.id}>
                      {user.name} {user.department ? `- ${user.department}` : ""}
                    </option>
                  ))}
                </Select>

                <Input
                  label="Date"
                  type="date"
                  value={formData.date}
                  onChange={(e) =>
                    setFormData((prev) => ({ ...prev, date: e.target.value }))
                  }
                  required
                  disabled={isLoading || !!editingRecord}
                />

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <Input
                    label="Time In"
                    type="time"
                    value={formData.clock_in_time}
                    onChange={(e) =>
                      setFormData((prev) => ({
                        ...prev,
                        clock_in_time: e.target.value,
                      }))
                    }
                    required
                    disabled={isLoading}
                  />

                  <Input
                    label="Time Out"
                    type="time"
                    value={formData.clock_out_time}
                    onChange={(e) =>
                      setFormData((prev) => ({
                        ...prev,
                        clock_out_time: e.target.value,
                      }))
                    }
                    disabled={isLoading}
                  />
                </div>

                <Select
                  label="Assigned Shift"
                  value={formData.shift_id}
                  onChange={(e) =>
                    setFormData((prev) => ({
                      ...prev,
                      shift_id: e.target.value,
                    }))
                  }
                  disabled={isLoading}
                >
                  <option value="">Select Shift</option>
                  {shifts.map((shift) => (
                    <option key={shift.id} value={shift.id}>
                      {shift.name}
                      {shift.locations?.name ? ` - ${shift.locations.name}` : ""}
                      {" | "}
                      {shift.start_time?.slice(0, 5)} - {shift.end_time?.slice(0, 5)}
                    </option>
                  ))}
                </Select>

                <div>
                  <label className="block text-sm mb-1.5 text-neutral-700">
                    Reason for Manual Entry
                  </label>
                  <textarea
                    value={formData.reason}
                    onChange={(e) =>
                      setFormData((prev) => ({
                        ...prev,
                        reason: e.target.value,
                      }))
                    }
                    disabled={isLoading}
                    placeholder="Enter the reason why admin needs to manually add this attendance"
                    rows={4}
                    className="w-full px-3 py-2 border border-neutral-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-neutral-900 focus:border-transparent transition-colors"
                    required
                  />
                </div>

                {isCheckingRecord && (
                  <div className="text-sm text-neutral-500">
                    Checking existing attendance record...
                  </div>
                )}
              </div>
            </DialogBody>

            <DialogFooter className="px-6 py-4 border-t bg-white shrink-0">
              <Button
                type="button"
                variant="outline"
                onClick={handleCloseDialog}
                disabled={isLoading}
              >
                Cancel
              </Button>

              <Button type="submit" disabled={isLoading}>
                {isLoading
                  ? "Saving..."
                  : editingRecord
                  ? "Update Attendance"
                  : "Create Attendance"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <Dialog open={isDeleteDialogOpen} onOpenChange={setIsDeleteDialogOpen}>
        <DialogContent onClose={() => setIsDeleteDialogOpen(false)}>
          <DialogHeader>
            <DialogTitle>Delete Manual Attendance</DialogTitle>
            <DialogDescription>
              Are you sure you want to delete the manual attendance record for{" "}
              <strong>{deletingRecord?.users?.name ?? "this employee"}</strong> on{" "}
              <strong>{deletingRecord?.date ? formatDate(deletingRecord.date) : ""}</strong>?
              This action cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setIsDeleteDialogOpen(false)}
              disabled={isLoading}
            >
              Cancel
            </Button>
            <Button variant="danger" onClick={handleDeleteConfirm} disabled={isLoading}>
              {isLoading ? "Deleting..." : "Delete Attendance"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </AdminLayout>
  );
}