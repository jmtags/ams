import { useEffect, useMemo, useState } from "react";
import { Download, RefreshCw } from "lucide-react";

import { AdminLayout } from "../layouts/admin-layout";
import { Badge } from "../components/ui/badge";
import { Button } from "../components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "../components/ui/card";
import { Input } from "../components/ui/input";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "../components/ui/table";
import {
  payrollService,
  type PayrollRecord,
} from "../services/payroll.service";

type EmployeeThirteenthMonth = {
  userId: string;
  employeeName: string;
  employeeEmail: string;
  payrollCount: number;
  includedBasicPay: number;
  grossPay: number;
  allowancesAndPremiums: number;
  deductions: number;
  netPay: number;
  thirteenthMonthPay: number;
  latestPayDate: string | null;
};

const currency = (value: number) =>
  new Intl.NumberFormat("en-PH", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(Number(value || 0));

const currentYear = new Date().getFullYear();

const yearOptions = Array.from({ length: 7 }, (_, index) => currentYear - index);

const getStatusBadgeVariant = (status: string) => {
  switch (status) {
    case "draft":
      return "outline";
    case "computed":
    case "reviewed":
      return "secondary";
    case "finalized":
    case "released":
      return "default";
    default:
      return "outline";
  }
};

const escapeCsvValue = (value: string | number | null) => {
  const text = String(value ?? "");
  if (/[",\n]/.test(text)) {
    return `"${text.replace(/"/g, '""')}"`;
  }
  return text;
};

const getPayrollBasis = (record: PayrollRecord) =>
  Number(record.basic_pay ?? 0) + Number(record.leave_pay ?? 0);

const getAllowanceAndPremiums = (record: PayrollRecord) =>
  Number(record.overtime_pay ?? 0) +
  Number(record.holiday_pay ?? 0) +
  Number(record.restday_pay ?? 0) +
  Number(record.allowance_pay ?? 0);

export function AdminThirteenthMonthPayPage() {
  const [selectedYear, setSelectedYear] = useState(String(currentYear));
  const [records, setRecords] = useState<PayrollRecord[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("finalized_released");

  useEffect(() => {
    loadRecords();
  }, [selectedYear]);

  const loadRecords = async () => {
    try {
      setIsLoading(true);
      const data = await payrollService.getRecordsByPeriodDateRange(
        `${selectedYear}-01-01`,
        `${selectedYear}-12-31`
      );
      setRecords(data);
    } catch (error: any) {
      console.error("Failed to load 13th month payroll records:", error);
      alert(error.message || "Failed to load 13th month payroll records.");
    } finally {
      setIsLoading(false);
    }
  };

  const filteredRecords = useMemo(() => {
    return records.filter((record) => {
      if (
        statusFilter === "finalized_released" &&
        !["finalized", "released"].includes(record.status)
      ) {
        return false;
      }

      if (statusFilter !== "all" && statusFilter !== "finalized_released") {
        return record.status === statusFilter;
      }

      return true;
    });
  }, [records, statusFilter]);

  const employeeSummaries = useMemo(() => {
    const summaryByUser = new Map<string, EmployeeThirteenthMonth>();

    filteredRecords.forEach((record) => {
      const fallbackUserId = record.user_id || "unknown";
      const existing =
        summaryByUser.get(fallbackUserId) ??
        ({
          userId: fallbackUserId,
          employeeName: record.user_name || "Unknown employee",
          employeeEmail: record.user_email || "",
          payrollCount: 0,
          includedBasicPay: 0,
          grossPay: 0,
          allowancesAndPremiums: 0,
          deductions: 0,
          netPay: 0,
          thirteenthMonthPay: 0,
          latestPayDate: null,
        } satisfies EmployeeThirteenthMonth);

      existing.payrollCount += 1;
      existing.includedBasicPay += getPayrollBasis(record);
      existing.grossPay += Number(record.gross_pay ?? 0);
      existing.allowancesAndPremiums += getAllowanceAndPremiums(record);
      existing.deductions += Number(record.total_deductions ?? 0);
      existing.netPay += Number(record.net_pay ?? 0);
      existing.thirteenthMonthPay = existing.includedBasicPay / 12;

      const payDate =
        record.payroll_period_pay_date ??
        record.payroll_period_date_to ??
        record.generated_at;
      if (
        payDate &&
        (!existing.latestPayDate || payDate > existing.latestPayDate)
      ) {
        existing.latestPayDate = payDate;
      }

      summaryByUser.set(fallbackUserId, existing);
    });

    return Array.from(summaryByUser.values()).sort((a, b) =>
      a.employeeName.localeCompare(b.employeeName)
    );
  }, [filteredRecords]);

  const filteredSummaries = useMemo(() => {
    const term = search.trim().toLowerCase();
    if (!term) return employeeSummaries;

    return employeeSummaries.filter((employee) =>
      [employee.employeeName, employee.employeeEmail]
        .join(" ")
        .toLowerCase()
        .includes(term)
    );
  }, [employeeSummaries, search]);

  const totals = useMemo(() => {
    return filteredSummaries.reduce(
      (acc, row) => {
        acc.includedBasicPay += row.includedBasicPay;
        acc.thirteenthMonthPay += row.thirteenthMonthPay;
        acc.grossPay += row.grossPay;
        acc.netPay += row.netPay;
        return acc;
      },
      {
        includedBasicPay: 0,
        thirteenthMonthPay: 0,
        grossPay: 0,
        netPay: 0,
      }
    );
  }, [filteredSummaries]);

  const exportCsv = () => {
    const rows = [
      [
        "Employee",
        "Email",
        "Payroll Records",
        "Included Basic Pay",
        "13th Month Pay",
        "Gross Pay",
        "Allowances and Premiums",
        "Deductions",
        "Net Pay",
        "Latest Pay Date",
      ],
      ...filteredSummaries.map((employee) => [
        employee.employeeName,
        employee.employeeEmail,
        employee.payrollCount,
        employee.includedBasicPay.toFixed(2),
        employee.thirteenthMonthPay.toFixed(2),
        employee.grossPay.toFixed(2),
        employee.allowancesAndPremiums.toFixed(2),
        employee.deductions.toFixed(2),
        employee.netPay.toFixed(2),
        employee.latestPayDate ?? "",
      ]),
    ];

    const csv = rows
      .map((row) => row.map((value) => escapeCsvValue(value)).join(","))
      .join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `13th-month-pay-${selectedYear}.csv`;
    link.click();
    URL.revokeObjectURL(url);
  };

  return (
    <AdminLayout>
      <div className="space-y-6">
        <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
          <div>
            <h1 className="mb-1 text-2xl font-semibold">13th Month Pay</h1>
            <p className="text-neutral-600">
              Review each employee's estimated 13th month pay from payroll records.
            </p>
          </div>

          <div className="flex flex-wrap gap-2">
            <Button variant="outline" onClick={loadRecords}>
              <RefreshCw className="mr-2 h-4 w-4" />
              Refresh
            </Button>
            <Button
              variant="outline"
              onClick={exportCsv}
              disabled={filteredSummaries.length === 0}
            >
              <Download className="mr-2 h-4 w-4" />
              Export CSV
            </Button>
          </div>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Filters</CardTitle>
            <CardDescription>
              Select the payroll year and records to include in the computation.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid gap-4 md:grid-cols-3">
              <div>
                <label className="mb-1 block text-sm font-medium">Year</label>
                <select
                  className="w-full rounded border bg-white px-3 py-2"
                  value={selectedYear}
                  onChange={(event) => setSelectedYear(event.target.value)}
                >
                  {yearOptions.map((year) => (
                    <option key={year} value={year}>
                      {year}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="mb-1 block text-sm font-medium">Search</label>
                <Input
                  placeholder="Search employee..."
                  value={search}
                  onChange={(event) => setSearch(event.target.value)}
                />
              </div>

              <div>
                <label className="mb-1 block text-sm font-medium">Status</label>
                <select
                  className="w-full rounded border bg-white px-3 py-2"
                  value={statusFilter}
                  onChange={(event) => setStatusFilter(event.target.value)}
                >
                  <option value="finalized_released">Finalized and Released</option>
                  <option value="all">All Statuses</option>
                  <option value="draft">Draft</option>
                  <option value="computed">Computed</option>
                  <option value="reviewed">Reviewed</option>
                  <option value="finalized">Finalized</option>
                  <option value="released">Released</option>
                </select>
              </div>
            </div>
          </CardContent>
        </Card>

        <div className="grid grid-cols-1 gap-4 md:grid-cols-4">
          <Card>
            <CardContent className="pt-6">
              <p className="text-sm text-neutral-500">Employees</p>
              <p className="mt-2 text-2xl font-bold">{filteredSummaries.length}</p>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="pt-6">
              <p className="text-sm text-neutral-500">Included Basic Pay</p>
              <p className="mt-2 text-2xl font-bold">
                {currency(totals.includedBasicPay)}
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="pt-6">
              <p className="text-sm text-neutral-500">13th Month Total</p>
              <p className="mt-2 text-2xl font-bold">
                {currency(totals.thirteenthMonthPay)}
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="pt-6">
              <p className="text-sm text-neutral-500">Net Pay Context</p>
              <p className="mt-2 text-2xl font-bold">{currency(totals.netPay)}</p>
            </CardContent>
          </Card>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Employee 13th Month Pay List</CardTitle>
            <CardDescription>
              Computed as included basic pay divided by 12 for the selected year.
            </CardDescription>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="py-10 text-center text-neutral-500">
                Loading 13th month pay records...
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Employee</TableHead>
                    <TableHead>Records</TableHead>
                    <TableHead>Included Basic Pay</TableHead>
                    <TableHead>13th Month Pay</TableHead>
                    <TableHead>Gross Pay</TableHead>
                    <TableHead>Excluded Context</TableHead>
                    <TableHead>Deductions</TableHead>
                    <TableHead>Net Pay</TableHead>
                    <TableHead>Latest Pay Date</TableHead>
                    <TableHead>Status Scope</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredSummaries.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={10} className="py-8 text-center">
                        No 13th month pay records found.
                      </TableCell>
                    </TableRow>
                  ) : (
                    filteredSummaries.map((employee) => (
                      <TableRow key={employee.userId}>
                        <TableCell>
                          <div className="font-medium">{employee.employeeName}</div>
                          <div className="text-xs text-neutral-500">
                            {employee.employeeEmail || "-"}
                          </div>
                        </TableCell>
                        <TableCell>{employee.payrollCount}</TableCell>
                        <TableCell>{currency(employee.includedBasicPay)}</TableCell>
                        <TableCell className="font-semibold">
                          {currency(employee.thirteenthMonthPay)}
                        </TableCell>
                        <TableCell>{currency(employee.grossPay)}</TableCell>
                        <TableCell>
                          {currency(employee.allowancesAndPremiums)}
                        </TableCell>
                        <TableCell>{currency(employee.deductions)}</TableCell>
                        <TableCell>{currency(employee.netPay)}</TableCell>
                        <TableCell>{employee.latestPayDate ?? "-"}</TableCell>
                        <TableCell>
                          <Badge variant={getStatusBadgeVariant(statusFilter)}>
                            {statusFilter === "finalized_released"
                              ? "finalized/released"
                              : statusFilter}
                          </Badge>
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
      </div>
    </AdminLayout>
  );
}
