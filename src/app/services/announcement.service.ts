import { supabase } from "../lib/supabase";
import { appSettingsService } from "./app-settings.service";

export type AnnouncementSeverity = "info" | "warning" | "urgent";

export type Announcement = {
  id: string;
  title: string;
  message: string;
  image_url: string | null;
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
  image_url?: string | null;
  image_file?: File | null;
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
  return rows.map((row: any) => ({
    ...row,
    image_url: row.image_url || row.imageUrl || null,
  })) as Announcement[];
};

const uploadAnnouncementImage = async (file: File): Promise<string> => {
  const ext = file.name.split(".").pop()?.toLowerCase() || "jpg";
  const filePath = `announcements/${Date.now()}-${crypto.randomUUID()}.${ext}`;

  const { error: uploadError } = await supabase.storage
    .from("announcement-images")
    .upload(filePath, file, {
      cacheControl: "3600",
      upsert: false,
    });

  if (uploadError) {
    throw new Error(uploadError.message || "Failed to upload announcement image.");
  }

  const { data } = supabase.storage
    .from("announcement-images")
    .getPublicUrl(filePath);

  return data.publicUrl;
};

const fetchMainContent = async (url: string, anonKey: string) => {
  const publicHeaders: Record<string, string> = {
    Accept: "application/json",
  };
  const authenticatedHeaders = anonKey
    ? {
        ...publicHeaders,
        apikey: anonKey,
        Authorization: `Bearer ${anonKey}`,
      }
    : publicHeaders;

  let response = await fetch(url, { headers: authenticatedHeaders });

  if (!response.ok && anonKey) {
    response = await fetch(url, { headers: publicHeaders });
  }

  if (!response.ok) {
    let detail = "";
    try {
      const payload = await response.json();
      detail = String(payload?.error || payload?.message || "").trim();
    } catch {
      // Use the HTTP status when the gateway returns a non-JSON response.
    }

    throw new Error(
      `Corporate HR content API returned ${response.status}${
        detail ? `: ${detail}` : ""
      }. Check the main API URL and deploy the public content Edge Function.`
    );
  }

  return response.json();
};

export const announcementService = {
  async getPublicAnnouncements(): Promise<Announcement[]> {
    const config = await appSettingsService.getInstanceConfig();

    if (config.mode === "sub" && config.mainAnnouncementApiUrl.trim()) {
      const anonKey = config.mainAnnouncementAnonKey.trim();
      const payload = await fetchMainContent(
        config.mainAnnouncementApiUrl.trim(),
        anonKey
      );
      return normalizeRemoteAnnouncements(payload);
    }

    const { data, error } = await activeAnnouncementFilter(
      supabase.from("announcements").select("*")
    )
      .order("starts_at", { ascending: false, nullsFirst: false })
      .order("created_at", { ascending: false });

    if (error) throw error;
    return (data ?? []) as Announcement[];
  },

  async getAll(): Promise<Announcement[]> {
    const { data, error } = await supabase
      .from("announcements")
      .select("*")
      .order("starts_at", { ascending: false, nullsFirst: false })
      .order("created_at", { ascending: false });

    if (error) throw error;
    return (data ?? []) as Announcement[];
  },

  async create(payload: AnnouncementFormPayload): Promise<Announcement> {
    const imageUrl = payload.image_file
      ? await uploadAnnouncementImage(payload.image_file)
      : payload.image_url?.trim() || null;

    const { data, error } = await supabase
      .from("announcements")
      .insert({
        title: payload.title.trim(),
        message: payload.message.trim(),
        image_url: imageUrl,
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
    const imageUrl = payload.image_file
      ? await uploadAnnouncementImage(payload.image_file)
      : payload.image_url?.trim() || null;

    const { data, error } = await supabase
      .from("announcements")
      .update({
        title: payload.title.trim(),
        message: payload.message.trim(),
        image_url: imageUrl,
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
