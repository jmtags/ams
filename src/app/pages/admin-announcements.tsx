import { FormEvent, useEffect, useState } from "react";
import { Megaphone, Pencil, Plus, Trash2 } from "lucide-react";

import { AdminLayout } from "../layouts/admin-layout";
import { Button } from "../components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "../components/ui/card";
import { Input } from "../components/ui/input";
import { Select } from "../components/ui/select";
import { Badge } from "../components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "../components/ui/table";
import {
  Dialog,
  DialogBody,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "../components/ui/dialog";
import { Switch } from "../components/ui/switch";
import { useAuth } from "../hooks/useAuth";
import {
  announcementService,
  type Announcement,
  type AnnouncementSeverity,
} from "../services/announcement.service";
import { appSettingsService } from "../services/app-settings.service";

type FormState = {
  title: string;
  message: string;
  image_url: string;
  severity: AnnouncementSeverity;
  is_active: boolean;
  starts_at: string;
  ends_at: string;
};

const initialForm: FormState = {
  title: "",
  message: "",
  image_url: "",
  severity: "info",
  is_active: true,
  starts_at: "",
  ends_at: "",
};

function toDateTimeInput(value?: string | null) {
  if (!value) return "";
  const date = new Date(value);
  const offsetMs = date.getTimezoneOffset() * 60000;
  return new Date(date.getTime() - offsetMs).toISOString().slice(0, 16);
}

function fromDateTimeInput(value: string) {
  return value ? new Date(value).toISOString() : null;
}

function severityVariant(severity: string) {
  if (severity === "urgent") return "danger";
  if (severity === "warning") return "warning";
  return "default";
}

function formatDateTime(value?: string | null) {
  if (!value) return "-";
  return new Date(value).toLocaleString("en-PH", {
    year: "numeric",
    month: "short",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function AdminAnnouncementsPage() {
  const { user } = useAuth();
  const [isMainInstance, setIsMainInstance] = useState(false);
  const [announcements, setAnnouncements] = useState<Announcement[]>([]);
  const [editing, setEditing] = useState<Announcement | null>(null);
  const [form, setForm] = useState<FormState>(initialForm);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState("");

  const loadData = async () => {
    try {
      setIsLoading(true);
      setError("");
      const config = await appSettingsService.getInstanceConfig();
      setIsMainInstance(config.mode === "main");

      if (config.mode === "main") {
        setAnnouncements(await announcementService.getAll());
      } else {
        setAnnouncements([]);
      }
    } catch (err: any) {
      setError(err.message || "Failed to load announcements.");
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const openDialog = (announcement?: Announcement) => {
    setEditing(announcement ?? null);
    setForm(
      announcement
        ? {
            title: announcement.title,
            message: announcement.message,
            image_url: announcement.image_url ?? "",
            severity: announcement.severity,
            is_active: announcement.is_active,
            starts_at: toDateTimeInput(announcement.starts_at),
            ends_at: toDateTimeInput(announcement.ends_at),
          }
        : initialForm
    );
    setError("");
    setIsDialogOpen(true);
  };

  const closeDialog = () => {
    if (isSaving) return;
    setIsDialogOpen(false);
    setEditing(null);
    setForm(initialForm);
  };

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault();

    try {
      setIsSaving(true);
      setError("");

      if (!form.title.trim() || !form.message.trim()) {
        throw new Error("Title and message are required.");
      }

      const payload = {
        title: form.title,
        message: form.message,
        image_url: form.image_url,
        severity: form.severity,
        is_active: form.is_active,
        starts_at: fromDateTimeInput(form.starts_at),
        ends_at: fromDateTimeInput(form.ends_at),
        created_by: user?.id ?? null,
      };

      if (editing) {
        await announcementService.update(editing.id, payload);
      } else {
        await announcementService.create(payload);
      }

      await loadData();
      closeDialog();
    } catch (err: any) {
      setError(err.message || "Failed to save announcement.");
    } finally {
      setIsSaving(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!window.confirm("Delete this announcement?")) return;

    try {
      setError("");
      await announcementService.delete(id);
      await loadData();
    } catch (err: any) {
      setError(err.message || "Failed to delete announcement.");
    }
  };

  return (
    <AdminLayout>
      <div className="space-y-6">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <h1 className="text-neutral-900 mb-1">Announcements</h1>
            <p className="text-neutral-600">
              Manage announcements shown to employees across all instances.
            </p>
          </div>

          {isMainInstance && (
            <Button onClick={() => openDialog()} className="flex items-center gap-2">
              <Plus className="w-4 h-4" />
              Add Announcement
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
              <CardTitle>Sub Instance</CardTitle>
              <CardDescription>
                Announcement management is only available when this instance is set as Main in Settings.
              </CardDescription>
            </CardHeader>
          </Card>
        ) : (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Megaphone className="w-5 h-5" />
                Announcement Board
              </CardTitle>
              <CardDescription>
                Active announcements are returned by the main instance API.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Title</TableHead>
                    <TableHead>Severity</TableHead>
                    <TableHead>Active</TableHead>
                    <TableHead>Starts</TableHead>
                    <TableHead>Ends</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {isLoading ? (
                    <TableRow>
                      <TableCell colSpan={6} className="text-center text-neutral-500 py-8">
                        Loading announcements...
                      </TableCell>
                    </TableRow>
                  ) : announcements.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={6} className="text-center text-neutral-500 py-8">
                        No announcements found
                      </TableCell>
                    </TableRow>
                  ) : (
                    announcements.map((announcement) => (
                      <TableRow key={announcement.id}>
                        <TableCell>
                          <div className="font-medium">{announcement.title}</div>
                          {announcement.image_url && (
                            <div className="text-xs text-neutral-500">
                              Has image
                            </div>
                          )}
                          <div className="max-w-[420px] truncate text-xs text-neutral-500">
                            {announcement.message}
                          </div>
                        </TableCell>
                        <TableCell>
                          <Badge variant={severityVariant(announcement.severity)}>
                            {announcement.severity}
                          </Badge>
                        </TableCell>
                        <TableCell>{announcement.is_active ? "Yes" : "No"}</TableCell>
                        <TableCell>{formatDateTime(announcement.starts_at)}</TableCell>
                        <TableCell>{formatDateTime(announcement.ends_at)}</TableCell>
                        <TableCell>
                          <div className="flex justify-end gap-2">
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => openDialog(announcement)}
                            >
                              <Pencil className="w-4 h-4" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => handleDelete(announcement.id)}
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

      <Dialog open={isDialogOpen} onOpenChange={(open) => !open && closeDialog()}>
        <DialogContent
          onClose={closeDialog}
          className="max-w-2xl max-h-[90vh] flex flex-col overflow-hidden"
        >
          <DialogHeader>
            <DialogTitle>{editing ? "Edit Announcement" : "Add Announcement"}</DialogTitle>
            <DialogDescription>
              Announcements are shown to employees when they open the dashboard.
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={handleSubmit} className="flex flex-col min-h-0">
            <DialogBody className="overflow-y-auto">
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
                    setForm((prev) => ({ ...prev, title: event.target.value }))
                  }
                  disabled={isSaving}
                  required
                />

                <div>
                  <label className="block text-sm mb-1.5 text-neutral-700">
                    Message
                  </label>
                  <textarea
                    value={form.message}
                    onChange={(event) =>
                      setForm((prev) => ({ ...prev, message: event.target.value }))
                    }
                    rows={5}
                    className="w-full px-3 py-2 border border-neutral-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-neutral-900 focus:border-transparent transition-colors"
                    disabled={isSaving}
                    required
                  />
                </div>

                <Input
                  label="Image URL"
                  value={form.image_url}
                  onChange={(event) =>
                    setForm((prev) => ({ ...prev, image_url: event.target.value }))
                  }
                  placeholder="https://example.com/announcement-image.jpg"
                  disabled={isSaving}
                />

                {form.image_url.trim() && (
                  <div className="overflow-hidden rounded-lg border border-neutral-200 bg-neutral-50">
                    <img
                      src={form.image_url.trim()}
                      alt="Announcement preview"
                      className="max-h-64 w-full object-contain"
                    />
                  </div>
                )}

                <Select
                  label="Severity"
                  value={form.severity}
                  onChange={(event) =>
                    setForm((prev) => ({
                      ...prev,
                      severity: event.target.value as AnnouncementSeverity,
                    }))
                  }
                  disabled={isSaving}
                >
                  <option value="info">Info</option>
                  <option value="warning">Warning</option>
                  <option value="urgent">Urgent</option>
                </Select>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <Input
                    label="Starts At"
                    type="datetime-local"
                    value={form.starts_at}
                    onChange={(event) =>
                      setForm((prev) => ({
                        ...prev,
                        starts_at: event.target.value,
                      }))
                    }
                    disabled={isSaving}
                  />
                  <Input
                    label="Ends At"
                    type="datetime-local"
                    value={form.ends_at}
                    onChange={(event) =>
                      setForm((prev) => ({
                        ...prev,
                        ends_at: event.target.value,
                      }))
                    }
                    disabled={isSaving}
                  />
                </div>

                <div className="flex items-center justify-between rounded-lg border border-neutral-200 p-4">
                  <div>
                    <p className="text-sm font-medium text-neutral-900">Active</p>
                    <p className="text-sm text-neutral-600">
                      Inactive announcements are hidden from employees.
                    </p>
                  </div>
                  <Switch
                    checked={form.is_active}
                    onCheckedChange={(checked) =>
                      setForm((prev) => ({ ...prev, is_active: checked }))
                    }
                    disabled={isSaving}
                  />
                </div>
              </div>
            </DialogBody>

            <DialogFooter>
              <Button type="button" variant="outline" onClick={closeDialog} disabled={isSaving}>
                Cancel
              </Button>
              <Button type="submit" disabled={isSaving}>
                {isSaving ? "Saving..." : "Save Announcement"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </AdminLayout>
  );
}
