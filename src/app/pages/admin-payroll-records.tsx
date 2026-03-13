import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router";
import { RefreshCw, Eye } from "lucide-react";

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

export function AdminPayrollRecordsPage() {
  const navigate = useNavigate();

  const [periods, setPeriods] = useState<PayrollPeriod[]>([]);
  const [selectedPeriodId, setSelectedPeriodId] = useState("");
  const [records, setRecords] = useState<PayrollRecord[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");

  useEffect(() => {
    loadPeriods();
  }, []);

  useEffect(() => {
    if (selectedPeriodId) {
      loadRecords(selectedPeriodId);
    } else {
      setRecords([]);
    }
  }, [selectedPeriodId]);

  const loadPeriods = async () => {
    try {
      setIsLoading(true);
      const data = await payrollPeriodService.getAll();
      setPeriods(data);

      if (!selectedPeriodId && data.length > 0) {
        setSelectedPeriodId(data[0].id);
      }
    } catch (error: any) {
      console.error("Failed to load payroll periods:", error);
      alert(error.message || "Failed to load payroll periods.");
    } finally {
      setIsLoading(false);
    }
  };

  const loadRecords = async (periodId: string) => {
    try {
      setIsLoading(true);
      const data = await payrollService.getRecordsByPeriod(periodId);
      setRecords(data);
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
        record.user_name ?? "",
        record.user_email ?? "",
        record.pay_type ?? "",
        record.status ?? "",
      ]
        .join(" ")
        .toLowerCase();

      if (search.trim() && !haystack.includes(search.trim().toLowerCase())) {
        return false;
      }

      if (statusFilter !== "all" && record.status !== statusFilter) {
        return false;
      }

      return true;
    });
  }, [records, search, statusFilter]);

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

  return (
    <AdminLayout>
      <div className="space-y-6">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h1 className="text-2xl font-semibold mb-1">Payroll Records</h1>
            <p className="text-neutral-600">
              View payroll records by period and review totals per employee.
            </p>
          </div>

          <Button variant="outline" onClick={loadPeriods}>
            <RefreshCw className="w-4 h-4 mr-2" />
            Refresh
          </Button>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Filters</CardTitle>
            <CardDescription>
              Select a payroll period and filter the payroll records.
            </CardDescription>
          </CardHeader>

          <CardContent>
            <div className="grid md:grid-cols-3 gap-4">
              <div>
                <label className="block text-sm font-medium mb-1">
                  Payroll Period
                </label>
                <select
                  className="w-full border rounded px-3 py-2 bg-white"
                  value={selectedPeriodId}
                  onChange={(e) => setSelectedPeriodId(e.target.value)}
                >
                  <option value="">Select payroll period</option>
                  {periods.map((period) => (
                    <option key={period.id} value={period.id}>
                      {period.name} ({period.date_from} to {period.date_to})
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium mb-1">Search</label>
                <Input
                  placeholder="Search employee..."
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

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <Card>
            <CardContent className="pt-6">
              <p className="text-sm text-neutral-500">Gross Total</p>
              <p className="text-2xl font-bold mt-2">{currency(totals.gross)}</p>
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

          <Card>
            <CardContent className="pt-6">
              <p className="text-sm text-neutral-500">Net Total</p>
              <p className="text-2xl font-bold mt-2">{currency(totals.net)}</p>
            </CardContent>
          </Card>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Payroll Record List</CardTitle>
            <CardDescription>
              Employee payroll records for the selected period.
            </CardDescription>
          </CardHeader>

          <CardContent>
            {isLoading ? (
              <div className="py-10 text-center text-neutral-500">
                Loading payroll records...
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Employee</TableHead>
                    <TableHead>Pay Type</TableHead>
                    <TableHead>Worked Days</TableHead>
                    <TableHead>Late</TableHead>
                    <TableHead>OT Minutes</TableHead>
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
                      <TableCell colSpan={10} className="text-center py-8">
                        No payroll records found.
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
                        <TableCell>{Number(record.total_late_minutes ?? 0)}</TableCell>
                        <TableCell>{Number(record.total_overtime_minutes ?? 0)}</TableCell>
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
                            onClick={() =>
                              navigate(`/admin/payroll-records/${record.id}`)
                            }
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
          </CardContent>
        </Card>
      </div>
    </AdminLayout>
  );
}