import { FormEvent, useEffect, useMemo, useState } from "react";
import { Plus, Search, Pencil, Trash2, RefreshCw, Download } from "lucide-react";
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
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "../components/ui/dialog";
import { leaveBalanceService, LeaveBalance, LeaveBalancePayload } from "../services/leave-balance.service";
import { leaveTypeService, LeaveType } from "../services/leave-type.service";
import { userService } from "../services/user.service";

type UserOption = {
  id: string;
  name: string;
  email?: string | null;
};

type FormState = {
  user_id: string;
  leave_type_id: string;
  year: string;
  entitled: string;
  used: string;
  pending: string;
};

const initialForm: FormState = {
  user_id: "",
  leave_type_id: "",
  year: String(new Date().getFullYear()),
  entitled: "0",
  used: "0",
  pending: "0",
};

export default function ManageLeaveBalancesPage() {
  const [leaveBalances, setLeaveBalances] = useState<LeaveBalance[]>([]);
  const [users, setUsers] = useState<UserOption[]>([]);
  const [leaveTypes, setLeaveTypes] = useState<LeaveType[]>([]);

  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);

  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<LeaveBalance | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<LeaveBalance | null>(null);

  const [form, setForm] = useState<FormState>(initialForm);

  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  const totalRecords = useMemo(() => leaveBalances.length, [leaveBalances]);

  const loadReferenceData = async () => {
    const [userData, leaveTypeData] = await Promise.all([
      userService.getUsers(),
      leaveTypeService.getAll(""),
    ]);

    const activeLeaveTypes = leaveTypeData.filter((item) => item.is_active);

    setUsers(
      (userData ?? []).map((user: any) => ({
        id: user.id,
        name: user.name,
        email: user.email ?? null,
      }))
    );
    setLeaveTypes(activeLeaveTypes);
  };

  const loadLeaveBalances = async (keyword = search) => {
    try {
      setLoading(true);
      setError("");
      const data = await leaveBalanceService.getAll(keyword);
      setLeaveBalances(data);
    } catch (err: any) {
      setError(err.message || "Failed to load leave balances.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    const init = async () => {
      try {
        setLoading(true);
        await Promise.all([loadReferenceData(), loadLeaveBalances("")]);
      } catch (err: any) {
        setError(err.message || "Failed to load page data.");
      } finally {
        setLoading(false);
      }
    };

    init();
  }, []);

  const resetMessages = () => {
    setError("");
    setSuccess("");
  };

  const openAddDialog = () => {
    resetMessages();
    setEditingItem(null);
    setForm({
      ...initialForm,
      year: String(new Date().getFullYear()),
    });
    setIsDialogOpen(true);
  };

  const openEditDialog = (item: LeaveBalance) => {
    resetMessages();
    setEditingItem(item);
    setForm({
      user_id: item.user_id,
      leave_type_id: item.leave_type_id,
      year: String(item.year),
      entitled: String(item.entitled),
      used: String(item.used),
      pending: String(item.pending),
    });
    setIsDialogOpen(true);
  };

  const closeDialog = () => {
    if (submitting) return;
    setIsDialogOpen(false);
    setEditingItem(null);
    setForm(initialForm);
  };

  const handleSearch = async (e: FormEvent) => {
    e.preventDefault();
    await loadLeaveBalances(search);
  };

  const handleRefresh = async () => {
    setSearch("");
    await loadLeaveBalances("");
  };

  const handleExport = () => {
    const exportData = leaveBalances.map((item) => ({
      Employee: item.user_name,
      Email: item.user_email ?? "",
      "Leave Type Code": item.leave_type_code,
      "Leave Type Name": item.leave_type_name,
      Year: item.year,
      Entitled: item.entitled,
      Used: item.used,
      Pending: item.pending,
      Available: item.entitled - item.used - item.pending,
      "Created At": item.created_at ? new Date(item.created_at).toLocaleString() : "",
      "Updated At": item.updated_at ? new Date(item.updated_at).toLocaleString() : "",
    }));

    const worksheet = XLSX.utils.json_to_sheet(exportData);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, "Leave Balances");

    const excelBuffer = XLSX.write(workbook, {
      bookType: "xlsx",
      type: "array",
    });

    const blob = new Blob([excelBuffer], {
      type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet;charset=UTF-8",
    });

    const fileName = `leave-balances-${new Date().toISOString().slice(0, 10)}.xlsx`;
    saveAs(blob, fileName);
  };

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();

    try {
      setSubmitting(true);
      resetMessages();

      const payload: LeaveBalancePayload = {
        user_id: form.user_id,
        leave_type_id: form.leave_type_id,
        year: Number(form.year),
        entitled: Number(form.entitled),
        used: Number(form.used),
        pending: Number(form.pending),
      };

      if (Number.isNaN(payload.year) || payload.year <= 0) {
        throw new Error("Please enter a valid year.");
      }

      if (Number.isNaN(payload.entitled) || payload.entitled < 0) {
        throw new Error("Entitled must be 0 or higher.");
      }

      if (Number.isNaN(payload.used) || (payload.used ?? 0) < 0) {
        throw new Error("Used must be 0 or higher.");
      }

      if (Number.isNaN(payload.pending) || (payload.pending ?? 0) < 0) {
        throw new Error("Pending must be 0 or higher.");
      }

      if (editingItem) {
        const updated = await leaveBalanceService.update(editingItem.id, payload);
        setLeaveBalances((prev) =>
          prev.map((item) => (item.id === updated.id ? updated : item))
        );
        setSuccess("Leave balance updated successfully.");
      } else {
        const created = await leaveBalanceService.create(payload);
        setLeaveBalances((prev) => [created, ...prev]);
        setSuccess("Leave balance created successfully.");
      }

      setIsDialogOpen(false);
      setEditingItem(null);
      setForm(initialForm);
    } catch (err: any) {
      setError(err.message || "Failed to save leave balance.");
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;

    try {
      setSubmitting(true);
      resetMessages();

      await leaveBalanceService.remove(deleteTarget.id);
      setLeaveBalances((prev) => prev.filter((item) => item.id !== deleteTarget.id));
      setSuccess("Leave balance deleted successfully.");
      setDeleteTarget(null);
    } catch (err: any) {
      setError(err.message || "Failed to delete leave balance.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <AdminLayout>
      <div className="space-y-6">
        <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
          <div>
            <h1 className="text-2xl font-bold">Leave Balance Management</h1>
            <p className="text-sm text-neutral-600">
              Assign, update, search, delete, and export leave balances for employees.
            </p>
          </div>

          <div className="flex flex-wrap gap-2">
            <Button variant="outline" onClick={handleRefresh} disabled={loading}>
              <RefreshCw className="mr-2 h-4 w-4" />
              Refresh
            </Button>
            <Button variant="outline" onClick={handleExport} disabled={leaveBalances.length === 0}>
              <Download className="mr-2 h-4 w-4" />
              Export Excel
            </Button>
            <Button onClick={openAddDialog}>
              <Plus className="mr-2 h-4 w-4" />
              Add Leave Balance
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
            <CardTitle>Search Leave Balances</CardTitle>
            <CardDescription>
              Search by employee name, email, leave type, or year.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form
              onSubmit={handleSearch}
              className="flex flex-col gap-3 md:flex-row md:items-center"
            >
              <div className="relative flex-1">
                <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-neutral-400" />
                <Input
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Search leave balances..."
                  className="pl-9"
                />
              </div>
              <Button type="submit" disabled={loading}>
                Search
              </Button>
            </form>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Leave Balances List</CardTitle>
            <CardDescription>Total records: {totalRecords}</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Employee</TableHead>
                    <TableHead>Leave Type</TableHead>
                    <TableHead>Year</TableHead>
                    <TableHead>Entitled</TableHead>
                    <TableHead>Used</TableHead>
                    <TableHead>Pending</TableHead>
                    <TableHead>Available</TableHead>
                    <TableHead>Updated At</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>

                <TableBody>
                  {loading ? (
                    <TableRow>
                      <TableCell colSpan={9} className="text-center">
                        Loading leave balances...
                      </TableCell>
                    </TableRow>
                  ) : leaveBalances.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={9} className="text-center">
                        No leave balances found.
                      </TableCell>
                    </TableRow>
                  ) : (
                    leaveBalances.map((item) => {
                      const available = item.entitled - item.used - item.pending;

                      return (
                        <TableRow key={item.id}>
                          <TableCell>
                            <div className="font-medium">{item.user_name}</div>
                            <div className="text-xs text-neutral-500">{item.user_email ?? "-"}</div>
                          </TableCell>
                          <TableCell>
                            <div className="font-medium">{item.leave_type_name}</div>
                            <div className="text-xs text-neutral-500">{item.leave_type_code}</div>
                          </TableCell>
                          <TableCell>{item.year}</TableCell>
                          <TableCell>{item.entitled}</TableCell>
                          <TableCell>{item.used}</TableCell>
                          <TableCell>{item.pending}</TableCell>
                          <TableCell>{available}</TableCell>
                          <TableCell>
                            {item.updated_at
                              ? new Date(item.updated_at).toLocaleString()
                              : item.created_at
                              ? new Date(item.created_at).toLocaleString()
                              : "-"}
                          </TableCell>
                          <TableCell>
                            <div className="flex justify-end gap-2">
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => openEditDialog(item)}
                              >
                                <Pencil className="mr-2 h-4 w-4" />
                                Edit
                              </Button>
                              <Button
                                variant="destructive"
                                size="sm"
                                onClick={() => setDeleteTarget(item)}
                              >
                                <Trash2 className="mr-2 h-4 w-4" />
                                Delete
                              </Button>
                            </div>
                          </TableCell>
                        </TableRow>
                      );
                    })
                  )}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>

        <Dialog open={isDialogOpen} onOpenChange={(open) => !submitting && setIsDialogOpen(open)}>
          <DialogContent className="max-w-xl">
            <DialogHeader>
              <DialogTitle>
                {editingItem ? "Edit Leave Balance" : "Add Leave Balance"}
              </DialogTitle>
              <DialogDescription>
                Assign leave balance to an employee by leave type and year.
              </DialogDescription>
            </DialogHeader>

            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="mb-2 block text-sm font-medium">Employee</label>
                <select
                  value={form.user_id}
                  onChange={(e) => setForm((prev) => ({ ...prev, user_id: e.target.value }))}
                  className="w-full rounded-md border border-neutral-300 px-3 py-2 text-sm"
                  required
                >
                  <option value="">Select employee</option>
                  {users.map((user) => (
                    <option key={user.id} value={user.id}>
                      {user.name} {user.email ? `(${user.email})` : ""}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="mb-2 block text-sm font-medium">Leave Type</label>
                <select
                  value={form.leave_type_id}
                  onChange={(e) => setForm((prev) => ({ ...prev, leave_type_id: e.target.value }))}
                  className="w-full rounded-md border border-neutral-300 px-3 py-2 text-sm"
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

              <div className="grid gap-4 md:grid-cols-2">
                <div>
                  <label className="mb-2 block text-sm font-medium">Year</label>
                  <Input
                    type="number"
                    value={form.year}
                    onChange={(e) => setForm((prev) => ({ ...prev, year: e.target.value }))}
                    required
                  />
                </div>

                <div>
                  <label className="mb-2 block text-sm font-medium">Entitled</label>
                  <Input
                    type="number"
                    step="0.5"
                    min="0"
                    value={form.entitled}
                    onChange={(e) => setForm((prev) => ({ ...prev, entitled: e.target.value }))}
                    required
                  />
                </div>

                <div>
                  <label className="mb-2 block text-sm font-medium">Used</label>
                  <Input
                    type="number"
                    step="0.5"
                    min="0"
                    value={form.used}
                    onChange={(e) => setForm((prev) => ({ ...prev, used: e.target.value }))}
                    required
                  />
                </div>

                <div>
                  <label className="mb-2 block text-sm font-medium">Pending</label>
                  <Input
                    type="number"
                    step="0.5"
                    min="0"
                    value={form.pending}
                    onChange={(e) => setForm((prev) => ({ ...prev, pending: e.target.value }))}
                    required
                  />
                </div>
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <Button type="button" variant="outline" onClick={closeDialog} disabled={submitting}>
                  Cancel
                </Button>
                <Button type="submit" disabled={submitting}>
                  {submitting
                    ? editingItem
                      ? "Updating..."
                      : "Saving..."
                    : editingItem
                    ? "Update"
                    : "Save"}
                </Button>
              </div>
            </form>
          </DialogContent>
        </Dialog>

        <Dialog
          open={!!deleteTarget}
          onOpenChange={(open) => !submitting && !open && setDeleteTarget(null)}
        >
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle>Delete Leave Balance</DialogTitle>
              <DialogDescription>
                This action cannot be undone.
              </DialogDescription>
            </DialogHeader>

            <div className="py-2 text-sm text-neutral-700">
              Are you sure you want to delete the leave balance for{" "}
              <span className="font-semibold">{deleteTarget?.user_name}</span>{" "}
              - <span className="font-semibold">{deleteTarget?.leave_type_name}</span>?
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <Button
                type="button"
                variant="outline"
                onClick={() => setDeleteTarget(null)}
                disabled={submitting}
              >
                Cancel
              </Button>
              <Button
                type="button"
                variant="destructive"
                onClick={handleDelete}
                disabled={submitting}
              >
                {submitting ? "Deleting..." : "Delete"}
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>
    </AdminLayout>
  );
}