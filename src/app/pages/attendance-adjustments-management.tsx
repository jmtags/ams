import { useEffect, useState, FormEvent } from "react";
import { Check, Eye, X } from "lucide-react";
import { AdminLayout } from "../layouts/admin-layout";
import { Button } from "../components/ui/button";
import { Card, CardContent } from "../components/ui/card";
import { Input } from "../components/ui/input";
import { Badge } from "../components/ui/badge";
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
import { attendanceAdjustmentService } from "../services/attendance-adjustment.service";
import { supabase } from "../lib/supabase";
import { formatDate } from "../lib/utils";

type AdjustmentRequest = {
  id: string;
  attendance_id: string;
  user_id: string;
  request_type: string;
  status: "pending" | "approved" | "rejected" | "cancelled";
  previous_clock_in: string | null;
  previous_clock_out: string | null;
  requested_clock_in: string | null;
  requested_clock_out: string | null;
  request_reason: string;
  approved_clock_in?: string | null;
  approved_clock_out?: string | null;
  admin_remarks?: string | null;
  created_by: string;
  reviewed_by?: string | null;
  created_at: string;
  reviewed_at?: string | null;
  users?: {
    id: string;
    name: string;
    email?: string;
    department?: string;
    shift_id?: string;
  };
  attendance?: {
    id: string;
    user_id: string;
    date: string;
    clock_in: string | null;
    clock_out: string | null;
    status: string;
    shift_id?: string | null;
    location_id?: string | null;
    scheduled_start?: string | null;
    scheduled_end?: string | null;
    minutes_late?: number;
    minutes_overtime?: number;
    is_late?: boolean;
    is_overtime?: boolean;
    remarks?: string | null;
  };
};

type FilterStatus = "all" | "pending" | "approved" | "rejected" | "cancelled";

type ReviewFormState = {
  approved_clock_in: string;
  approved_clock_out: string;
  admin_remarks: string;
};

const initialReviewForm: ReviewFormState = {
  approved_clock_in: "",
  approved_clock_out: "",
  admin_remarks: "",
};

function toLocalTimeInput(value?: string | null) {
  if (!value) return "";
  const date = new Date(value);
  return `${String(date.getHours()).padStart(2, "0")}:${String(
    date.getMinutes()
  ).padStart(2, "0")}`;
}

