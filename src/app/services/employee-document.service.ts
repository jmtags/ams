import { supabase } from "../lib/supabase";

export type DocumentStatus = "submitted" | "verified" | "rejected" | "expired";

export type DocumentCategory = {
  id: string;
  name: string;
  description: string | null;
  sort_order: number;
  is_active: boolean;
};

export type DocumentRequirement = {
  id: string;
  category_id: string | null;
  name: string;
  description: string | null;
  is_required: boolean;
  requires_expiry: boolean;
  employee_upload_allowed: boolean;
  employment_type: "all" | "regular" | "part_time";
  sort_order: number;
  is_active: boolean;
  category_name?: string | null;
};

export type EmployeeDocument = {
  id: string;
  user_id: string;
  category_id: string | null;
  requirement_id: string | null;
  title: string;
  file_name: string;
  file_size: number | null;
  mime_type: string | null;
  storage_path: string;
  status: DocumentStatus;
  expiry_date: string | null;
  remarks: string | null;
  uploaded_by: string | null;
  verified_by: string | null;
  verified_at: string | null;
  created_at: string;
  updated_at: string;
  category_name?: string | null;
  requirement_name?: string | null;
};

export type DocumentChecklistItem = {
  requirement: DocumentRequirement;
  document: EmployeeDocument | null;
  status: "missing" | "submitted" | "verified" | "rejected" | "expired";
};

export type DocumentReportRow = {
  user_id: string;
  employee_name: string;
  employee_email: string | null;
  required_count: number;
  submitted_count: number;
  verified_count: number;
  missing_count: number;
  expired_count: number;
  expiring_soon_count: number;
  completion_percent: number;
};

type UploadPayload = {
  user_id: string;
  category_id?: string | null;
  requirement_id?: string | null;
  title: string;
  expiry_date?: string | null;
  remarks?: string | null;
  file: File;
  uploaded_by?: string | null;
};

const BUCKET = "employee-201-files";
const MAX_FILE_SIZE = 20 * 1024 * 1024;

const defaultCategories = [
  ["Personal Documents", "Identity and personal records", 10],
  ["Employment Documents", "Contracts and employment records", 20],
  ["Government Records", "SSS, PhilHealth, Pag-IBIG, and TIN documents", 30],
  ["Payroll Documents", "Bank and compensation documents", 40],
  ["Performance", "Performance evaluations and commendations", 50],
  ["Disciplinary", "Incident reports and notices", 60],
  ["Training", "Certificates and training records", 70],
  ["Exit Documents", "Resignation, clearance, and final documents", 80],
] as const;

const defaultRequirements = [
  ["Personal Documents", "Resume / CV", "Employee resume or curriculum vitae", true, false, true, 10],
  ["Personal Documents", "Valid Government ID", "Primary valid identification document", true, true, true, 20],
  ["Employment Documents", "Employment Contract", "Signed employment contract or appointment document", true, false, false, 30],
  ["Government Records", "SSS Record", "SSS number or supporting document", true, false, true, 40],
  ["Government Records", "PhilHealth Record", "PhilHealth number or supporting document", true, false, true, 50],
  ["Government Records", "Pag-IBIG Record", "Pag-IBIG number or supporting document", true, false, true, 60],
  ["Government Records", "TIN Record", "Tax identification number or BIR document", true, false, true, 70],
  ["Payroll Documents", "Bank Account Form", "Payroll bank account or ATM document", true, false, true, 80],
  ["Personal Documents", "Medical Certificate", "Pre-employment or fit-to-work medical document", false, true, true, 90],
  ["Training", "Training Certificate", "Training or certification document", false, true, true, 100],
] as const;

const todayDate = () => new Date().toISOString().slice(0, 10);

const addDays = (date: string, days: number) => {
  const value = new Date(`${date}T00:00:00`);
  value.setDate(value.getDate() + days);
  return value.toISOString().slice(0, 10);
};

const normalizeFileName = (fileName: string) =>
  fileName
    .replace(/\.[^.]+$/, "")
    .replace(/[^a-zA-Z0-9_-]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 70) || "document";

const getDocumentStatus = (document: EmployeeDocument | null) => {
  if (!document) return "missing";
  if (document.expiry_date && document.expiry_date < todayDate()) {
    return "expired";
  }
  return document.status;
};

const mapCategory = (row: any): DocumentCategory => ({
  id: row.id,
  name: row.name,
  description: row.description ?? null,
  sort_order: Number(row.sort_order ?? 0),
  is_active: Boolean(row.is_active),
});

const mapRequirement = (row: any): DocumentRequirement => ({
  id: row.id,
  category_id: row.category_id ?? null,
  name: row.name,
  description: row.description ?? null,
  is_required: Boolean(row.is_required),
  requires_expiry: Boolean(row.requires_expiry),
  employee_upload_allowed: Boolean(row.employee_upload_allowed),
  employment_type: row.employment_type ?? "all",
  sort_order: Number(row.sort_order ?? 0),
  is_active: Boolean(row.is_active),
  category_name: row.document_categories?.name ?? null,
});

