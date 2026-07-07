import { FormEvent, useEffect, useMemo, useState } from "react";
import { Eye, FileText, Plus, Pencil, Trash2, RefreshCw, X } from "lucide-react";

import { AdminLayout } from "../layouts/admin-layout";
import { Button } from "../components/ui/button";
import { Input } from "../components/ui/input";
import { Badge } from "../components/ui/badge";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "../components/ui/card";
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
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "../components/ui/table";

import { userService, type User } from "../services/user.service";
import {
  recurringDeductionService,
  type RecurringDeduction,
  type RecurringDeductionAttachment,
} from "../services/recurring-deduction.service";
import { useAuth } from "../hooks/useAuth";

type FormState = {
  user_id: string;
  adjustment_type: "addition" | "deduction";
  name: string;
  amount: string;
  deduction_type: "fixed" | "percentage";
  frequency:
    | "every_payroll"
    | "monthly_first_half"
    | "monthly_second_half"
    | "one_time";
  start_date: string;
  end_date: string;
  is_active: boolean;
  notes: string;
};

const getTodayDate = () => {
  const now = new Date();
  const year = now.getFullYear();
  const month = `${now.getMonth() + 1}`.padStart(2, "0");
  const day = `${now.getDate()}`.padStart(2, "0");
  return `${year}-${month}-${day}`;
};

const defaultForm: FormState = {
  user_id: "",
  adjustment_type: "deduction",
  name: "",
  amount: "0",
  deduction_type: "fixed",
  frequency: "every_payroll",
  start_date: getTodayDate(),
  end_date: "",
  is_active: true,
  notes: "",
};

