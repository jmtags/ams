import { FormEvent, useEffect, useState } from "react";
import { Eye, FileText, Pencil, Plus, Trash2 } from "lucide-react";
import { AdminLayout } from "../layouts/admin-layout";
import { Badge } from "../components/ui/badge";
import { Button } from "../components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "../components/ui/card";
import {
  Dialog,
  DialogBody,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "../components/ui/dialog";
import { Input } from "../components/ui/input";
import { Switch } from "../components/ui/switch";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "../components/ui/table";
import { useAuth } from "../hooks/useAuth";
import { appSettingsService } from "../services/app-settings.service";
import {
  policyDocumentService,
  type PolicyDocument,
} from "../services/policy-document.service";

type FormState = {
  title: string;
  description: string;
  category: string;
  file: File | null;
  is_active: boolean;
};

const initialForm: FormState = {
  title: "",
  description: "",
  category: "",
  file: null,
  is_active: true,
};

const formatFileSize = (bytes?: number | null) => {
  if (!bytes) return "-";
  return bytes >= 1024 * 1024
    ? `${(bytes / 1024 / 1024).toFixed(1)} MB`
    : `${Math.ceil(bytes / 1024)} KB`;
};

export function AdminPolicyDocumentsPage() {
  const { user } = useAuth();
  const [documents, setDocuments] = useState<PolicyDocument[]>([]);
  const [editing, setEditing] = useState<PolicyDocument | null>(null);
  const [form, setForm] = useState<FormState>(initialForm);
  const [isMainInstance, setIsMainInstance] = useState(false);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [error, setError] = useState("");

  const loadData = async () => {
    try {
      setIsLoading(true);
      setError("");
      const config = await appSettingsService.getInstanceConfig();
      const isMain = config.mode === "main";
      setIsMainInstance(isMain);
      setDocuments(isMain ? await policyDocumentService.getAll() : []);
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Failed to load policy documents."
      );
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    void loadData();
  }, []);

  const openDialog = (document?: PolicyDocument) => {
    setEditing(document ?? null);
    setForm(
      document
        ? {
            title: document.title,
            description: document.description ?? "",
            category: document.category ?? "",
            file: null,
            is_active: document.is_active,
          }
        : initialForm
    );
    setError("");
    setIsDialogOpen(true);
  };

  const closeDialog = () => {
    setIsDialogOpen(false);
    setEditing(null);
    setForm(initialForm);
  };

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault();

    try {
      setIsSaving(true);
      setError("");
      const payload = {
        ...form,
        created_by: user?.id ?? null,
      };

      if (editing) {
        await policyDocumentService.update(editing, payload);
      } else {
        await policyDocumentService.create(payload);
      }

      await loadData();
      closeDialog();
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Failed to save policy document."
      );
    } finally {
      setIsSaving(false);
    }
  };

  const handleDelete = async (document: PolicyDocument) => {
    if (!window.confirm(`Delete "${document.title}"?`)) return;

    try {
      setDeletingId(document.id);
      setError("");
      await policyDocumentService.delete(document);
      await loadData();
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Failed to delete policy document."
      );
    } finally {
      setDeletingId(null);
    }
  };

  return (
    <AdminLayout>
      <div className="space-y-6">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <h1 className="text-neutral-900 mb-1">Policy Documents</h1>
            <p className="text-neutral-600">
              Publish Corporate HR PDFs to employees across all instances.
            </p>
          </div>
          {isMainInstance && (
            <Button onClick={() => openDialog()}>
              <Plus className="w-4 h-4 mr-2" />
              Upload Policy
            </Button>
          )}
        </div>

        {error && (
          <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg text-sm">
            {error}
          </div>
        )}

        {!isLoading && !isMainInstance ? (
          <Card>
            <CardHeader>
              <CardTitle>Main instance only</CardTitle>
              <CardDescription>
                Policy publishing is available only on the Corporate HR main
                instance.
              </CardDescription>
            </CardHeader>
          </Card>
        ) : (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <FileText className="w-5 h-5" />
                Published Library
              </CardTitle>
              <CardDescription>
                Only active documents appear in the employee policy library.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Document</TableHead>
                    <TableHead>Category</TableHead>
                    <TableHead>Size</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Updated</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {isLoading ? (
                    <TableRow>
                      <TableCell colSpan={6} className="text-center py-8 text-neutral-500">
                        Loading policy documents...
                      </TableCell>
                    </TableRow>
                  ) : documents.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={6} className="text-center py-8 text-neutral-500">
                        No policy documents uploaded
                      </TableCell>
                    </TableRow>
                  ) : (
                    documents.map((document) => (
                      <TableRow key={document.id}>
                        <TableCell>
                          <div className="font-medium">{document.title}</div>
                          <div className="text-xs text-neutral-500">
                            {document.file_name}
                          </div>
                          {document.description && (
                            <div className="max-w-[420px] truncate text-xs text-neutral-500">
                              {document.description}
                            </div>
                          )}
                        </TableCell>
                        <TableCell>{document.category || "General"}</TableCell>
                        <TableCell>{formatFileSize(document.file_size)}</TableCell>
                        <TableCell>
                          <Badge variant={document.is_active ? "success" : "secondary"}>
                            {document.is_active ? "Active" : "Hidden"}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          {new Date(document.updated_at).toLocaleDateString("en-PH")}
                        </TableCell>
                        <TableCell>
                          <div className="flex justify-end gap-1">
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() =>
                                window.open(document.file_url, "_blank", "noopener,noreferrer")
                              }
                              title="View PDF"
                            >
                              <Eye className="w-4 h-4" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => openDialog(document)}
                              title="Edit"
                            >
                              <Pencil className="w-4 h-4" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="sm"
                              disabled={deletingId === document.id}
                              onClick={() => void handleDelete(document)}
                              title="Delete"
                            >
                              <Trash2 className="w-4 h-4 text-red-600" />
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        )}
      </div>

      <Dialog
        open={isDialogOpen}
        onOpenChange={(open) => !open && !isSaving && closeDialog()}
      >
        <DialogContent onClose={closeDialog} className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>
              {editing ? "Edit Policy Document" : "Upload Policy Document"}
            </DialogTitle>
            <DialogDescription>
              Upload a PDF up to 20 MB. Active documents are immediately
              available to employees.
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={handleSubmit}>
            <DialogBody>
              {error && (
                <div className="mb-4 bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg text-sm">
                  {error}
                </div>
              )}
              <div className="space-y-4">
                <Input
                  label="Title"
                  value={form.title}
                  onChange={(event) =>
                    setForm((previous) => ({
                      ...previous,
                      title: event.target.value,
                    }))
                  }
                  required
                  disabled={isSaving}
                />
                <Input
                  label="Category"
                  value={form.category}
                  onChange={(event) =>
                    setForm((previous) => ({
                      ...previous,
                      category: event.target.value,
                    }))
                  }
                  placeholder="Example: Code of Conduct"
                  disabled={isSaving}
                />
                <div>
                  <label className="block text-sm mb-1.5 text-neutral-700">
                    Description
                  </label>
                  <textarea
                    value={form.description}
                    onChange={(event) =>
                      setForm((previous) => ({
                        ...previous,
                        description: event.target.value,
                      }))
                    }
                    rows={4}
                    className="w-full rounded-lg border border-neutral-300 px-3 py-2 text-sm"
                    disabled={isSaving}
                  />
                </div>
                <div>
                  <label className="block text-sm mb-1.5 text-neutral-700">
                    PDF Document {editing ? "(optional replacement)" : ""}
                  </label>
                  <input
                    type="file"
                    accept="application/pdf,.pdf"
                    required={!editing}
                    onChange={(event) =>
                      setForm((previous) => ({
                        ...previous,
                        file: event.target.files?.[0] ?? null,
                      }))
                    }
                    className="w-full rounded-lg border border-neutral-300 px-3 py-2 text-sm"
                    disabled={isSaving}
                  />
                  {editing && !form.file && (
                    <p className="mt-1 text-xs text-neutral-500">
                      Current file: {editing.file_name}
                    </p>
                  )}
                </div>
                <div className="flex items-center justify-between rounded-lg border border-neutral-200 p-4">
                  <div>
                    <p className="text-sm font-medium">Visible to employees</p>
                    <p className="text-sm text-neutral-600">
                      Hidden documents remain available to Corporate HR only.
                    </p>
                  </div>
                  <Switch
                    checked={form.is_active}
                    onCheckedChange={(checked) =>
                      setForm((previous) => ({
                        ...previous,
                        is_active: checked,
                      }))
                    }
                    disabled={isSaving}
                  />
                </div>
              </div>
            </DialogBody>
            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={closeDialog}
                disabled={isSaving}
              >
                Cancel
              </Button>
              <Button type="submit" disabled={isSaving}>
                {isSaving ? "Saving..." : editing ? "Save Changes" : "Upload PDF"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </AdminLayout>
  );
}
