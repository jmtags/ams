import { supabase } from "../lib/supabase";
import { appSettingsService } from "./app-settings.service";

export type AnnouncementSeverity = "info" | "warning" | "urgent";

export type Announcement = {
  id: string;
  title: string;
  message: string;
  severity: AnnouncementSeverity;
  is_active: boolean;
  starts_at: string | null;
  ends_at: string | null;
  created_by?: string | null;
  created_at: string;
  updated_at: string;
};

export type AnnouncementFormPayload = {
  title: string;
  message: string;
  severity: AnnouncementSeverity;
  is_active: boolean;
  starts_at?: string | null;
  ends_at?: string | null;
  created_by?: string | null;
};

const activeAnnouncementFilter = (query: any) => {
  const now = new Date().toISOString();
  return query
    .eq("is_active", true)
    .or(`starts_at.is.null,starts_at.lte.${now}`)
    .or(`ends_at.is.null,ends_at.gte.${now}`);
};

const normalizeRemoteAnnouncements = (payload: any): Announcement[] => {
  const rows = Array.isArray(payload) ? payload : payload?.announcements;
  if (!Array.isArray(rows)) return [];
  return rows as Announcement[];
};

export const announcementService = {
  async getPublicAnnouncements(): Promise<Announcement[]> {
    const config = await appSettingsService.getInstanceConfig();

    if (config.mode === "sub" && config.mainAnnouncementApiUrl.trim()) {
      const response = await fetch(config.mainAnnouncementApiUrl.trim(), {
        headers: { Accept: "application/json" },
      });

      if (!response.ok) {
        throw new Error("Failed to load announcements from main instance.");
      }

      return normalizeRemoteAnnouncements(await response.json());
    }

    const { data, error } = await activeAnnouncementFilter(
      supabase.from("announcements").select("*")
    )
      .order("severity", { ascending: false })
      .order("created_at", { ascending: false });

    if (error) throw error;
    return (data ?? []) as Announcement[];
  },

  async getAll(): Promise<Announcement[]> {
    const { data, error } = await supabase
      .from("announcements")
      .select("*")
      .order("created_at", { ascending: false });

    if (error) throw error;
    return (data ?? []) as Announcement[];
  },

  async create(payload: AnnouncementFormPayload): Promise<Announcement> {
    const { data, error } = await supabase
      .from("announcements")
      .insert({
        title: payload.title.trim(),
        message: payload.message.trim(),
        severity: payload.severity,
        is_active: payload.is_active,
        starts_at: payload.starts_at || null,
        ends_at: payload.ends_at || null,
        created_by: payload.created_by ?? null,
      })
      .select()
      .single();

    if (error) throw error;
    return data as Announcement;
  },

  async update(
    id: string,
    payload: AnnouncementFormPayload
  ): Promise<Announcement> {
    const { data, error } = await supabase
      .from("announcements")
      .update({
        title: payload.title.trim(),
        message: payload.message.trim(),
        severity: payload.severity,
        is_active: payload.is_active,
        starts_at: payload.starts_at || null,
        ends_at: payload.ends_at || null,
        updated_at: new Date().toISOString(),
      })
      .eq("id", id)
      .select()
      .single();

    if (error) throw error;
    return data as Announcement;
  },

  async delete(id: string): Promise<void> {
    const { error } = await supabase.from("announcements").delete().eq("id", id);
    if (error) throw error;
  },
};
