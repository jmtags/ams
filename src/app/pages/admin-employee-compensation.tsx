import { FormEvent, useEffect, useMemo, useState } from "react";
import { Plus, Pencil, Trash2, RefreshCw } from "lucide-react";

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
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogBody,
  DialogFooter,
} from "../components/ui/dialog";
import { Badge } from "../components/ui/badge";

import { userService, type User } from "../services/user.service";
import {
  employeeCompensationService,
  type EmployeeCompensation,
  type PayType,
} from "../services/employee-compensation.service";

type FormState = {
  user_id: string;
  pay_type: PayType;
  basic_monthly_rate: string;
  daily_rate: string;
  hourly_rate: string;
  allowance_amount: string;
  overtime_hourly_rate: string;
  late_deduction_mode: "none" | "per_minute" | "per_hour" | "fixed";
  late_deduction_rate: string;
  undertime_deduction_rate: string;
  absent_deduction_rate: string;
  effective_from: string;
  effective_to: string;
  is_active: boolean;
};

const defaultForm: FormState = {
  user_id: "",
  pay_type: "monthly",
  basic_monthly_rate: "0",
  daily_rate: "0",
  hourly_rate: "0",
  allowance_amount: "0",
  overtime_hourly_rate: "0",
  late_deduction_mode: "per_minute",
  late_deduction_rate: "0",
  undertime_deduction_rate: "0",
  absent_deduction_rate: "0",
  effective_from: "",
  effective_to: "",
  is_active: true,
};

const getTodayDate = () => {
  const now = new Date();
  const year = now.getFullYear();
  const month = `${now.getMonth() + 1}`.padStart(2, "0");
  const day = `${now.getDate()}`.padStart(2, "0");
  return `${year}-${month}-${day}`;
};

