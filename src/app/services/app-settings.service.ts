import { supabase } from "../lib/supabase";

export type InstanceMode = "main" | "sub";

export type InstanceConfig = {
  mode: InstanceMode;
  mainAnnouncementApiUrl: string;
  mainAnnouncementAnonKey: string;
  showAnnouncementPopup: boolean;
};

const defaultInstanceConfig: InstanceConfig = {
  mode: "sub",
  mainAnnouncementApiUrl: "",
  mainAnnouncementAnonKey: "",
  showAnnouncementPopup: true,
};

const normalizeConfig = (value: any): InstanceConfig => ({
  mode: value?.mode === "main" ? "main" : "sub",
  mainAnnouncementApiUrl: String(value?.mainAnnouncementApiUrl ?? ""),
  mainAnnouncementAnonKey: String(value?.mainAnnouncementAnonKey ?? ""),
  showAnnouncementPopup: value?.showAnnouncementPopup !== false,
});

export const appSettingsService = {
  async getInstanceConfig(): Promise<InstanceConfig> {
    const { data, error } = await supabase
      .from("app_settings")
      .select("value")
      .eq("key", "instance_config")
      .maybeSingle();

    if (error) throw error;
    if (!data?.value) return defaultInstanceConfig;

    return normalizeConfig(data.value);
  },

  async saveInstanceConfig(
    config: InstanceConfig,
    updatedBy?: string
  ): Promise<InstanceConfig> {
    const value = normalizeConfig(config);

    const { data, error } = await supabase
      .from("app_settings")
      .upsert({
        key: "instance_config",
        value,
        updated_by: updatedBy ?? null,
        updated_at: new Date().toISOString(),
      })
      .select("value")
      .single();

    if (error) throw error;
    return normalizeConfig(data.value);
  },
};
