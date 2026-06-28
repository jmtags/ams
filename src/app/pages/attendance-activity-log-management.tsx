import { useEffect, useMemo, useState } from "react";
import { saveAs } from "file-saver";
import { Download, Eye, Search } from "lucide-react";
import * as XLSX from "xlsx";
import { AdminLayout } from "../layouts/admin-layout";
import { Button } from "../components/ui/button";
import { Input } from "../components/ui/input";
import { Select } from "../components/ui/select";
import {
  Card,
  CardContent,
  CardHeader,
} from "../components/ui/card";
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
import { Badge } from "../components/ui/badge";
import { attendanceActivityLogManagementService, type ActivityLogManagementRow } from "../services/attendance-activity-log-management.service";
import { formatDate, formatTime } from "../lib/utils";

type FilterUser = {
  id: string;
  name: string;
  email?: string | null;
};

export function AttendanceActivityLogManagementPage() {
  const [rows, setRows] = useState<ActivityLogManagementRow[]>([]);
  const [users, setUsers] = useState<FilterUser[]>([]);
  const [filteredRows, setFilteredRows] = useState<ActivityLogManagementRow[]>([]);
  const [selectedRow, setSelectedRow] = useState<ActivityLogManagementRow | null>(null);

  const [searchQuery, setSearchQuery] = useState("");
  const [selectedUserId, setSelectedUserId] = useState("");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");

  const [isLoading, setIsLoading] = useState(false);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    loadInitialData();
  }, []);

  useEffect(() => {
    const q = searchQuery.trim().toLowerCase();

    const result = rows.filter((row) => {
      const matchesSearch = !q
        ? true
        : [
            row.user_name,
            row.user_email ?? "",
            row.department ?? "",
            row.shift_name ?? "",
            row.status ?? "",
            ...row.activities.map((a) => a.activity_text),
            ...row.activities.map((a) => a.output_note ?? ""),
          ]
            .join(" ")
            .toLowerCase()
            .includes(q);

      return matchesSearch;
    });

    setFilteredRows(result);
  }, [searchQuery, rows]);

  const loadInitialData = async () => {
    try {
      setIsLoading(true);
      setError("");

      const [activityRows, userRows] = await Promise.all([
        attendanceActivityLogManagementService.getActivityLogs(),
        attendanceActivityLogManagementService.getUsersForFilter(),
      ]);

      setRows(activityRows);
      setFilteredRows(activityRows);
      setUsers(userRows);
    } catch (err) {
      console.error(err);
      setError(err instanceof Error ? err.message : "Failed to load activity logs");
    } finally {
      setIsLoading(false);
    }
  };

  const handleApplyFilters = async () => {
    try {
      setIsLoading(true);
      setError("");

      const activityRows = await attendanceActivityLogManagementService.getActivityLogs({
        userId: selectedUserId || undefined,
        dateFrom: dateFrom || undefined,
        dateTo: dateTo || undefined,
        search: searchQuery || undefined,
      });

      setRows(activityRows);
      setFilteredRows(activityRows);
    } catch (err) {
      console.error(err);
      setError(err instanceof Error ? err.message : "Failed to load filtered activity logs");
    } finally {
      setIsLoading(false);
    }
  };

  const handleResetFilters = async () => {
    setSelectedUserId("");
    setDateFrom("");
    setDateTo("");
    setSearchQuery("");
    await loadInitialData();
  };

  const handleOpenDetails = (row: ActivityLogManagementRow) => {
    setSelectedRow(row);
    setIsDialogOpen(true);
  };

  const handleCloseDetails = () => {
    setSelectedRow(null);
    setIsDialogOpen(false);
  };

  const handleExport = () => {
    const exportData = filteredRows.flatMap((row) =>
      row.activities.map((activity, index) => ({
        Date: row.date,
        Employee: row.user_name,
        Email: row.user_email ?? "",
        Department: row.department ?? "",
        Shift: row.shift_name ?? "",
        "Clock In": row.clock_in ? formatTime(row.clock_in) : "",
        "Clock Out": row.clock_out ? formatTime(row.clock_out) : "",
        Status: row.status ?? "",
        "Activity Number": index + 1,
        Activity: activity.activity_text,
        "Hours Spent": activity.hours_spent ?? "",
        "Output / Note": activity.output_note ?? "",
        "Submitted At": new Date(activity.created_at).toLocaleString(),
      }))
    );

    const worksheet = XLSX.utils.json_to_sheet(exportData);
    worksheet["!cols"] = [
      { wch: 12 },
      { wch: 24 },
      { wch: 28 },
      { wch: 20 },
      { wch: 20 },
      { wch: 12 },
      { wch: 12 },
      { wch: 14 },
      { wch: 16 },
      { wch: 50 },
      { wch: 14 },
      { wch: 50 },
      { wch: 22 },
    ];

    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, "Activity Logs");

    const excelBuffer = XLSX.write(workbook, {
      bookType: "xlsx",
      type: "array",
    });

    const blob = new Blob([excelBuffer], {
      type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet;charset=UTF-8",
    });

    const fileName = `activity-logs-${new Date().toISOString().slice(0, 10)}.xlsx`;
    saveAs(blob, fileName);
  };

  const totalActivities = useMemo(() => {
    return filteredRows.reduce((sum, row) => sum + row.activities.length, 0);
  }, [filteredRows]);

  return (
    <AdminLayout>
      <div className="space-y-6">
        <div>
          <h1 className="text-neutral-900 mb-1">Activity Logs</h1>
          <p className="text-neutral-600">
            View employee activity logs submitted before clock out
          </p>
        </div>

        {error && (
          <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg text-sm">
            {error}
          </div>
        )}

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <Card>
            <CardContent className="p-4">
              <p className="text-sm text-neutral-600 mb-1">Attendance Days with Logs</p>
              <p className="text-2xl text-neutral-900">{filteredRows.length}</p>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-4">
              <p className="text-sm text-neutral-600 mb-1">Total Activities</p>
              <p className="text-2xl text-neutral-900">{totalActivities}</p>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-4">
              <p className="text-sm text-neutral-600 mb-1">Employees with Logs</p>
              <p className="text-2xl text-neutral-900">
                {new Set(filteredRows.map((row) => row.user_id)).size}
              </p>
            </CardContent>
          </Card>
        </div>

        <Card>
          <CardHeader>
            <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
              <div className="md:col-span-2 relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-neutral-400" />
                <Input
                  placeholder="Search employee, activity, note, shift..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-10"
                />
              </div>

              <Select
                value={selectedUserId}
                onChange={(e) => setSelectedUserId(e.target.value)}
              >
                <option value="">All Employees</option>
                {users.map((user) => (
                  <option key={user.id} value={user.id}>
                    {user.name}
                  </option>
                ))}
              </Select>

              <Input
                type="date"
                value={dateFrom}
                onChange={(e) => setDateFrom(e.target.value)}
              />

              <Input
                type="date"
                value={dateTo}
                onChange={(e) => setDateTo(e.target.value)}
              />
            </div>

            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={handleResetFilters}>
                Reset
              </Button>
              <Button onClick={handleApplyFilters}>
                Apply Filters
              </Button>
              <Button
                variant="outline"
                onClick={handleExport}
                disabled={isLoading || filteredRows.length === 0}
              >
                <Download className="w-4 h-4 mr-2" />
                Export Excel
              </Button>
            </div>
          </CardHeader>

          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Date</TableHead>
                  <TableHead>Employee</TableHead>
                  <TableHead>Department</TableHead>
                  <TableHead>Shift</TableHead>
                  <TableHead>Clock In</TableHead>
                  <TableHead>Clock Out</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Activities</TableHead>
                  <TableHead className="text-right">Action</TableHead>
                </TableRow>
              </TableHeader>

              <TableBody>
                {isLoading ? (
                  <TableRow>
                    <TableCell colSpan={9} className="text-center text-neutral-500 py-8">
                      Loading activity logs...
                    </TableCell>
                  </TableRow>
                ) : filteredRows.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={9} className="text-center text-neutral-500 py-8">
                      No activity logs found
                    </TableCell>
                  </TableRow>
                ) : (
                  filteredRows.map((row) => (
                    <TableRow key={row.attendance_id}>
                      <TableCell>{formatDate(row.date)}</TableCell>
                      <TableCell>
                        <div className="font-medium">{row.user_name}</div>
                        <div className="text-xs text-neutral-500">{row.user_email || "-"}</div>
                      </TableCell>
                      <TableCell>{row.department || "-"}</TableCell>
                      <TableCell>{row.shift_name || "-"}</TableCell>
                      <TableCell>{row.clock_in ? formatTime(row.clock_in) : "-"}</TableCell>
                      <TableCell>{row.clock_out ? formatTime(row.clock_out) : "-"}</TableCell>
                      <TableCell>
                        <Badge>{row.status || "-"}</Badge>
                      </TableCell>
                      <TableCell>{row.activities.length}</TableCell>
                      <TableCell>
                        <div className="flex justify-end">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleOpenDetails(row)}
                          >
                            <Eye className="w-4 h-4" />
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

      <Dialog open={isDialogOpen} onOpenChange={(open) => !open && handleCloseDetails()}>
        <DialogContent
          onClose={handleCloseDetails}
          className="w-full max-w-3xl max-h-[90vh] overflow-hidden p-0 flex flex-col"
        >
          <DialogHeader className="px-6 pt-6 pb-4 border-b">
            <DialogTitle>Activity Log Details</DialogTitle>
            <DialogDescription>
              Review employee activities submitted for this attendance day
            </DialogDescription>
          </DialogHeader>

          <DialogBody className="flex-1 overflow-y-auto px-6 py-4 min-h-0">
            {selectedRow && (
              <div className="space-y-5">
                <div className="rounded-lg border border-neutral-200 bg-neutral-50 p-4">
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm">
                    <div>
                      <p className="text-neutral-500 mb-1">Employee</p>
                      <p className="text-neutral-900">{selectedRow.user_name}</p>
                    </div>
                    <div>
                      <p className="text-neutral-500 mb-1">Date</p>
                      <p className="text-neutral-900">{formatDate(selectedRow.date)}</p>
                    </div>
                    <div>
                      <p className="text-neutral-500 mb-1">Department</p>
                      <p className="text-neutral-900">{selectedRow.department || "-"}</p>
                    </div>
                    <div>
                      <p className="text-neutral-500 mb-1">Shift</p>
                      <p className="text-neutral-900">{selectedRow.shift_name || "-"}</p>
                    </div>
                    <div>
                      <p className="text-neutral-500 mb-1">Clock In</p>
                      <p className="text-neutral-900">
                        {selectedRow.clock_in ? formatTime(selectedRow.clock_in) : "-"}
                      </p>
                    </div>
                    <div>
                      <p className="text-neutral-500 mb-1">Clock Out</p>
                      <p className="text-neutral-900">
                        {selectedRow.clock_out ? formatTime(selectedRow.clock_out) : "-"}
                      </p>
                    </div>
                  </div>
                </div>

                <div className="space-y-4">
                  {selectedRow.activities.length === 0 ? (
                    <div className="text-sm text-neutral-500">No activities found.</div>
                  ) : (
                    selectedRow.activities.map((activity, index) => (
                      <div
                        key={activity.id}
                        className="rounded-lg border border-neutral-200 p-4 bg-white"
                      >
                        <div className="flex items-center justify-between mb-3">
                          <div className="text-sm font-medium text-neutral-900">
                            Activity #{index + 1}
                          </div>
                          <div className="text-xs text-neutral-500">
                            {new Date(activity.created_at).toLocaleString()}
                          </div>
                        </div>

                        <div className="space-y-3 text-sm">
                          <div>
                            <p className="text-neutral-500 mb-1">Activity</p>
                            <p className="text-neutral-900 whitespace-pre-wrap">
                              {activity.activity_text}
                            </p>
                          </div>

                          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div>
                              <p className="text-neutral-500 mb-1">Hours Spent</p>
                              <p className="text-neutral-900">
                                {activity.hours_spent ?? "-"}
                              </p>
                            </div>

                            <div>
                              <p className="text-neutral-500 mb-1">Output / Note</p>
                              <p className="text-neutral-900 whitespace-pre-wrap">
                                {activity.output_note || "-"}
                              </p>
                            </div>
                          </div>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </div>
            )}
          </DialogBody>

          <DialogFooter className="px-6 py-4 border-t bg-white shrink-0">
            <Button variant="outline" onClick={handleCloseDetails}>
              Close
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </AdminLayout>
  );
}