const currency = (value: number) =>
  new Intl.NumberFormat("en-PH", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(Number(value || 0));

const formatFileSize = (bytes?: number | null) => {
  if (!bytes) return "-";
  return bytes >= 1024 * 1024
    ? `${(bytes / 1024 / 1024).toFixed(1)} MB`
    : `${Math.ceil(bytes / 1024)} KB`;
};

const getAttachmentKind = (attachment: RecurringDeductionAttachment) => {
  const name = attachment.file_name.toLowerCase();
  const type = attachment.file_type?.toLowerCase() ?? "";

  if (type.includes("pdf") || name.endsWith(".pdf")) return "pdf";
  if (type.includes("text") || name.endsWith(".txt")) return "text";
  if (name.endsWith(".doc") || name.endsWith(".docx") || type.includes("word")) {
    return "word";
  }

  return "other";
};

export function AdminRecurringDeductionsPage() {
  const { user } = useAuth();
  const [records, setRecords] = useState<RecurringDeduction[]>([]);
  const [users, setUsers] = useState<User[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const [search, setSearch] = useState("");
  const [userFilter, setUserFilter] = useState("all");
  const [activeFilter, setActiveFilter] = useState("all");
  const [frequencyFilter, setFrequencyFilter] = useState("all");

  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingRecord, setEditingRecord] = useState<RecurringDeduction | null>(null);
  const [form, setForm] = useState<FormState>(defaultForm);
  const [isSaving, setIsSaving] = useState(false);
  const [attachments, setAttachments] = useState<RecurringDeductionAttachment[]>([]);
  const [pendingAttachments, setPendingAttachments] = useState<File[]>([]);
  const [deletingAttachmentId, setDeletingAttachmentId] = useState<string | null>(null);
  const [viewerAttachment, setViewerAttachment] =
    useState<RecurringDeductionAttachment | null>(null);
  const [textPreview, setTextPreview] = useState("");
  const [isLoadingTextPreview, setIsLoadingTextPreview] = useState(false);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      setIsLoading(true);

      const [deductionData, userData] = await Promise.all([
        recurringDeductionService.getAll(),
        userService.getUsers(),
      ]);

      setRecords(deductionData);
      setUsers(userData);
    } catch (error: any) {
      console.error("Failed to load recurring deductions:", error);
      alert(error.message || "Failed to load recurring deductions.");
    } finally {
      setIsLoading(false);
    }
  };

  const openCreateDialog = () => {
    setEditingRecord(null);
    setForm({
      ...defaultForm,
      start_date: getTodayDate(),
    });
    setAttachments([]);
    setPendingAttachments([]);
    setIsDialogOpen(true);
  };

  const openEditDialog = async (record: RecurringDeduction) => {
    setEditingRecord(record);
    setForm({
      user_id: record.user_id,
      adjustment_type: record.adjustment_type,
      name: record.name ?? "",
      amount: String(record.amount ?? 0),
      deduction_type: record.deduction_type,
      frequency: record.frequency,
      start_date: record.start_date ?? "",
      end_date: record.end_date ?? "",
      is_active: Boolean(record.is_active),
      notes: record.notes ?? "",
    });
    setPendingAttachments([]);
    setAttachments([]);
    setIsDialogOpen(true);

    try {
      const data = await recurringDeductionService.getAttachments(record.id);
      setAttachments(data);
    } catch (error: any) {
      console.error("Failed to load attachments:", error);
      alert(error.message || "Failed to load attachments.");
    }
  };

  const closeDialog = () => {
    if (isSaving) return;
    setIsDialogOpen(false);
    setEditingRecord(null);
    setForm(defaultForm);
    setAttachments([]);
    setPendingAttachments([]);
  };

  const handleAttachmentChange = (files?: FileList | null) => {
    if (!files?.length) return;
    setPendingAttachments((prev) => [...prev, ...Array.from(files)]);
  };

  const removePendingAttachment = (index: number) => {
    setPendingAttachments((prev) => prev.filter((_, itemIndex) => itemIndex !== index));
  };

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();

    if (!form.user_id) {
      alert("Employee is required.");
      return;
    }

    if (!form.name.trim()) {
      alert("Name is required.");
      return;
    }

    if (Number(form.amount) <= 0) {
      alert("Amount must be greater than zero.");
      return;
    }

    if (!form.start_date) {
      alert("Start date is required.");
      return;
    }

    if (form.end_date && form.end_date < form.start_date) {
      alert("End date cannot be earlier than start date.");
      return;
    }

    try {
      setIsSaving(true);

      const payload = {
        user_id: form.user_id,
        adjustment_type: form.adjustment_type,
        name: form.name.trim(),
        amount: Number(form.amount),
        deduction_type: form.deduction_type,
        frequency: form.frequency,
        start_date: form.start_date,
        end_date: form.end_date || null,
        is_active: form.is_active,
        notes: form.notes.trim() || null,
      };

      let savedRecord: RecurringDeduction;

      if (editingRecord) {
        savedRecord = await recurringDeductionService.update(editingRecord.id, payload);
      } else {
        savedRecord = await recurringDeductionService.create(payload);
      }

      if (pendingAttachments.length) {
        await recurringDeductionService.addAttachments(
          savedRecord.id,
          pendingAttachments,
          user?.id ?? null
        );
      }

      await loadData();
      closeDialog();
    } catch (error: any) {
      console.error("Failed to save recurring payroll item:", error);
      alert(error.message || "Failed to save recurring payroll item.");
    } finally {
      setIsSaving(false);
    }
  };

  const handleDelete = async (record: RecurringDeduction) => {
    const confirmed = window.confirm(
      `Delete recurring ${record.adjustment_type} "${record.name}" for ${record.user_name || "this employee"}?`
    );

    if (!confirmed) return;

    try {
      await recurringDeductionService.remove(record.id);
      await loadData();
    } catch (error: any) {
      console.error("Failed to delete recurring payroll item:", error);
      alert(error.message || "Failed to delete recurring payroll item.");
    }
  };

  const handleDeleteAttachment = async (attachment: RecurringDeductionAttachment) => {
    if (!window.confirm(`Delete attachment "${attachment.file_name}"?`)) return;

    try {
      setDeletingAttachmentId(attachment.id);
      await recurringDeductionService.deleteAttachment(attachment);
      setAttachments((prev) => prev.filter((item) => item.id !== attachment.id));
      if (viewerAttachment?.id === attachment.id) {
        setViewerAttachment(null);
      }
    } catch (error: any) {
      console.error("Failed to delete attachment:", error);
      alert(error.message || "Failed to delete attachment.");
    } finally {
      setDeletingAttachmentId(null);
    }
  };

  useEffect(() => {
    if (!viewerAttachment || getAttachmentKind(viewerAttachment) !== "text") {
      setTextPreview("");
      return;
    }

    let cancelled = false;

    const loadTextPreview = async () => {
      try {
        setIsLoadingTextPreview(true);
        const response = await fetch(viewerAttachment.file_url);
        if (!response.ok) throw new Error("Failed to load text file.");
        const text = await response.text();
        if (!cancelled) setTextPreview(text);
      } catch (error: any) {
        if (!cancelled) {
          setTextPreview(error.message || "Failed to load text file.");
        }
      } finally {
        if (!cancelled) setIsLoadingTextPreview(false);
      }
    };

    void loadTextPreview();

    return () => {
      cancelled = true;
    };
  }, [viewerAttachment]);

  const filteredRecords = useMemo(() => {
    return records.filter((item) => {
      const haystack = [
        item.user_name ?? "",
        item.user_email ?? "",
        item.adjustment_type ?? "",
        item.name ?? "",
        item.frequency ?? "",
        item.notes ?? "",
      ]
        .join(" ")
        .toLowerCase();

      if (search.trim() && !haystack.includes(search.trim().toLowerCase())) {
        return false;
      }

      if (userFilter !== "all" && item.user_id !== userFilter) {
        return false;
      }

      if (activeFilter === "active" && !item.is_active) {
        return false;
      }

      if (activeFilter === "inactive" && item.is_active) {
        return false;
      }

      if (frequencyFilter !== "all" && item.frequency !== frequencyFilter) {
        return false;
      }

      return true;
    });
  }, [records, search, userFilter, activeFilter, frequencyFilter]);

  const activeTotals = useMemo(() => {
    return filteredRecords
      .filter((item) => item.is_active)
      .reduce(
        (totals, item) => {
          if (item.adjustment_type === "addition") {
            totals.additions += Number(item.amount ?? 0);
          } else {
            totals.deductions += Number(item.amount ?? 0);
          }

          return totals;
        },
        { additions: 0, deductions: 0 }
      );
  }, [filteredRecords]);

  return (
    <AdminLayout>
      <div className="space-y-6">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h1 className="text-2xl font-semibold mb-1">Recurring Payroll Items</h1>
            <p className="text-neutral-600">
              Manage ongoing employee additions and deductions that apply to payroll runs.
            </p>
          </div>

          <div className="flex gap-2">
            <Button variant="outline" onClick={loadData}>
              <RefreshCw className="w-4 h-4 mr-2" />
              Refresh
            </Button>

            <Button onClick={openCreateDialog}>
              <Plus className="w-4 h-4 mr-2" />
              Add Recurring Item
            </Button>
          </div>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Filters</CardTitle>
            <CardDescription>
              Search and filter recurring payroll items.
            </CardDescription>
          </CardHeader>

          <CardContent>
            <div className="grid md:grid-cols-4 gap-4">
              <Input
                placeholder="Search employee or deduction..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />

              <select
                className="border rounded px-3 py-2 bg-white"
                value={userFilter}
                onChange={(e) => setUserFilter(e.target.value)}
              >
                <option value="all">All Employees</option>
                {users.map((user) => (
                  <option key={user.id} value={user.id}>
                    {user.name || user.email}
                  </option>
                ))}
              </select>

              <select
                className="border rounded px-3 py-2 bg-white"
                value={activeFilter}
                onChange={(e) => setActiveFilter(e.target.value)}
              >
                <option value="all">All Activity Status</option>
                <option value="active">Active Only</option>
                <option value="inactive">Inactive Only</option>
              </select>

              <select
                className="border rounded px-3 py-2 bg-white"
                value={frequencyFilter}
                onChange={(e) => setFrequencyFilter(e.target.value)}
              >
                <option value="all">All Frequencies</option>
                <option value="every_payroll">Every Payroll</option>
                <option value="monthly_first_half">Monthly First Half</option>
                <option value="monthly_second_half">Monthly Second Half</option>
                <option value="one_time">One Time</option>
              </select>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="grid gap-4 md:grid-cols-2">
              <div>
                <p className="text-sm text-neutral-500">Active Additions</p>
                <p className="text-2xl font-bold mt-2">
                  {currency(activeTotals.additions)}
                </p>
              </div>
              <div>
                <p className="text-sm text-neutral-500">Active Deductions</p>
                <p className="text-2xl font-bold mt-2">
                  {currency(activeTotals.deductions)}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Recurring Payroll Item List</CardTitle>
            <CardDescription>
              {filteredRecords.length} recurring payroll item(s) found
            </CardDescription>
          </CardHeader>

          <CardContent>
            {isLoading ? (
              <div className="py-10 text-center text-neutral-500">
                Loading recurring payroll items...
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Employee</TableHead>
                    <TableHead>Kind</TableHead>
                    <TableHead>Name</TableHead>
                    <TableHead>Amount</TableHead>
                    <TableHead>Type</TableHead>
                    <TableHead>Frequency</TableHead>
                    <TableHead>Start Date</TableHead>
                    <TableHead>End Date</TableHead>
                    <TableHead>Active</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>

                <TableBody>
                  {filteredRecords.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={10} className="text-center py-8">
                        No recurring payroll items found.
                      </TableCell>
                    </TableRow>
                  ) : (
                    filteredRecords.map((item) => (
                      <TableRow key={item.id}>
                        <TableCell>
                          <div className="font-medium">{item.user_name || "-"}</div>
                          <div className="text-xs text-neutral-500">
                            {item.user_email || "-"}
                          </div>
                        </TableCell>
                        <TableCell>
                          <Badge
                            variant={
                              item.adjustment_type === "addition"
                                ? "default"
                                : "outline"
                            }
                          >
                            {item.adjustment_type === "addition"
                              ? "Addition"
                              : "Deduction"}
                          </Badge>
                        </TableCell>
                        <TableCell>{item.name}</TableCell>
                        <TableCell>{currency(item.amount)}</TableCell>
                        <TableCell className="capitalize">{item.deduction_type}</TableCell>
                        <TableCell>{item.frequency}</TableCell>
                        <TableCell>{item.start_date}</TableCell>
                        <TableCell>{item.end_date || "-"}</TableCell>
                        <TableCell>
                          <Badge variant={item.is_active ? "default" : "outline"}>
                            {item.is_active ? "Active" : "Inactive"}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-right">
                          <div className="flex justify-end gap-2">
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => openEditDialog(item)}
                            >
                              <Pencil className="w-4 h-4 mr-1" />
                              Edit
                            </Button>

                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => handleDelete(item)}
                            >
                              <Trash2 className="w-4 h-4 mr-1" />
                              Delete
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>

        <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
          <DialogContent className="max-w-2xl">
            <DialogHeader>
              <DialogTitle>
                {editingRecord ? "Edit Recurring Item" : "Add Recurring Item"}
              </DialogTitle>
              <DialogDescription>
                Create or update an ongoing payroll addition or deduction for an employee.
              </DialogDescription>
            </DialogHeader>

            <form onSubmit={handleSubmit}>
              <DialogBody>
                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium mb-1">Employee</label>
                    <select
                      className="w-full border rounded px-3 py-2 bg-white"
                      value={form.user_id}
                      onChange={(e) =>
                        setForm((prev) => ({
                          ...prev,
                          user_id: e.target.value,
                        }))
                      }
                    >
                      <option value="">Select employee</option>
                      {users.map((user) => (
                        <option key={user.id} value={user.id}>
                          {user.name || user.email}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div className="grid md:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium mb-1">Kind</label>
                      <select
                        className="w-full border rounded px-3 py-2 bg-white"
                        value={form.adjustment_type}
                        onChange={(e) =>
                          setForm((prev) => ({
                            ...prev,
                            adjustment_type: e.target.value as
                              | "addition"
                              | "deduction",
                          }))
                        }
                      >
                        <option value="addition">Addition</option>
                        <option value="deduction">Deduction</option>
                      </select>
                    </div>

                    <div>
                      <label className="block text-sm font-medium mb-1">Name</label>
                      <Input
                        value={form.name}
                        onChange={(e) =>
                          setForm((prev) => ({
                            ...prev,
                            name: e.target.value,
                          }))
                        }
                        placeholder="e.g. Salary Loan"
                      />
                    </div>

                    <div>
                      <label className="block text-sm font-medium mb-1">Amount</label>
                      <Input
                        type="number"
                        step="0.01"
                        value={form.amount}
                        onChange={(e) =>
                          setForm((prev) => ({
                            ...prev,
                            amount: e.target.value,
                          }))
                        }
                      />
                    </div>
                  </div>

                  <div className="grid md:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium mb-1">Type</label>
                      <select
                        className="w-full border rounded px-3 py-2 bg-white"
                        value={form.deduction_type}
                        onChange={(e) =>
                          setForm((prev) => ({
                            ...prev,
                            deduction_type: e.target.value as "fixed" | "percentage",
                          }))
                        }
                      >
                        <option value="fixed">Fixed</option>
                        <option value="percentage">Percentage</option>
                      </select>
                    </div>

                    <div>
                      <label className="block text-sm font-medium mb-1">
                        Frequency
                      </label>
                      <select
                        className="w-full border rounded px-3 py-2 bg-white"
                        value={form.frequency}
                        onChange={(e) =>
                          setForm((prev) => ({
                            ...prev,
                            frequency: e.target.value as
                              | "every_payroll"
                              | "monthly_first_half"
                              | "monthly_second_half"
                              | "one_time",
                          }))
                        }
                      >
                        <option value="every_payroll">Every Payroll</option>
                        <option value="monthly_first_half">Monthly First Half</option>
                        <option value="monthly_second_half">Monthly Second Half</option>
                        <option value="one_time">One Time</option>
                      </select>
                    </div>
                  </div>

                  <div className="grid md:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium mb-1">
                        Start Date
                      </label>
                      <Input
                        type="date"
                        value={form.start_date}
                        onChange={(e) =>
                          setForm((prev) => ({
                            ...prev,
                            start_date: e.target.value,
                          }))
                        }
                      />
                    </div>

                    <div>
                      <label className="block text-sm font-medium mb-1">
                        End Date
                      </label>
                      <Input
                        type="date"
                        value={form.end_date}
                        onChange={(e) =>
                          setForm((prev) => ({
                            ...prev,
                            end_date: e.target.value,
                          }))
                        }
                      />
                    </div>
                  </div>

                  <div>
                    <label className="flex items-center gap-2 text-sm font-medium">
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
                      Active deduction
                    </label>
                  </div>

                  <div>
                    <label className="block text-sm font-medium mb-1">Notes</label>
                    <textarea
                      className="w-full border rounded px-3 py-2 bg-white min-h-[100px]"
                      value={form.notes}
                      onChange={(e) =>
                        setForm((prev) => ({
                          ...prev,
                          notes: e.target.value,
                        }))
                      }
                      placeholder="Optional notes..."
                    />
                  </div>

                  <div className="rounded-lg border border-neutral-200 p-4">
                    <div className="mb-3 flex items-center justify-between gap-3">
                      <div>
                        <p className="text-sm font-medium">Documents</p>
                        <p className="text-xs text-neutral-500">
                          Attach PDF, DOCX, DOC, or TXT files up to 20 MB each.
                        </p>
                      </div>
                      <FileText className="h-5 w-5 text-neutral-400" />
                    </div>

                    <input
                      type="file"
                      multiple
                      accept=".pdf,.doc,.docx,.txt,application/pdf,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document,text/plain"
                      onChange={(event) => handleAttachmentChange(event.target.files)}
                      className="w-full rounded-lg border border-neutral-300 px-3 py-2 text-sm"
                      disabled={isSaving}
                    />

                    {pendingAttachments.length > 0 && (
                      <div className="mt-4 space-y-2">
                        <p className="text-xs font-medium uppercase text-neutral-500">
                          Pending upload
                        </p>
                        {pendingAttachments.map((file, index) => (
                          <div
                            key={`${file.name}-${file.lastModified}-${index}`}
                            className="flex items-center justify-between gap-3 rounded border border-neutral-200 px-3 py-2 text-sm"
                          >
                            <div className="min-w-0">
                              <p className="truncate font-medium">{file.name}</p>
                              <p className="text-xs text-neutral-500">
                                {formatFileSize(file.size)}
                              </p>
                            </div>
                            <Button
                              type="button"
                              variant="ghost"
                              size="sm"
                              onClick={() => removePendingAttachment(index)}
                              disabled={isSaving}
                              title="Remove pending attachment"
                            >
                              <X className="h-4 w-4" />
                            </Button>
                          </div>
                        ))}
                      </div>
                    )}

                    {editingRecord && (
                      <div className="mt-4 space-y-2">
                        <p className="text-xs font-medium uppercase text-neutral-500">
                          Saved documents
                        </p>
                        {attachments.length === 0 ? (
                          <p className="rounded border border-dashed border-neutral-200 px-3 py-4 text-center text-sm text-neutral-500">
                            No documents attached.
                          </p>
                        ) : (
                          attachments.map((attachment) => (
                            <div
                              key={attachment.id}
                              className="flex items-center justify-between gap-3 rounded border border-neutral-200 px-3 py-2 text-sm"
                            >
                              <div className="min-w-0">
                                <p className="truncate font-medium">
                                  {attachment.file_name}
                                </p>
                                <p className="text-xs text-neutral-500">
                                  {formatFileSize(attachment.file_size)}
                                </p>
                              </div>
                              <div className="flex shrink-0 gap-1">
                                <Button
                                  type="button"
                                  variant="ghost"
                                  size="sm"
                                  onClick={() => setViewerAttachment(attachment)}
                                  title="View document"
                                >
                                  <Eye className="h-4 w-4" />
                                </Button>
                                <Button
                                  type="button"
                                  variant="ghost"
                                  size="sm"
                                  disabled={deletingAttachmentId === attachment.id}
                                  onClick={() => void handleDeleteAttachment(attachment)}
                                  title="Delete attachment"
                                >
                                  <Trash2 className="h-4 w-4 text-red-600" />
                                </Button>
                              </div>
                            </div>
                          ))
                        )}
                      </div>
                    )}
                  </div>
                </div>
              </DialogBody>

              <DialogFooter>
                <Button type="button" variant="outline" onClick={closeDialog}>
                  Cancel
                </Button>

                <Button type="submit" disabled={isSaving}>
                  {isSaving
                    ? "Saving..."
                    : editingRecord
                    ? "Update Item"
                    : "Create Item"}
                </Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>

        <Dialog
          open={Boolean(viewerAttachment)}
          onOpenChange={(open) => !open && setViewerAttachment(null)}
        >
          <DialogContent
            className="max-w-5xl h-[90vh] overflow-hidden flex flex-col"
            onClose={() => setViewerAttachment(null)}
          >
            <DialogHeader className="shrink-0">
              <DialogTitle>{viewerAttachment?.file_name ?? "Document"}</DialogTitle>
              <DialogDescription>
                {viewerAttachment
                  ? `${formatFileSize(viewerAttachment.file_size)} attachment`
                  : ""}
              </DialogDescription>
            </DialogHeader>

            <DialogBody className="min-h-0 flex-1 overflow-hidden">
              {viewerAttachment && getAttachmentKind(viewerAttachment) === "pdf" && (
                <iframe
                  src={viewerAttachment.file_url}
                  title={viewerAttachment.file_name}
                  className="h-full w-full rounded border border-neutral-200"
                />
              )}

              {viewerAttachment && getAttachmentKind(viewerAttachment) === "text" && (
                <pre className="h-full overflow-auto rounded border border-neutral-200 bg-neutral-50 p-4 text-sm whitespace-pre-wrap">
                  {isLoadingTextPreview ? "Loading text file..." : textPreview}
                </pre>
              )}

              {viewerAttachment && getAttachmentKind(viewerAttachment) === "word" && (
                <iframe
                  src={`https://view.officeapps.live.com/op/embed.aspx?src=${encodeURIComponent(
                    viewerAttachment.file_url
                  )}`}
                  title={viewerAttachment.file_name}
                  className="h-full w-full rounded border border-neutral-200"
                />
              )}

              {viewerAttachment && getAttachmentKind(viewerAttachment) === "other" && (
                <div className="flex h-full flex-col items-center justify-center gap-3 rounded border border-dashed border-neutral-300 text-center">
                  <FileText className="h-8 w-8 text-neutral-400" />
                  <p className="text-sm text-neutral-600">
                    Preview is not available for this file type.
                  </p>
                  <Button
                    type="button"
                    onClick={() =>
                      window.open(
                        viewerAttachment.file_url,
                        "_blank",
                        "noopener,noreferrer"
                      )
                    }
                  >
                    Open Document
                  </Button>
                </div>
              )}
            </DialogBody>

            <DialogFooter className="shrink-0">
              {viewerAttachment && (
                <Button
                  type="button"
                  variant="outline"
                  onClick={() =>
                    window.open(
                      viewerAttachment.file_url,
                      "_blank",
                      "noopener,noreferrer"
                    )
                  }
                >
                  Open in New Tab
                </Button>
              )}
              <Button type="button" onClick={() => setViewerAttachment(null)}>
                Close
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </AdminLayout>
  );
}
