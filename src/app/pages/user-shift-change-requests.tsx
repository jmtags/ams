import { FormEvent, useEffect, useMemo, useState } from "react";
import { CalendarClock, Plus } from "lucide-react";

import { UserLayout } from "../layouts/user-layout";
import { Button } from "../components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "../components/ui/card";
import { Input } from "../components/ui/input";
import { Select } from "../components/ui/select";
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
import { shiftService, type Shift } from "../services/shift.service";
import {
  shiftChangeRequestService,
  type ShiftChangeRequest,
} from "../services/shift-change-request.service";
import { formatDate } from "../lib/utils";

type FormState = {
  request_date: string;
  requested_shift_id: string;
  request_reason: string;
};

const initialForm: FormState = {
  request_date: "",
  requested_shift_id: "",
  request_reason: "",
};

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

export function UserShiftChangeRequestsPage() {
  const { user } = useAuth();
  const [requests, setRequests] = useState<ShiftChangeRequest[]>([]);
  const [shifts, setShifts] = useState<Shift[]>([]);
  const [form, setForm] = useState<FormState>(initialForm);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  const activeShifts = useMemo(
    () => shifts.filter((shift) => shift.is_active),
    [shifts]
  );

  const loadData = async () => {
    if (!user?.id) return;

    try {
      setIsLoading(true);
      setError("");

      const [requestData, shiftData] = await Promise.all([
        shiftChangeRequestService.getMyRequests(user.id),
        shiftService.getShifts(),
      ]);

      setRequests(requestData);
      setShifts(shiftData);
    } catch (err: any) {
      setError(err.message || "Failed to load shift change requests.");
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [user?.id]);

  const handleOpenDialog = () => {
    setForm(initialForm);
    setError("");
    setSuccess("");
    setIsDialogOpen(true);
  };

  const handleCloseDialog = () => {
    if (isSubmitting) return;
    setIsDialogOpen(false);
    setForm(initialForm);
  };

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault();
    if (!user?.id) return;

    try {
      setIsSubmitting(true);
      setError("");
      setSuccess("");

      if (!form.request_date || !form.requested_shift_id) {
        throw new Error("Date and requested shift are required.");
      }

      if (!form.request_reason.trim()) {
        throw new Error("Please provide a reason for the shift change.");
      }

      await shiftChangeRequestService.createRequest({
        user_id: user.id,
        request_date: form.request_date,
        requested_shift_id: form.requested_shift_id,
        request_reason: form.request_reason.trim(),
      });

      setSuccess("Shift change request submitted successfully.");
      await loadData();
      handleCloseDialog();
    } catch (err: any) {
      setError(
        err.code === "23505"
          ? "You already have a pending or approved shift change request for this date."
          : err.message || "Failed to submit shift change request."
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <UserLayout>
      <div className="space-y-6">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <h1 className="text-neutral-900 mb-1">Shift Change Requests</h1>
            <p className="text-neutral-600">
              Request a temporary shift change for one specific date.
            </p>
          </div>

          <Button onClick={handleOpenDialog} className="flex items-center gap-2">
            <Plus className="w-4 h-4" />
            New Request
          </Button>
        </div>

        {error && !isDialogOpen && (
          <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg text-sm">
            {error}
          </div>
        )}

        {success && !isDialogOpen && (
          <div className="bg-green-50 border border-green-200 text-green-700 px-4 py-3 rounded-lg text-sm">
            {success}
          </div>
        )}

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <CalendarClock className="w-5 h-5" />
              My Requests
            </CardTitle>
            <CardDescription>
              Approved requests apply only on the requested date.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Date</TableHead>
                  <TableHead>Requested Shift</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Reason</TableHead>
                  <TableHead>Admin Remarks</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {isLoading ? (
                  <TableRow>
                    <TableCell colSpan={5} className="text-center text-neutral-500 py-8">
                      Loading requests...
                    </TableCell>
                  </TableRow>
                ) : requests.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={5} className="text-center text-neutral-500 py-8">
                      No shift change requests found
                    </TableCell>
                  </TableRow>
                ) : (
                  requests.map((request) => (
                    <TableRow key={request.id}>
                      <TableCell>{formatDate(request.request_date)}</TableCell>
                      <TableCell>{formatShift(request.requested_shift)}</TableCell>
                      <TableCell>
                        <Badge variant={getStatusVariant(request.status)}>
                          {request.status}
                        </Badge>
                      </TableCell>
                      <TableCell className="max-w-[280px] truncate">
                        {request.request_reason}
                      </TableCell>
                      <TableCell className="max-w-[280px] truncate">
                        {request.admin_remarks || "-"}
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
          className="max-w-2xl max-h-[90vh] overflow-hidden flex flex-col"
        >
          <DialogHeader>
            <DialogTitle>New Shift Change Request</DialogTitle>
            <DialogDescription>
              This request changes your shift for the selected date only.
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={handleSubmit} className="flex flex-col min-h-0">
            <DialogBody className="overflow-y-auto">
              {error && (
                <div className="mb-4 bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg text-sm">
                  {error}
                </div>
              )}

              <div className="space-y-4">
                <Input
                  label="Date"
                  type="date"
                  value={form.request_date}
                  onChange={(event) =>
                    setForm((prev) => ({
                      ...prev,
                      request_date: event.target.value,
                    }))
                  }
                  required
                  disabled={isSubmitting}
                />

                <Select
                  label="Requested Shift"
                  value={form.requested_shift_id}
                  onChange={(event) =>
                    setForm((prev) => ({
                      ...prev,
                      requested_shift_id: event.target.value,
                    }))
                  }
                  required
                  disabled={isSubmitting}
                >
                  <option value="">Select Shift</option>
                  {activeShifts.map((shift) => (
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
                    Reason
                  </label>
                  <textarea
                    value={form.request_reason}
                    onChange={(event) =>
                      setForm((prev) => ({
                        ...prev,
                        request_reason: event.target.value,
                      }))
                    }
                    rows={4}
                    className="w-full px-3 py-2 border border-neutral-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-neutral-900 focus:border-transparent transition-colors"
                    disabled={isSubmitting}
                    required
                  />
                </div>
              </div>
            </DialogBody>

            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={handleCloseDialog}
                disabled={isSubmitting}
              >
                Cancel
              </Button>
              <Button type="submit" disabled={isSubmitting}>
                {isSubmitting ? "Submitting..." : "Submit Request"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </UserLayout>
  );
}
