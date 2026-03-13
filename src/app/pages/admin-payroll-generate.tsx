import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router";
import {
  RefreshCw,
  PlayCircle,
  CheckCircle2,
  Eye,
  FileText,
  Wallet,
} from "lucide-react";

import { AdminLayout } from "../layouts/admin-layout";
import { Button } from "../components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "../components/ui/card";
import { Input } from "../components/ui/input";
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
  payrollPeriodService,
  type PayrollPeriod,
} from "../services/payroll-period.service";
import {
  payrollService,
  type PayrollRecord,
} from "../services/payroll.service";

const currency = (value: number) =>
  new Intl.NumberFormat("en-PH", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(Number(value || 0));

const getStatusBadgeVariant = (status: string) => {
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

export function AdminPayrollGeneratePage() {
  const navigate = useNavigate();

  const [periods, setPeriods] = useState<PayrollPeriod[]>([]);
  const [selectedPeriodId, setSelectedPeriodId] = useState("");
  const [selectedPeriod, setSelectedPeriod] = useState<PayrollPeriod | null>(null);

  const [records, setRecords] = useState<PayrollRecord[]>([]);
  const [isLoadingPeriods, setIsLoadingPeriods] = useState(true);
  const [isLoadingRecords, setIsLoadingRecords] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);
  const [isFinalizing, setIsFinalizing] = useState(false);

  const [search, setSearch] = useState("");

  useEffect(() => {
    loadPeriods();
  }, []);

  useEffect(() => {
    const period = periods.find((item) => item.id === selectedPeriodId) ?? null;
    setSelectedPeriod(period);

    if (selectedPeriodId) {
      loadRecords(selectedPeriodId);
    } else {
      setRecords([]);
    }
  }, [selectedPeriodId, periods]);

  const loadPeriods = async () => {
    try {
      setIsLoadingPeriods(true);
      const data = await payrollPeriodService.getAll();
      setPeriods(data);

      if (!selectedPeriodId && data.length > 0) {
        setSelectedPeriodId(data[0].id);
      }
    } catch (error: any) {
      console.error("Failed to load payroll periods:", error);
      alert(error.message || "Failed to load payroll periods.");
    } finally {
      setIsLoadingPeriods(false);
    }
  };

  const loadRecords = async (periodId: string) => {
    try {
      setIsLoadingRecords(true);
      const data = await payrollService.getRecordsByPeriod(periodId);
      setRecords(data);
    } catch (error: any) {
      console.error("Failed to load payroll records:", error);
      alert(error.message || "Failed to load payroll records.");
    } finally {
      setIsLoadingRecords(false);
    }
  };

  const handleGenerate = async () => {
    if (!selectedPeriodId) {
      alert("Please select a payroll period first.");
      return;
    }

    const confirmed = window.confirm(
      "Generate payroll for this period? Existing generated payroll records for this period will be replaced."
    );

    if (!confirmed) return;

    try {
      setIsGenerating(true);
      await payrollService.generatePayroll(selectedPeriodId);
      await loadPeriods();
      await loadRecords(selectedPeriodId);
      alert("Payroll generated successfully.");
    } catch (error: any) {
      console.error("Failed to generate payroll:", error);
      alert(error.message || "Failed to generate payroll.");
    } finally {
      setIsGenerating(false);
    }
  };

  const handleFinalize = async () => {
    if (!selectedPeriodId) {
      alert("Please select a payroll period first.");
      return;
    }

    if (records.length === 0) {
      alert("There are no payroll records to finalize.");
      return;
    }

    const confirmed = window.confirm(
      "Finalize payroll for this period? Finalized payroll should no longer be casually edited."
    );

    if (!confirmed) return;

    try {
      setIsFinalizing(true);
      await payrollService.finalizePayroll(selectedPeriodId);
      await loadPeriods();
      await loadRecords(selectedPeriodId);
      alert("Payroll finalized successfully.");
    } catch (error: any) {
      console.error("Failed to finalize payroll:", error);
      alert(error.message || "Failed to finalize payroll.");
    } finally {
      setIsFinalizing(false);
    }
  };

  const filteredRecords = useMemo(() => {
    return records.filter((record) => {
      if (!search.trim()) return true;

      const haystack = [
        record.user_name ?? "",
        record.user_email ?? "",
        record.pay_type ?? "",
        record.status ?? "",
      ]
        .join(" ")
        .toLowerCase();

      return haystack.includes(search.trim().toLowerCase());
    });
  }, [records, search]);

  const summary = useMemo(() => {
    return filteredRecords.reduce(
      (acc, row) => {
        acc.employeeCount += 1;
        acc.grossPay += Number(row.gross_pay ?? 0);
        acc.totalDeductions += Number(row.total_deductions ?? 0);
        acc.netPay += Number(row.net_pay ?? 0);
        acc.totalWorkDays += Number(row.total_work_days ?? 0);
        return acc;
      },
      {
        employeeCount: 0,
        grossPay: 0,
        totalDeductions: 0,
        netPay: 0,
        totalWorkDays: 0,
      }
    );
  }, [filteredRecords]);

  return (
    <AdminLayout>
      <div className="space-y-6">
        <div className="flex items-start justify-between gap-4 flex-wrap">
          <div>
            <h1 className="text-2xl font-semibold mb-1">Generate Payroll</h1>
            <p className="text-neutral-600">
              Generate, review, and finalize payroll records by payroll period.
            </p>
          </div>

          <div className="flex gap-2 flex-wrap">
            <Button variant="outline" onClick={loadPeriods}>
              <RefreshCw className="w-4 h-4 mr-2" />
              Refresh
            </Button>

            <Button
              variant="outline"
              onClick={() => navigate("/admin/payroll-adjustments")}
            >
              <FileText className="w-4 h-4 mr-2" />
              Payroll Adjustments
            </Button>

            <Button
              variant="outline"
              onClick={() => navigate("/admin/recurring-deductions")}
            >
              <Wallet className="w-4 h-4 mr-2" />
              Recurring Deductions
            </Button>

            <Button
              variant="outline"
              onClick={() => navigate("/admin/payroll-records")}
            >
              <Eye className="w-4 h-4 mr-2" />
              Payroll Records
            </Button>
          </div>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Payroll Period Selection</CardTitle>
            <CardDescription>
              Choose the payroll period to generate or review.
            </CardDescription>
          </CardHeader>

          <CardContent>
            <div className="grid md:grid-cols-4 gap-4 items-end">
              <div className="md:col-span-2">
                <label className="block text-sm font-medium mb-1">
                  Payroll Period
                </label>
                <select
                  className="w-full border rounded px-3 py-2 bg-white"
                  value={selectedPeriodId}
                  onChange={(e) => setSelectedPeriodId(e.target.value)}
                  disabled={isLoadingPeriods}
                >
                  <option value="">Select payroll period</option>
                  {periods.map((period) => (
                    <option key={period.id} value={period.id}>
                      {period.name} ({period.date_from} to {period.date_to})
                    </option>
                  ))}
                </select>
              </div>

              <Button onClick={handleGenerate} disabled={!selectedPeriodId || isGenerating}>
                <PlayCircle className="w-4 h-4 mr-2" />
                {isGenerating ? "Generating..." : "Generate Payroll"}
              </Button>

              <Button
                variant="outline"
                onClick={handleFinalize}
                disabled={!selectedPeriodId || isFinalizing || records.length === 0}
              >
                <CheckCircle2 className="w-4 h-4 mr-2" />
                {isFinalizing ? "Finalizing..." : "Finalize Payroll"}
              </Button>
            </div>

            <div className="mt-4 rounded-xl border bg-neutral-50 p-4 text-sm text-neutral-700">
              After adding or changing payroll adjustments and recurring deductions,
              regenerate payroll for the selected period so the totals update.
            </div>
          </CardContent>
        </Card>

        {selectedPeriod && (
          <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
            <Card>
              <CardContent className="pt-6">
                <p className="text-sm text-neutral-500">Period Status</p>
                <div className="mt-2">
                  <Badge variant={getStatusBadgeVariant(selectedPeriod.status)}>
                    {selectedPeriod.status}
                  </Badge>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="pt-6">
                <p className="text-sm text-neutral-500">Employees</p>
                <p className="text-2xl font-bold mt-2">{summary.employeeCount}</p>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="pt-6">
                <p className="text-sm text-neutral-500">Work Days</p>
                <p className="text-2xl font-bold mt-2">{summary.totalWorkDays}</p>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="pt-6">
                <p className="text-sm text-neutral-500">Gross Pay</p>
                <p className="text-2xl font-bold mt-2">
                  {currency(summary.grossPay)}
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="pt-6">
                <p className="text-sm text-neutral-500">Net Pay</p>
                <p className="text-2xl font-bold mt-2">{currency(summary.netPay)}</p>
              </CardContent>
            </Card>
          </div>
        )}

        <Card>
          <CardHeader>
            <CardTitle>Generated Payroll Records</CardTitle>
            <CardDescription>
              Review generated employee payroll records for the selected period.
            </CardDescription>
          </CardHeader>

          <CardContent>
            <div className="mb-4">
              <Input
                placeholder="Search employee..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </div>

            {isLoadingRecords ? (
              <div className="py-10 text-center text-neutral-500">
                Loading payroll records...
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Employee</TableHead>
                    <TableHead>Pay Type</TableHead>
                    <TableHead>Work Days</TableHead>
                    <TableHead>Leave Days</TableHead>
                    <TableHead>Absent Days</TableHead>
                    <TableHead>Late Minutes</TableHead>
                    <TableHead>Gross Pay</TableHead>
                    <TableHead>Deductions</TableHead>
                    <TableHead>Net Pay</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>

                <TableBody>
                  {filteredRecords.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={11} className="text-center py-8">
                        No payroll records found for this period.
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
                        <TableCell>{Number(record.total_work_days ?? 0)}</TableCell>
                        <TableCell>{Number(record.total_paid_leave_days ?? 0)}</TableCell>
                        <TableCell>
                          {Number(record.total_absent_days ?? 0) +
                            Number(record.total_unpaid_leave_days ?? 0)}
                        </TableCell>
                        <TableCell>{Number(record.total_late_minutes ?? 0)}</TableCell>
                        <TableCell>{currency(record.gross_pay)}</TableCell>
                        <TableCell>{currency(record.total_deductions)}</TableCell>
                        <TableCell className="font-semibold">
                          {currency(record.net_pay)}
                        </TableCell>
                        <TableCell>
                          <Badge variant={getStatusBadgeVariant(record.status)}>
                            {record.status}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-right">
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => navigate(`/admin/payroll-records/${record.id}`)}
                          >
                            <Eye className="w-4 h-4 mr-1" />
                            Details
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            )}

            {filteredRecords.length > 0 && (
              <div className="mt-4 flex items-center justify-end gap-6 text-sm flex-wrap">
                <div>
                  <span className="text-neutral-500 mr-2">Gross:</span>
                  <span className="font-semibold">{currency(summary.grossPay)}</span>
                </div>
                <div>
                  <span className="text-neutral-500 mr-2">Deductions:</span>
                  <span className="font-semibold">
                    {currency(summary.totalDeductions)}
                  </span>
                </div>
                <div>
                  <span className="text-neutral-500 mr-2">Net:</span>
                  <span className="font-semibold">{currency(summary.netPay)}</span>
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </AdminLayout>
  );
}