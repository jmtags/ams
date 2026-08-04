import { FormEvent, useEffect, useMemo, useState } from "react";
import {
  FileText,
  FolderOpen,
  RefreshCw,
  Upload,
  Eye,
  Trash2,
  Pencil,
  CheckCircle2,
} from "lucide-react";

import { AdminLayout } from "../layouts/admin-layout";
import { Button } from "../components/ui/button";
import { Input } from "../components/ui/input";
import { Badge } from "../components/ui/badge";
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
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "../components/ui/table";
import { userService, type User } from "../services/user.service";
import {
  employeeDocumentService,
  type DocumentCategory,
  type DocumentRequirement,
  type DocumentStatus,
  type EmployeeDocument,
  type DocumentReportRow,
} from "../services/employee-document.service";
import { useAuth } from "../hooks/useAuth";

type ViewMode = "employee_file" | "requirements" | "reports";

type DocumentFormState = {
  title: string;
  category_id: string;
  requirement_id: string;
  status: DocumentStatus;
  expiry_date: string;
  remarks: string;
  file: File | null;
};

const initialDocumentForm: DocumentFormState = {
  title: "",
  category_id: "",
  requirement_id: "",
  status: "submitted",
  expiry_date: "",
  remarks: "",
  file: null,
};

const todayDate = () => new Date().toISOString().slice(0, 10);

const statusVariant = (status: string) => {
  if (status === "verified") return "success";
  if (status === "expired" || status === "missing" || status === "rejected") {
    return "danger";
  }
  if (status === "submitted") return "warning";
  return "default";
};

const formatSize = (size?: number | null) => {
  if (!size) return "-";
  if (size < 1024 * 1024) return `${Math.round(size / 1024)} KB`;
  return `${(size / (1024 * 1024)).toFixed(1)} MB`;
};

