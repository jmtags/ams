import { supabase } from "../lib/supabase";

export type RecurringDeduction = {
  id: string;
  user_id: string;
  adjustment_type: "addition" | "deduction";
  name: string;
  amount: number;
  deduction_type: "fixed" | "percentage";
  frequency:
    | "every_payroll"
    | "monthly_first_half"
    | "monthly_second_half"
    | "one_time";
  start_date: string;
  end_date: string | null;
  is_active: boolean;
  notes: string | null;
  created_at?: string;
  updated_at?: string;

  user_name?: string;
  user_email?: string | null;
};

export type RecurringDeductionAttachment = {
  id: string;
  recurring_deduction_id: string;
  file_url: string;
  file_name: string;
  file_size: number | null;
  file_type: string | null;
  storage_path: string;
  uploaded_by: string | null;
  created_at: string;
};

export type SaveRecurringDeductionPayload = {
  user_id: string;
  adjustment_type?: "addition" | "deduction";
  name: string;
  amount: number;
  deduction_type?: "fixed" | "percentage";
  frequency?:
    | "every_payroll"
    | "monthly_first_half"
    | "monthly_second_half"
    | "one_time";
  start_date: string;
  end_date?: string | null;
  is_active?: boolean;
  notes?: string | null;
};

const ATTACHMENT_BUCKET = "recurring-deduction-attachments";
const MAX_ATTACHMENT_SIZE = 20 * 1024 * 1024;
const ALLOWED_ATTACHMENT_TYPES = new Set([
  "application/pdf",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "application/msword",
  "text/plain",
]);
const ALLOWED_ATTACHMENT_EXTENSIONS = new Set(["pdf", "doc", "docx", "txt"]);

const mapRecurringDeduction = (row: any): RecurringDeduction => ({
  id: row.id,
  user_id: row.user_id,
  adjustment_type: row.adjustment_type ?? "deduction",
  name: row.name,
  amount: Number(row.amount ?? 0),
  deduction_type: row.deduction_type ?? "fixed",
  frequency: row.frequency ?? "every_payroll",
  start_date: row.start_date,
  end_date: row.end_date ?? null,
  is_active: Boolean(row.is_active),
  notes: row.notes ?? null,
  created_at: row.created_at,
  updated_at: row.updated_at,
  user_name: row.users?.name ?? "",
  user_email: row.users?.email ?? null,
});

const getFileExtension = (fileName: string) =>
  fileName.split(".").pop()?.toLowerCase() ?? "";

const validateAttachment = (file: File) => {
  const extension = getFileExtension(file.name);

  if (
    !ALLOWED_ATTACHMENT_TYPES.has(file.type) &&
    !ALLOWED_ATTACHMENT_EXTENSIONS.has(extension)
  ) {
    throw new Error("Attachments must be PDF, DOC, DOCX, or TXT files.");
  }

  if (file.size > MAX_ATTACHMENT_SIZE) {
    throw new Error("Attachments must be 20 MB or smaller.");
  }
};

const uploadAttachmentFile = async (
  recurringDeductionId: string,
  file: File
) => {
  validateAttachment(file);

  const extension = getFileExtension(file.name) || "file";
  const safeName = file.name
    .replace(/\.[^.]+$/i, "")
    .replace(/[^a-zA-Z0-9_-]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60);
  const storagePath = `${recurringDeductionId}/${Date.now()}-${crypto.randomUUID()}-${
    safeName || "attachment"
  }.${extension}`;

  const { error } = await supabase.storage
    .from(ATTACHMENT_BUCKET)
    .upload(storagePath, file, {
      cacheControl: "3600",
      contentType: file.type || undefined,
      upsert: false,
    });

  if (error) {
    throw new Error(error.message || "Failed to upload attachment.");
  }

  const { data } = supabase.storage
    .from(ATTACHMENT_BUCKET)
    .getPublicUrl(storagePath);

  return {
    fileUrl: data.publicUrl,
    storagePath,
    fileName: file.name,
    fileSize: file.size,
    fileType: file.type || extension,
  };
};

