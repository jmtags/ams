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
  payrollPeriodService,
  type PayrollPeriod,
} from "../services/payroll-period.service";
import {
  payrollAdjustmentService,
  type PayrollAdjustment,
} from "../services/payroll-adjustment.service";
import { supabase } from "../lib/supabase";

type FormState = {
  payroll_period_id: string;
  user_id: string;
  adjustment_type: "addition" | "deduction";
  name: string;
  amount: string;
  notes: string;
};

const defaultForm: FormState = {
  payroll_period_id: "",
  user_id: "",
  adjustment_type: "addition",
  name: "",
  amount: "0",
  notes: "",
};

const currency = (value: number) =>
  new Intl.NumberFormat("en-PH", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(Number(value || 0));

export function AdminPayrollAdjustmentsPage() {
  const [adjustments, setAdjustments] = useState<PayrollAdjustment[]>([]);
  const [users, setUsers] = useState<User[]>([]);
  const [periods, setPeriods] = useState<PayrollPeriod[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const [search, setSearch] = useState("");
  const [periodFilter, setPeriodFilter] = useState("all");
  const [userFilter, setUserFilter] = useState("all");
  const [typeFilter, setTypeFilter] = useState("all");

  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingRecord, setEditingRecord] = useState<PayrollAdjustment | null>(null);
  const [form, setForm] = useState<FormState>(defaultForm);
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      setIsLoading(true);

      const [adjustmentData, userData, periodData] = await Promise.all([
        payrollAdjustmentService.getAll(),
        userService.getUsers(),
        payrollPeriodService.getAll(),
      ]);

      setAdjustments(adjustmentData);
      setUsers(userData);
      setPeriods(periodData);
    } catch (error: any) {
      console.error("Failed to load payroll adjustments:", error);
      alert(error.message || "Failed to load payroll adjustments.");
    } finally {
      setIsLoading(false);
    }
  };

  const openCreateDialog = () => {
    setEditingRecord(null);
    setForm({
      ...defaultForm,
      payroll_period_id: periods[0]?.id ?? "",
    });
    setIsDialogOpen(true);
  };

  const openEditDialog = (record: PayrollAdjustment) => {
    setEditingRecord(record);
    setForm({
      payroll_period_id: record.payroll_period_id,
      user_id: record.user_id,
      adjustment_type: record.adjustment_type,
      name: record.name ?? "",
      amount: String(record.amount ?? 0),
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

    if (!form.payroll_period_id) {
      alert("Payroll period is required.");
      return;
    }

    if (!form.user_id) {
      alert("Employee is required.");
      return;
    }

    if (!form.name.trim()) {
      alert("Adjustment name is required.");
      return;
    }

    if (Number(form.amount) <= 0) {
      alert("Amount must be greater than zero.");
      return;
    }

    try {
      setIsSaving(true);

      const {
        data: { user: currentUser },
      } = await supabase.auth.getUser();

      const payload = {
        payroll_period_id: form.payroll_period_id,
        user_id: form.user_id,
        adjustment_type: form.adjustment_type,
        name: form.name.trim(),
        amount: Number(form.amount),
        notes: form.notes.trim() || null,
        created_by: currentUser?.id ?? null,
      };

      if (editingRecord) {
        await payrollAdjustmentService.update(editingRecord.id, payload);
      } else {
        await payrollAdjustmentService.create(payload);
      }

      await loadData();
      closeDialog();
    } catch (error: any) {
      console.error("Failed to save payroll adjustment:", error);
      alert(error.message || "Failed to save payroll adjustment.");
    } finally {
      setIsSaving(false);
    }
  };

  const handleDelete = async (record: PayrollAdjustment) => {
    const confirmed = window.confirm(
      `Delete adjustment "${record.name}" for ${record.user_name || "this employee"}?`
    );

    if (!confirmed) return;

    try {
      await payrollAdjustmentService.remove(record.id);
      await loadData();
    } catch (error: any) {
      console.error("Failed to delete payroll adjustment:", error);
      alert(error.message || "Failed to delete payroll adjustment.");
    }
  };

  const filteredAdjustments = useMemo(() => {
    return adjustments.filter((item) => {
      const haystack = [
        item.user_name ?? "",
        item.user_email ?? "",
        item.payroll_period_name ?? "",
        item.name ?? "",
        item.adjustment_type ?? "",
        item.notes ?? "",
      ]
        .join(" ")
        .toLowerCase();

      if (search.trim() && !haystack.includes(search.trim().toLowerCase())) {
        return false;
      }

      if (periodFilter !== "all" && item.payroll_period_id !== periodFilter) {
        return false;
      }

      if (userFilter !== "all" && item.user_id !== userFilter) {
        return false;
      }

      if (typeFilter !== "all" && item.adjustment_type !== typeFilter) {
        return false;
      }

      return true;
    });
  }, [adjustments, search, periodFilter, userFilter, typeFilter]);

  const totals = useMemo(() => {
    return filteredAdjustments.reduce(
      (acc, item) => {
        if (item.adjustment_type === "addition") {
          acc.additions += Number(item.amount ?? 0);
        } else {
          acc.deductions += Number(item.amount ?? 0);
        }
        return acc;
      },
      { additions: 0, deductions: 0 }
    );
  }, [filteredAdjustments]);

  return (
    <AdminLayout>
      <div className="space-y-6">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h1 className="text-2xl font-semibold mb-1">Payroll Adjustments</h1>
            <p className="text-neutral-600">
              Manage payroll additions and deductions per employee and payroll period.
            </p>
          </div>

          <div className="flex gap-2">
            <Button variant="outline" onClick={loadData}>
              <RefreshCw className="w-4 h-4 mr-2" />
              Refresh
            </Button>

            <Button onClick={openCreateDialog}>
              <Plus className="w-4 h-4 mr-2" />
              Add Adjustment
            </Button>
          </div>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Filters</CardTitle>
            <CardDescription>
              Search and filter payroll adjustments.
            </CardDescription>
          </CardHeader>

          <CardContent>
            <div className="grid md:grid-cols-4 gap-4">
              <Input
                placeholder="Search employee, period, or adjustment..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />

              <select
                className="border rounded px-3 py-2 bg-white"
                value={periodFilter}
                onChange={(e) => setPeriodFilter(e.target.value)}
              >
                <option value="all">All Payroll Periods</option>
                {periods.map((period) => (
                  <option key={period.id} value={period.id}>
                    {period.name}
                  </option>
                ))}
              </select>

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
                value={typeFilter}
                onChange={(e) => setTypeFilter(e.target.value)}
              >
                <option value="all">All Types</option>
                <option value="addition">Addition</option>
                <option value="deduction">Deduction</option>
              </select>
            </div>
          </CardContent>
        </Card>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <Card>
            <CardContent className="pt-6">
              <p className="text-sm text-neutral-500">Total Additions</p>
              <p className="text-2xl font-bold mt-2">
                {currency(totals.additions)}
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="pt-6">
              <p className="text-sm text-neutral-500">Total Deductions</p>
              <p className="text-2xl font-bold mt-2">
                {currency(totals.deductions)}
              </p>
            </CardContent>
          </Card>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Adjustment List</CardTitle>
            <CardDescription>
              {filteredAdjustments.length} adjustment(s) found
            </CardDescription>
          </CardHeader>

          <CardContent>
            {isLoading ? (
              <div className="py-10 text-center text-neutral-500">
                Loading payroll adjustments...
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Payroll Period</TableHead>
                    <TableHead>Employee</TableHead>
                    <TableHead>Type</TableHead>
                    <TableHead>Name</TableHead>
                    <TableHead>Amount</TableHead>
                    <TableHead>Notes</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>

                <TableBody>
                  {filteredAdjustments.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={7} className="text-center py-8">
                        No payroll adjustments found.
                      </TableCell>
                    </TableRow>
                  ) : (
                    filteredAdjustments.map((item) => (
                      <TableRow key={item.id}>
                        <TableCell>{item.payroll_period_name || "-"}</TableCell>
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
                                : "destructive"
                            }
                          >
                            {item.adjustment_type}
                          </Badge>
                        </TableCell>
                        <TableCell>{item.name}</TableCell>
                        <TableCell>{currency(item.amount)}</TableCell>
                        <TableCell>{item.notes || "-"}</TableCell>
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
                {editingRecord ? "Edit Payroll Adjustment" : "Add Payroll Adjustment"}
              </DialogTitle>
              <DialogDescription>
                Add a payroll addition or deduction for a selected employee and period.
              </DialogDescription>
            </DialogHeader>

            <form onSubmit={handleSubmit}>
              <DialogBody>
                <div className="space-y-4">
                  <div className="grid md:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium mb-1">
                        Payroll Period
                      </label>
                      <select
                        className="w-full border rounded px-3 py-2 bg-white"
                        value={form.payroll_period_id}
                        onChange={(e) =>
                          setForm((prev) => ({
                            ...prev,
                            payroll_period_id: e.target.value,
                          }))
                        }
                      >
                        <option value="">Select payroll period</option>
                        {periods.map((period) => (
                          <option key={period.id} value={period.id}>
                            {period.name}
                          </option>
                        ))}
                      </select>
                    </div>

                    <div>
                      <label className="block text-sm font-medium mb-1">
                        Employee
                      </label>
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
                  </div>

                  <div className="grid md:grid-cols-3 gap-4">
                    <div>
                      <label className="block text-sm font-medium mb-1">Type</label>
                      <select
                        className="w-full border rounded px-3 py-2 bg-white"
                        value={form.adjustment_type}
                        onChange={(e) =>
                          setForm((prev) => ({
                            ...prev,
                            adjustment_type: e.target.value as "addition" | "deduction",
                          }))
                        }
                      >
                        <option value="addition">Addition</option>
                        <option value="deduction">Deduction</option>
                      </select>
                    </div>

                    <div className="md:col-span-2">
                      <label className="block text-sm font-medium mb-1">Name</label>
                      <Input
                        value={form.name}
                        onChange={(e) =>
                          setForm((prev) => ({
                            ...prev,
                            name: e.target.value,
                          }))
                        }
                        placeholder="e.g. Bonus, Incentive, Cash Advance"
                      />
                    </div>
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
                    ? "Update Adjustment"
                    : "Create Adjustment"}
                </Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>
      </div>
    </AdminLayout>
  );
}