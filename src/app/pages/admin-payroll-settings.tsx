import { FormEvent, useEffect, useState } from "react";
import { RefreshCw, Upload } from "lucide-react";

import { AdminLayout } from "../layouts/admin-layout";
import { Button } from "../components/ui/button";
import { Input } from "../components/ui/input";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "../components/ui/card";

import {
  payrollSettingsService,
  type PayrollSettings,
} from "../services/payroll-settings.service";

type FormState = {
  company_name: string;
  company_logo_url: string;
  company_address: string;
  company_tin: string;

  default_working_days_per_month: string;
  default_hours_per_day: string;

  overtime_multiplier_regular: string;
  overtime_multiplier_restday: string;
  overtime_multiplier_holiday: string;

  restday_multiplier: string;
  holiday_multiplier: string;
  holiday_restday_multiplier: string;

  late_deduction_basis: "hourly_rate" | "daily_rate_fraction" | "custom";
};

const defaultForm: FormState = {
  company_name: "",
  company_logo_url: "",
  company_address: "",
  company_tin: "",

  default_working_days_per_month: "22",
  default_hours_per_day: "8",

  overtime_multiplier_regular: "1.25",
  overtime_multiplier_restday: "1.3",
  overtime_multiplier_holiday: "2",

  restday_multiplier: "1.3",
  holiday_multiplier: "2",
  holiday_restday_multiplier: "2.6",

  late_deduction_basis: "hourly_rate",
};