const removeStoredAttachment = async (storagePath?: string | null) => {
  if (!storagePath) return;
  await supabase.storage.from(ATTACHMENT_BUCKET).remove([storagePath]);
};

export const recurringDeductionService = {
  async getAll(): Promise<RecurringDeduction[]> {
    const { data, error } = await supabase
      .from("employee_recurring_deductions")
      .select(`
        *,
        users (
          id,
          name,
          email
        )
      `)
      .order("created_at", { ascending: false });

    if (error) throw error;
    return (data ?? []).map(mapRecurringDeduction);
  },

  async getByUser(userId: string): Promise<RecurringDeduction[]> {
    const { data, error } = await supabase
      .from("employee_recurring_deductions")
      .select(`
        *,
        users (
          id,
          name,
          email
        )
      `)
      .eq("user_id", userId)
      .order("created_at", { ascending: false });

    if (error) throw error;
    return (data ?? []).map(mapRecurringDeduction);
  },

  async create(
    payload: SaveRecurringDeductionPayload
  ): Promise<RecurringDeduction> {
    const { data, error } = await supabase
      .from("employee_recurring_deductions")
      .insert({
        user_id: payload.user_id,
        adjustment_type: payload.adjustment_type ?? "deduction",
        name: payload.name,
        amount: payload.amount,
        deduction_type: payload.deduction_type ?? "fixed",
        frequency: payload.frequency ?? "every_payroll",
        start_date: payload.start_date,
        end_date: payload.end_date ?? null,
        is_active: payload.is_active ?? true,
        notes: payload.notes ?? null,
      })
      .select(`
        *,
        users (
          id,
          name,
          email
        )
      `)
      .single();

    if (error) throw error;
    return mapRecurringDeduction(data);
  },

  async update(
    id: string,
    payload: Partial<SaveRecurringDeductionPayload>
  ): Promise<RecurringDeduction> {
    const { data, error } = await supabase
      .from("employee_recurring_deductions")
      .update({
        ...payload,
        updated_at: new Date().toISOString(),
      })
      .eq("id", id)
      .select(`
        *,
        users (
          id,
          name,
          email
        )
      `)
      .single();

    if (error) throw error;
    return mapRecurringDeduction(data);
  },

  async remove(id: string): Promise<void> {
    const { error } = await supabase
      .from("employee_recurring_deductions")
      .delete()
      .eq("id", id);

    if (error) throw error;
  },

  async getAttachments(
    recurringDeductionId: string
  ): Promise<RecurringDeductionAttachment[]> {
    const { data, error } = await supabase
      .from("employee_recurring_deduction_attachments")
      .select("*")
      .eq("recurring_deduction_id", recurringDeductionId)
      .order("created_at", { ascending: false });

    if (error) throw error;
    return (data ?? []) as RecurringDeductionAttachment[];
  },

  async addAttachments(
    recurringDeductionId: string,
    files: File[],
    uploadedBy?: string | null
  ): Promise<RecurringDeductionAttachment[]> {
    if (!files.length) return [];

    const created: RecurringDeductionAttachment[] = [];

    for (const file of files) {
      const uploaded = await uploadAttachmentFile(recurringDeductionId, file);

      const { data, error } = await supabase
        .from("employee_recurring_deduction_attachments")
        .insert({
          recurring_deduction_id: recurringDeductionId,
          file_url: uploaded.fileUrl,
          file_name: uploaded.fileName,
          file_size: uploaded.fileSize,
          file_type: uploaded.fileType,
          storage_path: uploaded.storagePath,
          uploaded_by: uploadedBy ?? null,
        })
        .select()
        .single();

      if (error) {
        await removeStoredAttachment(uploaded.storagePath);
        throw error;
      }

      created.push(data as RecurringDeductionAttachment);
    }

    return created;
  },

  async deleteAttachment(
    attachment: RecurringDeductionAttachment
  ): Promise<void> {
    const { error } = await supabase
      .from("employee_recurring_deduction_attachments")
      .delete()
      .eq("id", attachment.id);

    if (error) throw error;
    await removeStoredAttachment(attachment.storage_path);
  },
};
