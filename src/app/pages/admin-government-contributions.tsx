import { useEffect, useMemo, useState } from "react";
import { RefreshCw, Save, Plus, Trash2 } from "lucide-react";

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
  governmentContributionSettingsService,
  type GovernmentContributionSetting,
  type GovernmentSettingType,
} from "../services/government-contribution-settings.service";

type NumericRow = Record<string, number | null>;

const settingLabels: Record<GovernmentSettingType, string> = {
  sss: "SSS",
  philhealth: "PhilHealth",
  pagibig: "Pag-IBIG",
  withholding_tax: "Withholding Tax",
};

const parseNumber = (value: string) => {
  if (value.trim() === "") return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
};

const percent = (value: number | null | undefined) =>
  String(Number(value ?? 0) * 100);

const fromPercent = (value: string) => Number(parseNumber(value) ?? 0) / 100;

function NumberInput({
  value,
  onChange,
  placeholder,
}: {
  value: number | null | undefined;
  onChange: (value: number | null) => void;
  placeholder?: string;
}) {
  return (
    <Input
      type="number"
      step="0.01"
      value={value ?? ""}
      placeholder={placeholder}
      onChange={(event) => onChange(parseNumber(event.target.value))}
    />
  );
}

export function AdminGovernmentContributionsPage() {
  const [settings, setSettings] = useState<GovernmentContributionSetting[]>([]);
  const [selectedType, setSelectedType] =
    useState<GovernmentSettingType>("sss");
  const [draft, setDraft] = useState<GovernmentContributionSetting | null>(null);
  const [taxFrequency, setTaxFrequency] = useState("semi_monthly");
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [isCreatingDefaults, setIsCreatingDefaults] = useState(false);

  useEffect(() => {
    loadSettings();
  }, []);

  useEffect(() => {
    const selected =
      settings.find(
        (item) => item.setting_type === selectedType && item.is_active
      ) ?? settings.find((item) => item.setting_type === selectedType) ?? null;
    setDraft(selected ? structuredClone(selected) : null);
  }, [selectedType, settings]);

  const loadSettings = async () => {
    try {
      setIsLoading(true);
      const data = await governmentContributionSettingsService.getAll();
      setSettings(data);
    } catch (error: any) {
      console.error("Failed to load government settings:", error);
      alert(error.message || "Failed to load government contribution settings.");
    } finally {
      setIsLoading(false);
    }
  };

  const updateDraftConfig = (updater: (config: any) => any) => {
    setDraft((prev) =>
      prev ? { ...prev, config: updater(structuredClone(prev.config ?? {})) } : prev
    );
  };

  const handleSave = async () => {
    if (!draft) return;

    try {
      setIsSaving(true);
      await governmentContributionSettingsService.update(draft.id, {
        name: draft.name,
        effective_from: draft.effective_from,
        is_active: draft.is_active,
        config: draft.config,
      });
      await loadSettings();
      alert("Government contribution settings saved.");
    } catch (error: any) {
      console.error("Failed to save government settings:", error);
      alert(error.message || "Failed to save government contribution settings.");
    } finally {
      setIsSaving(false);
    }
  };

  const handleCreateDefault = async () => {
    try {
      setIsCreatingDefaults(true);
      await governmentContributionSettingsService.createDefault(selectedType);
      await loadSettings();
      alert(`${settingLabels[selectedType]} default settings created.`);
    } catch (error: any) {
      console.error("Failed to create default government settings:", error);
      alert(error.message || "Failed to create default settings.");
    } finally {
      setIsCreatingDefaults(false);
    }
  };

  const handleCreateMissingDefaults = async () => {
    try {
      setIsCreatingDefaults(true);
      await governmentContributionSettingsService.createMissingDefaults();
      await loadSettings();
      alert("Missing government contribution defaults created.");
    } catch (error: any) {
      console.error("Failed to create missing government settings:", error);
      alert(error.message || "Failed to create missing default settings.");
    } finally {
      setIsCreatingDefaults(false);
    }
  };

  const sssRows = useMemo(
    () => (Array.isArray(draft?.config?.salary_ranges) ? draft?.config.salary_ranges : []),
    [draft]
  );
  const taxRows = useMemo(
    () =>
      Array.isArray(draft?.config?.tables?.[taxFrequency])
        ? draft?.config.tables[taxFrequency]
        : [],
    [draft, taxFrequency]
  );

  return (
    <AdminLayout>
      <div className="space-y-6">
        <div className="flex items-start justify-between gap-4 flex-wrap">
          <div>
            <h1 className="text-2xl font-semibold mb-1">
              Government Contributions
            </h1>
            <p className="text-neutral-600">
              Maintain contribution rates and tax table ranges used during
              payroll generation.
            </p>
          </div>

          <div className="flex gap-2">
            <Button variant="outline" onClick={loadSettings}>
              <RefreshCw className="w-4 h-4 mr-2" />
              Refresh
            </Button>
            <Button
              variant="outline"
              onClick={handleCreateMissingDefaults}
              disabled={isCreatingDefaults}
            >
              <Plus className="w-4 h-4 mr-2" />
              {isCreatingDefaults ? "Creating..." : "Create Missing Defaults"}
            </Button>
            <Button onClick={handleSave} disabled={!draft || isSaving}>
              <Save className="w-4 h-4 mr-2" />
              {isSaving ? "Saving..." : "Save Settings"}
            </Button>
          </div>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Contribution Table</CardTitle>
            <CardDescription>
              Choose the table to update. Changes apply the next time payroll is
              generated.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid md:grid-cols-4 gap-3">
              {(Object.keys(settingLabels) as GovernmentSettingType[]).map(
                (type) => (
                  <button
                    type="button"
                    key={type}
                    className={`rounded-lg border px-4 py-3 text-left ${
                      selectedType === type
                        ? "border-neutral-900 bg-neutral-900 text-white"
                        : "bg-white hover:bg-neutral-50"
                    }`}
                    onClick={() => setSelectedType(type)}
                  >
                    <div className="font-medium">{settingLabels[type]}</div>
                    <div
                      className={`text-xs ${
                        selectedType === type
                          ? "text-neutral-200"
                          : "text-neutral-500"
                      }`}
                    >
                      Editable payroll table
                    </div>
                  </button>
                )
              )}
            </div>
          </CardContent>
        </Card>

        {isLoading ? (
          <Card>
            <CardContent className="py-10 text-center text-neutral-500">
              Loading settings...
            </CardContent>
          </Card>
        ) : !draft ? (
          <Card>
            <CardContent className="py-10 text-center">
              <div className="mx-auto max-w-lg space-y-4">
                <div>
                  <h3 className="text-lg font-semibold text-neutral-900">
                    No {settingLabels[selectedType]} settings found
                  </h3>
                  <p className="mt-1 text-neutral-600">
                    Create the default table first, then adjust the values if
                    your payroll team needs a different rate or range.
                  </p>
                </div>

                <Button
                  onClick={handleCreateDefault}
                  disabled={isCreatingDefaults}
                >
                  <Plus className="w-4 h-4 mr-2" />
                  {isCreatingDefaults
                    ? "Creating..."
                    : `Create ${settingLabels[selectedType]} Default`}
                </Button>
              </div>
            </CardContent>
          </Card>
        ) : (
          <Card>
            <CardHeader>
              <CardTitle>{settingLabels[selectedType]} Settings</CardTitle>
              <CardDescription>
                Review and update the active table used in payroll.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-5">
              <div className="grid md:grid-cols-3 gap-4">
                <div>
                  <label className="block text-sm font-medium mb-1">Name</label>
                  <Input
                    value={draft.name}
                    onChange={(event) =>
                      setDraft((prev) =>
                        prev ? { ...prev, name: event.target.value } : prev
                      )
                    }
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1">
                    Effective From
                  </label>
                  <Input
                    type="date"
                    value={draft.effective_from}
                    onChange={(event) =>
                      setDraft((prev) =>
                        prev
                          ? { ...prev, effective_from: event.target.value }
                          : prev
                      )
                    }
                  />
                </div>
                <label className="flex items-end gap-2 text-sm font-medium pb-2">
                  <input
                    type="checkbox"
                    checked={draft.is_active}
                    onChange={(event) =>
                      setDraft((prev) =>
                        prev ? { ...prev, is_active: event.target.checked } : prev
                      )
                    }
                  />
                  Active table
                </label>
              </div>

              {selectedType === "sss" && (
                <div className="space-y-3">
                  <div className="grid grid-cols-6 gap-3 text-xs font-semibold text-neutral-500">
                    <div>Min Salary</div>
                    <div>Max Salary</div>
                    <div>MSC</div>
                    <div>Employee %</div>
                    <div>Employer %</div>
                    <div />
                  </div>
                  {sssRows.map((row: NumericRow, index: number) => (
                    <div key={index} className="grid grid-cols-6 gap-3">
                      <NumberInput
                        value={row.min}
                        onChange={(value) =>
                          updateDraftConfig((config) => {
                            config.salary_ranges[index].min = value;
                            return config;
                          })
                        }
                      />
                      <NumberInput
                        value={row.max}
                        placeholder="No max"
                        onChange={(value) =>
                          updateDraftConfig((config) => {
                            config.salary_ranges[index].max = value;
                            return config;
                          })
                        }
                      />
                      <NumberInput
                        value={row.monthly_salary_credit}
                        placeholder="Use salary"
                        onChange={(value) =>
                          updateDraftConfig((config) => {
                            config.salary_ranges[index].monthly_salary_credit =
                              value;
                            return config;
                          })
                        }
                      />
                      <Input
                        type="number"
                        step="0.01"
                        value={percent(row.employee_rate)}
                        onChange={(event) =>
                          updateDraftConfig((config) => {
                            config.salary_ranges[index].employee_rate =
                              fromPercent(event.target.value);
                            return config;
                          })
                        }
                      />
                      <Input
                        type="number"
                        step="0.01"
                        value={percent(row.employer_rate)}
                        onChange={(event) =>
                          updateDraftConfig((config) => {
                            config.salary_ranges[index].employer_rate =
                              fromPercent(event.target.value);
                            return config;
                          })
                        }
                      />
                      <Button
                        type="button"
                        variant="outline"
                        onClick={() =>
                          updateDraftConfig((config) => {
                            config.salary_ranges.splice(index, 1);
                            return config;
                          })
                        }
                      >
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    </div>
                  ))}
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() =>
                      updateDraftConfig((config) => {
                        config.salary_ranges = config.salary_ranges ?? [];
                        config.salary_ranges.push({
                          min: 0,
                          max: null,
                          monthly_salary_credit: null,
                          employee_rate: 0.05,
                          employer_rate: 0.1,
                        });
                        return config;
                      })
                    }
                  >
                    <Plus className="w-4 h-4 mr-2" />
                    Add SSS Range
                  </Button>
                </div>
              )}

              {selectedType === "philhealth" && (
                <div className="grid md:grid-cols-5 gap-4">
                  <div>
                    <label className="block text-sm font-medium mb-1">
                      Salary Floor
                    </label>
                    <NumberInput
                      value={draft.config.salary_floor}
                      onChange={(value) =>
                        updateDraftConfig((config) => ({
                          ...config,
                          salary_floor: value,
                        }))
                      }
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium mb-1">
                      Salary Ceiling
                    </label>
                    <NumberInput
                      value={draft.config.salary_ceiling}
                      onChange={(value) =>
                        updateDraftConfig((config) => ({
                          ...config,
                          salary_ceiling: value,
                        }))
                      }
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium mb-1">
                      Total Rate %
                    </label>
                    <Input
                      type="number"
                      step="0.01"
                      value={percent(draft.config.total_rate)}
                      onChange={(event) =>
                        updateDraftConfig((config) => ({
                          ...config,
                          total_rate: fromPercent(event.target.value),
                        }))
                      }
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium mb-1">
                      Employee Share %
                    </label>
                    <Input
                      type="number"
                      step="0.01"
                      value={percent(draft.config.employee_share)}
                      onChange={(event) =>
                        updateDraftConfig((config) => ({
                          ...config,
                          employee_share: fromPercent(event.target.value),
                        }))
                      }
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium mb-1">
                      Employer Share %
                    </label>
                    <Input
                      type="number"
                      step="0.01"
                      value={percent(draft.config.employer_share)}
                      onChange={(event) =>
                        updateDraftConfig((config) => ({
                          ...config,
                          employer_share: fromPercent(event.target.value),
                        }))
                      }
                    />
                  </div>
                </div>
              )}

              {selectedType === "pagibig" && (
                <div className="grid md:grid-cols-3 gap-4">
                  <div>
                    <label className="block text-sm font-medium mb-1">
                      Salary Cap
                    </label>
                    <NumberInput
                      value={draft.config.salary_cap}
                      onChange={(value) =>
                        updateDraftConfig((config) => ({
                          ...config,
                          salary_cap: value,
                        }))
                      }
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium mb-1">
                      Employee Rate %
                    </label>
                    <Input
                      type="number"
                      step="0.01"
                      value={percent(draft.config.employee_rate)}
                      onChange={(event) =>
                        updateDraftConfig((config) => ({
                          ...config,
                          employee_rate: fromPercent(event.target.value),
                        }))
                      }
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium mb-1">
                      Employer Rate %
                    </label>
                    <Input
                      type="number"
                      step="0.01"
                      value={percent(draft.config.employer_rate)}
                      onChange={(event) =>
                        updateDraftConfig((config) => ({
                          ...config,
                          employer_rate: fromPercent(event.target.value),
                        }))
                      }
                    />
                  </div>
                </div>
              )}

              {selectedType === "withholding_tax" && (
                <div className="space-y-3">
                  <div className="max-w-xs">
                    <label className="block text-sm font-medium mb-1">
                      Tax Frequency Table
                    </label>
                    <select
                      className="w-full border rounded px-3 py-2 bg-white"
                      value={taxFrequency}
                      onChange={(event) => setTaxFrequency(event.target.value)}
                    >
                      <option value="semi_monthly">Semi-monthly</option>
                      <option value="monthly">Monthly</option>
                      <option value="weekly">Weekly</option>
                      <option value="daily">Daily</option>
                    </select>
                  </div>

                  <div className="grid grid-cols-6 gap-3 text-xs font-semibold text-neutral-500">
                    <div>Min</div>
                    <div>Max</div>
                    <div>Base Tax</div>
                    <div>Excess Over</div>
                    <div>Rate %</div>
                    <div />
                  </div>
                  {taxRows.map((row: NumericRow, index: number) => (
                    <div key={index} className="grid grid-cols-6 gap-3">
                      <NumberInput
                        value={row.min}
                        onChange={(value) =>
                          updateDraftConfig((config) => {
                            config.tables = config.tables ?? {};
                            config.tables[taxFrequency][index].min = value;
                            return config;
                          })
                        }
                      />
                      <NumberInput
                        value={row.max}
                        placeholder="No max"
                        onChange={(value) =>
                          updateDraftConfig((config) => {
                            config.tables = config.tables ?? {};
                            config.tables[taxFrequency][index].max = value;
                            return config;
                          })
                        }
                      />
                      <NumberInput
                        value={row.base_tax}
                        onChange={(value) =>
                          updateDraftConfig((config) => {
                            config.tables = config.tables ?? {};
                            config.tables[taxFrequency][index].base_tax = value;
                            return config;
                          })
                        }
                      />
                      <NumberInput
                        value={row.excess_over}
                        onChange={(value) =>
                          updateDraftConfig((config) => {
                            config.tables = config.tables ?? {};
                            config.tables[taxFrequency][index].excess_over =
                              value;
                            return config;
                          })
                        }
                      />
                      <Input
                        type="number"
                        step="0.01"
                        value={percent(row.rate)}
                        onChange={(event) =>
                          updateDraftConfig((config) => {
                            config.tables = config.tables ?? {};
                            config.tables[taxFrequency][index].rate =
                              fromPercent(event.target.value);
                            return config;
                          })
                        }
                      />
                      <Button
                        type="button"
                        variant="outline"
                        onClick={() =>
                          updateDraftConfig((config) => {
                            config.tables = config.tables ?? {};
                            config.tables[taxFrequency].splice(index, 1);
                            return config;
                          })
                        }
                      >
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    </div>
                  ))}
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() =>
                      updateDraftConfig((config) => {
                        config.tables = config.tables ?? {};
                        config.tables[taxFrequency] =
                          config.tables[taxFrequency] ?? [];
                        config.tables[taxFrequency].push({
                          min: 0,
                          max: null,
                          base_tax: 0,
                          excess_over: 0,
                          rate: 0,
                        });
                        return config;
                      })
                    }
                  >
                    <Plus className="w-4 h-4 mr-2" />
                    Add Tax Range
                  </Button>
                </div>
              )}
            </CardContent>
          </Card>
        )}
      </div>
    </AdminLayout>
  );
}
