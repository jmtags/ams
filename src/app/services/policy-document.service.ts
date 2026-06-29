import { supabase } from "../lib/supabase";
import { appSettingsService } from "./app-settings.service";

export type PolicyDocument = {
  id: string;
  title: string;
  description: string | null;
  category: string | null;
  file_url: string;
  file_name: string;
  file_size: number | null;
  storage_path?: string | null;
  is_active: boolean;
  created_by?: string | null;
  created_at: string;
  updated_at: string;
};

export type PolicyDocumentPayload = {
  title: string;
  description?: string | null;
  category?: string | null;
  file?: File | null;
  is_active: boolean;
  created_by?: string | null;
};

const POLICY_BUCKET = "policy-documents";
const MAX_PDF_SIZE = 20 * 1024 * 1024;

const normalizeRemoteDocuments = (payload: unknown): PolicyDocument[] => {
  if (!payload || typeof payload !== "object") return [];
  const rows = (payload as { policy_documents?: unknown }).policy_documents;
  return Array.isArray(rows) ? (rows as PolicyDocument[]) : [];
};

const validatePdf = (file: File) => {
  const hasPdfExtension = file.name.toLowerCase().endsWith(".pdf");
  if (file.type !== "application/pdf" && !hasPdfExtension) {
    throw new Error("Please select a PDF document.");
  }
  if (file.size > MAX_PDF_SIZE) {
    throw new Error("The PDF must be 20 MB or smaller.");
  }
};

const uploadPdf = async (file: File) => {
  validatePdf(file);
  const safeName = file.name
    .replace(/\.pdf$/i, "")
    .replace(/[^a-zA-Z0-9_-]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60);
  const storagePath = `policies/${Date.now()}-${crypto.randomUUID()}-${
    safeName || "document"
  }.pdf`;

  const { error } = await supabase.storage
    .from(POLICY_BUCKET)
    .upload(storagePath, file, {
      cacheControl: "3600",
      contentType: "application/pdf",
      upsert: false,
    });

  if (error) {
    throw new Error(error.message || "Failed to upload the PDF.");
  }

  const { data } = supabase.storage
    .from(POLICY_BUCKET)
    .getPublicUrl(storagePath);

  return {
    fileUrl: data.publicUrl,
    storagePath,
    fileName: file.name,
    fileSize: file.size,
  };
};

const removeStoredFile = async (storagePath?: string | null) => {
  if (!storagePath) return;
  await supabase.storage.from(POLICY_BUCKET).remove([storagePath]);
};

export const policyDocumentService = {
  async getPublished(): Promise<PolicyDocument[]> {
    const config = await appSettingsService.getInstanceConfig();

    if (config.mode === "sub" && config.mainAnnouncementApiUrl.trim()) {
      const headers: Record<string, string> = { Accept: "application/json" };
      const anonKey = config.mainAnnouncementAnonKey.trim();

      if (anonKey) {
        headers.apikey = anonKey;
        headers.Authorization = `Bearer ${anonKey}`;
      }

      const response = await fetch(config.mainAnnouncementApiUrl.trim(), {
        headers,
      });

      if (!response.ok) {
        throw new Error(
          "Failed to load policies from Corporate HR. Check the main instance API settings."
        );
      }

      return normalizeRemoteDocuments(await response.json());
    }

    const { data, error } = await supabase
      .from("policy_documents")
      .select(
        "id, title, description, category, file_url, file_name, file_size, is_active, created_at, updated_at"
      )
      .eq("is_active", true)
      .order("updated_at", { ascending: false });

    if (error) throw error;
    return (data ?? []) as PolicyDocument[];
  },

  async getAll(): Promise<PolicyDocument[]> {
    const { data, error } = await supabase
      .from("policy_documents")
      .select("*")
      .order("updated_at", { ascending: false });

    if (error) throw error;
    return (data ?? []) as PolicyDocument[];
  },

  async create(payload: PolicyDocumentPayload): Promise<PolicyDocument> {
    if (!payload.title.trim()) throw new Error("Title is required.");
    if (!payload.file) throw new Error("A PDF document is required.");

    const uploaded = await uploadPdf(payload.file);
    const { data, error } = await supabase
      .from("policy_documents")
      .insert({
        title: payload.title.trim(),
        description: payload.description?.trim() || null,
        category: payload.category?.trim() || null,
        file_url: uploaded.fileUrl,
        file_name: uploaded.fileName,
        file_size: uploaded.fileSize,
        storage_path: uploaded.storagePath,
        is_active: payload.is_active,
        created_by: payload.created_by ?? null,
      })
      .select()
      .single();

    if (error) {
      await removeStoredFile(uploaded.storagePath);
      throw error;
    }

    return data as PolicyDocument;
  },

  async update(
    document: PolicyDocument,
    payload: PolicyDocumentPayload
  ): Promise<PolicyDocument> {
    if (!payload.title.trim()) throw new Error("Title is required.");

    const uploaded = payload.file ? await uploadPdf(payload.file) : null;
    const { data, error } = await supabase
      .from("policy_documents")
      .update({
        title: payload.title.trim(),
        description: payload.description?.trim() || null,
        category: payload.category?.trim() || null,
        file_url: uploaded?.fileUrl ?? document.file_url,
        file_name: uploaded?.fileName ?? document.file_name,
        file_size: uploaded?.fileSize ?? document.file_size,
        storage_path: uploaded?.storagePath ?? document.storage_path,
        is_active: payload.is_active,
        updated_at: new Date().toISOString(),
      })
      .eq("id", document.id)
      .select()
      .single();

    if (error) {
      await removeStoredFile(uploaded?.storagePath);
      throw error;
    }

    if (uploaded) await removeStoredFile(document.storage_path);
    return data as PolicyDocument;
  },

  async delete(document: PolicyDocument): Promise<void> {
    const { error } = await supabase
      .from("policy_documents")
      .delete()
      .eq("id", document.id);

    if (error) throw error;
    await removeStoredFile(document.storage_path);
  },
};