export function AdminPayrollSettingsPage() {
  const [settings, setSettings] = useState<PayrollSettings | null>(null);
  const [form, setForm] = useState<FormState>(defaultForm);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [isUploadingLogo, setIsUploadingLogo] = useState(false);

  useEffect(() => {
    loadSettings();
  }, []);

  const loadSettings = async () => {
    try {
      setIsLoading(true);
      const data = await payrollSettingsService.get();
      setSettings(data);

      if (data) {
        setForm({
          company_name: data.company_name ?? "",
          company_logo_url: data.company_logo_url ?? "",
          company_address: data.company_address ?? "",
          company_tin: data.company_tin ?? "",

          default_working_days_per_month: String(
            data.default_working_days_per_month ?? 22
          ),
          default_hours_per_day: String(data.default_hours_per_day ?? 8),

          overtime_multiplier_regular: String(
            data.overtime_multiplier_regular ?? 1.25
          ),
          overtime_multiplier_restday: String(
            data.overtime_multiplier_restday ?? 1.3
          ),
          overtime_multiplier_holiday: String(
            data.overtime_multiplier_holiday ?? 2
          ),

          restday_multiplier: String(data.restday_multiplier ?? 1.3),
          holiday_multiplier: String(data.holiday_multiplier ?? 2),
          holiday_restday_multiplier: String(
            data.holiday_restday_multiplier ?? 2.6
          ),

          late_deduction_basis: data.late_deduction_basis ?? "hourly_rate",
        });
      }
    } catch (error: any) {
      console.error("Failed to load payroll settings:", error);
      alert(error.message || "Failed to load payroll settings.");
    } finally {
      setIsLoading(false);
    }
  };

  const handleLogoUpload = async (file?: File | null) => {
    if (!file) return;

    try {
      setIsUploadingLogo(true);
      const logoUrl = await payrollSettingsService.uploadCompanyLogo(file);
      setForm((prev) => ({ ...prev, company_logo_url: logoUrl }));
    } catch (error: any) {
      console.error("Failed to upload company logo:", error);
      alert(error.message || "Failed to upload company logo.");
    } finally {
      setIsUploadingLogo(false);
    }
  };

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();

    try {
      setIsSaving(true);

      const saved = await payrollSettingsService.save({
        company_name: form.company_name.trim() || null,
        company_logo_url: form.company_logo_url.trim() || null,
        company_address: form.company_address.trim() || null,
        company_tin: form.company_tin.trim() || null,

        default_working_days_per_month: Number(form.default_working_days_per_month),
        default_hours_per_day: Number(form.default_hours_per_day),

        overtime_multiplier_regular: Number(form.overtime_multiplier_regular),
        overtime_multiplier_restday: Number(form.overtime_multiplier_restday),
        overtime_multiplier_holiday: Number(form.overtime_multiplier_holiday),

        restday_multiplier: Number(form.restday_multiplier),
        holiday_multiplier: Number(form.holiday_multiplier),
        holiday_restday_multiplier: Number(form.holiday_restday_multiplier),

        late_deduction_basis: form.late_deduction_basis,
      });

      setSettings(saved);
      alert("Payroll settings saved successfully.");
    } catch (error: any) {
      console.error("Failed to save payroll settings:", error);
      alert(error.message || "Failed to save payroll settings.");
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <AdminLayout>
      <div className="space-y-6">
        <div className="flex items-start justify-between gap-4 flex-wrap">
          <div>
            <h1 className="text-2xl font-semibold mb-1">Payroll Settings</h1>
            <p className="text-neutral-600">
              Manage company payroll branding and payroll computation defaults.
            </p>
          </div>

          <Button variant="outline" onClick={loadSettings}>
            <RefreshCw className="w-4 h-4 mr-2" />
            Refresh
          </Button>
        </div>

        {isLoading ? (
          <Card>
            <CardContent className="py-10 text-center text-neutral-500">
              Loading payroll settings...
            </CardContent>
          </Card>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle>Company Branding</CardTitle>
                <CardDescription>
                  This information will be used for payslips and payroll outputs.
                </CardDescription>
              </CardHeader>

              <CardContent className="space-y-4">
                <div className="grid md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium mb-1">
                      Company Name
                    </label>
                    <Input
                      value={form.company_name}
                      onChange={(e) =>
                        setForm((prev) => ({
                          ...prev,
                          company_name: e.target.value,
                        }))
                      }
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium mb-1">
                      Company TIN
                    </label>
                    <Input
                      value={form.company_tin}
                      onChange={(e) =>
                        setForm((prev) => ({
                          ...prev,
                          company_tin: e.target.value,
                        }))
                      }
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium mb-1">
                    Company Address
                  </label>
                  <textarea
                    className="w-full border rounded px-3 py-2 bg-white min-h-[90px]"
                    value={form.company_address}
                    onChange={(e) =>
                      setForm((prev) => ({
                        ...prev,
                        company_address: e.target.value,
                      }))
                    }
                  />
                </div>

                <div className="grid md:grid-cols-2 gap-4 items-start">
                  <div>
                    <label className="block text-sm font-medium mb-1">
                      Company Logo URL
                    </label>
                    <Input
                      value={form.company_logo_url}
                      onChange={(e) =>
                        setForm((prev) => ({
                          ...prev,
                          company_logo_url: e.target.value,
                        }))
                      }
                      placeholder="https://..."
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium mb-1">
                      Upload Company Logo
                    </label>
                    <div className="flex gap-2">
                      <Input
                        type="file"
                        accept="image/*"
                        onChange={(e) => handleLogoUpload(e.target.files?.[0])}
                      />
                      <Button
                        type="button"
                        variant="outline"
                        disabled={isUploadingLogo}
                      >
                        <Upload className="w-4 h-4 mr-2" />
                        {isUploadingLogo ? "Uploading..." : "Upload"}
                      </Button>
                    </div>
                  </div>
                </div>

                {form.company_logo_url && (
                  <div className="pt-2">
                    <p className="text-sm font-medium mb-2">Logo Preview</p>
                    <img
                      src={form.company_logo_url}
                      alt="Company Logo"
                      className="h-24 w-auto object-contain border rounded p-2 bg-white"
                    />
                  </div>
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Payroll Defaults</CardTitle>
                <CardDescription>
                  Default rules used during payroll generation.
                </CardDescription>
              </CardHeader>

              <CardContent className="space-y-4">
                <div className="grid md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium mb-1">
                      Working Days Per Month
                    </label>
                    <Input
                      type="number"
                      step="1"
                      value={form.default_working_days_per_month}
                      onChange={(e) =>
                        setForm((prev) => ({
                          ...prev,
                          default_working_days_per_month: e.target.value,
                        }))
                      }
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium mb-1">
                      Hours Per Day
                    </label>
                    <Input
                      type="number"
                      step="0.01"
                      value={form.default_hours_per_day}
                      onChange={(e) =>
                        setForm((prev) => ({
                          ...prev,
                          default_hours_per_day: e.target.value,
                        }))
                      }
                    />
                  </div>
                </div>

                <div className="grid md:grid-cols-3 gap-4">
                  <div>
                    <label className="block text-sm font-medium mb-1">
                      OT Multiplier Regular
                    </label>
                    <Input
                      type="number"
                      step="0.01"
                      value={form.overtime_multiplier_regular}
                      onChange={(e) =>
                        setForm((prev) => ({
                          ...prev,
                          overtime_multiplier_regular: e.target.value,
                        }))
                      }
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium mb-1">
                      OT Multiplier Rest Day
                    </label>
                    <Input
                      type="number"
                      step="0.01"
                      value={form.overtime_multiplier_restday}
                      onChange={(e) =>
                        setForm((prev) => ({
                          ...prev,
                          overtime_multiplier_restday: e.target.value,
                        }))
                      }
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium mb-1">
                      OT Multiplier Holiday
                    </label>
                    <Input
                      type="number"
                      step="0.01"
                      value={form.overtime_multiplier_holiday}
                      onChange={(e) =>
                        setForm((prev) => ({
                          ...prev,
                          overtime_multiplier_holiday: e.target.value,
                        }))
                      }
                    />
                  </div>
                </div>

                <div className="grid md:grid-cols-3 gap-4">
                  <div>
                    <label className="block text-sm font-medium mb-1">
                      Rest Day Multiplier
                    </label>
                    <Input
                      type="number"
                      step="0.01"
                      value={form.restday_multiplier}
                      onChange={(e) =>
                        setForm((prev) => ({
                          ...prev,
                          restday_multiplier: e.target.value,
                        }))
                      }
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium mb-1">
                      Holiday Multiplier
                    </label>
                    <Input
                      type="number"
                      step="0.01"
                      value={form.holiday_multiplier}
                      onChange={(e) =>
                        setForm((prev) => ({
                          ...prev,
                          holiday_multiplier: e.target.value,
                        }))
                      }
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium mb-1">
                      Holiday + Rest Day Multiplier
                    </label>
                    <Input
                      type="number"
                      step="0.01"
                      value={form.holiday_restday_multiplier}
                      onChange={(e) =>
                        setForm((prev) => ({
                          ...prev,
                          holiday_restday_multiplier: e.target.value,
                        }))
                      }
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium mb-1">
                    Late Deduction Basis
                  </label>
                  <select
                    className="w-full border rounded px-3 py-2 bg-white"
                    value={form.late_deduction_basis}
                    onChange={(e) =>
                      setForm((prev) => ({
                        ...prev,
                        late_deduction_basis: e.target.value as
                          | "hourly_rate"
                          | "daily_rate_fraction"
                          | "custom",
                      }))
                    }
                  >
                    <option value="hourly_rate">Hourly Rate</option>
                    <option value="daily_rate_fraction">Daily Rate Fraction</option>
                    <option value="custom">Custom</option>
                  </select>
                </div>
              </CardContent>
            </Card>

            <div className="flex justify-end">
              <Button type="submit" disabled={isSaving}>
                {isSaving ? "Saving..." : "Save Payroll Settings"}
              </Button>
            </div>
          </form>
        )}
      </div>
    </AdminLayout>
  );
}