const mapDocument = (row: any): EmployeeDocument => ({
  id: row.id,
  user_id: row.user_id,
  category_id: row.category_id ?? null,
  requirement_id: row.requirement_id ?? null,
  title: row.title,
  file_name: row.file_name,
  file_size: row.file_size == null ? null : Number(row.file_size),
  mime_type: row.mime_type ?? null,
  storage_path: row.storage_path,
  status: row.status,
  expiry_date: row.expiry_date ?? null,
  remarks: row.remarks ?? null,
  uploaded_by: row.uploaded_by ?? null,
  verified_by: row.verified_by ?? null,
  verified_at: row.verified_at ?? null,
  created_at: row.created_at,
  updated_at: row.updated_at,
  category_name: row.document_categories?.name ?? null,
  requirement_name: row.document_requirements?.name ?? null,
});

const validateFile = (file: File) => {
  if (file.size > MAX_FILE_SIZE) {
    throw new Error("201 files must be 20 MB or smaller.");
  }
};

const logActivity = async (
  documentId: string,
  userId: string,
  action: string,
  actorId?: string | null,
  notes?: string | null
) => {
  await supabase.from("employee_document_activity_logs").insert({
    document_id: documentId,
    user_id: userId,
    action,
    actor_id: actorId ?? null,
    notes: notes ?? null,
  });
};

