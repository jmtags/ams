import { FormEvent, useEffect, useState } from "react";
import { Check, Eye, X } from "lucide-react";

import { AdminLayout } from "../layouts/admin-layout";
import { Button } from "../components/ui/button";
import { Card, CardContent } from "../components/ui/card";
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
import { useAuth } from "../hooks/useAuth";
import {
  shiftChangeRequestService,
  type ShiftChangeRequest,
} from "../services/shift-change-request.service";
import { formatDate } from "../lib/utils";

type FilterStatus = "pending" | "approved" | "rejected" | "all";

function getStatusVariant(status: string) {
  switch (status) {
    case "approved":
      return "success";
    case "pending":
      return "warning";
    case "rejected":
      return "danger";
    default:
      return "default";
  }
}

function formatShift(shift?: { name?: string | null; start_time?: string | null; end_time?: string | null } | null) {
  if (!shift) return "-";
  return `${shift.name ?? "Shift"} (${shift.start_time?.slice(0, 5) ?? "--:--"} - ${
    shift.end_time?.slice(0, 5) ?? "--:--"
  })`;
}

function formatDateTime(value?: string | null) {
  if (!value) return "-";
  return new Date(value).toLocaleString("en-PH", {
    year: "numeric",
    month: "short",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function AdminShiftChangeRequestsPage() {
  const { user } = useAuth();
  const [requests, setRequests] = useState<ShiftChangeRequest[]>([]);
  const [filteredStatus, setFilteredStatus] = useState<FilterStatus>("pending");
  const [selectedRequest, setSelectedRequest] =
    useState<ShiftChangeRequest | null>(null);
  const [reviewAction, setReviewAction] = useState<"approve" | "reject" | null>(
    null
  );
  const [remarks, setRemarks] = useState("");
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState("");

  const loadRequests = async () => {
    try {
      setError("");
      const data = await shiftChangeRequestService.getAllRequests();
      setRequests(data);
    } catch (err: any) {
      setError(err.message || "Failed to load shift change requests.");
    }
  };

  useEffect(() => {
    loadRequests();
  }, []);

  const filteredRequests =
    filteredStatus === "all"
      ? requests
      : requests.filter((request) => request.status === filteredStatus);

  const openDialog = (
    request: ShiftChangeRequest,
    action: "approve" | "reject" | null
  ) => {
    setSelectedRequest(request);
    setReviewAction(action);
    setRemarks(request.admin_remarks ?? "");
    setError("");
    setIsDialogOpen(true);
  };

  const closeDialog = () => {
    if (isLoading) return;
    setSelectedRequest(null);
    setReviewAction(null);
    setRemarks("");
    setError("");
    setIsDialogOpen(false);
  };

  const handleSubmitReview = async (event: FormEvent) => {
    event.preventDefault();
    if (!selectedRequest || !reviewAction || !user?.id) return;

    try {
      setIsLoading(true);
      setError("");

      if (reviewAction === "reject" && !remarks.trim()) {
        throw new Error("Remarks are required when rejecting a request.");
      }

      if (reviewAction === "approve") {
        await shiftChangeRequestService.approveRequest(selectedRequest, {
          reviewed_by: user.id,
          admin_remarks: remarks.trim(),
        });
      } else {
        await shiftChangeRequestService.rejectRequest(selectedRequest.id, {
          reviewed_by: user.id,
          admin_remarks: remarks.trim(),
        });
      }

      await loadRequests();
      closeDialog();
    } catch (err: any) {
      setError(err.message || "Failed to process shift change request.");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <AdminLayout>
      <div className="space-y-6">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <h1 className="text-neutral-900 mb-1">Shift Change Requests</h1>
            <p className="text-neutral-600">
              Review one-day shift changes submitted by employees.
            </p>
          </div>

          <div className="flex flex-wrap gap-2">
            {(["pending", "approved", "rejected", "all"] as FilterStatus[]).map(
              (status) => (
                <Button
                  key={status}
                  variant={filteredStatus === status ? "primary" : "outline"}
                  onClick={() => setFilteredStatus(status)}
                >
                  {status[0].toUpperCase() + status.slice(1)}
                </Button>
              )
            )}
          </div>
        </div>

        {error && !isDialogOpen && (
          <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg text-sm">
            {error}
          </div>
        )}

        <Card>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Employee</TableHead>
                  <TableHead>Date</TableHead>
                  <TableHead>Current Shift</TableHead>
                  <TableHead>Requested Shift</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Reason</TableHead>
                  <TableHead>Requested At</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredRequests.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={8} className="text-center text-neutral-500 py-8">
                      No shift change requests found
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
                      <TableCell>{formatDate(request.request_date)}</TableCell>
                      <TableCell>{formatShift(request.users?.shifts)}</TableCell>
                      <TableCell>{formatShift(request.requested_shift)}</TableCell>
                      <TableCell>
                        <Badge variant={getStatusVariant(request.status)}>
                          {request.status}
                        </Badge>
                      </TableCell>
                      <TableCell className="max-w-[260px] truncate">
                        {request.request_reason}
                      </TableCell>
                      <TableCell>{formatDateTime(request.created_at)}</TableCell>
                      <TableCell>
                        <div className="flex justify-end gap-2">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => openDialog(request, null)}
                          >
                            <Eye className="w-4 h-4" />
                          </Button>

                          {request.status === "pending" && (
                            <>
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => openDialog(request, "approve")}
                              >
                                <Check className="w-4 h-4 text-green-600" />
                              </Button>

                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => openDialog(request, "reject")}
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

      <Dialog open={isDialogOpen} onOpenChange={(open) => !open && closeDialog()}>
        <DialogContent
          onClose={closeDialog}
          className="max-w-2xl max-h-[90vh] overflow-hidden flex flex-col"
        >
          <DialogHeader>
            <DialogTitle>
              {reviewAction === "approve"
                ? "Approve Shift Change"
                : reviewAction === "reject"
                ? "Reject Shift Change"
                : "View Shift Change"}
            </DialogTitle>
            <DialogDescription>
              Approved requests update the attendance shift for this date only.
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={handleSubmitReview} className="flex flex-col min-h-0">
            <DialogBody className="overflow-y-auto">
              {error && (
                <div className="mb-4 bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg text-sm">
                  {error}
                </div>
              )}

              {selectedRequest && (
                <div className="space-y-4">
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
                          {formatDate(selectedRequest.request_date)}
                        </p>
                      </div>
                      <div>
                        <p className="text-neutral-500 mb-1">Current Shift</p>
                        <p className="text-neutral-900">
                          {formatShift(selectedRequest.users?.shifts)}
                        </p>
                      </div>
                      <div>
                        <p className="text-neutral-500 mb-1">Requested Shift</p>
                        <p className="text-neutral-900">
                          {formatShift(selectedRequest.requested_shift)}
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

                  <div>
                    <label className="block text-sm mb-1.5 text-neutral-700">
                      Admin Remarks
                    </label>
                    <textarea
                      value={remarks}
                      onChange={(event) => setRemarks(event.target.value)}
                      rows={4}
                      disabled={isLoading || !reviewAction}
                      required={reviewAction === "reject"}
                      className="w-full px-3 py-2 border border-neutral-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-neutral-900 focus:border-transparent transition-colors disabled:bg-neutral-100"
                    />
                  </div>
                </div>
              )}
            </DialogBody>

            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={closeDialog}
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
