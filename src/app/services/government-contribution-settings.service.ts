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

export const defaultGovernmentContributionSettings: Record<
  GovernmentSettingType,
  Pick<
    GovernmentContributionSetting,
    "setting_type" | "name" | "effective_from" | "is_active" | "config"
  >
> = {
  sss: {
    setting_type: "sss",
    name: "SSS 2025 Default",
    effective_from: "2025-01-01",
    is_active: true,
    config: {
      salary_ranges: [
        {
          min: 0,
          max: 4999.99,
          monthly_salary_credit: 5000,
          employee_rate: 0.05,
          employer_rate: 0.1,
        },
        {
          min: 5000,
          max: 34999.99,
          monthly_salary_credit: null,
          employee_rate: 0.05,
          employer_rate: 0.1,
        },
        {
          min: 35000,
          max: null,
          monthly_salary_credit: 35000,
          employee_rate: 0.05,
          employer_rate: 0.1,
        },
      ],
    },
  },
  philhealth: {
    setting_type: "philhealth",
    name: "PhilHealth 2025 Default",
    effective_from: "2025-01-01",
    is_active: true,
    config: {
      salary_floor: 10000,
      salary_ceiling: 100000,
      total_rate: 0.05,
      employee_share: 0.5,
      employer_share: 0.5,
    },
  },
  pagibig: {
    setting_type: "pagibig",
    name: "Pag-IBIG 2024 Default",
    effective_from: "2024-02-01",
    is_active: true,
    config: {
      salary_cap: 10000,
      employee_rate: 0.02,
      employer_rate: 0.02,
    },
  },
  withholding_tax: {
    setting_type: "withholding_tax",
    name: "BIR Withholding Tax Table 2023 Onwards",
    effective_from: "2023-01-01",
    is_active: true,
    config: {
      tables: {
        semi_monthly: [
          { min: 0, max: 10417, base_tax: 0, excess_over: 0, rate: 0 },
          {
            min: 10417,
            max: 16666,
            base_tax: 0,
            excess_over: 10417,
            rate: 0.15,
          },
          {
            min: 16667,
            max: 33332,
            base_tax: 937.5,
            excess_over: 16667,
            rate: 0.2,
          },
          {
            min: 33333,
            max: 83332,
            base_tax: 4270.7,
            excess_over: 33333,
            rate: 0.25,
          },
          {
            min: 83333,
            max: 333332,
            base_tax: 16770.7,
            excess_over: 83333,
            rate: 0.3,
          },
          {
            min: 333333,
            max: null,
            base_tax: 91770.7,
            excess_over: 333333,
            rate: 0.35,
          },
        ],
        monthly: [
          { min: 0, max: 20833, base_tax: 0, excess_over: 0, rate: 0 },
          {
            min: 20833,
            max: 33332,
            base_tax: 0,
            excess_over: 20833,
            rate: 0.15,
          },
          {
            min: 33333,
            max: 66666,
            base_tax: 1875,
            excess_over: 33333,
            rate: 0.2,
          },
          {
            min: 66667,
            max: 166666,
            base_tax: 8541.8,
            excess_over: 66667,
            rate: 0.25,
          },
          {
            min: 166667,
            max: 666666,
            base_tax: 33541.8,
            excess_over: 166667,
            rate: 0.3,
          },
          {
            min: 666667,
            max: null,
            base_tax: 183541.8,
            excess_over: 666667,
            rate: 0.35,
          },
        ],
      },
    },
  },
};

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

  async createDefault(
    settingType: GovernmentSettingType
  ): Promise<GovernmentContributionSetting> {
    const defaultSetting = defaultGovernmentContributionSettings[settingType];
    const { data, error } = await supabase
      .from("government_contribution_settings")
      .insert(defaultSetting)
      .select("*")
      .single();

    if (error) throw error;
    return mapSetting(data);
  },

  async createMissingDefaults(): Promise<void> {
    const settings = await this.getAll();
    const existingTypes = new Set(settings.map((setting) => setting.setting_type));
    const missingTypes = (
      Object.keys(defaultGovernmentContributionSettings) as GovernmentSettingType[]
    ).filter((settingType) => !existingTypes.has(settingType));

    if (missingTypes.length === 0) return;

    const { error } = await supabase
      .from("government_contribution_settings")
      .insert(
        missingTypes.map(
          (settingType) => defaultGovernmentContributionSettings[settingType]
        )
      );

    if (error) throw error;
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
