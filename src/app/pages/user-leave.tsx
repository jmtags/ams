import { useEffect, useMemo, useState } from "react";
import { FilePlus2, Paperclip, RefreshCw, XCircle } from "lucide-react";
import { useAuth } from "../hooks/useAuth";
import { UserLayout } from "../layouts/user-layout";
import { Badge } from "../components/ui/badge";
import { Button } from "../components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "../components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "../components/ui/table";
import { leaveBalanceService } from "../services/leave-balance.service";
import {
  leaveRequestService,
  type LeaveRequest,
} from "../services/leave-request.service";
import {
  leaveTypeService,
  type LeaveType,
} from "../services/leave-type.service";
import { formatDate } from "../lib/utils";

type UserLeaveBalance = {
  id: string;
  year: number;
  entitled: number;
  used: number;
  pending: number;
  leave_type_code: string;
  leave_type_name: string;
};

type LeaveFormState = {
  leave_type_id: string;
  date_from: string;
  date_to: string;
  is_half_day: boolean;
  half_day_portion: "AM" | "PM" | "";
  reason: string;
  attachment: File | null;
};

const initialLeaveForm: LeaveFormState = {
  leave_type_id: "",
  date_from: "",
  date_to: "",
  is_half_day: false,
  half_day_portion: "",
  reason: "",
  attachment: null,
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

export function UserLeavePage() {
  const { user } = useAuth();
  const [leaveTypes, setLeaveTypes] = useState<LeaveType[]>([]);
  const [leaveBalances, setLeaveBalances] = useState<UserLeaveBalance[]>([]);
  const [leaveRequests, setLeaveRequests] = useState<LeaveRequest[]>([]);
  const [leaveForm, setLeaveForm] = useState<LeaveFormState>(initialLeaveForm);
  const [fileInputKey, setFileInputKey] = useState(0);
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [cancellingId, setCancellingId] = useState<string | null>(null);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  const loadLeaveData = async () => {
    if (!user?.id) {
      setIsLoading(false);
      return;
    }

    try {
      setIsLoading(true);
      setError("");

      const currentYear = new Date().getFullYear();
      const [typeRows, balanceRows, requestRows] = await Promise.all([
        leaveTypeService.getAll(""),
        leaveBalanceService.getByUser(user.id, currentYear),
        leaveRequestService.getMyLeaveRequests(user.id),
      ]);

      setLeaveTypes(typeRows.filter((item) => item.is_active));
      setLeaveBalances(balanceRows);
      setLeaveRequests(requestRows);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load leave data.");
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    void loadLeaveData();
  }, [user?.id]);

  const selectedLeaveType = useMemo(
    () => leaveTypes.find((item) => item.id === leaveForm.leave_type_id),
    [leaveTypes, leaveForm.leave_type_id]
  );

  const totalAvailable = leaveBalances.reduce(
    (sum, item) => sum + item.entitled - item.used - item.pending,
    0
  );

  const handleSubmitLeave = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!user?.id) return;

    try {
      setIsSubmitting(true);
      setError("");
      setSuccess("");

      if (!selectedLeaveType) {
        throw new Error("Please select a leave type.");
      }

      await leaveRequestService.create({
        user_id: user.id,
        leave_type_id: leaveForm.leave_type_id,
        date_from: leaveForm.date_from,
        date_to: leaveForm.date_to,
        is_half_day: leaveForm.is_half_day,
        half_day_portion: leaveForm.is_half_day
          ? (leaveForm.half_day_portion as "AM" | "PM")
          : null,
        reason: leaveForm.reason,
        attachment: leaveForm.attachment,
      });

      setLeaveForm(initialLeaveForm);
      setFileInputKey((key) => key + 1);
      setSuccess("Leave request filed successfully.");
      await loadLeaveData();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to file leave request.");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleCancelLeave = async (requestId: string) => {
    if (!user?.id) return;

    try {
      setCancellingId(requestId);
      setError("");
      setSuccess("");
      await leaveRequestService.cancelLeaveRequest(requestId, user.id);
      setSuccess("Leave request cancelled successfully.");
      await loadLeaveData();
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Failed to cancel leave request."
      );
    } finally {
      setCancellingId(null);
    }
  };

  return (
    <UserLayout>
      <div className="space-y-6">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h1 className="text-neutral-900 mb-1">My Leave</h1>
            <p className="text-neutral-600">
              File leave, check available credits, and track your requests
            </p>
          </div>
          <Button
            variant="outline"
            onClick={() => void loadLeaveData()}
            disabled={isLoading}
          >
            <RefreshCw className={`w-4 h-4 mr-2 ${isLoading ? "animate-spin" : ""}`} />
            Refresh
          </Button>
        </div>

        {error && (
          <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg text-sm">
            {error}
          </div>
        )}
        {success && (
          <div className="bg-green-50 border border-green-200 text-green-700 px-4 py-3 rounded-lg text-sm">
            {success}
          </div>
        )}

        <div className="grid grid-cols-1 xl:grid-cols-[minmax(0,1.4fr)_minmax(300px,0.6fr)] gap-6 items-start">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <FilePlus2 className="w-5 h-5" />
                File Leave
              </CardTitle>
              <CardDescription>
                Complete the form below to submit a leave request.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleSubmitLeave} className="space-y-4">
                <div>
                  <label className="block text-sm text-neutral-700 mb-2">
                    Leave Type
                  </label>
                  <select
                    value={leaveForm.leave_type_id}
                    onChange={(event) =>
                      setLeaveForm((previous) => ({
                        ...previous,
                        leave_type_id: event.target.value,
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
                    <label className="block text-sm text-neutral-700 mb-2">
                      Date From
                    </label>
                    <input
                      type="date"
                      value={leaveForm.date_from}
                      onChange={(event) =>
                        setLeaveForm((previous) => ({
                          ...previous,
                          date_from: event.target.value,
                          date_to: previous.is_half_day
                            ? event.target.value
                            : previous.date_to,
                        }))
                      }
                      className="w-full rounded-lg border border-neutral-300 px-3 py-2 text-sm"
                      required
                    />
                  </div>
                  <div>
                    <label className="block text-sm text-neutral-700 mb-2">
                      Date To
                    </label>
                    <input
                      type="date"
                      value={leaveForm.date_to}
                      onChange={(event) =>
                        setLeaveForm((previous) => ({
                          ...previous,
                          date_to: event.target.value,
                        }))
                      }
                      disabled={leaveForm.is_half_day}
                      className="w-full rounded-lg border border-neutral-300 px-3 py-2 text-sm disabled:bg-neutral-100"
                      required
                    />
                  </div>
                </div>

                <div className="flex flex-wrap gap-6">
                  <label className="flex items-center gap-2 text-sm text-neutral-700">
                    <input
                      type="radio"
                      name="leave-duration"
                      checked={!leaveForm.is_half_day}
                      onChange={() =>
                        setLeaveForm((previous) => ({
                          ...previous,
                          is_half_day: false,
                          half_day_portion: "",
                        }))
                      }
                    />
                    Whole Day
                  </label>
                  <label className="flex items-center gap-2 text-sm text-neutral-700">
                    <input
                      type="radio"
                      name="leave-duration"
                      checked={leaveForm.is_half_day}
                      onChange={() =>
                        setLeaveForm((previous) => ({
                          ...previous,
                          is_half_day: true,
                          date_to: previous.date_from,
                        }))
                      }
                    />
                    Half Day
                  </label>
                </div>

                {leaveForm.is_half_day && (
                  <div>
                    <label className="block text-sm text-neutral-700 mb-2">
                      Half Day Portion
                    </label>
                    <select
                      value={leaveForm.half_day_portion}
                      onChange={(event) =>
                        setLeaveForm((previous) => ({
                          ...previous,
                          half_day_portion: event.target.value as "AM" | "PM",
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
                  <label className="block text-sm text-neutral-700 mb-2">
                    Reason
                  </label>
                  <textarea
                    value={leaveForm.reason}
                    onChange={(event) =>
                      setLeaveForm((previous) => ({
                        ...previous,
                        reason: event.target.value,
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
                    {selectedLeaveType?.requires_attachment
                      ? " (Required)"
                      : " (Optional)"}
                  </label>
                  <input
                    key={fileInputKey}
                    type="file"
                    required={selectedLeaveType?.requires_attachment}
                    onChange={(event) =>
                      setLeaveForm((previous) => ({
                        ...previous,
                        attachment: event.target.files?.[0] ?? null,
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
                  <Button type="submit" disabled={isSubmitting || isLoading}>
                    {isSubmitting ? "Submitting..." : "Submit Leave Request"}
                  </Button>
                </div>
              </form>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Leave Credits</CardTitle>
              <CardDescription>
                Current-year availability across {leaveBalances.length} leave type(s)
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="rounded-lg bg-neutral-900 text-white p-4 mb-4">
                <p className="text-sm text-neutral-300">Total Available</p>
                <p className="text-3xl font-semibold mt-1">{totalAvailable}</p>
              </div>
              <div className="space-y-3">
                {isLoading ? (
                  <div className="text-sm text-neutral-500">
                    Loading leave credits...
                  </div>
                ) : leaveBalances.length === 0 ? (
                  <div className="text-sm text-neutral-500">
                    No leave credits found for this year.
                  </div>
                ) : (
                  leaveBalances.map((item) => {
                    const available =
                      item.entitled - item.used - item.pending;

                    return (
                      <div
                        key={item.id}
                        className="rounded-lg border border-neutral-200 p-4 bg-neutral-50"
                      >
                        <div className="flex items-center justify-between gap-3 mb-3">
                          <div>
                            <p className="text-sm font-medium text-neutral-900">
                              {item.leave_type_name}
                            </p>
                            <p className="text-xs text-neutral-500">
                              {item.leave_type_code} • {item.year}
                            </p>
                          </div>
                          <Badge>{available} available</Badge>
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
              Track your filed leaves. Pending requests may be cancelled.
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
                {isLoading ? (
                  <TableRow>
                    <TableCell colSpan={9} className="text-center text-neutral-500 py-8">
                      Loading leave requests...
                    </TableCell>
                  </TableRow>
                ) : leaveRequests.length === 0 ? (
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
                        <div className="text-xs text-neutral-500">
                          {request.leave_type_code}
                        </div>
                      </TableCell>
                      <TableCell>{formatDate(request.date_from)}</TableCell>
                      <TableCell>{formatDate(request.date_to)}</TableCell>
                      <TableCell>
                        {request.is_half_day
                          ? `0.5 day (${request.half_day_portion})`
                          : `${request.total_days} day(s)`}
                      </TableCell>
                      <TableCell className="max-w-[220px] truncate">
                        {request.reason || "-"}
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
                          "-"
                        )}
                      </TableCell>
                      <TableCell>{request.approver_remarks || "-"}</TableCell>
                      <TableCell>
                        {request.status === "pending" ? (
                          <Button
                            variant="outline"
                            size="sm"
                            disabled={cancellingId === request.id}
                            onClick={() => void handleCancelLeave(request.id)}
                          >
                            <XCircle className="w-4 h-4 mr-2" />
                            {cancellingId === request.id
                              ? "Cancelling..."
                              : "Cancel"}
                          </Button>
                        ) : (
                          "-"
                        )}
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