export function AdminEmployeeCompensationPage() {
  const [records, setRecords] = useState<EmployeeCompensation[]>([]);
  const [users, setUsers] = useState<User[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const [search, setSearch] = useState("");
  const [payTypeFilter, setPayTypeFilter] = useState("all");
  const [userFilter, setUserFilter] = useState("all");
  const [activeFilter, setActiveFilter] = useState("all");

  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingRecord, setEditingRecord] = useState<EmployeeCompensation | null>(null);
  const [form, setForm] = useState<FormState>({
    ...defaultForm,
    effective_from: getTodayDate(),
  });
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      setIsLoading(true);

      const [compensationData, userData] = await Promise.all([
        employeeCompensationService.getAll(),
        userService.getUsers(),
      ]);

      setRecords(compensationData);
      setUsers(userData);
    } catch (error: any) {
      console.error("Failed to load compensation data:", error);
      alert(error.message || "Failed to load employee compensation records.");
    } finally {
      setIsLoading(false);
    }
  };

  const openCreateDialog = () => {
    setEditingRecord(null);
    setForm({
      ...defaultForm,
      effective_from: getTodayDate(),
    });
    setIsDialogOpen(true);
  };

  const openEditDialog = (record: EmployeeCompensation) => {
    setEditingRecord(record);
    setForm({
      user_id: record.user_id,
      pay_type: record.pay_type,
      basic_monthly_rate: String(record.basic_monthly_rate ?? 0),
      daily_rate: String(record.daily_rate ?? 0),
      hourly_rate: String(record.hourly_rate ?? 0),
      allowance_amount: String(record.allowance_amount ?? 0),
      overtime_hourly_rate: String(record.overtime_hourly_rate ?? 0),
      late_deduction_mode: record.late_deduction_mode,
      late_deduction_rate: String(record.late_deduction_rate ?? 0),
      undertime_deduction_rate: String(record.undertime_deduction_rate ?? 0),
      absent_deduction_rate: String(record.absent_deduction_rate ?? 0),
      effective_from: record.effective_from ?? "",
      effective_to: record.effective_to ?? "",
      is_active: Boolean(record.is_active),
    });
    setIsDialogOpen(true);
  };

  const closeDialog = () => {
    if (isSaving) return;
    setIsDialogOpen(false);
    setEditingRecord(null);
    setForm({
      ...defaultForm,
      effective_from: getTodayDate(),
    });
  };

  const parseNumber = (value: string) => {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : 0;
  };

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();

    if (!form.user_id) {
      alert("Employee is required.");
      return;
    }

    if (!form.effective_from) {
      alert("Effective from date is required.");
      return;
    }

    if (form.effective_to && form.effective_to < form.effective_from) {
      alert("Effective to cannot be earlier than effective from.");
      return;
    }

    try {
      setIsSaving(true);

      const payload = {
        user_id: form.user_id,
        pay_type: form.pay_type,
        basic_monthly_rate: parseNumber(form.basic_monthly_rate),
        daily_rate: parseNumber(form.daily_rate),
        hourly_rate: parseNumber(form.hourly_rate),
        allowance_amount: parseNumber(form.allowance_amount),
        overtime_hourly_rate: parseNumber(form.overtime_hourly_rate),
        late_deduction_mode: form.late_deduction_mode,
        late_deduction_rate: parseNumber(form.late_deduction_rate),
        undertime_deduction_rate: parseNumber(form.undertime_deduction_rate),
        absent_deduction_rate: parseNumber(form.absent_deduction_rate),
        effective_from: form.effective_from,
        effective_to: form.effective_to || null,
        is_active: form.is_active,
      };

      if (editingRecord) {
        await employeeCompensationService.update(editingRecord.id, payload);
      } else {
        await employeeCompensationService.create(payload);
      }

      await loadData();
      closeDialog();
    } catch (error: any) {
      console.error("Failed to save employee compensation:", error);
      alert(error.message || "Failed to save employee compensation.");
    } finally {
      setIsSaving(false);
    }
  };

  const handleDelete = async (record: EmployeeCompensation) => {
    const confirmed = window.confirm(
      `Delete compensation record for ${record.user_name || "this employee"}?`
    );

    if (!confirmed) return;

    try {
      await employeeCompensationService.remove(record.id);
      await loadData();
    } catch (error: any) {
      console.error("Failed to delete compensation record:", error);
      alert(error.message || "Failed to delete compensation record.");
    }
  };

  const filteredRecords = useMemo(() => {
    return records.filter((record) => {
      const haystack = [
        record.user_name ?? "",
        record.user_email ?? "",
        record.pay_type ?? "",
        record.effective_from ?? "",
        record.effective_to ?? "",
      ]
        .join(" ")
        .toLowerCase();

      if (search.trim() && !haystack.includes(search.trim().toLowerCase())) {
        return false;
      }

      if (payTypeFilter !== "all" && record.pay_type !== payTypeFilter) {
        return false;
      }

      if (userFilter !== "all" && record.user_id !== userFilter) {
        return false;
      }

      if (activeFilter === "active" && !record.is_active) {
        return false;
      }

      if (activeFilter === "inactive" && record.is_active) {
        return false;
      }

      return true;
    });
  }, [records, search, payTypeFilter, userFilter, activeFilter]);

  return (
    <AdminLayout>
      <div className="space-y-6">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h1 className="text-2xl font-semibold mb-1">Employee Compensation</h1>
            <p className="text-neutral-600">
              Set employee pay type, rates, allowance, and payroll deduction basis.
            </p>
          </div>

          <div className="flex gap-2">
            <Button variant="outline" onClick={loadData}>
              <RefreshCw className="w-4 h-4 mr-2" />
              Refresh
            </Button>

            <Button onClick={openCreateDialog}>
              <Plus className="w-4 h-4 mr-2" />
              Add Compensation
            </Button>
          </div>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Filters</CardTitle>
            <CardDescription>
              Search and narrow down compensation records.
            </CardDescription>
          </CardHeader>

          <CardContent>
            <div className="grid md:grid-cols-4 gap-4">
              <Input
                placeholder="Search employee or pay type..."
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
                value={payTypeFilter}
                onChange={(e) => setPayTypeFilter(e.target.value)}
              >
                <option value="all">All Pay Types</option>
                <option value="monthly">Monthly</option>
                <option value="daily">Daily</option>
                <option value="hourly">Hourly</option>
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
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Compensation Records</CardTitle>
            <CardDescription>
              {filteredRecords.length} compensation record(s) found
            </CardDescription>
          </CardHeader>

          <CardContent>
            {isLoading ? (
              <div className="py-10 text-center text-neutral-500">
                Loading compensation records...
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Employee</TableHead>
                    <TableHead>Pay Type</TableHead>
                    <TableHead>Monthly</TableHead>
                    <TableHead>Daily</TableHead>
                    <TableHead>Hourly</TableHead>
                    <TableHead>Allowance</TableHead>
                    <TableHead>Effective From</TableHead>
                    <TableHead>Effective To</TableHead>
                    <TableHead>Active</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>

                <TableBody>
                  {filteredRecords.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={10} className="text-center py-8">
                        No compensation records found.
                      </TableCell>
                    </TableRow>
                  ) : (
                    filteredRecords.map((record) => (
                      <TableRow key={record.id}>
                        <TableCell>
                          <div className="font-medium">{record.user_name || "-"}</div>
                          <div className="text-xs text-neutral-500">
                            {record.user_email || "-"}
                          </div>
                        </TableCell>
                        <TableCell className="capitalize">{record.pay_type}</TableCell>
                        <TableCell>{Number(record.basic_monthly_rate ?? 0).toFixed(2)}</TableCell>
                        <TableCell>{Number(record.daily_rate ?? 0).toFixed(2)}</TableCell>
                        <TableCell>{Number(record.hourly_rate ?? 0).toFixed(2)}</TableCell>
                        <TableCell>{Number(record.allowance_amount ?? 0).toFixed(2)}</TableCell>
                        <TableCell>{record.effective_from}</TableCell>
                        <TableCell>{record.effective_to || "-"}</TableCell>
                        <TableCell>
                          <Badge variant={record.is_active ? "default" : "outline"}>
                            {record.is_active ? "Active" : "Inactive"}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-right">
                          <div className="flex justify-end gap-2">
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => openEditDialog(record)}
                            >
                              <Pencil className="w-4 h-4 mr-1" />
                              Edit
                            </Button>

                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => handleDelete(record)}
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
          <DialogContent className="max-w-3xl">
            <DialogHeader>
              <DialogTitle>
                {editingRecord ? "Edit Employee Compensation" : "Add Employee Compensation"}
              </DialogTitle>
              <DialogDescription>
                Configure the payroll basis for the selected employee.
              </DialogDescription>
            </DialogHeader>

            <form onSubmit={handleSubmit}>
              <DialogBody>
                <div className="space-y-4">
                  <div className="grid md:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium mb-1">Employee</label>
                      <select
                        className="w-full border rounded px-3 py-2 bg-white"
                        value={form.user_id}
                        onChange={(e) =>
                          setForm((prev) => ({ ...prev, user_id: e.target.value }))
                        }
                        disabled={Boolean(editingRecord)}
                      >
                        <option value="">Select employee</option>
                        {users.map((user) => (
                          <option key={user.id} value={user.id}>
                            {user.name || user.email}
                          </option>
                        ))}
                      </select>
                    </div>

                    <div>
                      <label className="block text-sm font-medium mb-1">Pay Type</label>
                      <select
                        className="w-full border rounded px-3 py-2 bg-white"
                        value={form.pay_type}
                        onChange={(e) =>
                          setForm((prev) => ({
                            ...prev,
                            pay_type: e.target.value as PayType,
                          }))
                        }
                      >
                        <option value="monthly">Monthly</option>
                        <option value="daily">Daily</option>
                        <option value="hourly">Hourly</option>
                      </select>
                    </div>
                  </div>

                  <div className="grid md:grid-cols-3 gap-4">
                    <div>
                      <label className="block text-sm font-medium mb-1">
                        Basic Monthly Rate
                      </label>
                      <Input
                        type="number"
                        step="0.01"
                        value={form.basic_monthly_rate}
                        onChange={(e) =>
                          setForm((prev) => ({
                            ...prev,
                            basic_monthly_rate: e.target.value,
                          }))
                        }
                      />
                    </div>

                    <div>
                      <label className="block text-sm font-medium mb-1">Daily Rate</label>
                      <Input
                        type="number"
                        step="0.01"
                        value={form.daily_rate}
                        onChange={(e) =>
                          setForm((prev) => ({
                            ...prev,
                            daily_rate: e.target.value,
                          }))
                        }
                      />
                    </div>

                    <div>
                      <label className="block text-sm font-medium mb-1">Hourly Rate</label>
                      <Input
                        type="number"
                        step="0.01"
                        value={form.hourly_rate}
                        onChange={(e) =>
                          setForm((prev) => ({
                            ...prev,
                            hourly_rate: e.target.value,
                          }))
                        }
                      />
                    </div>
                  </div>

                  <div className="grid md:grid-cols-3 gap-4">
                    <div>
                      <label className="block text-sm font-medium mb-1">Allowance</label>
                      <Input
                        type="number"
                        step="0.01"
                        value={form.allowance_amount}
                        onChange={(e) =>
                          setForm((prev) => ({
                            ...prev,
                            allowance_amount: e.target.value,
                          }))
                        }
                      />
                    </div>

                    <div>
                      <label className="block text-sm font-medium mb-1">
                        OT Hourly Rate
                      </label>
                      <Input
                        type="number"
                        step="0.01"
                        value={form.overtime_hourly_rate}
                        onChange={(e) =>
                          setForm((prev) => ({
                            ...prev,
                            overtime_hourly_rate: e.target.value,
                          }))
                        }
                      />
                    </div>

                    <div>
                      <label className="block text-sm font-medium mb-1">
                        Late Deduction Mode
                      </label>
                      <select
                        className="w-full border rounded px-3 py-2 bg-white"
                        value={form.late_deduction_mode}
                        onChange={(e) =>
                          setForm((prev) => ({
                            ...prev,
                            late_deduction_mode: e.target.value as
                              | "none"
                              | "per_minute"
                              | "per_hour"
                              | "fixed",
                          }))
                        }
                      >
                        <option value="none">None</option>
                        <option value="per_minute">Per Minute</option>
                        <option value="per_hour">Per Hour</option>
                        <option value="fixed">Fixed</option>
                      </select>
                    </div>
                  </div>

                  <div className="grid md:grid-cols-3 gap-4">
                    <div>
                      <label className="block text-sm font-medium mb-1">
                        Late Deduction Rate
                      </label>
                      <Input
                        type="number"
                        step="0.01"
                        value={form.late_deduction_rate}
                        onChange={(e) =>
                          setForm((prev) => ({
                            ...prev,
                            late_deduction_rate: e.target.value,
                          }))
                        }
                      />
                    </div>

                    <div>
                      <label className="block text-sm font-medium mb-1">
                        Undertime Deduction Rate
                      </label>
                      <Input
                        type="number"
                        step="0.01"
                        value={form.undertime_deduction_rate}
                        onChange={(e) =>
                          setForm((prev) => ({
                            ...prev,
                            undertime_deduction_rate: e.target.value,
                          }))
                        }
                      />
                    </div>

                    <div>
                      <label className="block text-sm font-medium mb-1">
                        Absent Deduction Rate
                      </label>
                      <Input
                        type="number"
                        step="0.01"
                        value={form.absent_deduction_rate}
                        onChange={(e) =>
                          setForm((prev) => ({
                            ...prev,
                            absent_deduction_rate: e.target.value,
                          }))
                        }
                      />
                    </div>
                  </div>

                  <div className="grid md:grid-cols-3 gap-4">
                    <div>
                      <label className="block text-sm font-medium mb-1">
                        Effective From
                      </label>
                      <Input
                        type="date"
                        value={form.effective_from}
                        onChange={(e) =>
                          setForm((prev) => ({
                            ...prev,
                            effective_from: e.target.value,
                          }))
                        }
                      />
                    </div>

                    <div>
                      <label className="block text-sm font-medium mb-1">
                        Effective To
                      </label>
                      <Input
                        type="date"
                        value={form.effective_to}
                        onChange={(e) =>
                          setForm((prev) => ({
                            ...prev,
                            effective_to: e.target.value,
                          }))
                        }
                      />
                    </div>

                    <div className="flex items-end">
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
                        Active record
                      </label>
                    </div>
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
                    ? "Update Compensation"
                    : "Create Compensation"}
                </Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>
      </div>
    </AdminLayout>
  );
}