import { useEffect, useMemo, useState, FormEvent } from "react";
import { Plus, Search, Pencil, Trash2, RefreshCw } from "lucide-react";

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
  DialogBody,
  DialogFooter,
} from "../components/ui/dialog";

import {
  leaveTypeService,
  LeaveType,
  LeaveTypePayload,
} from "../services/leave-type.service";

type FormState = {
  code: string;
  name: string;
  description: string;
  requires_attachment: boolean;
  is_active: boolean;
};

const initialForm: FormState = {
  code: "",
  name: "",
  description: "",
  requires_attachment: false,
  is_active: true,
};

export default function ManageLeaveTypesPage() {
  const [leaveTypes, setLeaveTypes] = useState<LeaveType[]>([]);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);

  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingLeaveType, setEditingLeaveType] = useState<LeaveType | null>(null);
  const [form, setForm] = useState<FormState>(initialForm);

  const [deleteTarget, setDeleteTarget] = useState<LeaveType | null>(null);

  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  const filteredCount = useMemo(() => leaveTypes.length, [leaveTypes]);

  const loadLeaveTypes = async (keyword = search) => {
    try {
      setLoading(true);
      setError("");
      const data = await leaveTypeService.getAll(keyword);
      setLeaveTypes(data);
    } catch (err: any) {
      setError(err.message || "Failed to load leave types.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadLeaveTypes();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const resetMessages = () => {
    setError("");
    setSuccess("");
  };

  const openAddDialog = () => {
    resetMessages();
    setEditingLeaveType(null);
    setForm(initialForm);
    setIsDialogOpen(true);
  };

  const openEditDialog = (leaveType: LeaveType) => {
    resetMessages();
    setEditingLeaveType(leaveType);
    setForm({
      code: leaveType.code,
      name: leaveType.name,
      description: leaveType.description ?? "",
      requires_attachment: leaveType.requires_attachment,
      is_active: leaveType.is_active,
    });
    setIsDialogOpen(true);
  };

  const closeDialog = () => {
    if (submitting) return;
    setIsDialogOpen(false);
    setEditingLeaveType(null);
    setForm(initialForm);
  };

  const handleSearch = async (e: FormEvent) => {
    e.preventDefault();
    await loadLeaveTypes(search);
  };

  const handleRefresh = async () => {
    setSearch("");
    await loadLeaveTypes("");
  };

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();

    try {
      setSubmitting(true);
      resetMessages();

      const payload: LeaveTypePayload = {
        code: form.code,
        name: form.name,
        description: form.description,
        requires_attachment: form.requires_attachment,
        is_active: form.is_active,
      };

      if (editingLeaveType) {
        const updated = await leaveTypeService.update(editingLeaveType.id, payload);
        setLeaveTypes((prev) =>
          prev.map((item) => (item.id === updated.id ? updated : item))
        );
        setSuccess("Leave type updated successfully.");
      } else {
        const created = await leaveTypeService.create(payload);
        setLeaveTypes((prev) => [created, ...prev]);
        setSuccess("Leave type created successfully.");
      }

      setIsDialogOpen(false);
      setEditingLeaveType(null);
      setForm(initialForm);
    } catch (err: any) {
      setError(err.message || "Failed to save leave type.");
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;

    try {
      setSubmitting(true);
      resetMessages();

      await leaveTypeService.remove(deleteTarget.id);
      setLeaveTypes((prev) => prev.filter((item) => item.id !== deleteTarget.id));
      setSuccess("Leave type deleted successfully.");
      setDeleteTarget(null);
    } catch (err: any) {
      setError(err.message || "Failed to delete leave type.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <AdminLayout>
      <div className="space-y-6 p-6">
        <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
          <div>
            <h1 className="text-2xl font-bold">Leave Types Management</h1>
            <p className="text-sm text-muted-foreground">
              Add, edit, delete, and manage leave types for your leave module.
            </p>
          </div>

          <div className="flex gap-2">
            <Button variant="outline" onClick={handleRefresh} disabled={loading}>
              <RefreshCw className="mr-2 h-4 w-4" />
              Refresh
            </Button>
            <Button onClick={openAddDialog}>
              <Plus className="mr-2 h-4 w-4" />
              Add Leave Type
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
            <CardTitle>Search Leave Types</CardTitle>
            <CardDescription>
              Search by code, name, or description.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form
              onSubmit={handleSearch}
              className="flex flex-col gap-3 md:flex-row md:items-center"
            >
              <div className="relative flex-1">
                <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Search leave types..."
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
            <CardTitle>Leave Types List</CardTitle>
            <CardDescription>
              Total records: {filteredCount}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Code</TableHead>
                    <TableHead>Name</TableHead>
                    <TableHead>Description</TableHead>
                    <TableHead>Attachment Required</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Created At</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>

                <TableBody>
                  {loading ? (
                    <TableRow>
                      <TableCell colSpan={7} className="text-center">
                        Loading leave types...
                      </TableCell>
                    </TableRow>
                  ) : leaveTypes.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={7} className="text-center">
                        No leave types found.
                      </TableCell>
                    </TableRow>
                  ) : (
                    leaveTypes.map((item) => (
                      <TableRow key={item.id}>
                        <TableCell className="font-medium">{item.code}</TableCell>
                        <TableCell>{item.name}</TableCell>
                        <TableCell>{item.description || "-"}</TableCell>
                        <TableCell>
                          <Badge variant={item.requires_attachment ? "default" : "secondary"}>
                            {item.requires_attachment ? "Yes" : "No"}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          <Badge variant={item.is_active ? "default" : "secondary"}>
                            {item.is_active ? "Active" : "Inactive"}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          {item.created_at
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
                    ))
                  )}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>

        <Dialog open={isDialogOpen} onOpenChange={(open) => !submitting && setIsDialogOpen(open)}>
          <DialogContent className="max-w-lg">
            <DialogHeader>
              <DialogTitle>
                {editingLeaveType ? "Edit Leave Type" : "Add Leave Type"}
              </DialogTitle>
              <DialogDescription>
                Fill in the leave type details below.
              </DialogDescription>
            </DialogHeader>

            <form onSubmit={handleSubmit}>
              <DialogBody>
                <div className="grid gap-4">
                  <div>
                    <label className="mb-2 block text-sm font-medium">Code</label>
                    <Input
                      value={form.code}
                      onChange={(e) =>
                        setForm((prev) => ({
                          ...prev,
                          code: e.target.value.toUpperCase(),
                        }))
                      }
                      placeholder="e.g. SL"
                      maxLength={20}
                      required
                    />
                  </div>

                  <div>
                    <label className="mb-2 block text-sm font-medium">Name</label>
                    <Input
                      value={form.name}
                      onChange={(e) =>
                        setForm((prev) => ({
                          ...prev,
                          name: e.target.value,
                        }))
                      }
                      placeholder="e.g. Sick Leave"
                      required
                    />
                  </div>

                  <div>
                    <label className="mb-2 block text-sm font-medium">Description</label>
                    <textarea
                      value={form.description}
                      onChange={(e) =>
                        setForm((prev) => ({
                          ...prev,
                          description: e.target.value,
                        }))
                      }
                      placeholder="Optional description"
                      rows={3}
                      className="w-full rounded-md border px-3 py-2 text-sm outline-none"
                    />
                  </div>

                  <div className="flex items-center justify-between rounded-md border px-3 py-3">
                    <div>
                      <p className="text-sm font-medium">Requires Attachment</p>
                      <p className="text-xs text-muted-foreground">
                        Turn on if this leave type needs document proof.
                      </p>
                    </div>
                    <input
                      type="checkbox"
                      checked={form.requires_attachment}
                      onChange={(e) =>
                        setForm((prev) => ({
                          ...prev,
                          requires_attachment: e.target.checked,
                        }))
                      }
                    />
                  </div>

                  <div className="flex items-center justify-between rounded-md border px-3 py-3">
                    <div>
                      <p className="text-sm font-medium">Active</p>
                      <p className="text-xs text-muted-foreground">
                        Inactive types cannot be used for new leave requests.
                      </p>
                    </div>
                    <input
                      type="checkbox"
                      checked={form.is_active}
                      onChange={(e) =>
                        setForm((prev) => ({
                          ...prev,
                          is_active: e.target.checked,
                        }))
                      }
                    />
                  </div>
                </div>
              </DialogBody>

              <DialogFooter>
                <Button
                  type="button"
                  variant="outline"
                  onClick={closeDialog}
                  disabled={submitting}
                >
                  Cancel
                </Button>
                <Button type="submit" disabled={submitting}>
                  {submitting
                    ? editingLeaveType
                      ? "Updating..."
                      : "Saving..."
                    : editingLeaveType
                    ? "Update"
                    : "Save"}
                </Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>

        <Dialog
          open={!!deleteTarget}
          onOpenChange={(open) => !submitting && !open && setDeleteTarget(null)}
        >
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle>Delete Leave Type</DialogTitle>
              <DialogDescription>
                This action cannot be undone.
              </DialogDescription>
            </DialogHeader>

            <DialogBody>
              <p className="text-sm">
                Are you sure you want to delete{" "}
                <span className="font-semibold">{deleteTarget?.name}</span>?
              </p>
            </DialogBody>

            <DialogFooter>
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
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </AdminLayout>
  );
}