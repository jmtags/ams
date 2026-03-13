import { FormEvent, useEffect, useMemo, useState } from "react";
import { Plus, Pencil, Trash2, RefreshCw } from "lucide-react";

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
} from "../services/recurring-deduction.service";

type FormState = {
  user_id: string;
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

export function AdminRecurringDeductionsPage() {
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
    setIsDialogOpen(true);
  };

  const openEditDialog = (record: RecurringDeduction) => {
    setEditingRecord(record);
    setForm({
      user_id: record.user_id,
      name: record.name ?? "",
      amount: String(record.amount ?? 0),
      deduction_type: record.deduction_type,
      frequency: record.frequency,
      start_date: record.start_date ?? "",
      end_date: record.end_date ?? "",
      is_active: Boolean(record.is_active),
      notes: record.notes ?? "",
    });
    setIsDialogOpen(true);
  };

  const closeDialog = () => {
    if (isSaving) return;
    setIsDialogOpen(false);
    setEditingRecord(null);
    setForm(defaultForm);
  };

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();

    if (!form.user_id) {
      alert("Employee is required.");
      return;
    }

    if (!form.name.trim()) {
      alert("Deduction name is required.");
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
        name: form.name.trim(),
        amount: Number(form.amount),
        deduction_type: form.deduction_type,
        frequency: form.frequency,
        start_date: form.start_date,
        end_date: form.end_date || null,
        is_active: form.is_active,
        notes: form.notes.trim() || null,
      };

      if (editingRecord) {
        await recurringDeductionService.update(editingRecord.id, payload);
      } else {
        await recurringDeductionService.create(payload);
      }

      await loadData();
      closeDialog();
    } catch (error: any) {
      console.error("Failed to save recurring deduction:", error);
      alert(error.message || "Failed to save recurring deduction.");
    } finally {
      setIsSaving(false);
    }
  };

  const handleDelete = async (record: RecurringDeduction) => {
    const confirmed = window.confirm(
      `Delete recurring deduction "${record.name}" for ${record.user_name || "this employee"}?`
    );

    if (!confirmed) return;

    try {
      await recurringDeductionService.remove(record.id);
      await loadData();
    } catch (error: any) {
      console.error("Failed to delete recurring deduction:", error);
      alert(error.message || "Failed to delete recurring deduction.");
    }
  };

  const filteredRecords = useMemo(() => {
    return records.filter((item) => {
      const haystack = [
        item.user_name ?? "",
        item.user_email ?? "",
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

  const totalActiveAmount = useMemo(() => {
    return filteredRecords
      .filter((item) => item.is_active)
      .reduce((sum, item) => sum + Number(item.amount ?? 0), 0);
  }, [filteredRecords]);

  return (
    <AdminLayout>
      <div className="space-y-6">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h1 className="text-2xl font-semibold mb-1">Recurring Deductions</h1>
            <p className="text-neutral-600">
              Manage ongoing employee deductions that apply to payroll runs.
            </p>
          </div>

          <div className="flex gap-2">
            <Button variant="outline" onClick={loadData}>
              <RefreshCw className="w-4 h-4 mr-2" />
              Refresh
            </Button>

            <Button onClick={openCreateDialog}>
              <Plus className="w-4 h-4 mr-2" />
              Add Recurring Deduction
            </Button>
          </div>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Filters</CardTitle>
            <CardDescription>
              Search and filter recurring deductions.
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
            <p className="text-sm text-neutral-500">Total Active Amount</p>
            <p className="text-2xl font-bold mt-2">{currency(totalActiveAmount)}</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Recurring Deduction List</CardTitle>
            <CardDescription>
              {filteredRecords.length} recurring deduction(s) found
            </CardDescription>
          </CardHeader>

          <CardContent>
            {isLoading ? (
              <div className="py-10 text-center text-neutral-500">
                Loading recurring deductions...
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Employee</TableHead>
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
                      <TableCell colSpan={9} className="text-center py-8">
                        No recurring deductions found.
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
                {editingRecord ? "Edit Recurring Deduction" : "Add Recurring Deduction"}
              </DialogTitle>
              <DialogDescription>
                Create or update an ongoing payroll deduction for an employee.
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
                    ? "Update Deduction"
                    : "Create Deduction"}
                </Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>
      </div>
    </AdminLayout>
  );
}