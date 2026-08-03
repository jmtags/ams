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
  type EmploymentType,
  type PayType,
} from "../services/employee-compensation.service";

type FormState = {
  user_id: string;
  pay_type: PayType;
  employment_type: EmploymentType;
  basic_monthly_rate: string;
  daily_rate: string;
  hourly_rate: string;
  allowance_amount: string;
  overtime_hourly_rate: string;
  unpaid_break_minutes: string;
  deduct_sss: boolean;
  deduct_philhealth: boolean;
  deduct_pagibig: boolean;
  deduct_withholding_tax: boolean;
  government_contribution_frequency:
    | "every_payroll"
    | "monthly_first_half"
    | "monthly_second_half";
  late_deduction_mode: "none" | "per_minute" | "per_hour" | "fixed";
  late_deduction_rate: string;
  undertime_deduction_rate: string;
  absent_deduction_rate: string;
  effective_from: string;
  effective_to: string;
  is_active: boolean;
};

type CompensationTableRow = {
  id: string;
  user_id: string;
  user_name: string;
  user_email: string | null;
  record: EmployeeCompensation | null;
};

const defaultForm: FormState = {
  user_id: "",
  pay_type: "monthly",
  employment_type: "regular",
  basic_monthly_rate: "0",
  daily_rate: "0",
  hourly_rate: "0",
  allowance_amount: "0",
  overtime_hourly_rate: "0",
  unpaid_break_minutes: "60",
  deduct_sss: true,
  deduct_philhealth: true,
  deduct_pagibig: true,
  deduct_withholding_tax: false,
  government_contribution_frequency: "monthly_second_half",
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
  const [employmentTypeFilter, setEmploymentTypeFilter] = useState("all");
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

  const openCreateDialog = (userId = "") => {
    setEditingRecord(null);
    setForm({
      ...defaultForm,
      user_id: userId,
      effective_from: getTodayDate(),
    });
    setIsDialogOpen(true);
  };

  const openEditDialog = (record: EmployeeCompensation) => {
    setEditingRecord(record);
    setForm({
      user_id: record.user_id,
      pay_type: record.pay_type,
      employment_type: record.employment_type,
      basic_monthly_rate: String(record.basic_monthly_rate ?? 0),
      daily_rate: String(record.daily_rate ?? 0),
      hourly_rate: String(record.hourly_rate ?? 0),
      allowance_amount: String(record.allowance_amount ?? 0),
      overtime_hourly_rate: String(record.overtime_hourly_rate ?? 0),
      unpaid_break_minutes: String(record.unpaid_break_minutes ?? 60),
      deduct_sss: record.deduct_sss,
      deduct_philhealth: record.deduct_philhealth,
      deduct_pagibig: record.deduct_pagibig,
      deduct_withholding_tax: record.deduct_withholding_tax,
      government_contribution_frequency:
        record.government_contribution_frequency ?? "monthly_second_half",
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
        employment_type: form.employment_type,
        basic_monthly_rate: parseNumber(form.basic_monthly_rate),
        daily_rate: parseNumber(form.daily_rate),
        hourly_rate: parseNumber(form.hourly_rate),
        allowance_amount: parseNumber(form.allowance_amount),
        overtime_hourly_rate: parseNumber(form.overtime_hourly_rate),
        unpaid_break_minutes: Math.max(0, Math.round(parseNumber(form.unpaid_break_minutes))),
        deduct_sss: form.deduct_sss,
        deduct_philhealth: form.deduct_philhealth,
        deduct_pagibig: form.deduct_pagibig,
        deduct_withholding_tax: form.deduct_withholding_tax,
        government_contribution_frequency: form.government_contribution_frequency,
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

  const tableRows = useMemo<CompensationTableRow[]>(() => {
    const rows = records.map((record) => ({
      id: `record-${record.id}`,
      user_id: record.user_id,
      user_name: record.user_name || "",
      user_email: record.user_email ?? null,
      record,
    }));

    const usersWithRecords = new Set(records.map((record) => record.user_id));

    users.forEach((user) => {
      if (usersWithRecords.has(user.id)) return;

      rows.push({
        id: `user-${user.id}`,
        user_id: user.id,
        user_name: user.name || "",
        user_email: user.email ?? null,
        record: null,
      });
    });

    return rows.sort((a, b) =>
      (a.user_name || a.user_email || "").localeCompare(
        b.user_name || b.user_email || ""
      )
    );
  }, [records, users]);

  const filteredRecords = useMemo(() => {
    return tableRows.filter((row) => {
      const record = row.record;
      const haystack = [
        row.user_name ?? "",
        row.user_email ?? "",
        record?.pay_type ?? "",
        record?.employment_type ?? "",
        record?.effective_from ?? "",
        record?.effective_to ?? "",
        record ? "configured" : "not configured",
      ]
        .join(" ")
        .toLowerCase();

      if (search.trim() && !haystack.includes(search.trim().toLowerCase())) {
        return false;
      }

      if (payTypeFilter !== "all" && record?.pay_type !== payTypeFilter) {
        return false;
      }

      if (
        employmentTypeFilter !== "all" &&
        record?.employment_type !== employmentTypeFilter
      ) {
        return false;
      }

      if (userFilter !== "all" && row.user_id !== userFilter) {
        return false;
      }

      if (activeFilter === "active" && !record?.is_active) {
        return false;
      }

      if (activeFilter === "inactive" && record?.is_active) {
        return false;
      }

      return true;
    });
  }, [tableRows, search, payTypeFilter, employmentTypeFilter, userFilter, activeFilter]);

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

            <Button onClick={() => openCreateDialog()}>
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
            <div className="grid md:grid-cols-5 gap-4">
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
                value={employmentTypeFilter}
                onChange={(e) => setEmploymentTypeFilter(e.target.value)}
              >
                <option value="all">All Employment Types</option>
                <option value="regular">Regular</option>
                <option value="part_time">Part-time</option>
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
                    <TableHead>Employment</TableHead>
                    <TableHead>Pay Type</TableHead>
                    <TableHead>Monthly</TableHead>
                    <TableHead>Daily</TableHead>
                    <TableHead>Hourly</TableHead>
                    <TableHead>Break</TableHead>
                    <TableHead>Gov't</TableHead>
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
                      <TableCell colSpan={13} className="text-center py-8">
                        No compensation records found.
                      </TableCell>
                    </TableRow>
                  ) : (
                    filteredRecords.map((row) => {
                      const record = row.record;

                      return (
                      <TableRow key={row.id}>
                        <TableCell>
                          <div className="font-medium">{row.user_name || "-"}</div>
                          <div className="text-xs text-neutral-500">
                            {row.user_email || "-"}
                          </div>
                        </TableCell>
                        <TableCell>
                          {record ? (
                            <Badge variant="outline">
                              {record.employment_type === "part_time"
                                ? "Part-time"
                                : "Regular"}
                            </Badge>
                          ) : (
                            <Badge variant="outline">Not configured</Badge>
                          )}
                        </TableCell>
                        <TableCell className="capitalize">
                          {record?.pay_type ?? "-"}
                        </TableCell>
                        <TableCell>
                          {record
                            ? Number(record.basic_monthly_rate ?? 0).toFixed(2)
                            : "-"}
                        </TableCell>
                        <TableCell>
                          {record ? Number(record.daily_rate ?? 0).toFixed(2) : "-"}
                        </TableCell>
                        <TableCell>
                          {record ? Number(record.hourly_rate ?? 0).toFixed(2) : "-"}
                        </TableCell>
                        <TableCell>
                          {record ? `${Number(record.unpaid_break_minutes ?? 0)} min` : "-"}
                        </TableCell>
                        <TableCell>
                          {record ? (
                            <div className="flex flex-wrap gap-1">
                              {record.deduct_sss && (
                                <Badge variant="outline">SSS</Badge>
                              )}
                              {record.deduct_philhealth && (
                                <Badge variant="outline">PHIC</Badge>
                              )}
                              {record.deduct_pagibig && (
                                <Badge variant="outline">HDMF</Badge>
                              )}
                              {record.deduct_withholding_tax && (
                                <Badge variant="outline">Tax</Badge>
                              )}
                              {!record.deduct_sss &&
                                !record.deduct_philhealth &&
                                !record.deduct_pagibig &&
                                !record.deduct_withholding_tax && (
                                  <span className="text-neutral-500">None</span>
                                )}
                            </div>
                          ) : (
                            "-"
                          )}
                        </TableCell>
                        <TableCell>
                          {record
                            ? Number(record.allowance_amount ?? 0).toFixed(2)
                            : "-"}
                        </TableCell>
                        <TableCell>{record?.effective_from ?? "-"}</TableCell>
                        <TableCell>{record?.effective_to || "-"}</TableCell>
                        <TableCell>
                          <Badge variant={record?.is_active ? "default" : "outline"}>
                            {record
                              ? record.is_active
                                ? "Active"
                                : "Inactive"
                              : "Missing"}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-right">
                          <div className="flex justify-end gap-2">
                            {record ? (
                              <>
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
                              </>
                            ) : (
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => openCreateDialog(row.user_id)}
                              >
                                <Plus className="w-4 h-4 mr-1" />
                                Configure
                              </Button>
                            )}
                          </div>
                        </TableCell>
                      </TableRow>
                    )})
                  )}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>

        <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
          <DialogContent className="max-w-5xl max-h-[92vh] overflow-hidden flex flex-col">
            <DialogHeader className="shrink-0 border-b">
              <DialogTitle className="text-xl font-semibold">
                {editingRecord ? "Edit Employee Compensation" : "Add Employee Compensation"}
              </DialogTitle>
              <DialogDescription>
                Configure pay rates, deduction rules, government contributions,
                and effective dates for the selected employee.
              </DialogDescription>
            </DialogHeader>

            <form onSubmit={handleSubmit} className="min-h-0 flex flex-1 flex-col">
              <DialogBody className="min-h-0 flex-1 overflow-y-auto py-5">
                <div className="space-y-5">
                  <div className="rounded-lg border p-4">
                    <div className="mb-4">
                      <h3 className="text-base font-semibold text-neutral-900">
                        Employee And Pay Type
                      </h3>
                      <p className="text-sm text-neutral-500">
                        Select who this compensation setup belongs to and how
                        the employee is paid.
                      </p>
                    </div>

                  <div className="grid md:grid-cols-3 gap-4">
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

                    <div>
                      <label className="block text-sm font-medium mb-1">
                        Employment Type
                      </label>
                      <select
                        className="w-full border rounded px-3 py-2 bg-white"
                        value={form.employment_type}
                        onChange={(e) =>
                          setForm((prev) => ({
                            ...prev,
                            employment_type: e.target.value as EmploymentType,
                            unpaid_break_minutes:
                              e.target.value === "part_time"
                                ? prev.unpaid_break_minutes
                                : prev.unpaid_break_minutes || "60",
                          }))
                        }
                      >
                        <option value="regular">Regular</option>
                        <option value="part_time">Part-time</option>
                      </select>
                    </div>
                  </div>
                  </div>

                  <div className="rounded-lg border p-4">
                    <div className="mb-4">
                      <h3 className="text-base font-semibold text-neutral-900">
                        Pay Rates
                      </h3>
                      <p className="text-sm text-neutral-500">
                        Enter the monthly, daily, hourly, allowance, overtime,
                        and break settings used for payroll computation.
                      </p>
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

                  <div className="grid md:grid-cols-3 gap-4 mt-4">
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
                        Unpaid Break Minutes
                      </label>
                      <Input
                        type="number"
                        step="1"
                        min="0"
                        value={form.unpaid_break_minutes}
                        onChange={(e) =>
                          setForm((prev) => ({
                            ...prev,
                            unpaid_break_minutes: e.target.value,
                          }))
                        }
                      />
                    </div>
                  </div>
                  </div>

                  <div className="rounded-lg border p-4">
                    <div className="mb-4">
                      <h3 className="text-base font-semibold text-neutral-900">
                        Attendance Deductions
                      </h3>
                      <p className="text-sm text-neutral-500">
                        Set how late, undertime, and absence deductions are
                        handled for this employee.
                      </p>
                    </div>

                  <div className="grid md:grid-cols-4 gap-4">
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
                  </div>

                  <div className="rounded-lg border bg-neutral-50 p-4">
                    <div className="mb-3">
                      <h3 className="text-base font-semibold text-neutral-900">
                        Government Contributions
                      </h3>
                      <p className="text-sm text-neutral-500">
                        Enable mandated employee deductions and choose when the
                        monthly contribution is deducted.
                      </p>
                    </div>

                    <div className="grid md:grid-cols-5 gap-4">
                      <label className="flex items-center gap-2 text-sm font-medium">
                        <input
                          type="checkbox"
                          checked={form.deduct_sss}
                          onChange={(e) =>
                            setForm((prev) => ({
                              ...prev,
                              deduct_sss: e.target.checked,
                            }))
                          }
                        />
                        Deduct SSS
                      </label>

                      <label className="flex items-center gap-2 text-sm font-medium">
                        <input
                          type="checkbox"
                          checked={form.deduct_philhealth}
                          onChange={(e) =>
                            setForm((prev) => ({
                              ...prev,
                              deduct_philhealth: e.target.checked,
                            }))
                          }
                        />
                        Deduct PhilHealth
                      </label>

                      <label className="flex items-center gap-2 text-sm font-medium">
                        <input
                          type="checkbox"
                          checked={form.deduct_pagibig}
                          onChange={(e) =>
                            setForm((prev) => ({
                              ...prev,
                              deduct_pagibig: e.target.checked,
                            }))
                          }
                        />
                        Deduct Pag-IBIG
                      </label>

                      <label className="flex items-center gap-2 text-sm font-medium">
                        <input
                          type="checkbox"
                          checked={form.deduct_withholding_tax}
                          onChange={(e) =>
                            setForm((prev) => ({
                              ...prev,
                              deduct_withholding_tax: e.target.checked,
                            }))
                          }
                        />
                        Deduct Tax
                      </label>

                      <div>
                        <label className="block text-sm font-medium mb-1">
                          Deduction Schedule
                        </label>
                        <select
                          className="w-full border rounded px-3 py-2 bg-white"
                          value={form.government_contribution_frequency}
                          onChange={(e) =>
                            setForm((prev) => ({
                              ...prev,
                              government_contribution_frequency: e.target
                                .value as FormState["government_contribution_frequency"],
                            }))
                          }
                        >
                          <option value="monthly_second_half">
                            Monthly - second half
                          </option>
                          <option value="monthly_first_half">
                            Monthly - first half
                          </option>
                          <option value="every_payroll">Every payroll</option>
                        </select>
                      </div>
                    </div>
                  </div>

                  <div className="rounded-lg border p-4">
                    <div className="mb-4">
                      <h3 className="text-base font-semibold text-neutral-900">
                        Effective Dates
                      </h3>
                      <p className="text-sm text-neutral-500">
                        Control when this compensation record starts, ends, and
                        whether it is currently active.
                      </p>
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
                </div>
              </DialogBody>

              <DialogFooter className="shrink-0 bg-white">
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
