import { supabase } from "../lib/supabase";

export type GovernmentSettingType =
  | "sss"
  | "philhealth"
  | "pagibig"
  | "withholding_tax";

export type GovernmentContributionSetting = {
  id: string;
  setting_type: GovernmentSettingType;
  name: string;
  effective_from: string;
  is_active: boolean;
  config: any;
  created_at?: string;
  updated_at?: string;
};

export type GovernmentReportRow = {
  id: string;
  employee: string;
  email: string | null;
  sss_employee: number;
  sss_employer: number;
  philhealth_employee: number;
  philhealth_employer: number;
  pagibig_employee: number;
  pagibig_employer: number;
  withholding_tax: number;
  total_employee_deductions: number;
  total_employer_contributions: number;
};

const mapSetting = (row: any): GovernmentContributionSetting => ({
  id: row.id,
  setting_type: row.setting_type,
  name: row.name,
  effective_from: row.effective_from,
  is_active: Boolean(row.is_active),
  config: row.config ?? {},
  created_at: row.created_at,
  updated_at: row.updated_at,
});

const numberValue = (value: unknown) => Number(value ?? 0);

export const governmentContributionSettingsService = {
  async getAll(): Promise<GovernmentContributionSetting[]> {
    const { data, error } = await supabase
      .from("government_contribution_settings")
      .select("*")
      .order("setting_type", { ascending: true })
      .order("effective_from", { ascending: false });

    if (error) throw error;
    return (data ?? []).map(mapSetting);
  },

  async getActiveByType(): Promise<
    Partial<Record<GovernmentSettingType, GovernmentContributionSetting>>
  > {
    const settings = await this.getAll();
    return settings.reduce<
      Partial<Record<GovernmentSettingType, GovernmentContributionSetting>>
    >((acc, setting) => {
      if (!setting.is_active || acc[setting.setting_type]) return acc;
      acc[setting.setting_type] = setting;
      return acc;
    }, {});
  },

  async update(
    id: string,
    payload: Partial<
      Pick<
        GovernmentContributionSetting,
        "name" | "effective_from" | "is_active" | "config"
      >
    >
  ): Promise<GovernmentContributionSetting> {
    const { data, error } = await supabase
      .from("government_contribution_settings")
      .update({
        ...payload,
        updated_at: new Date().toISOString(),
      })
      .eq("id", id)
      .select("*")
      .single();

    if (error) throw error;
    return mapSetting(data);
  },

  async getGovernmentReports(payrollPeriodId: string): Promise<GovernmentReportRow[]> {
    const { data, error } = await supabase
      .from("payroll_records")
      .select(`
        id,
        sss_deduction,
        sss_employer_contribution,
        philhealth_deduction,
        philhealth_employer_contribution,
        pagibig_deduction,
        pagibig_employer_contribution,
        tax_deduction,
        users (
          name,
          email
        )
      `)
      .eq("payroll_period_id", payrollPeriodId)
      .order("created_at", { ascending: false });

    if (error) throw error;

    return (data ?? []).map((row: any) => {
      const sssEmployee = numberValue(row.sss_deduction);
      const sssEmployer = numberValue(row.sss_employer_contribution);
      const philhealthEmployee = numberValue(row.philhealth_deduction);
      const philhealthEmployer = numberValue(row.philhealth_employer_contribution);
      const pagibigEmployee = numberValue(row.pagibig_deduction);
      const pagibigEmployer = numberValue(row.pagibig_employer_contribution);
      const withholdingTax = numberValue(row.tax_deduction);

      return {
        id: row.id,
        employee: row.users?.name ?? "",
        email: row.users?.email ?? null,
        sss_employee: sssEmployee,
        sss_employer: sssEmployer,
        philhealth_employee: philhealthEmployee,
        philhealth_employer: philhealthEmployer,
        pagibig_employee: pagibigEmployee,
        pagibig_employer: pagibigEmployer,
        withholding_tax: withholdingTax,
        total_employee_deductions:
          sssEmployee + philhealthEmployee + pagibigEmployee + withholdingTax,
        total_employer_contributions:
          sssEmployer + philhealthEmployer + pagibigEmployer,
      };
    });
  },
};
