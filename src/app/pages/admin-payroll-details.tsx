import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate, useParams } from "react-router";
import { ArrowLeft, RefreshCw, Printer } from "lucide-react";
import { useReactToPrint } from "react-to-print";

import { AdminLayout } from "../layouts/admin-layout";
import { Button } from "../components/ui/button";
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
  payrollService,
  type PayrollRecord,
  type PayrollRecordItem,
} from "../services/payroll.service";
import {
  payrollSettingsService,
  type PayrollSettings,
} from "../services/payroll-settings.service";

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

export function AdminPayrollDetailsPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const payslipRef = useRef<HTMLDivElement>(null);

  const [record, setRecord] = useState<PayrollRecord | null>(null);
  const [items, setItems] = useState<PayrollRecordItem[]>([]);
  const [settings, setSettings] = useState<PayrollSettings | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    if (id) {
      loadDetails(id);
    }
  }, [id]);

  const loadDetails = async (recordId: string) => {
    try {
      setIsLoading(true);

      const [result, settingsData] = await Promise.all([
        payrollService.getRecordDetails(recordId),
        payrollSettingsService.get(),
      ]);

      setRecord(result.record);
      setItems(result.items);
      setSettings(settingsData);
    } catch (error: any) {
      console.error("Failed to load payroll details:", error);
      alert(error.message || "Failed to load payroll details.");
    } finally {
      setIsLoading(false);
    }
  };

  const handlePrint = useReactToPrint({
    contentRef: payslipRef,
    documentTitle: record
      ? `Payslip-${(record.user_name || "Employee").replace(/\s+/g, "-")}`
      : "Payslip",
  });

  const groupedItems = useMemo(() => {
    const earnings = items.filter((item) =>
      [
        "basic_pay",
        "leave_pay",
        "overtime_pay",
        "holiday_pay",
        "restday_pay",
        "allowance",
        "adjustment_add",
      ].includes(item.item_type)
    );

    const deductions = items.filter((item) =>
      [
        "late_deduction",
        "undertime_deduction",
        "absent_deduction",
        "sss_deduction",
        "pagibig_deduction",
        "philhealth_deduction",
        "tax_deduction",
        "other_deduction",
        "adjustment_less",
      ].includes(item.item_type)
    );

    return { earnings, deductions };
  }, [items]);

  const earningsTotal = useMemo(() => {
    return groupedItems.earnings.reduce(
      (sum, item) => sum + Number(item.amount ?? 0),
      0
    );
  }, [groupedItems.earnings]);

  const deductionsTotal = useMemo(() => {
    return groupedItems.deductions.reduce(
      (sum, item) => sum + Number(item.amount ?? 0),
      0
    );
  }, [groupedItems.deductions]);

  return (
    <AdminLayout>
      <div className="space-y-6">
        <div className="flex items-start justify-between gap-4 flex-wrap">
          <div>
            <h1 className="text-2xl font-semibold mb-1">Payroll Details</h1>
            <p className="text-neutral-600">
              Review the payroll computation breakdown for one employee.
            </p>
          </div>

          <div className="flex gap-2 flex-wrap">
            <Button
              variant="outline"
              onClick={() => navigate("/admin/payroll-records")}
            >
              <ArrowLeft className="w-4 h-4 mr-2" />
              Back to Payroll Records
            </Button>

            {id && (
              <Button variant="outline" onClick={() => loadDetails(id)}>
                <RefreshCw className="w-4 h-4 mr-2" />
                Refresh
              </Button>
            )}

            <Button
              variant="outline"
              onClick={handlePrint}
              disabled={!record}
            >
              <Printer className="w-4 h-4 mr-2" />
              Print / Save PDF
            </Button>
          </div>
        </div>

        {isLoading ? (
          <Card>
            <CardContent className="py-10 text-center text-neutral-500">
              Loading payroll details...
            </CardContent>
          </Card>
        ) : !record ? (
          <Card>
            <CardContent className="py-10 text-center text-neutral-500">
              Payroll record not found.
            </CardContent>
          </Card>
        ) : (
          <div
            ref={payslipRef}
            className="space-y-6 bg-white print:bg-white print:p-6"
          >
            <div className="border-b pb-4">
              <div className="flex items-start justify-between gap-4">
                <div className="flex items-center gap-4">
                  {settings?.company_logo_url ? (
                    <img
                      src={settings.company_logo_url}
                      alt="Company Logo"
                      className="h-16 w-16 object-contain border rounded bg-white p-1"
                    />
                  ) : null}

                  <div>
                    <h2 className="text-2xl font-bold">
                      {settings?.company_name || "Company Name"}
                    </h2>

                    {settings?.company_address ? (
                      <p className="text-sm text-neutral-500">
                        {settings.company_address}
                      </p>
                    ) : null}

                    {settings?.company_tin ? (
                      <p className="text-sm text-neutral-500">
                        TIN: {settings.company_tin}
                      </p>
                    ) : null}
                  </div>
                </div>

                <div className="text-right">
                  <h3 className="text-xl font-semibold">Employee Payslip</h3>

                  <p className="text-sm text-neutral-500">
                    {record.payroll_period_name || "Payroll Period"}
                  </p>

                  {record.payroll_period_date_from &&
                  record.payroll_period_date_to ? (
                    <p className="text-sm text-neutral-500">
                      {record.payroll_period_date_from} to{" "}
                      {record.payroll_period_date_to}
                    </p>
                  ) : null}

                  {record.payroll_period_pay_date ? (
                    <p className="text-sm text-neutral-500">
                      Pay Date: {record.payroll_period_pay_date}
                    </p>
                  ) : null}
                </div>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-4 gap-4 print:grid-cols-4">
              <Card className="print:shadow-none print:border">
                <CardContent className="pt-6">
                  <p className="text-sm text-neutral-500">Employee</p>
                  <p className="text-lg font-semibold mt-2">
                    {record.user_name || "-"}
                  </p>
                  <p className="text-xs text-neutral-500 mt-1">
                    {record.user_email || "-"}
                  </p>
                </CardContent>
              </Card>

              <Card className="print:shadow-none print:border">
                <CardContent className="pt-6">
                  <p className="text-sm text-neutral-500">Pay Type</p>
                  <p className="text-lg font-semibold mt-2 capitalize">
                    {record.pay_type}
                  </p>
                </CardContent>
              </Card>

              <Card className="print:shadow-none print:border">
                <CardContent className="pt-6">
                  <p className="text-sm text-neutral-500">Status</p>
                  <div className="mt-2">
                    <Badge variant={getStatusBadgeVariant(record.status)}>
                      {record.status}
                    </Badge>
                  </div>
                </CardContent>
              </Card>

              <Card className="print:shadow-none print:border">
                <CardContent className="pt-6">
                  <p className="text-sm text-neutral-500">Net Pay</p>
                  <p className="text-2xl font-bold mt-2">
                    {currency(record.net_pay)}
                  </p>
                </CardContent>
              </Card>
            </div>

            <Card className="print:shadow-none print:border">
              <CardHeader>
                <CardTitle>Payroll Summary</CardTitle>
                <CardDescription>
                  Employee totals for this payroll record.
                </CardDescription>
              </CardHeader>

              <CardContent>
                <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                  <div className="rounded-xl border p-4">
                    <p className="text-sm text-neutral-500">Worked Days</p>
                    <p className="text-xl font-semibold mt-2">
                      {Number(record.total_work_days ?? 0)}
                    </p>
                  </div>

                  <div className="rounded-xl border p-4">
                    <p className="text-sm text-neutral-500">Paid Leave Days</p>
                    <p className="text-xl font-semibold mt-2">
                      {Number(record.total_paid_leave_days ?? 0)}
                    </p>
                  </div>

                  <div className="rounded-xl border p-4">
                    <p className="text-sm text-neutral-500">
                      Absent / Unpaid Leave
                    </p>
                    <p className="text-xl font-semibold mt-2">
                      {Number(record.total_absent_days ?? 0) +
                        Number(record.total_unpaid_leave_days ?? 0)}
                    </p>
                  </div>

                  <div className="rounded-xl border p-4">
                    <p className="text-sm text-neutral-500">Late Minutes</p>
                    <p className="text-xl font-semibold mt-2">
                      {Number(record.total_late_minutes ?? 0)}
                    </p>
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mt-4">
                  <div className="rounded-xl border p-4">
                    <p className="text-sm text-neutral-500">Basic Pay</p>
                    <p className="text-xl font-semibold mt-2">
                      {currency(record.basic_pay)}
                    </p>
                  </div>

                  <div className="rounded-xl border p-4">
                    <p className="text-sm text-neutral-500">Gross Pay</p>
                    <p className="text-xl font-semibold mt-2">
                      {currency(record.gross_pay)}
                    </p>
                  </div>

                  <div className="rounded-xl border p-4">
                    <p className="text-sm text-neutral-500">Total Deductions</p>
                    <p className="text-xl font-semibold mt-2">
                      {currency(record.total_deductions)}
                    </p>
                  </div>

                  <div className="rounded-xl border p-4">
                    <p className="text-sm text-neutral-500">Net Pay</p>
                    <p className="text-xl font-semibold mt-2">
                      {currency(record.net_pay)}
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <Card className="print:shadow-none print:border">
                <CardContent className="pt-6">
                  <p className="text-sm text-neutral-500">Total Earnings Items</p>
                  <p className="text-2xl font-bold mt-2">
                    {currency(earningsTotal)}
                  </p>
                </CardContent>
              </Card>

              <Card className="print:shadow-none print:border">
                <CardContent className="pt-6">
                  <p className="text-sm text-neutral-500">Total Deduction Items</p>
                  <p className="text-2xl font-bold mt-2">
                    {currency(deductionsTotal)}
                  </p>
                </CardContent>
              </Card>
            </div>

            <div className="grid grid-cols-1 xl:grid-cols-2 gap-6 print:grid-cols-2">
              <Card className="print:shadow-none print:border">
                <CardHeader>
                  <CardTitle>Earnings</CardTitle>
                  <CardDescription>
                    Positive payroll components and additions.
                  </CardDescription>
                </CardHeader>

                <CardContent>
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Description</TableHead>
                        <TableHead>Qty</TableHead>
                        <TableHead>Rate</TableHead>
                        <TableHead className="text-right">Amount</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {groupedItems.earnings.length === 0 ? (
                        <TableRow>
                          <TableCell colSpan={4} className="text-center py-6">
                            No earning items found.
                          </TableCell>
                        </TableRow>
                      ) : (
                        groupedItems.earnings.map((item) => (
                          <TableRow key={item.id}>
                            <TableCell>{item.description}</TableCell>
                            <TableCell>{Number(item.quantity ?? 0)}</TableCell>
                            <TableCell>{currency(item.rate ?? 0)}</TableCell>
                            <TableCell className="text-right font-medium">
                              {currency(item.amount ?? 0)}
                            </TableCell>
                          </TableRow>
                        ))
                      )}
                    </TableBody>
                  </Table>
                </CardContent>
              </Card>

              <Card className="print:shadow-none print:border">
                <CardHeader>
                  <CardTitle>Deductions</CardTitle>
                  <CardDescription>
                    Deductions and reductions applied to payroll.
                  </CardDescription>
                </CardHeader>

                <CardContent>
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Description</TableHead>
                        <TableHead>Qty</TableHead>
                        <TableHead>Rate</TableHead>
                        <TableHead className="text-right">Amount</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {groupedItems.deductions.length === 0 ? (
                        <TableRow>
                          <TableCell colSpan={4} className="text-center py-6">
                            No deduction items found.
                          </TableCell>
                        </TableRow>
                      ) : (
                        groupedItems.deductions.map((item) => (
                          <TableRow key={item.id}>
                            <TableCell>{item.description}</TableCell>
                            <TableCell>{Number(item.quantity ?? 0)}</TableCell>
                            <TableCell>{currency(item.rate ?? 0)}</TableCell>
                            <TableCell className="text-right font-medium">
                              {currency(item.amount ?? 0)}
                            </TableCell>
                          </TableRow>
                        ))
                      )}
                    </TableBody>
                  </Table>
                </CardContent>
              </Card>
            </div>

            <Card className="print:shadow-none print:border">
              <CardHeader>
                <CardTitle>Record Metadata</CardTitle>
                <CardDescription>
                  Tracking information for this payroll record.
                </CardDescription>
              </CardHeader>

              <CardContent>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm">
                  <div className="rounded-xl border p-4">
                    <p className="text-neutral-500">Generated At</p>
                    <p className="font-medium mt-1">
                      {record.generated_at || "-"}
                    </p>
                  </div>

                  <div className="rounded-xl border p-4">
                    <p className="text-neutral-500">Finalized At</p>
                    <p className="font-medium mt-1">
                      {record.finalized_at || "-"}
                    </p>
                  </div>

                  <div className="rounded-xl border p-4">
                    <p className="text-neutral-500">Released At</p>
                    <p className="font-medium mt-1">
                      {record.released_at || "-"}
                    </p>
                  </div>
                </div>

                {record.remarks && (
                  <div className="rounded-xl border p-4 mt-4">
                    <p className="text-neutral-500 text-sm">Remarks</p>
                    <p className="font-medium mt-1">{record.remarks}</p>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        )}
      </div>
    </AdminLayout>
  );
}