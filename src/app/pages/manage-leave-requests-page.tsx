import { FormEvent, useEffect, useMemo, useState } from "react";
import {
  Search,
  RefreshCw,
  Download,
  CheckCircle2,
  XCircle,
  Paperclip,
  Eye,
} from "lucide-react";
import * as XLSX from "xlsx";
import { saveAs } from "file-saver";

import { AdminLayout } from "../layouts/admin-layout";
import { Button } from "../components/ui/button";
import { Input } from "../components/ui/input";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "../components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "../components/ui/table";
import { Badge } from "../components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "../components/ui/dialog";

import {
  adminLeaveRequestService,
  AdminLeaveRequest,
} from "../services/admin-leave-request.service";
import { leaveTypeService, LeaveType } from "../services/leave-type.service";
import { userService } from "../services/user.service";
import { useAuth } from "../hooks/useAuth";

type UserOption = {
  id: string;
  name: string;
  email?: string | null;
};

type DecisionDialogState = {
  open: boolean;
  mode: "approve" | "reject";
  request: AdminLeaveRequest | null;
};

export default function ManageLeaveRequestsPage() {
  const { user } = useAuth();

  const [leaveRequests, setLeaveRequests] = useState<AdminLeaveRequest[]>([]);
  const [users, setUsers] = useState<UserOption[]>([]);
  const [leaveTypes, setLeaveTypes] = useState<LeaveType[]>([]);

  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [employeeFilter, setEmployeeFilter] = useState("all");
  const [leaveTypeFilter, setLeaveTypeFilter] = useState("all");

  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);

  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  const [decisionDialog, setDecisionDialog] = useState<DecisionDialogState>({
    open: false,
    mode: "approve",
    request: null,
  });
  const [remarks, setRemarks] = useState("");

  const totalRecords = useMemo(() => leaveRequests.length, [leaveRequests]);

  const loadReferenceData = async () => {
    const [userData, leaveTypeData] = await Promise.all([
      userService.getUsers(),
      leaveTypeService.getAll(""),
    ]);

    setUsers(
      (userData ?? []).map((item: any) => ({
        id: item.id,
        name: item.name,
        email: item.email ?? null,
      }))
    );

    setLeaveTypes(leaveTypeData ?? []);
  };

  const loadLeaveRequests = async () => {
    try {
      setLoading(true);
      setError("");

      const data = await adminLeaveRequestService.getAll({
        search,
        status: statusFilter,
        user_id: employeeFilter,
        leave_type_id: leaveTypeFilter,
      });

      setLeaveRequests(data);
    } catch (err: any) {
      setError(err.message || "Failed to load leave requests.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    const init = async () => {
      try {
        setLoading(true);
        await Promise.all([loadReferenceData(), loadLeaveRequests()]);
      } catch (err: any) {
        setError(err.message || "Failed to initialize page.");
      } finally {
        setLoading(false);
      }
    };

    init();
  }, []);

  const handleSearch = async (e: FormEvent) => {
    e.preventDefault();
    await loadLeaveRequests();
  };

  const handleRefresh = async () => {
    setSearch("");
    setStatusFilter("all");
    setEmployeeFilter("all");
    setLeaveTypeFilter("all");

    try {
      setLoading(true);
      setError("");

      const data = await adminLeaveRequestService.getAll({
        search: "",
        status: "all",
        user_id: "all",
        leave_type_id: "all",
      });

      setLeaveRequests(data);
    } catch (err: any) {
      setError(err.message || "Failed to refresh leave requests.");
    } finally {
      setLoading(false);
    }
  };

  const handleExport = () => {
    const exportData = leaveRequests.map((item) => ({
      Employee: item.employee_name,
      Email: item.employee_email ?? "",
      "Leave Type Code": item.leave_type_code,
      "Leave Type Name": item.leave_type_name,
      "Date From": item.date_from,
      "Date To": item.date_to,
      "Half Day": item.is_half_day ? "Yes" : "No",
      "Half Day Portion": item.half_day_portion ?? "",
      "Total Days": item.total_days,
      Reason: item.reason ?? "",
      Status: item.status,
      "Approver Remarks": item.approver_remarks ?? "",
      "Approved At": item.approved_at ?? "",
      "Rejected At": item.rejected_at ?? "",
      "Cancelled At": item.cancelled_at ?? "",
      "Attachment URL": item.attachment_url ?? "",
      "Created At": item.created_at,
      "Updated At": item.updated_at ?? "",
    }));

    const worksheet = XLSX.utils.json_to_sheet(exportData);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, "Leave Requests");

    const excelBuffer = XLSX.write(workbook, {
      bookType: "xlsx",
      type: "array",
    });

    const blob = new Blob([excelBuffer], {
      type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet;charset=UTF-8",
    });

    const fileName = `leave-requests-${new Date().toISOString().slice(0, 10)}.xlsx`;
    saveAs(blob, fileName);
  };

  const openDecisionDialog = (
    mode: "approve" | "reject",
    request: AdminLeaveRequest
  ) => {
    setRemarks(request.approver_remarks ?? "");
    setDecisionDialog({
      open: true,
      mode,
      request,
    });
  };

  const closeDecisionDialog = () => {
    if (submitting) return;
    setDecisionDialog({
      open: false,
      mode: "approve",
      request: null,
    });
    setRemarks("");
  };

  const handleDecision = async () => {
    if (!decisionDialog.request || !user?.id) return;

    try {
      setSubmitting(true);
      setError("");
      setSuccess("");

      if (decisionDialog.mode === "approve") {
        await adminLeaveRequestService.approve(
          decisionDialog.request.id,
          user.id,
          remarks
        );
        setSuccess("Leave request approved successfully.");
      } else {
        await adminLeaveRequestService.reject(
          decisionDialog.request.id,
          user.id,
          remarks
        );
        setSuccess("Leave request rejected successfully.");
      }

      closeDecisionDialog();
      await loadLeaveRequests();
    } catch (err: any) {
      setError(err.message || "Failed to process leave request.");
    } finally {
      setSubmitting(false);
    }
  };

  const getLeaveStatusBadgeVariant = (status: string) => {
    switch (status) {
      case "approved":
        return "success";
      case "pending":
        return "warning";
      case "rejected":
        return "danger";
      case "cancelled":
        return "secondary";
      default:
        return "default";
    }
  };

  return (
    <AdminLayout>
      <div className="space-y-6">
        <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
          <div>
            <h1 className="text-2xl font-bold">Leave Requests Management</h1>
            <p className="text-sm text-neutral-600">
              Review, filter, approve, reject, and export leave requests.
            </p>
          </div>

          <div className="flex flex-wrap gap-2">
            <Button variant="outline" onClick={handleRefresh} disabled={loading}>
              <RefreshCw className="mr-2 h-4 w-4" />
              Refresh
            </Button>
            <Button
              variant="outline"
              onClick={handleExport}
              disabled={leaveRequests.length === 0}
            >
              <Download className="mr-2 h-4 w-4" />
              Export Excel
            </Button>
          </div>
        </div>

        {(error || success) && (
          <div className="space-y-2">
            {error && (
              <div className="rounded-md border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
                {error}
              </div>
            )}
            {success && (
              <div className="rounded-md border border-green-200 bg-green-50 px-4 py-3 text-sm text-green-700">
                {success}
              </div>
            )}
          </div>
        )}

        <Card>
          <CardHeader>
            <CardTitle>Search and Filters</CardTitle>
            <CardDescription>
              Search by employee, email, leave type, reason, status, or date.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSearch} className="space-y-4">
              <div className="flex flex-col gap-3 lg:flex-row">
                <div className="relative flex-1">
                  <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-neutral-400" />
                  <Input
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    placeholder="Search leave requests..."
                    className="pl-9"
                  />
                </div>

                <div className="grid grid-cols-1 gap-3 md:grid-cols-3 lg:w-[700px]">
                  <select
                    value={statusFilter}
                    onChange={(e) => setStatusFilter(e.target.value)}
                    className="w-full rounded-md border border-neutral-300 px-3 py-2 text-sm"
                  >
                    <option value="all">All Statuses</option>
                    <option value="pending">Pending</option>
                    <option value="approved">Approved</option>
                    <option value="rejected">Rejected</option>
                    <option value="cancelled">Cancelled</option>
                  </select>

                  <select
                    value={employeeFilter}
                    onChange={(e) => setEmployeeFilter(e.target.value)}
                    className="w-full rounded-md border border-neutral-300 px-3 py-2 text-sm"
                  >
                    <option value="all">All Employees</option>
                    {users.map((employee) => (
                      <option key={employee.id} value={employee.id}>
                        {employee.name}
                      </option>
                    ))}
                  </select>

                  <select
                    value={leaveTypeFilter}
                    onChange={(e) => setLeaveTypeFilter(e.target.value)}
                    className="w-full rounded-md border border-neutral-300 px-3 py-2 text-sm"
                  >
                    <option value="all">All Leave Types</option>
                    {leaveTypes.map((leaveType) => (
                      <option key={leaveType.id} value={leaveType.id}>
                        {leaveType.code} - {leaveType.name}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="flex justify-end">
                <Button type="submit" disabled={loading}>
                  Search
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Leave Requests List</CardTitle>
            <CardDescription>Total records: {totalRecords}</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Employee</TableHead>
                    <TableHead>Leave Type</TableHead>
                    <TableHead>Date Range</TableHead>
                    <TableHead>Duration</TableHead>
                    <TableHead>Reason</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Attachment</TableHead>
                    <TableHead>Remarks</TableHead>
                    <TableHead>Filed At</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>

                <TableBody>
                  {loading ? (
                    <TableRow>
                      <TableCell colSpan={10} className="text-center">
                        Loading leave requests...
                      </TableCell>
                    </TableRow>
                  ) : leaveRequests.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={10} className="text-center">
                        No leave requests found.
                      </TableCell>
                    </TableRow>
                  ) : (
                    leaveRequests.map((item) => (
                      <TableRow key={item.id}>
                        <TableCell>
                          <div className="font-medium">{item.employee_name}</div>
                          <div className="text-xs text-neutral-500">
                            {item.employee_email ?? "-"}
                          </div>
                        </TableCell>

                        <TableCell>
                          <div className="font-medium">{item.leave_type_name}</div>
                          <div className="text-xs text-neutral-500">
                            {item.leave_type_code}
                          </div>
                        </TableCell>

                        <TableCell>
                          <div>{item.date_from}</div>
                          <div className="text-xs text-neutral-500">to {item.date_to}</div>
                        </TableCell>

                        <TableCell>
                          {item.is_half_day
                            ? `0.5 day (${item.half_day_portion ?? "-"})`
                            : `${item.total_days} day(s)`}
                        </TableCell>

                        <TableCell className="max-w-[220px]">
                          <div className="truncate" title={item.reason ?? ""}>
                            {item.reason ?? "-"}
                          </div>
                        </TableCell>

                        <TableCell>
                          <Badge variant={getLeaveStatusBadgeVariant(item.status)}>
                            {item.status}
                          </Badge>
                        </TableCell>

                        <TableCell>
                          {item.attachment_url ? (
                            <a
                              href={item.attachment_url}
                              target="_blank"
                              rel="noreferrer"
                              className="inline-flex items-center gap-1 text-sm text-blue-600 hover:underline"
                            >
                              <Paperclip className="h-4 w-4" />
                              View
                            </a>
                          ) : (
                            "-"
                          )}
                        </TableCell>

                        <TableCell className="max-w-[220px]">
                          <div title={item.approver_remarks ?? ""} className="truncate">
                            {item.approver_remarks ?? "-"}
                          </div>
                        </TableCell>

                        <TableCell>
                          {item.created_at
                            ? new Date(item.created_at).toLocaleString()
                            : "-"}
                        </TableCell>

                        <TableCell>
                          <div className="flex justify-end gap-2">
                            {item.attachment_url && (
                              <Button
                                asChild
                                variant="outline"
                                size="sm"
                              >
                                <a
                                  href={item.attachment_url}
                                  target="_blank"
                                  rel="noreferrer"
                                >
                                  <Eye className="mr-2 h-4 w-4" />
                                  View
                                </a>
                              </Button>
                            )}

                            {item.status === "pending" && (
                              <>
                                <Button
                                  size="sm"
                                  onClick={() => openDecisionDialog("approve", item)}
                                >
                                  <CheckCircle2 className="mr-2 h-4 w-4" />
                                  Approve
                                </Button>

                                <Button
                                  size="sm"
                                  variant="destructive"
                                  onClick={() => openDecisionDialog("reject", item)}
                                >
                                  <XCircle className="mr-2 h-4 w-4" />
                                  Reject
                                </Button>
                              </>
                            )}
                          </div>
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>

        <Dialog
          open={decisionDialog.open}
          onOpenChange={(open) => !submitting && !open && closeDecisionDialog()}
        >
          <DialogContent className="max-w-lg">
            <DialogHeader>
              <DialogTitle>
                {decisionDialog.mode === "approve" ? "Approve Leave Request" : "Reject Leave Request"}
              </DialogTitle>
              <DialogDescription>
                Add remarks before confirming your decision.
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-4">
              {decisionDialog.request && (
                <div className="rounded-md border border-neutral-200 bg-neutral-50 p-4 text-sm">
                  <div>
                    <span className="font-medium">Employee:</span>{" "}
                    {decisionDialog.request.employee_name}
                  </div>
                  <div>
                    <span className="font-medium">Leave Type:</span>{" "}
                    {decisionDialog.request.leave_type_name}
                  </div>
                  <div>
                    <span className="font-medium">Dates:</span>{" "}
                    {decisionDialog.request.date_from} to {decisionDialog.request.date_to}
                  </div>
                  <div>
                    <span className="font-medium">Duration:</span>{" "}
                    {decisionDialog.request.is_half_day
                      ? `0.5 day (${decisionDialog.request.half_day_portion ?? "-"})`
                      : `${decisionDialog.request.total_days} day(s)`}
                  </div>
                </div>
              )}

              <div>
                <label className="mb-2 block text-sm font-medium">Remarks</label>
                <textarea
                  value={remarks}
                  onChange={(e) => setRemarks(e.target.value)}
                  rows={4}
                  className="w-full rounded-md border border-neutral-300 px-3 py-2 text-sm outline-none"
                  placeholder="Enter remarks"
                />
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <Button
                  type="button"
                  variant="outline"
                  onClick={closeDecisionDialog}
                  disabled={submitting}
                >
                  Cancel
                </Button>

                <Button
                  type="button"
                  variant={decisionDialog.mode === "approve" ? "default" : "destructive"}
                  onClick={handleDecision}
                  disabled={submitting}
                >
                  {submitting
                    ? decisionDialog.mode === "approve"
                      ? "Approving..."
                      : "Rejecting..."
                    : decisionDialog.mode === "approve"
                    ? "Approve"
                    : "Reject"}
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      </div>
    </AdminLayout>
  );
}