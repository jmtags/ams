import { useEffect, useMemo, useState } from "react";
import { RefreshCw } from "lucide-react";

import { AdminLayout } from "../layouts/admin-layout";
import { Button } from "../components/ui/button";
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
  governmentContributionSettingsService,
  type GovernmentReportRow,
} from "../services/government-contribution-settings.service";

const currency = (value: number) =>
  new Intl.NumberFormat("en-PH", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(Number(value || 0));

export function AdminGovernmentReportsPage() {
  const [periods, setPeriods] = useState<PayrollPeriod[]>([]);
  const [selectedPeriodId, setSelectedPeriodId] = useState("");
  const [rows, setRows] = useState<GovernmentReportRow[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    loadPeriods();
  }, []);

  useEffect(() => {
    if (selectedPeriodId) {
      loadReport(selectedPeriodId);
    } else {
      setRows([]);
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

  const loadReport = async (periodId: string) => {
    try {
      setIsLoading(true);
      const data =
        await governmentContributionSettingsService.getGovernmentReports(
          periodId
        );
      setRows(data);
    } catch (error: any) {
      console.error("Failed to load government reports:", error);
      alert(error.message || "Failed to load government reports.");
    } finally {
      setIsLoading(false);
    }
  };

  const totals = useMemo(
    () =>
      rows.reduce(
        (acc, row) => {
          acc.sssEmployee += row.sss_employee;
          acc.sssEmployer += row.sss_employer;
          acc.philhealthEmployee += row.philhealth_employee;
          acc.philhealthEmployer += row.philhealth_employer;
          acc.pagibigEmployee += row.pagibig_employee;
          acc.pagibigEmployer += row.pagibig_employer;
          acc.withholdingTax += row.withholding_tax;
          acc.employeeTotal += row.total_employee_deductions;
          acc.employerTotal += row.total_employer_contributions;
          return acc;
        },
        {
          sssEmployee: 0,
          sssEmployer: 0,
          philhealthEmployee: 0,
          philhealthEmployer: 0,
          pagibigEmployee: 0,
          pagibigEmployer: 0,
          withholdingTax: 0,
          employeeTotal: 0,
          employerTotal: 0,
        }
      ),
    [rows]
  );

  return (
    <AdminLayout>
      <div className="space-y-6">
        <div className="flex items-start justify-between gap-4 flex-wrap">
          <div>
            <h1 className="text-2xl font-semibold mb-1">
              Government Reports
            </h1>
            <p className="text-neutral-600">
              Review payroll totals for SSS, PhilHealth, Pag-IBIG, and
              withholding tax.
            </p>
          </div>
          <Button variant="outline" onClick={loadPeriods}>
            <RefreshCw className="w-4 h-4 mr-2" />
            Refresh
          </Button>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Payroll Period</CardTitle>
            <CardDescription>
              Select the period to prepare government remittance summaries.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <select
              className="w-full max-w-xl border rounded px-3 py-2 bg-white"
              value={selectedPeriodId}
              onChange={(event) => setSelectedPeriodId(event.target.value)}
            >
              <option value="">Select payroll period</option>
              {periods.map((period) => (
                <option key={period.id} value={period.id}>
                  {period.name} ({period.date_from} to {period.date_to})
                </option>
              ))}
            </select>
          </CardContent>
        </Card>

        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <Card>
            <CardContent className="pt-6">
              <p className="text-sm text-neutral-500">Employee Deductions</p>
              <p className="text-2xl font-bold mt-2">
                {currency(totals.employeeTotal)}
              </p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6">
              <p className="text-sm text-neutral-500">Employer Share</p>
              <p className="text-2xl font-bold mt-2">
                {currency(totals.employerTotal)}
              </p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6">
              <p className="text-sm text-neutral-500">Withholding Tax</p>
              <p className="text-2xl font-bold mt-2">
                {currency(totals.withholdingTax)}
              </p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6">
              <p className="text-sm text-neutral-500">Employees</p>
              <p className="text-2xl font-bold mt-2">{rows.length}</p>
            </CardContent>
          </Card>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Contribution Details</CardTitle>
            <CardDescription>
              Employee and employer amounts by payroll record.
            </CardDescription>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="py-10 text-center text-neutral-500">
                Loading report...
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Employee</TableHead>
                    <TableHead>SSS EE</TableHead>
                    <TableHead>SSS ER</TableHead>
                    <TableHead>PHIC EE</TableHead>
                    <TableHead>PHIC ER</TableHead>
                    <TableHead>HDMF EE</TableHead>
                    <TableHead>HDMF ER</TableHead>
                    <TableHead>Tax</TableHead>
                    <TableHead>Total EE</TableHead>
                    <TableHead>Total ER</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {rows.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={10} className="py-8 text-center">
                        No payroll records found for this period.
                      </TableCell>
                    </TableRow>
                  ) : (
                    rows.map((row) => (
                      <TableRow key={row.id}>
                        <TableCell>
                          <div className="font-medium">
                            {row.employee || "-"}
                          </div>
                          <div className="text-xs text-neutral-500">
                            {row.email || "-"}
                          </div>
                        </TableCell>
                        <TableCell>{currency(row.sss_employee)}</TableCell>
                        <TableCell>{currency(row.sss_employer)}</TableCell>
                        <TableCell>
                          {currency(row.philhealth_employee)}
                        </TableCell>
                        <TableCell>
                          {currency(row.philhealth_employer)}
                        </TableCell>
                        <TableCell>{currency(row.pagibig_employee)}</TableCell>
                        <TableCell>{currency(row.pagibig_employer)}</TableCell>
                        <TableCell>{currency(row.withholding_tax)}</TableCell>
                        <TableCell>
                          {currency(row.total_employee_deductions)}
                        </TableCell>
                        <TableCell>
                          {currency(row.total_employer_contributions)}
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
