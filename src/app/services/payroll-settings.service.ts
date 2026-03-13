import { supabase } from "../lib/supabase";

export type PayrollSettings = {
  id: string;
  company_name: string | null;
  company_logo_url: string | null;
  company_address: string | null;
  company_tin: string | null;

  default_working_days_per_month: number;
  default_hours_per_day: number;

  overtime_multiplier_regular: number;
  overtime_multiplier_restday: number;
  overtime_multiplier_holiday: number;

  restday_multiplier: number;
  holiday_multiplier: number;
  holiday_restday_multiplier: number;

  late_deduction_basis: "hourly_rate" | "daily_rate_fraction" | "custom";

  created_at?: string;
  updated_at?: string;
};

export type SavePayrollSettingsPayload = {
  company_name?: string | null;
  company_logo_url?: string | null;
  company_address?: string | null;
  company_tin?: string | null;

  default_working_days_per_month?: number;
  default_hours_per_day?: number;

  overtime_multiplier_regular?: number;
  overtime_multiplier_restday?: number;
  overtime_multiplier_holiday?: number;

  restday_multiplier?: number;
  holiday_multiplier?: number;
  holiday_restday_multiplier?: number;

  late_deduction_basis?: "hourly_rate" | "daily_rate_fraction" | "custom";
};

const mapPayrollSettings = (row: any): PayrollSettings => ({
  id: row.id,
  company_name: row.company_name ?? null,
  company_logo_url: row.company_logo_url ?? null,
  company_address: row.company_address ?? null,
  company_tin: row.company_tin ?? null,

  default_working_days_per_month: Number(row.default_working_days_per_month ?? 22),
  default_hours_per_day: Number(row.default_hours_per_day ?? 8),

  overtime_multiplier_regular: Number(row.overtime_multiplier_regular ?? 1.25),
  overtime_multiplier_restday: Number(row.overtime_multiplier_restday ?? 1.3),
  overtime_multiplier_holiday: Number(row.overtime_multiplier_holiday ?? 2),

  restday_multiplier: Number(row.restday_multiplier ?? 1.3),
  holiday_multiplier: Number(row.holiday_multiplier ?? 2),
  holiday_restday_multiplier: Number(row.holiday_restday_multiplier ?? 2.6),

  late_deduction_basis: row.late_deduction_basis ?? "hourly_rate",

  created_at: row.created_at,
  updated_at: row.updated_at,
});

export const payrollSettingsService = {
  async get(): Promise<PayrollSettings | null> {
    const { data, error } = await supabase
      .from("payroll_settings")
      .select("*")
      .limit(1)
      .maybeSingle();

    if (error) throw error;
    return data ? mapPayrollSettings(data) : null;
  },

  async save(payload: SavePayrollSettingsPayload): Promise<PayrollSettings> {
    const existing = await this.get();

    if (existing?.id) {
      const { data, error } = await supabase
        .from("payroll_settings")
        .update({
          ...payload,
          updated_at: new Date().toISOString(),
        })
        .eq("id", existing.id)
        .select("*")
        .single();

      if (error) throw error;
      return mapPayrollSettings(data);
    }

    const { data, error } = await supabase
      .from("payroll_settings")
      .insert({
        company_name: payload.company_name ?? null,
        company_logo_url: payload.company_logo_url ?? null,
        company_address: payload.company_address ?? null,
        company_tin: payload.company_tin ?? null,

        default_working_days_per_month:
          payload.default_working_days_per_month ?? 22,
        default_hours_per_day: payload.default_hours_per_day ?? 8,

        overtime_multiplier_regular:
          payload.overtime_multiplier_regular ?? 1.25,
        overtime_multiplier_restday:
          payload.overtime_multiplier_restday ?? 1.3,
        overtime_multiplier_holiday:
          payload.overtime_multiplier_holiday ?? 2,

        restday_multiplier: payload.restday_multiplier ?? 1.3,
        holiday_multiplier: payload.holiday_multiplier ?? 2,
        holiday_restday_multiplier:
          payload.holiday_restday_multiplier ?? 2.6,

        late_deduction_basis: payload.late_deduction_basis ?? "hourly_rate",
      })
      .select("*")
      .single();

    if (error) throw error;
    return mapPayrollSettings(data);
  },

  async uploadCompanyLogo(file: File): Promise<string> {
    const ext = file.name.split(".").pop()?.toLowerCase() || "png";
    const filePath = `logos/company-logo-${Date.now()}.${ext}`;

    const { error: uploadError } = await supabase.storage
      .from("company-assets")
      .upload(filePath, file, {
        upsert: true,
      });

    if (uploadError) throw uploadError;

    const { data } = supabase.storage
      .from("company-assets")
      .getPublicUrl(filePath);

    return data.publicUrl;
  },
};