export const employeeDocumentService = {
  async getCategories(): Promise<DocumentCategory[]> {
    const { data, error } = await supabase
      .from("document_categories")
      .select("*")
      .order("sort_order", { ascending: true })
      .order("name", { ascending: true });

    if (error) throw error;
    return (data ?? []).map(mapCategory);
  },

  async getRequirements(): Promise<DocumentRequirement[]> {
    const { data, error } = await supabase
      .from("document_requirements")
      .select("*, document_categories ( name )")
      .order("sort_order", { ascending: true })
      .order("name", { ascending: true });

    if (error) throw error;
    return (data ?? []).map(mapRequirement);
  },

  async createDefaultSetup(): Promise<void> {
    const { data: existingCategories, error: categoryReadError } = await supabase
      .from("document_categories")
      .select("id, name");

    if (categoryReadError) throw categoryReadError;

    const categoryNames = new Set((existingCategories ?? []).map((row) => row.name));
    const categoriesToInsert = defaultCategories
      .filter(([name]) => !categoryNames.has(name))
      .map(([name, description, sort_order]) => ({
        name,
        description,
        sort_order,
      }));

    if (categoriesToInsert.length > 0) {
      const { error } = await supabase
        .from("document_categories")
        .insert(categoriesToInsert);
      if (error) throw error;
    }

    const { data: categories, error: categoriesError } = await supabase
      .from("document_categories")
      .select("id, name");
    if (categoriesError) throw categoriesError;

    const categoryByName = new Map((categories ?? []).map((row) => [row.name, row.id]));

    const { data: existingRequirements, error: requirementReadError } =
      await supabase.from("document_requirements").select("name");
    if (requirementReadError) throw requirementReadError;

    const requirementNames = new Set(
      (existingRequirements ?? []).map((row) => row.name)
    );
    const requirementsToInsert = defaultRequirements
      .filter(([, name]) => !requirementNames.has(name))
      .map(
        ([
          categoryName,
          name,
          description,
          is_required,
          requires_expiry,
          employee_upload_allowed,
          sort_order,
        ]) => ({
          category_id: categoryByName.get(categoryName) ?? null,
          name,
          description,
          is_required,
          requires_expiry,
          employee_upload_allowed,
          sort_order,
        })
      );

    if (requirementsToInsert.length > 0) {
      const { error } = await supabase
        .from("document_requirements")
        .insert(requirementsToInsert);
      if (error) throw error;
    }
  },

  async getDocumentsByUser(userId: string): Promise<EmployeeDocument[]> {
    const { data, error } = await supabase
      .from("employee_documents")
      .select("*, document_categories ( name ), document_requirements ( name )")
      .eq("user_id", userId)
      .order("updated_at", { ascending: false });

    if (error) throw error;
    return (data ?? []).map(mapDocument);
  },

  getChecklist(
    requirements: DocumentRequirement[],
    documents: EmployeeDocument[]
  ): DocumentChecklistItem[] {
    return requirements
      .filter((item) => item.is_active && item.is_required)
      .map((requirement) => {
        const document =
          documents.find((item) => item.requirement_id === requirement.id) ?? null;
        return {
          requirement,
          document,
          status: getDocumentStatus(document),
        };
      });
  },

  getCompletion(checklist: DocumentChecklistItem[]) {
    const total = checklist.length;
    const completed = checklist.filter((item) =>
      ["submitted", "verified"].includes(item.status)
    ).length;
    return total === 0 ? 100 : Math.round((completed / total) * 100);
  },

  async uploadDocument(payload: UploadPayload): Promise<EmployeeDocument> {
    validateFile(payload.file);

    const fileName = normalizeFileName(payload.file.name);
    const extension = payload.file.name.includes(".")
      ? payload.file.name.split(".").pop()
      : "file";
    const storagePath = `${payload.user_id}/${Date.now()}-${crypto.randomUUID()}-${fileName}.${extension}`;

    const { error: uploadError } = await supabase.storage
      .from(BUCKET)
      .upload(storagePath, payload.file, {
        cacheControl: "3600",
        contentType: payload.file.type || "application/octet-stream",
        upsert: false,
      });

    if (uploadError) {
      throw new Error(uploadError.message || "Failed to upload 201 file.");
    }

    const { data, error } = await supabase
      .from("employee_documents")
      .insert({
        user_id: payload.user_id,
        category_id: payload.category_id ?? null,
        requirement_id: payload.requirement_id ?? null,
        title: payload.title.trim(),
        file_name: payload.file.name,
        file_size: payload.file.size,
        mime_type: payload.file.type || null,
        storage_path: storagePath,
        status: "submitted",
        expiry_date: payload.expiry_date || null,
        remarks: payload.remarks?.trim() || null,
        uploaded_by: payload.uploaded_by ?? null,
      })
      .select("*, document_categories ( name ), document_requirements ( name )")
      .single();

    if (error) {
      await supabase.storage.from(BUCKET).remove([storagePath]);
      throw error;
    }

    const document = mapDocument(data);
    await logActivity(document.id, document.user_id, "uploaded", payload.uploaded_by);
    return document;
  },

  async updateDocument(
    document: EmployeeDocument,
    payload: {
      title: string;
      category_id?: string | null;
      requirement_id?: string | null;
      status: DocumentStatus;
      expiry_date?: string | null;
      remarks?: string | null;
      actor_id?: string | null;
    }
  ): Promise<EmployeeDocument> {
    const now = new Date().toISOString();
    const verified = payload.status === "verified";
    const { data, error } = await supabase
      .from("employee_documents")
      .update({
        title: payload.title.trim(),
        category_id: payload.category_id ?? null,
        requirement_id: payload.requirement_id ?? null,
        status: payload.status,
        expiry_date: payload.expiry_date || null,
        remarks: payload.remarks?.trim() || null,
        verified_by: verified ? payload.actor_id ?? null : document.verified_by,
        verified_at: verified ? now : document.verified_at,
        updated_at: now,
      })
      .eq("id", document.id)
      .select("*, document_categories ( name ), document_requirements ( name )")
      .single();

    if (error) throw error;

    const updated = mapDocument(data);
    await logActivity(updated.id, updated.user_id, "updated", payload.actor_id);
    return updated;
  },

  async deleteDocument(document: EmployeeDocument, actorId?: string | null) {
    await logActivity(document.id, document.user_id, "deleted", actorId);

    const { error } = await supabase
      .from("employee_documents")
      .delete()
      .eq("id", document.id);

    if (error) throw error;
    await supabase.storage.from(BUCKET).remove([document.storage_path]);
  },

  async getSignedUrl(document: EmployeeDocument): Promise<string> {
    const { data, error } = await supabase.storage
      .from(BUCKET)
      .createSignedUrl(document.storage_path, 60 * 5);

    if (error) throw error;
    return data.signedUrl;
  },

  async getReport(): Promise<DocumentReportRow[]> {
    const [{ data: users, error: usersError }, requirements, documentsRes] =
      await Promise.all([
        supabase
          .from("users")
          .select("id, name, email")
          .order("name", { ascending: true }),
        this.getRequirements(),
        supabase
          .from("employee_documents")
          .select("*, document_categories ( name ), document_requirements ( name )"),
      ]);

    if (usersError) throw usersError;
    if (documentsRes.error) throw documentsRes.error;

    const required = requirements.filter((item) => item.is_active && item.is_required);
    const docs = (documentsRes.data ?? []).map(mapDocument);
    const today = todayDate();
    const soon = addDays(today, 30);

    return (users ?? []).map((user: any) => {
      const userDocs = docs.filter((doc) => doc.user_id === user.id);
      const checklist = this.getChecklist(required, userDocs);
      const missing = checklist.filter((item) => item.status === "missing").length;
      const expired = userDocs.filter(
        (doc) => doc.expiry_date && doc.expiry_date < today
      ).length;
      const expiringSoon = userDocs.filter(
        (doc) =>
          doc.expiry_date && doc.expiry_date >= today && doc.expiry_date <= soon
      ).length;

      return {
        user_id: user.id,
        employee_name: user.name ?? "",
        employee_email: user.email ?? null,
        required_count: checklist.length,
        submitted_count: checklist.filter((item) =>
          ["submitted", "verified"].includes(item.status)
        ).length,
        verified_count: checklist.filter((item) => item.status === "verified").length,
        missing_count: missing,
        expired_count: expired,
        expiring_soon_count: expiringSoon,
        completion_percent: this.getCompletion(checklist),
      };
    });
  },
};