export function AdminEmployee201FilesPage() {
  const { user } = useAuth();
  const [viewMode, setViewMode] = useState<ViewMode>("employee_file");
  const [users, setUsers] = useState<User[]>([]);
  const [categories, setCategories] = useState<DocumentCategory[]>([]);
  const [requirements, setRequirements] = useState<DocumentRequirement[]>([]);
  const [documents, setDocuments] = useState<EmployeeDocument[]>([]);
  const [reportRows, setReportRows] = useState<DocumentReportRow[]>([]);
  const [selectedUserId, setSelectedUserId] = useState("");
  const [search, setSearch] = useState("");
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingDocument, setEditingDocument] =
    useState<EmployeeDocument | null>(null);
  const [form, setForm] = useState<DocumentFormState>(initialDocumentForm);

  const selectedUser = users.find((item) => item.id === selectedUserId) ?? null;

  useEffect(() => {
    loadInitialData();
  }, []);

  useEffect(() => {
    if (selectedUserId) {
      loadDocuments(selectedUserId);
    } else {
      setDocuments([]);
    }
  }, [selectedUserId]);

  const loadInitialData = async () => {
    try {
      setIsLoading(true);
      const [userData, categoryData, requirementData, reports] =
        await Promise.all([
          userService.getUsers(),
          employeeDocumentService.getCategories(),
          employeeDocumentService.getRequirements(),
          employeeDocumentService.getReport().catch(() => []),
        ]);
      setUsers(userData);
      setCategories(categoryData);
      setRequirements(requirementData);
      setReportRows(reports);

      if (!selectedUserId && userData.length > 0) {
        setSelectedUserId(userData[0].id);
      }
    } catch (error: any) {
      console.error("Failed to load 201 file data:", error);
      alert(error.message || "Failed to load 201 file data.");
    } finally {
      setIsLoading(false);
    }
  };

  const loadDocuments = async (userId: string) => {
    try {
      const data = await employeeDocumentService.getDocumentsByUser(userId);
      setDocuments(data);
    } catch (error: any) {
      console.error("Failed to load employee documents:", error);
      alert(error.message || "Failed to load employee documents.");
    }
  };

  const reloadAll = async () => {
    await loadInitialData();
    if (selectedUserId) await loadDocuments(selectedUserId);
  };

  const checklist = useMemo(
    () => employeeDocumentService.getChecklist(requirements, documents),
    [requirements, documents]
  );
  const completion = employeeDocumentService.getCompletion(checklist);

  const filteredUsers = useMemo(() => {
    const term = search.trim().toLowerCase();
    if (!term) return users;
    return users.filter((item) =>
      [item.name, item.email, item.department, item.role]
        .join(" ")
        .toLowerCase()
        .includes(term)
    );
  }, [users, search]);

  const filteredReportRows = useMemo(() => {
    const term = search.trim().toLowerCase();
    if (!term) return reportRows;
    return reportRows.filter((item) =>
      [item.employee_name, item.employee_email]
        .join(" ")
        .toLowerCase()
        .includes(term)
    );
  }, [reportRows, search]);

  const openUploadDialog = (requirement?: DocumentRequirement) => {
    setEditingDocument(null);
    setForm({
      ...initialDocumentForm,
      title: requirement?.name ?? "",
      category_id: requirement?.category_id ?? "",
      requirement_id: requirement?.id ?? "",
    });
    setIsDialogOpen(true);
  };

  const openEditDialog = (document: EmployeeDocument) => {
    setEditingDocument(document);
    setForm({
      title: document.title,
      category_id: document.category_id ?? "",
      requirement_id: document.requirement_id ?? "",
      status: document.status,
      expiry_date: document.expiry_date ?? "",
      remarks: document.remarks ?? "",
      file: null,
    });
    setIsDialogOpen(true);
  };

  const closeDialog = () => {
    if (isSaving) return;
    setIsDialogOpen(false);
    setEditingDocument(null);
    setForm(initialDocumentForm);
  };

  const handleSaveDocument = async (event: FormEvent) => {
    event.preventDefault();
    if (!selectedUserId) {
      alert("Please select an employee first.");
      return;
    }
    if (!form.title.trim()) {
      alert("Document title is required.");
      return;
    }
    if (!editingDocument && !form.file) {
      alert("Please select a file to upload.");
      return;
    }

    try {
      setIsSaving(true);
      if (editingDocument) {
        await employeeDocumentService.updateDocument(editingDocument, {
          title: form.title,
          category_id: form.category_id || null,
          requirement_id: form.requirement_id || null,
          status: form.status,
          expiry_date: form.expiry_date || null,
          remarks: form.remarks || null,
          actor_id: user?.id ?? null,
        });
      } else if (form.file) {
        await employeeDocumentService.uploadDocument({
          user_id: selectedUserId,
          title: form.title,
          category_id: form.category_id || null,
          requirement_id: form.requirement_id || null,
          expiry_date: form.expiry_date || null,
          remarks: form.remarks || null,
          file: form.file,
          uploaded_by: user?.id ?? null,
        });
      }

      await reloadAll();
      closeDialog();
    } catch (error: any) {
      console.error("Failed to save document:", error);
      alert(error.message || "Failed to save document.");
    } finally {
      setIsSaving(false);
    }
  };

  const handleView = async (document: EmployeeDocument) => {
    try {
      const url = await employeeDocumentService.getSignedUrl(document);
      window.open(url, "_blank", "noopener,noreferrer");
    } catch (error: any) {
      console.error("Failed to open document:", error);
      alert(error.message || "Failed to open document.");
    }
  };

  const handleDelete = async (document: EmployeeDocument) => {
    const confirmed = window.confirm(`Delete ${document.title}?`);
    if (!confirmed) return;

    try {
      await employeeDocumentService.deleteDocument(document, user?.id ?? null);
      await reloadAll();
    } catch (error: any) {
      console.error("Failed to delete document:", error);
      alert(error.message || "Failed to delete document.");
    }
  };

  const handleCreateDefaults = async () => {
    try {
      setIsLoading(true);
      await employeeDocumentService.createDefaultSetup();
      await reloadAll();
      alert("Default 201 file categories and requirements created.");
    } catch (error: any) {
      console.error("Failed to create defaults:", error);
      alert(error.message || "Failed to create default 201 file setup.");
    } finally {
      setIsLoading(false);
    }
  };

  const missingCount = checklist.filter((item) => item.status === "missing").length;
  const expiredCount = documents.filter(
    (item) => item.expiry_date && item.expiry_date < todayDate()
  ).length;

  return (
    <AdminLayout>
      <div className="space-y-6">
        <div className="flex items-start justify-between gap-4 flex-wrap">
          <div>
            <h1 className="text-2xl font-semibold mb-1">
              Employee 201 Files
            </h1>
            <p className="text-neutral-600">
              Manage employee HR documents, required file checklists, and 201
              file completion reports.
            </p>
          </div>

          <div className="flex gap-2 flex-wrap">
            <Button variant="outline" onClick={reloadAll}>
              <RefreshCw className="w-4 h-4 mr-2" />
              Refresh
            </Button>
            <Button variant="outline" onClick={handleCreateDefaults}>
              <CheckCircle2 className="w-4 h-4 mr-2" />
              Create Defaults
            </Button>
            <Button onClick={() => openUploadDialog()} disabled={!selectedUserId}>
              <Upload className="w-4 h-4 mr-2" />
              Upload Document
            </Button>
          </div>
        </div>

        <Card>
          <CardContent className="pt-6">
            <div className="grid md:grid-cols-3 gap-4">
              <button
                type="button"
                onClick={() => setViewMode("employee_file")}
                className={`rounded-lg border px-4 py-3 text-left ${
                  viewMode === "employee_file"
                    ? "bg-neutral-900 text-white"
                    : "bg-white hover:bg-neutral-50"
                }`}
              >
                <div className="font-medium">Employee File</div>
                <div className="text-xs opacity-80">
                  Upload and review employee documents
                </div>
              </button>
              <button
                type="button"
                onClick={() => setViewMode("requirements")}
                className={`rounded-lg border px-4 py-3 text-left ${
                  viewMode === "requirements"
                    ? "bg-neutral-900 text-white"
                    : "bg-white hover:bg-neutral-50"
                }`}
              >
                <div className="font-medium">Checklist Setup</div>
                <div className="text-xs opacity-80">
                  Review required document list
                </div>
              </button>
              <button
                type="button"
                onClick={() => setViewMode("reports")}
                className={`rounded-lg border px-4 py-3 text-left ${
                  viewMode === "reports"
                    ? "bg-neutral-900 text-white"
                    : "bg-white hover:bg-neutral-50"
                }`}
              >
                <div className="font-medium">Reports</div>
                <div className="text-xs opacity-80">
                  Missing, expired, and completion summary
                </div>
              </button>
            </div>
          </CardContent>
        </Card>

        {viewMode === "employee_file" && (
          <>
            <div className="grid lg:grid-cols-[320px_1fr] gap-6">
              <Card>
                <CardHeader>
                  <CardTitle>Employees</CardTitle>
                  <CardDescription>Select an employee file.</CardDescription>
                </CardHeader>
                <CardContent className="space-y-3">
                  <Input
                    placeholder="Search employee..."
                    value={search}
                    onChange={(event) => setSearch(event.target.value)}
                  />
                  <div className="max-h-[520px] overflow-y-auto space-y-2">
                    {filteredUsers.map((item) => (
                      <button
                        key={item.id}
                        type="button"
                        onClick={() => setSelectedUserId(item.id)}
                        className={`w-full rounded-lg border px-3 py-2 text-left ${
                          selectedUserId === item.id
                            ? "border-neutral-900 bg-neutral-900 text-white"
                            : "bg-white hover:bg-neutral-50"
                        }`}
                      >
                        <div className="font-medium">{item.name || "-"}</div>
                        <div className="text-xs opacity-80">
                          {item.email || "-"}
                        </div>
                      </button>
                    ))}
                  </div>
                </CardContent>
              </Card>

              <div className="space-y-6">
                <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                  <Card>
                    <CardContent className="pt-6">
                      <p className="text-sm text-neutral-500">Completion</p>
                      <p className="text-2xl font-bold mt-2">{completion}%</p>
                    </CardContent>
                  </Card>
                  <Card>
                    <CardContent className="pt-6">
                      <p className="text-sm text-neutral-500">Documents</p>
                      <p className="text-2xl font-bold mt-2">{documents.length}</p>
                    </CardContent>
                  </Card>
                  <Card>
                    <CardContent className="pt-6">
                      <p className="text-sm text-neutral-500">Missing</p>
                      <p className="text-2xl font-bold mt-2">{missingCount}</p>
                    </CardContent>
                  </Card>
                  <Card>
                    <CardContent className="pt-6">
                      <p className="text-sm text-neutral-500">Expired</p>
                      <p className="text-2xl font-bold mt-2">{expiredCount}</p>
                    </CardContent>
                  </Card>
                </div>

                <Card>
                  <CardHeader>
                    <CardTitle>
                      {selectedUser?.name || "Employee"} 201 Checklist
                    </CardTitle>
                    <CardDescription>
                      Required documents and current file status.
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Document</TableHead>
                          <TableHead>Category</TableHead>
                          <TableHead>Status</TableHead>
                          <TableHead>Expiry</TableHead>
                          <TableHead className="text-right">Action</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {checklist.length === 0 ? (
                          <TableRow>
                            <TableCell colSpan={5} className="text-center py-8">
                              No required documents configured.
                            </TableCell>
                          </TableRow>
                        ) : (
                          checklist.map((item) => (
                            <TableRow key={item.requirement.id}>
                              <TableCell className="font-medium">
                                {item.requirement.name}
                              </TableCell>
                              <TableCell>
                                {item.requirement.category_name || "-"}
                              </TableCell>
                              <TableCell>
                                <Badge variant={statusVariant(item.status)}>
                                  {item.status}
                                </Badge>
                              </TableCell>
                              <TableCell>
                                {item.document?.expiry_date || "-"}
                              </TableCell>
                              <TableCell className="text-right">
                                {item.document ? (
                                  <Button
                                    size="sm"
                                    variant="outline"
                                    onClick={() => openEditDialog(item.document!)}
                                  >
                                    <Pencil className="w-4 h-4 mr-1" />
                                    Review
                                  </Button>
                                ) : (
                                  <Button
                                    size="sm"
                                    variant="outline"
                                    onClick={() =>
                                      openUploadDialog(item.requirement)
                                    }
                                  >
                                    <Upload className="w-4 h-4 mr-1" />
                                    Upload
                                  </Button>
                                )}
                              </TableCell>
                            </TableRow>
                          ))
                        )}
                      </TableBody>
                    </Table>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader>
                    <CardTitle>Uploaded Documents</CardTitle>
                    <CardDescription>
                      Files stored in the selected employee 201 file.
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Title</TableHead>
                          <TableHead>File</TableHead>
                          <TableHead>Status</TableHead>
                          <TableHead>Expiry</TableHead>
                          <TableHead className="text-right">Actions</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {documents.length === 0 ? (
                          <TableRow>
                            <TableCell colSpan={5} className="text-center py-8">
                              No uploaded documents found.
                            </TableCell>
                          </TableRow>
                        ) : (
                          documents.map((document) => (
                            <TableRow key={document.id}>
                              <TableCell>
                                <div className="font-medium">
                                  {document.title}
                                </div>
                                <div className="text-xs text-neutral-500">
                                  {document.category_name || "-"}
                                </div>
                              </TableCell>
                              <TableCell>
                                <div>{document.file_name}</div>
                                <div className="text-xs text-neutral-500">
                                  {formatSize(document.file_size)}
                                </div>
                              </TableCell>
                              <TableCell>
                                <Badge variant={statusVariant(document.status)}>
                                  {document.status}
                                </Badge>
                              </TableCell>
                              <TableCell>{document.expiry_date || "-"}</TableCell>
                              <TableCell className="text-right">
                                <div className="flex justify-end gap-2">
                                  <Button
                                    size="sm"
                                    variant="outline"
                                    onClick={() => handleView(document)}
                                  >
                                    <Eye className="w-4 h-4" />
                                  </Button>
                                  <Button
                                    size="sm"
                                    variant="outline"
                                    onClick={() => openEditDialog(document)}
                                  >
                                    <Pencil className="w-4 h-4" />
                                  </Button>
                                  <Button
                                    size="sm"
                                    variant="outline"
                                    onClick={() => handleDelete(document)}
                                  >
                                    <Trash2 className="w-4 h-4" />
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
              </div>
            </div>
          </>
        )}

        {viewMode === "requirements" && (
          <div className="grid lg:grid-cols-2 gap-6">
            <Card>
              <CardHeader>
                <CardTitle>Categories</CardTitle>
                <CardDescription>
                  Default 201 file folders for HR documents.
                </CardDescription>
              </CardHeader>
              <CardContent>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Name</TableHead>
                      <TableHead>Description</TableHead>
                      <TableHead>Status</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {categories.map((category) => (
                      <TableRow key={category.id}>
                        <TableCell className="font-medium">
                          {category.name}
                        </TableCell>
                        <TableCell>{category.description || "-"}</TableCell>
                        <TableCell>
                          <Badge
                            variant={category.is_active ? "success" : "default"}
                          >
                            {category.is_active ? "active" : "inactive"}
                          </Badge>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Required Documents</CardTitle>
                <CardDescription>
                  Checklist items used to calculate completion.
                </CardDescription>
              </CardHeader>
              <CardContent>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Document</TableHead>
                      <TableHead>Category</TableHead>
                      <TableHead>Expiry</TableHead>
                      <TableHead>Status</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {requirements.map((requirement) => (
                      <TableRow key={requirement.id}>
                        <TableCell className="font-medium">
                          {requirement.name}
                        </TableCell>
                        <TableCell>{requirement.category_name || "-"}</TableCell>
                        <TableCell>
                          {requirement.requires_expiry ? "Required" : "No"}
                        </TableCell>
                        <TableCell>
                          <Badge
                            variant={requirement.is_required ? "warning" : "default"}
                          >
                            {requirement.is_required ? "required" : "optional"}
                          </Badge>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          </div>
        )}

        {viewMode === "reports" && (
          <Card>
            <CardHeader>
              <CardTitle>201 File Completion Report</CardTitle>
              <CardDescription>
                Employees with missing, expired, or incomplete documents.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Input
                className="mb-4 max-w-md"
                placeholder="Search employee..."
                value={search}
                onChange={(event) => setSearch(event.target.value)}
              />
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Employee</TableHead>
                    <TableHead>Completion</TableHead>
                    <TableHead>Required</TableHead>
                    <TableHead>Submitted</TableHead>
                    <TableHead>Verified</TableHead>
                    <TableHead>Missing</TableHead>
                    <TableHead>Expired</TableHead>
                    <TableHead>Expiring Soon</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredReportRows.map((row) => (
                    <TableRow key={row.user_id}>
                      <TableCell>
                        <div className="font-medium">
                          {row.employee_name || "-"}
                        </div>
                        <div className="text-xs text-neutral-500">
                          {row.employee_email || "-"}
                        </div>
                      </TableCell>
                      <TableCell>{row.completion_percent}%</TableCell>
                      <TableCell>{row.required_count}</TableCell>
                      <TableCell>{row.submitted_count}</TableCell>
                      <TableCell>{row.verified_count}</TableCell>
                      <TableCell>{row.missing_count}</TableCell>
                      <TableCell>{row.expired_count}</TableCell>
                      <TableCell>{row.expiring_soon_count}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        )}

        <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
          <DialogContent className="max-w-3xl">
            <DialogHeader>
              <DialogTitle>
                {editingDocument ? "Review 201 Document" : "Upload 201 Document"}
              </DialogTitle>
              <DialogDescription>
                Store HR documents in the selected employee digital 201 file.
              </DialogDescription>
            </DialogHeader>

            <form onSubmit={handleSaveDocument}>
              <DialogBody>
                <div className="space-y-4">
                  <div className="grid md:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium mb-1">
                        Title
                      </label>
                      <Input
                        value={form.title}
                        onChange={(event) =>
                          setForm((prev) => ({
                            ...prev,
                            title: event.target.value,
                          }))
                        }
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium mb-1">
                        Status
                      </label>
                      <select
                        className="w-full border rounded px-3 py-2 bg-white"
                        value={form.status}
                        onChange={(event) =>
                          setForm((prev) => ({
                            ...prev,
                            status: event.target.value as DocumentStatus,
                          }))
                        }
                      >
                        <option value="submitted">Submitted</option>
                        <option value="verified">Verified</option>
                        <option value="rejected">Rejected</option>
                        <option value="expired">Expired</option>
                      </select>
                    </div>
                  </div>

                  <div className="grid md:grid-cols-3 gap-4">
                    <div>
                      <label className="block text-sm font-medium mb-1">
                        Category
                      </label>
                      <select
                        className="w-full border rounded px-3 py-2 bg-white"
                        value={form.category_id}
                        onChange={(event) =>
                          setForm((prev) => ({
                            ...prev,
                            category_id: event.target.value,
                          }))
                        }
                      >
                        <option value="">No category</option>
                        {categories.map((category) => (
                          <option key={category.id} value={category.id}>
                            {category.name}
                          </option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <label className="block text-sm font-medium mb-1">
                        Requirement
                      </label>
                      <select
                        className="w-full border rounded px-3 py-2 bg-white"
                        value={form.requirement_id}
                        onChange={(event) => {
                          const req = requirements.find(
                            (item) => item.id === event.target.value
                          );
                          setForm((prev) => ({
                            ...prev,
                            requirement_id: event.target.value,
                            category_id: req?.category_id ?? prev.category_id,
                            title: prev.title || req?.name || "",
                          }));
                        }}
                      >
                        <option value="">No requirement</option>
                        {requirements.map((requirement) => (
                          <option key={requirement.id} value={requirement.id}>
                            {requirement.name}
                          </option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <label className="block text-sm font-medium mb-1">
                        Expiry Date
                      </label>
                      <Input
                        type="date"
                        value={form.expiry_date}
                        onChange={(event) =>
                          setForm((prev) => ({
                            ...prev,
                            expiry_date: event.target.value,
                          }))
                        }
                      />
                    </div>
                  </div>

                  {!editingDocument && (
                    <div>
                      <label className="block text-sm font-medium mb-1">
                        File
                      </label>
                      <Input
                        type="file"
                        onChange={(event) =>
                          setForm((prev) => ({
                            ...prev,
                            file: event.target.files?.[0] ?? null,
                          }))
                        }
                      />
                      <p className="text-xs text-neutral-500 mt-1">
                        Maximum file size: 20 MB.
                      </p>
                    </div>
                  )}

                  <div>
                    <label className="block text-sm font-medium mb-1">
                      Remarks
                    </label>
                    <textarea
                      className="w-full min-h-24 rounded border px-3 py-2"
                      value={form.remarks}
                      onChange={(event) =>
                        setForm((prev) => ({
                          ...prev,
                          remarks: event.target.value,
                        }))
                      }
                    />
                  </div>
                </div>
              </DialogBody>

              <DialogFooter>
                <Button type="button" variant="outline" onClick={closeDialog}>
                  Cancel
                </Button>
                <Button type="submit" disabled={isSaving}>
                  {isSaving ? "Saving..." : editingDocument ? "Save Review" : "Upload"}
                </Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>
      </div>
    </AdminLayout>
  );
}