function combineDateAndTime(date: string, time: string) {
  if (!date || !time) return null;
  return `${date}T${time}:00+08:00`;
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

function getStatusBadgeVariant(status: string) {
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
}

export function AttendanceAdjustmentsManagementPage() {
  const [requests, setRequests] = useState<AdjustmentRequest[]>([]);
  const [filteredStatus, setFilteredStatus] = useState<FilterStatus>("pending");

  const [selectedRequest, setSelectedRequest] = useState<AdjustmentRequest | null>(null);
  const [reviewAction, setReviewAction] = useState<"approve" | "reject" | null>(null);

  const [isDialogOpen, setIsDialogOpen] = useState(false);

  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState("");

  const [reviewForm, setReviewForm] = useState<ReviewFormState>(initialReviewForm);

  useEffect(() => {
    loadRequests();
  }, []);

  const loadRequests = async () => {
    try {
      const data = await attendanceAdjustmentService.getAllRequests();
      setRequests(data);
    } catch (err) {
      console.error("Error loading attendance adjustment requests:", err);
    }
  };

  const filteredRequests =
    filteredStatus === "all"
      ? requests
      : requests.filter((request) => request.status === filteredStatus);

  const handleOpenReviewDialog = (
    request: AdjustmentRequest,
    action: "approve" | "reject"
  ) => {
    setSelectedRequest(request);
    setReviewAction(action);
    setError("");

    setReviewForm({
      approved_clock_in: toLocalTimeInput(
        request.requested_clock_in ?? request.previous_clock_in
      ),
      approved_clock_out: toLocalTimeInput(
        request.requested_clock_out ?? request.previous_clock_out
      ),
      admin_remarks: "",
    });

    setIsDialogOpen(true);
  };

  const handleOpenViewDialog = (request: AdjustmentRequest) => {
    setSelectedRequest(request);
    setReviewAction(null);

    setReviewForm({
      approved_clock_in: toLocalTimeInput(
        request.approved_clock_in ??
          request.requested_clock_in ??
          request.previous_clock_in
      ),
      approved_clock_out: toLocalTimeInput(
        request.approved_clock_out ??
          request.requested_clock_out ??
          request.previous_clock_out
      ),
      admin_remarks: request.admin_remarks ?? "",
    });

    setError("");
    setIsDialogOpen(true);
  };

  const handleCloseDialog = () => {
    setSelectedRequest(null);
    setReviewAction(null);
    setReviewForm(initialReviewForm);
    setError("");
    setIsDialogOpen(false);
  };

  const handleSubmitReview = async (e: FormEvent) => {
    e.preventDefault();

    if (!selectedRequest || !reviewAction) return;

    setIsLoading(true);
    setError("");

    try {
      const {
        data: { user },
        error: authError,
      } = await supabase.auth.getUser();

      if (authError || !user?.id) {
        throw new Error("Unable to identify the current admin user.");
      }

      if (reviewAction === "reject") {
        await attendanceAdjustmentService.rejectRequest(
          selectedRequest.id,
          reviewForm.admin_remarks,
          user.id
        );
      }

      if (reviewAction === "approve") {
        const attendanceDate = selectedRequest.attendance?.date;
        if (!attendanceDate) {
          throw new Error("Attendance date not found.");
        }

        const approvedClockIn = reviewForm.approved_clock_in
          ? combineDateAndTime(attendanceDate, reviewForm.approved_clock_in)
          : null;

        const approvedClockOut = reviewForm.approved_clock_out
          ? combineDateAndTime(attendanceDate, reviewForm.approved_clock_out)
          : null;

        await attendanceAdjustmentService.approveRequest(selectedRequest, {
          approved_clock_in: approvedClockIn,
          approved_clock_out: approvedClockOut,
          admin_remarks: reviewForm.admin_remarks,
          reviewed_by: user.id,
        });
      }

      await loadRequests();
      handleCloseDialog();
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Failed to process attendance adjustment request"
      );
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <AdminLayout>
      <div className="space-y-6">
        <div className="flex justify-between items-start gap-4 flex-wrap">
          <div>
            <h1 className="text-neutral-900 mb-1">Attendance Adjustments</h1>
            <p className="text-neutral-600">
              Review and approve employee punch alteration requests
            </p>
          </div>

          <div className="flex gap-2 flex-wrap">
            <Button
              variant={filteredStatus === "pending" ? "default" : "outline"}
              onClick={() => setFilteredStatus("pending")}
            >
              Pending
            </Button>
            <Button
              variant={filteredStatus === "approved" ? "default" : "outline"}
              onClick={() => setFilteredStatus("approved")}
            >
              Approved
            </Button>
            <Button
              variant={filteredStatus === "rejected" ? "default" : "outline"}
              onClick={() => setFilteredStatus("rejected")}
            >
              Rejected
            </Button>
            <Button
              variant={filteredStatus === "all" ? "default" : "outline"}
              onClick={() => setFilteredStatus("all")}
            >
              All
            </Button>
          </div>
        </div>

        <Card>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Employee</TableHead>
                  <TableHead>Date</TableHead>
                  <TableHead>Current Punch</TableHead>
                  <TableHead>Requested Punch</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Reason</TableHead>
                  <TableHead>Requested At</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredRequests.length === 0 ? (
                  <TableRow>
                    <TableCell
                      colSpan={8}
                      className="text-center text-neutral-500 py-8"
                    >
                      No attendance adjustment requests found
                    </TableCell>
                  </TableRow>
                ) : (
                  filteredRequests.map((request) => (
                    <TableRow key={request.id}>
                      <TableCell>
                        <div className="font-medium">
                          {request.users?.name ?? "-"}
                        </div>
                        <div className="text-xs text-neutral-500">
                          {request.users?.department ?? "-"}
                        </div>
                      </TableCell>

                      <TableCell>
                        {request.attendance?.date
                          ? formatDate(request.attendance.date)
                          : "-"}
                      </TableCell>

                      <TableCell>
                        <div className="text-sm">
                          <div>In: {formatTimeDisplay(request.previous_clock_in)}</div>
                          <div>Out: {formatTimeDisplay(request.previous_clock_out)}</div>
                        </div>
                      </TableCell>

                      <TableCell>
                        <div className="text-sm">
                          <div>In: {formatTimeDisplay(request.requested_clock_in)}</div>
                          <div>Out: {formatTimeDisplay(request.requested_clock_out)}</div>
                        </div>
                      </TableCell>

                      <TableCell>
                        <Badge variant={getStatusBadgeVariant(request.status)}>
                          {request.status}
                        </Badge>
                      </TableCell>

                      <TableCell className="max-w-[280px] truncate">
                        {request.request_reason}
                      </TableCell>

                      <TableCell>{formatDateTimeDisplay(request.created_at)}</TableCell>

                      <TableCell>
                        <div className="flex justify-end gap-2">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleOpenViewDialog(request)}
                          >
                            <Eye className="w-4 h-4" />
                          </Button>

                          {request.status === "pending" && (
                            <>
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() =>
                                  handleOpenReviewDialog(request, "approve")
                                }
                              >
                                <Check className="w-4 h-4 text-green-600" />
                              </Button>

                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() =>
                                  handleOpenReviewDialog(request, "reject")
                                }
                              >
                                <X className="w-4 h-4 text-red-600" />
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
              {reviewAction === "approve"
                ? "Approve Attendance Adjustment"
                : reviewAction === "reject"
                ? "Reject Attendance Adjustment"
                : "View Attendance Adjustment"}
            </DialogTitle>
            <DialogDescription>
              {reviewAction === "approve"
                ? "Review the requested punch change and approve the final corrected time."
                : reviewAction === "reject"
                ? "Provide remarks for rejecting this request."
                : "View full details of the attendance adjustment request."}
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={handleSubmitReview} className="flex-1 flex flex-col min-h-0">
            <DialogBody className="flex-1 overflow-y-auto px-6 py-4 min-h-0">
              {error && (
                <div className="mb-4 bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg text-sm">
                  {error}
                </div>
              )}

              {selectedRequest && (
                <div className="space-y-5">
                  <div className="rounded-lg border border-neutral-200 bg-neutral-50 p-4">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
                      <div>
                        <p className="text-neutral-500 mb-1">Employee</p>
                        <p className="text-neutral-900">
                          {selectedRequest.users?.name ?? "-"}
                        </p>
                      </div>
                      <div>
                        <p className="text-neutral-500 mb-1">Date</p>
                        <p className="text-neutral-900">
                          {selectedRequest.attendance?.date
                            ? formatDate(selectedRequest.attendance.date)
                            : "-"}
                        </p>
                      </div>
                      <div>
                        <p className="text-neutral-500 mb-1">Current Time In</p>
                        <p className="text-neutral-900">
                          {formatTimeDisplay(selectedRequest.previous_clock_in)}
                        </p>
                      </div>
                      <div>
                        <p className="text-neutral-500 mb-1">Current Time Out</p>
                        <p className="text-neutral-900">
                          {formatTimeDisplay(selectedRequest.previous_clock_out)}
                        </p>
                      </div>
                      <div>
                        <p className="text-neutral-500 mb-1">Requested Time In</p>
                        <p className="text-neutral-900">
                          {formatTimeDisplay(selectedRequest.requested_clock_in)}
                        </p>
                      </div>
                      <div>
                        <p className="text-neutral-500 mb-1">Requested Time Out</p>
                        <p className="text-neutral-900">
                          {formatTimeDisplay(selectedRequest.requested_clock_out)}
                        </p>
                      </div>
                      <div className="md:col-span-2">
                        <p className="text-neutral-500 mb-1">Employee Reason</p>
                        <p className="text-neutral-900 whitespace-pre-wrap">
                          {selectedRequest.request_reason}
                        </p>
                      </div>
                    </div>
                  </div>

                  {reviewAction === "approve" && (
                    <div className="space-y-4">
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <Input
                          label="Approved Time In"
                          type="time"
                          value={reviewForm.approved_clock_in}
                          onChange={(e) =>
                            setReviewForm((prev) => ({
                              ...prev,
                              approved_clock_in: e.target.value,
                            }))
                          }
                          disabled={isLoading}
                        />

                        <Input
                          label="Approved Time Out"
                          type="time"
                          value={reviewForm.approved_clock_out}
                          onChange={(e) =>
                            setReviewForm((prev) => ({
                              ...prev,
                              approved_clock_out: e.target.value,
                            }))
                          }
                          disabled={isLoading}
                        />
                      </div>

                      <div>
                        <label className="block text-sm mb-1.5 text-neutral-700">
                          Admin Remarks
                        </label>
                        <textarea
                          value={reviewForm.admin_remarks}
                          onChange={(e) =>
                            setReviewForm((prev) => ({
                              ...prev,
                              admin_remarks: e.target.value,
                            }))
                          }
                          rows={4}
                          disabled={isLoading}
                          placeholder="Optional remarks for approval"
                          className="w-full px-3 py-2 border border-neutral-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-neutral-900 focus:border-transparent transition-colors"
                        />
                      </div>
                    </div>
                  )}

                  {reviewAction === "reject" && (
                    <div>
                      <label className="block text-sm mb-1.5 text-neutral-700">
                        Admin Remarks
                      </label>
                      <textarea
                        value={reviewForm.admin_remarks}
                        onChange={(e) =>
                          setReviewForm((prev) => ({
                            ...prev,
                            admin_remarks: e.target.value,
                          }))
                        }
                        rows={4}
                        disabled={isLoading}
                        placeholder="Enter the reason for rejection"
                        className="w-full px-3 py-2 border border-neutral-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-neutral-900 focus:border-transparent transition-colors"
                        required
                      />
                    </div>
                  )}

                  {!reviewAction && (
                    <div className="rounded-lg border border-neutral-200 p-4">
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
                        <div>
                          <p className="text-neutral-500 mb-1">Final Approved Time In</p>
                          <p className="text-neutral-900">
                            {formatTimeDisplay(
                              selectedRequest.approved_clock_in ??
                                selectedRequest.requested_clock_in
                            )}
                          </p>
                        </div>
                        <div>
                          <p className="text-neutral-500 mb-1">Final Approved Time Out</p>
                          <p className="text-neutral-900">
                            {formatTimeDisplay(
                              selectedRequest.approved_clock_out ??
                                selectedRequest.requested_clock_out
                            )}
                          </p>
                        </div>
                        <div className="md:col-span-2">
                          <p className="text-neutral-500 mb-1">Admin Remarks</p>
                          <p className="text-neutral-900 whitespace-pre-wrap">
                            {selectedRequest.admin_remarks || "-"}
                          </p>
                        </div>
                        <div>
                          <p className="text-neutral-500 mb-1">Reviewed At</p>
                          <p className="text-neutral-900">
                            {formatDateTimeDisplay(selectedRequest.reviewed_at)}
                          </p>
                        </div>
                        <div>
                          <p className="text-neutral-500 mb-1">Status</p>
                          <p className="text-neutral-900 capitalize">
                            {selectedRequest.status}
                          </p>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              )}
            </DialogBody>

            <DialogFooter className="px-6 py-4 border-t bg-white shrink-0">
              <Button
                type="button"
                variant="outline"
                onClick={handleCloseDialog}
                disabled={isLoading}
              >
                {reviewAction ? "Cancel" : "Close"}
              </Button>

              {reviewAction && (
                <Button type="submit" disabled={isLoading}>
                  {isLoading
                    ? "Processing..."
                    : reviewAction === "approve"
                    ? "Approve Request"
                    : "Reject Request"}
                </Button>
              )}
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </AdminLayout>
  );
}