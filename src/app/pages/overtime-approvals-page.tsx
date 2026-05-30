import { FormEvent, useEffect, useMemo, useState } from "react";
import { Check, Eye, X } from "lucide-react";
import { AdminLayout } from "../layouts/admin-layout";
import { Badge } from "../components/ui/badge";
import { Button } from "../components/ui/button";
import { Card, CardContent } from "../components/ui/card";
import {
  Dialog,
  DialogBody,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "../components/ui/dialog";
import { Input } from "../components/ui/input";
import { Label } from "../components/ui/label";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "../components/ui/table";
import { Textarea } from "../components/ui/textarea";
import {
  overtimeApprovalService,
  type OvertimeApprovalRow,
} from "../services/overtime-approval.service";
import { formatDate } from "../lib/utils";

type FilterStatus = "pending" | "approved" | "rejected" | "all";
type DialogAction = "view" | "approve" | "reject";

function formatTime(value?: string | null) {
  if (!value) return "-";
  return new Date(value).toLocaleTimeString("en-PH", {
    hour: "2-digit",
    minute: "2-digit",
  });
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

function statusVariant(status: string) {
  if (status === "approved") return "success";
  if (status === "rejected") return "danger";
  if (status === "pending") return "warning";
  return "secondary";
}

export function OvertimeApprovalsPage() {
  const [rows, setRows] = useState<OvertimeApprovalRow[]>([]);
  const [filter, setFilter] = useState<FilterStatus>("pending");
  const [selectedRow, setSelectedRow] = useState<OvertimeApprovalRow | null>(
    null
  );
  const [dialogAction, setDialogAction] = useState<DialogAction>("view");
  const [approvedMinutes, setApprovedMinutes] = useState("");
  const [remarks, setRemarks] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const loadRows = async () => {
    setLoading(true);
    try {
      const data = await overtimeApprovalService.getOvertimeRows();
      setRows(data);
    } catch (err) {
      console.error("Failed to load overtime approvals:", err);
      setError(
        err instanceof Error ? err.message : "Failed to load overtime approvals."
      );
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadRows();
  }, []);

  const filteredRows = useMemo(() => {
    if (filter === "all") return rows;
    return rows.filter((row) => row.overtime_status === filter);
  }, [filter, rows]);

  const openDialog = (row: OvertimeApprovalRow, action: DialogAction) => {
    setSelectedRow(row);
    setDialogAction(action);
    setApprovedMinutes(
      String(row.approved_overtime_minutes || row.minutes_overtime || 0)
    );
    setRemarks(row.remarks ?? "");
    setError("");
  };

  const closeDialog = () => {
    if (submitting) return;
    setSelectedRow(null);
    setDialogAction("view");
    setApprovedMinutes("");
    setRemarks("");
    setError("");
  };

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault();
    if (!selectedRow || dialogAction === "view") return;

    setSubmitting(true);
    setError("");

    try {
      if (dialogAction === "approve") {
        const minutes = Number(approvedMinutes);
        if (!Number.isFinite(minutes) || minutes <= 0) {
          throw new Error("Approved overtime minutes must be greater than zero.");
        }

        if (minutes > selectedRow.minutes_overtime) {
          throw new Error("Approved minutes cannot exceed rendered overtime.");
        }

        await overtimeApprovalService.approveOvertime(
          selectedRow.id,
          minutes,
          remarks
        );
      } else {
        await overtimeApprovalService.rejectOvertime(selectedRow.id, remarks);
      }

      await loadRows();
      closeDialog();
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Failed to update overtime request."
      );
    } finally {
      setSubmitting(false);
    }
  };

  const pendingCount = rows.filter((row) => row.overtime_status === "pending")
    .length;

  return (
    <AdminLayout>
      <div className="space-y-6">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <h1 className="text-neutral-900 mb-1">Overtime Approvals</h1>
            <p className="text-neutral-600">
              Review rendered overtime before it is included in payroll.
            </p>
          </div>

          <div className="flex flex-wrap gap-2">
            {(["pending", "approved", "rejected", "all"] as FilterStatus[]).map(
              (status) => (
                <Button
                  key={status}
                  variant={filter === status ? "default" : "outline"}
                  onClick={() => setFilter(status)}
                >
                  {status === "all" ? "All" : status}
                </Button>
              )
            )}
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <Card>
            <CardContent className="pt-6">
              <p className="text-sm text-neutral-500">Pending Requests</p>
              <p className="text-2xl font-bold mt-2">{pendingCount}</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6">
              <p className="text-sm text-neutral-500">Approved Minutes</p>
              <p className="text-2xl font-bold mt-2">
                {rows.reduce(
                  (sum, row) =>
                    row.overtime_status === "approved"
                      ? sum + row.approved_overtime_minutes
                      : sum,
                  0
                )}
              </p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6">
              <p className="text-sm text-neutral-500">Rendered OT Minutes</p>
              <p className="text-2xl font-bold mt-2">
                {rows.reduce((sum, row) => sum + row.minutes_overtime, 0)}
              </p>
            </CardContent>
          </Card>
        </div>

        {error && !selectedRow ? (
          <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
            {error}
          </div>
        ) : null}

        <Card>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Employee</TableHead>
                  <TableHead>Date</TableHead>
                  <TableHead>Schedule / Punch</TableHead>
                  <TableHead>Rendered OT</TableHead>
                  <TableHead>Approved OT</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {loading ? (
                  <TableRow>
                    <TableCell colSpan={7} className="text-center py-8">
                      Loading overtime records...
                    </TableCell>
                  </TableRow>
                ) : filteredRows.length === 0 ? (
                  <TableRow>
                    <TableCell
                      colSpan={7}
                      className="text-center text-neutral-500 py-8"
                    >
                      No overtime records found.
                    </TableCell>
                  </TableRow>
                ) : (
                  filteredRows.map((row) => (
                    <TableRow key={row.id}>
                      <TableCell>
                        <div className="font-medium">
                          {row.users?.name ?? "-"}
                        </div>
                        <div className="text-xs text-neutral-500">
                          {row.users?.department ?? row.users?.email ?? "-"}
                        </div>
                      </TableCell>
                      <TableCell>{formatDate(row.date)}</TableCell>
                      <TableCell>
                        <div className="text-sm">
                          <div>End: {formatTime(row.scheduled_end)}</div>
                          <div>Out: {formatTime(row.clock_out)}</div>
                        </div>
                      </TableCell>
                      <TableCell>{row.minutes_overtime} min</TableCell>
                      <TableCell>
                        {row.approved_overtime_minutes > 0
                          ? `${row.approved_overtime_minutes} min`
                          : "-"}
                      </TableCell>
                      <TableCell>
                        <Badge variant={statusVariant(row.overtime_status)}>
                          {row.overtime_status}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <div className="flex justify-end gap-2">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => openDialog(row, "view")}
                          >
                            <Eye className="h-4 w-4" />
                          </Button>

                          {row.overtime_status === "pending" ? (
                            <>
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => openDialog(row, "approve")}
                              >
                                <Check className="h-4 w-4 text-green-600" />
                              </Button>
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => openDialog(row, "reject")}
                              >
                                <X className="h-4 w-4 text-red-600" />
                              </Button>
                            </>
                          ) : null}
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

      <Dialog open={!!selectedRow} onOpenChange={(open) => !open && closeDialog()}>
        <DialogContent
          onClose={closeDialog}
          className="w-full max-w-xl max-h-[90vh] overflow-hidden p-0 flex flex-col"
        >
          <DialogHeader className="px-6 pt-6 pb-4 border-b">
            <DialogTitle>
              {dialogAction === "approve"
                ? "Approve Overtime"
                : dialogAction === "reject"
                ? "Reject Overtime"
                : "Overtime Details"}
            </DialogTitle>
            <DialogDescription>
              {dialogAction === "view"
                ? "Review the overtime record details."
                : "Confirm how this overtime should be handled for payroll."}
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={handleSubmit} className="flex min-h-0 flex-1 flex-col">
            <DialogBody className="flex-1 overflow-y-auto px-6 py-4">
              {error && selectedRow ? (
                <div className="mb-4 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
                  {error}
                </div>
              ) : null}

              {selectedRow ? (
                <div className="space-y-4">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-sm">
                    <div>
                      <p className="text-neutral-500">Employee</p>
                      <p className="font-medium">
                        {selectedRow.users?.name ?? "-"}
                      </p>
                    </div>
                    <div>
                      <p className="text-neutral-500">Date</p>
                      <p className="font-medium">{formatDate(selectedRow.date)}</p>
                    </div>
                    <div>
                      <p className="text-neutral-500">Scheduled End</p>
                      <p className="font-medium">
                        {formatDateTime(selectedRow.scheduled_end)}
                      </p>
                    </div>
                    <div>
                      <p className="text-neutral-500">Clock Out</p>
                      <p className="font-medium">
                        {formatDateTime(selectedRow.clock_out)}
                      </p>
                    </div>
                    <div>
                      <p className="text-neutral-500">Rendered OT</p>
                      <p className="font-medium">
                        {selectedRow.minutes_overtime} minutes
                      </p>
                    </div>
                    <div>
                      <p className="text-neutral-500">Status</p>
                      <Badge variant={statusVariant(selectedRow.overtime_status)}>
                        {selectedRow.overtime_status}
                      </Badge>
                    </div>
                  </div>

                  {dialogAction === "approve" ? (
                    <div className="space-y-2">
                      <Label htmlFor="approved_minutes">
                        Approved Overtime Minutes
                      </Label>
                      <Input
                        id="approved_minutes"
                        type="number"
                        min="1"
                        max={selectedRow.minutes_overtime}
                        value={approvedMinutes}
                        onChange={(event) =>
                          setApprovedMinutes(event.target.value)
                        }
                      />
                    </div>
                  ) : null}

                  {dialogAction !== "view" ? (
                    <div className="space-y-2">
                      <Label htmlFor="remarks">Remarks</Label>
                      <Textarea
                        id="remarks"
                        value={remarks}
                        onChange={(event) => setRemarks(event.target.value)}
                        placeholder="Optional approval or rejection remarks"
                      />
                    </div>
                  ) : selectedRow.remarks ? (
                    <div className="space-y-2">
                      <p className="text-sm text-neutral-500">Remarks</p>
                      <p className="rounded-lg border bg-neutral-50 p-3 text-sm">
                        {selectedRow.remarks}
                      </p>
                    </div>
                  ) : null}
                </div>
              ) : null}
            </DialogBody>

            <DialogFooter className="border-t px-6 py-4">
              <Button type="button" variant="outline" onClick={closeDialog}>
                Close
              </Button>
              {dialogAction !== "view" ? (
                <Button type="submit" disabled={submitting}>
                  {submitting
                    ? "Saving..."
                    : dialogAction === "approve"
                    ? "Approve Overtime"
                    : "Reject Overtime"}
                </Button>
              ) : null}
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </AdminLayout>
  );
}
