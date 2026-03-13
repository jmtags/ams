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

import {
  payrollPeriodService,
  type PayrollPeriod,
  type PayrollPeriodStatus,
} from "../services/payroll-period.service";

type FormState = {
  name: string;
  date_from: string;
  date_to: string;
  pay_date: string;
  status: PayrollPeriodStatus;
};

const defaultForm: FormState = {
  name: "",
  date_from: "",
  date_to: "",
  pay_date: "",
  status: "draft",
};

const getStatusBadgeVariant = (status: PayrollPeriodStatus) => {
  switch (status) {
    case "draft":
      return "outline";
    case "processing":
      return "secondary";
    case "processed":
      return "default";
    case "finalized":
      return "default";
    case "released":
      return "default";
    default:
      return "outline";
  }
};

export function AdminPayrollPeriodsPage() {
  const [periods, setPeriods] = useState<PayrollPeriod[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");

  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingPeriod, setEditingPeriod] = useState<PayrollPeriod | null>(null);
  const [form, setForm] = useState<FormState>(defaultForm);
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    loadPeriods();
  }, []);

  const loadPeriods = async () => {
    try {
      setIsLoading(true);
      const data = await payrollPeriodService.getAll();
      setPeriods(data);
    } catch (error: any) {
      console.error("Failed to load payroll periods:", error);
      alert(error.message || "Failed to load payroll periods.");
    } finally {
      setIsLoading(false);
    }
  };

  const openCreateDialog = () => {
    setEditingPeriod(null);
    setForm(defaultForm);
    setIsDialogOpen(true);
  };

  const openEditDialog = (period: PayrollPeriod) => {
    setEditingPeriod(period);
    setForm({
      name: period.name ?? "",
      date_from: period.date_from ?? "",
      date_to: period.date_to ?? "",
      pay_date: period.pay_date ?? "",
      status: period.status ?? "draft",
    });
    setIsDialogOpen(true);
  };

  const closeDialog = () => {
    if (isSaving) return;
    setIsDialogOpen(false);
    setEditingPeriod(null);
    setForm(defaultForm);
  };

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();

    if (!form.name.trim()) {
      alert("Payroll period name is required.");
      return;
    }

    if (!form.date_from || !form.date_to) {
      alert("Date from and date to are required.");
      return;
    }

    if (form.date_from > form.date_to) {
      alert("Date from cannot be later than date to.");
      return;
    }

    try {
      setIsSaving(true);

      if (editingPeriod) {
        await payrollPeriodService.update(editingPeriod.id, {
          name: form.name.trim(),
          date_from: form.date_from,
          date_to: form.date_to,
          pay_date: form.pay_date || null,
          status: form.status,
        });
      } else {
        await payrollPeriodService.create({
          name: form.name.trim(),
          date_from: form.date_from,
          date_to: form.date_to,
          pay_date: form.pay_date || null,
          status: form.status,
        });
      }

      await loadPeriods();
      closeDialog();
    } catch (error: any) {
      console.error("Failed to save payroll period:", error);
      alert(error.message || "Failed to save payroll period.");
    } finally {
      setIsSaving(false);
    }
  };

  const handleDelete = async (period: PayrollPeriod) => {
    const confirmed = window.confirm(
      `Delete payroll period "${period.name}"? This will also affect related payroll records if already generated.`
    );

    if (!confirmed) return;

    try {
      await payrollPeriodService.remove(period.id);
      await loadPeriods();
    } catch (error: any) {
      console.error("Failed to delete payroll period:", error);
      alert(error.message || "Failed to delete payroll period.");
    }
  };

  const filteredPeriods = useMemo(() => {
    return periods.filter((period) => {
      if (
        search.trim() &&
        ![
          period.name,
          period.date_from,
          period.date_to,
          period.pay_date ?? "",
          period.status,
        ]
          .join(" ")
          .toLowerCase()
          .includes(search.trim().toLowerCase())
      ) {
        return false;
      }

      if (statusFilter !== "all" && period.status !== statusFilter) {
        return false;
      }

      return true;
    });
  }, [periods, search, statusFilter]);

  return (
    <AdminLayout>
      <div className="space-y-6">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h1 className="text-2xl font-semibold mb-1">Payroll Periods</h1>
            <p className="text-neutral-600">
              Manage payroll cutoffs, pay dates, and processing status.
            </p>
          </div>

          <div className="flex gap-2">
            <Button variant="outline" onClick={loadPeriods}>
              <RefreshCw className="w-4 h-4 mr-2" />
              Refresh
            </Button>

            <Button onClick={openCreateDialog}>
              <Plus className="w-4 h-4 mr-2" />
              Add Payroll Period
            </Button>
          </div>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Filters</CardTitle>
            <CardDescription>
              Search and filter payroll periods.
            </CardDescription>
          </CardHeader>

          <CardContent>
            <div className="grid md:grid-cols-2 gap-4">
              <Input
                placeholder="Search by name, date, or status..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />

              <select
                className="border rounded px-3 py-2 bg-white"
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
              >
                <option value="all">All Statuses</option>
                <option value="draft">Draft</option>
                <option value="processing">Processing</option>
                <option value="processed">Processed</option>
                <option value="finalized">Finalized</option>
                <option value="released">Released</option>
              </select>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Payroll Period List</CardTitle>
            <CardDescription>
              {filteredPeriods.length} payroll period(s) found
            </CardDescription>
          </CardHeader>

          <CardContent>
            {isLoading ? (
              <div className="py-10 text-center text-neutral-500">
                Loading payroll periods...
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Name</TableHead>
                    <TableHead>Date From</TableHead>
                    <TableHead>Date To</TableHead>
                    <TableHead>Pay Date</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>

                <TableBody>
                  {filteredPeriods.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={6} className="text-center py-8">
                        No payroll periods found.
                      </TableCell>
                    </TableRow>
                  ) : (
                    filteredPeriods.map((period) => (
                      <TableRow key={period.id}>
                        <TableCell className="font-medium">{period.name}</TableCell>
                        <TableCell>{period.date_from}</TableCell>
                        <TableCell>{period.date_to}</TableCell>
                        <TableCell>{period.pay_date || "-"}</TableCell>
                        <TableCell>
                          <Badge variant={getStatusBadgeVariant(period.status)}>
                            {period.status}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-right">
                          <div className="flex justify-end gap-2">
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => openEditDialog(period)}
                            >
                              <Pencil className="w-4 h-4 mr-1" />
                              Edit
                            </Button>

                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => handleDelete(period)}
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
          <DialogContent>
            <DialogHeader>
              <DialogTitle>
                {editingPeriod ? "Edit Payroll Period" : "Add Payroll Period"}
              </DialogTitle>
              <DialogDescription>
                Fill in the payroll cutoff information below.
              </DialogDescription>
            </DialogHeader>

            <form onSubmit={handleSubmit}>
              <DialogBody>
                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium mb-1">
                      Period Name
                    </label>
                    <Input
                      value={form.name}
                      onChange={(e) =>
                        setForm((prev) => ({ ...prev, name: e.target.value }))
                      }
                      placeholder="e.g. March 1–15, 2026"
                    />
                  </div>

                  <div className="grid md:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium mb-1">
                        Date From
                      </label>
                      <Input
                        type="date"
                        value={form.date_from}
                        onChange={(e) =>
                          setForm((prev) => ({
                            ...prev,
                            date_from: e.target.value,
                          }))
                        }
                      />
                    </div>

                    <div>
                      <label className="block text-sm font-medium mb-1">
                        Date To
                      </label>
                      <Input
                        type="date"
                        value={form.date_to}
                        onChange={(e) =>
                          setForm((prev) => ({
                            ...prev,
                            date_to: e.target.value,
                          }))
                        }
                      />
                    </div>
                  </div>

                  <div className="grid md:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium mb-1">
                        Pay Date
                      </label>
                      <Input
                        type="date"
                        value={form.pay_date}
                        onChange={(e) =>
                          setForm((prev) => ({
                            ...prev,
                            pay_date: e.target.value,
                          }))
                        }
                      />
                    </div>

                    <div>
                      <label className="block text-sm font-medium mb-1">
                        Status
                      </label>
                      <select
                        className="w-full border rounded px-3 py-2 bg-white"
                        value={form.status}
                        onChange={(e) =>
                          setForm((prev) => ({
                            ...prev,
                            status: e.target.value as PayrollPeriodStatus,
                          }))
                        }
                      >
                        <option value="draft">Draft</option>
                        <option value="processing">Processing</option>
                        <option value="processed">Processed</option>
                        <option value="finalized">Finalized</option>
                        <option value="released">Released</option>
                      </select>
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
                    : editingPeriod
                    ? "Update Period"
                    : "Create Period"}
                </Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>
      </div>
    </AdminLayout>
  );
}