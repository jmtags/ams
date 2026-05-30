import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router";
import { RefreshCw, Eye, Wallet } from "lucide-react";

import { UserLayout } from "../layouts/user-layout";
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
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "../components/ui/table";

import { useAuth } from "../hooks/useAuth";
import { supabase } from "../lib/supabase";
import type { PayrollRecord } from "../services/payroll.service";

const currency = (value: number) =>
  new Intl.NumberFormat("en-PH", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(Number(value || 0));

const getStatusBadgeVariant = (status: string) => {
  switch (status) {
    case "draft":
      return "outline";
    case "computed":
      return "secondary";
    case "reviewed":
      return "secondary";
    case "finalized":
      return "default";
    case "released":
      return "default";
    default:
      return "outline";
  }
};

const mapPayrollRecord = (row: any): PayrollRecord => ({
  ...row,
  employment_type: row.employment_type ?? "regular",
  basic_rate: Number(row.basic_rate ?? 0),
  daily_rate: Number(row.daily_rate ?? 0),
  hourly_rate: Number(row.hourly_rate ?? 0),
  unpaid_break_minutes: Number(row.unpaid_break_minutes ?? 60),
  total_work_days: Number(row.total_work_days ?? 0),
  total_work_minutes: Number(row.total_work_minutes ?? 0),
  total_paid_leave_days: Number(row.total_paid_leave_days ?? 0),
  total_unpaid_leave_days: Number(row.total_unpaid_leave_days ?? 0),
  total_absent_days: Number(row.total_absent_days ?? 0),
  total_late_minutes: Number(row.total_late_minutes ?? 0),
  total_overtime_minutes: Number(row.total_overtime_minutes ?? 0),
  basic_pay: Number(row.basic_pay ?? 0),
  leave_pay: Number(row.leave_pay ?? 0),
  overtime_pay: Number(row.overtime_pay ?? 0),
  holiday_pay: Number(row.holiday_pay ?? 0),
  restday_pay: Number(row.restday_pay ?? 0),
  allowance_pay: Number(row.allowance_pay ?? 0),
  gross_pay: Number(row.gross_pay ?? 0),
  late_deduction: Number(row.late_deduction ?? 0),
  undertime_deduction: Number(row.undertime_deduction ?? 0),
  absent_deduction: Number(row.absent_deduction ?? 0),
  sss_deduction: Number(row.sss_deduction ?? 0),
  pagibig_deduction: Number(row.pagibig_deduction ?? 0),
  philhealth_deduction: Number(row.philhealth_deduction ?? 0),
  tax_deduction: Number(row.tax_deduction ?? 0),
  other_deductions: Number(row.other_deductions ?? 0),
  total_deductions: Number(row.total_deductions ?? 0),
  net_pay: Number(row.net_pay ?? 0),
  user_name: row.users?.name ?? "",
  user_email: row.users?.email ?? null,
  payroll_period_name: row.payroll_periods?.name ?? "",
  payroll_period_date_from: row.payroll_periods?.date_from ?? null,
  payroll_period_date_to: row.payroll_periods?.date_to ?? null,
  payroll_period_pay_date: row.payroll_periods?.pay_date ?? null,
});

export function UserPayrollPage() {
  const navigate = useNavigate();
  const { user } = useAuth();

  const [records, setRecords] = useState<PayrollRecord[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [yearFilter, setYearFilter] = useState("all");

  useEffect(() => {
    if (user?.id) {
      loadRecords(user.id);
    }
  }, [user?.id]);

  const loadRecords = async (userId: string) => {
    try {
      setIsLoading(true);

      const { data, error } = await supabase
        .from("payroll_records")
        .select(`
          *,
          users (
            id,
            name,
            email
          ),
          payroll_periods (
            id,
            name,
            date_from,
            date_to,
            pay_date
          )
        `)
        .eq("user_id", userId)
        .in("status", ["finalized", "released"])
        .order("created_at", { ascending: false });

      if (error) throw error;

      setRecords((data ?? []).map(mapPayrollRecord));
    } catch (error: any) {
      console.error("Failed to load payroll records:", error);
      alert(error.message || "Failed to load payroll records.");
    } finally {
      setIsLoading(false);
    }
  };

  const filteredRecords = useMemo(() => {
    return records.filter((record) => {
      const haystack = [
        record.payroll_period_name ?? "",
        record.payroll_period_date_from ?? "",
        record.payroll_period_date_to ?? "",
        record.payroll_period_pay_date ?? "",
        record.status ?? "",
        record.pay_type ?? "",
      ]
        .join(" ")
        .toLowerCase();

      if (search.trim() && !haystack.includes(search.trim().toLowerCase())) {
        return false;
      }

      if (statusFilter !== "all" && record.status !== statusFilter) {
        return false;
      }

      if (yearFilter !== "all") {
        const payDate =
          record.payroll_period_pay_date ||
          record.payroll_period_date_to ||
          record.created_at ||
          "";
        if (!String(payDate).startsWith(yearFilter)) {
          return false;
        }
      }

      return true;
    });
  }, [records, search, statusFilter, yearFilter]);

  const availableYears = useMemo(() => {
    const years = new Set<string>();

    records.forEach((record) => {
      const payDate =
        record.payroll_period_pay_date ||
        record.payroll_period_date_to ||
        record.created_at ||
        "";
      if (payDate) {
        years.add(String(payDate).slice(0, 4));
      }
    });

    return Array.from(years).sort((a, b) => Number(b) - Number(a));
  }, [records]);

  const totals = useMemo(() => {
    return filteredRecords.reduce(
      (acc, row) => {
        acc.gross += Number(row.gross_pay ?? 0);
        acc.deductions += Number(row.total_deductions ?? 0);
        acc.net += Number(row.net_pay ?? 0);
        return acc;
      },
      { gross: 0, deductions: 0, net: 0 }
    );
  }, [filteredRecords]);

  const latestRecord = filteredRecords[0] ?? null;

  return (
    <UserLayout>
      <div className="space-y-6">
        <div className="flex items-start justify-between gap-4 flex-wrap">
          <div>
            <h1 className="text-2xl font-semibold mb-1">My Payroll</h1>
            <p className="text-neutral-600">
              View your payroll history, payslip details, and download your payslips.
            </p>
          </div>

          <Button
            variant="outline"
            onClick={() => user?.id && loadRecords(user.id)}
            disabled={isLoading}
          >
            <RefreshCw className="w-4 h-4 mr-2" />
            Refresh
          </Button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <Card>
            <CardContent className="pt-6">
              <p className="text-sm text-neutral-500">Latest Net Pay</p>
              <p className="text-2xl font-bold mt-2">
                {latestRecord ? currency(latestRecord.net_pay) : "0.00"}
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="pt-6">
              <p className="text-sm text-neutral-500">Filtered Gross Total</p>
              <p className="text-2xl font-bold mt-2">{currency(totals.gross)}</p>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="pt-6">
              <p className="text-sm text-neutral-500">Filtered Net Total</p>
              <p className="text-2xl font-bold mt-2">{currency(totals.net)}</p>
            </CardContent>
          </Card>
        </div>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Wallet className="w-5 h-5" />
              Payroll History
            </CardTitle>
            <CardDescription>
              Search and filter your finalized or released payroll records.
            </CardDescription>
          </CardHeader>

          <CardContent>
            <div className="grid md:grid-cols-3 gap-4 mb-6">
              <div>
                <label className="block text-sm font-medium mb-1">Search</label>
                <Input
                  placeholder="Search payroll period..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                />
              </div>

              <div>
                <label className="block text-sm font-medium mb-1">Status</label>
                <select
                  className="w-full border rounded px-3 py-2 bg-white"
                  value={statusFilter}
                  onChange={(e) => setStatusFilter(e.target.value)}
                >
                  <option value="all">All Statuses</option>
                  <option value="finalized">Finalized</option>
                  <option value="released">Released</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium mb-1">Year</label>
                <select
                  className="w-full border rounded px-3 py-2 bg-white"
                  value={yearFilter}
                  onChange={(e) => setYearFilter(e.target.value)}
                >
                  <option value="all">All Years</option>
                  {availableYears.map((year) => (
                    <option key={year} value={year}>
                      {year}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            {isLoading ? (
              <div className="py-10 text-center text-neutral-500">
                Loading payroll records...
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Payroll Period</TableHead>
                    <TableHead>Pay Date</TableHead>
                    <TableHead>Pay Type</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="text-right">Gross Pay</TableHead>
                    <TableHead className="text-right">Deductions</TableHead>
                    <TableHead className="text-right">Net Pay</TableHead>
                    <TableHead className="text-right">Action</TableHead>
                  </TableRow>
                </TableHeader>

                <TableBody>
                  {filteredRecords.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={8} className="text-center text-neutral-500 py-8">
                        No payroll records found.
                      </TableCell>
                    </TableRow>
                  ) : (
                    filteredRecords.map((record) => (
                      <TableRow key={record.id}>
                        <TableCell>
                          <div className="font-medium">
                            {record.payroll_period_name || "Payroll Period"}
                          </div>
                          <div className="text-xs text-neutral-500">
                            {record.payroll_period_date_from || "-"} to{" "}
                            {record.payroll_period_date_to || "-"}
                          </div>
                        </TableCell>

                        <TableCell>{record.payroll_period_pay_date || "-"}</TableCell>

                        <TableCell className="capitalize">
                          {record.pay_type || "-"}
                        </TableCell>

                        <TableCell>
                          <Badge variant={getStatusBadgeVariant(record.status)}>
                            {record.status}
                          </Badge>
                        </TableCell>

                        <TableCell className="text-right">
                          {currency(record.gross_pay)}
                        </TableCell>

                        <TableCell className="text-right">
                          {currency(record.total_deductions)}
                        </TableCell>

                        <TableCell className="text-right font-semibold">
                          {currency(record.net_pay)}
                        </TableCell>

                        <TableCell className="text-right">
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => navigate(`/my-payroll/${record.id}`)}
                          >
                            <Eye className="w-4 h-4 mr-2" />
                            View Payslip
                          </Button>
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
    </UserLayout>
  );
}
