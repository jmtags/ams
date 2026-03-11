import { useEffect, useMemo, useState, FormEvent } from "react";
import { Plus, Search, Pencil, Trash2 } from "lucide-react";
import { AdminLayout } from "../layouts/admin-layout";
import { Button } from "../components/ui/button";
import { Input } from "../components/ui/input";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "../components/ui/card";
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
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "../components/ui/dialog";
import { Label } from "../components/ui/label";
import {
  holidayService,
  Holiday,
  HolidayPayload,
  Location,
} from "../services/holiday-service";

type HolidayForm = {
  name: string;
  holiday_date: string;
  type: string;
  description: string;
  is_paid: boolean;
  location_id: string;
};

const initialForm: HolidayForm = {
  name: "",
  holiday_date: "",
  type: "regular",
  description: "",
  is_paid: true,
  location_id: "",
};

export default function ManageHolidaysPage() {
  const [holidays, setHolidays] = useState<Holiday[]>([]);
  const [locations, setLocations] = useState<Location[]>([]);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);

  const [openForm, setOpenForm] = useState(false);
  const [editingHoliday, setEditingHoliday] = useState<Holiday | null>(null);
  const [form, setForm] = useState<HolidayForm>(initialForm);

  const [deleteTarget, setDeleteTarget] = useState<Holiday | null>(null);

  useEffect(() => {
    loadData();
  }, []);

  async function loadData() {
    setLoading(true);
    try {
      const [holidayList, locationList] = await Promise.all([
        holidayService.getAll(),
        holidayService.getLocations(),
      ]);

      setHolidays(holidayList);
      setLocations(locationList);
    } catch (error) {
      console.error("Error loading holiday data:", error);
      alert("Failed to load holiday data.");
    } finally {
      setLoading(false);
    }
  }

  function openAddModal() {
    setEditingHoliday(null);
    setForm(initialForm);
    setOpenForm(true);
  }

  function openEditModal(holiday: Holiday) {
    setEditingHoliday(holiday);
    setForm({
      name: holiday.name || "",
      holiday_date: holiday.holiday_date || "",
      type: holiday.type || "regular",
      description: holiday.description || "",
      is_paid: holiday.is_paid ?? true,
      location_id: holiday.location_id || "",
    });
    setOpenForm(true);
  }

  function closeFormModal() {
    setOpenForm(false);
    setEditingHoliday(null);
    setForm(initialForm);
  }

  function handleInputChange(
    e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>
  ) {
    const { name, value, type } = e.target;

    if (type === "checkbox") {
      const checked = (e.target as HTMLInputElement).checked;
      setForm((prev) => ({ ...prev, [name]: checked }));
      return;
    }

    setForm((prev) => ({ ...prev, [name]: value }));
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();

    if (!form.name.trim()) {
      alert("Holiday name is required.");
      return;
    }

    if (!form.holiday_date) {
      alert("Holiday date is required.");
      return;
    }

    setSaving(true);

    const payload: HolidayPayload = {
      name: form.name.trim(),
      holiday_date: form.holiday_date,
      type: form.type.trim(),
      description: form.description.trim() || null,
      is_paid: form.is_paid,
      location_id: form.location_id || null,
    };

    try {
      if (editingHoliday) {
        await holidayService.update(editingHoliday.id, payload);
        alert("Holiday updated successfully.");
      } else {
        await holidayService.create(payload);
        alert("Holiday added successfully.");
      }

      closeFormModal();
      await loadData();
    } catch (error) {
      console.error("Error saving holiday:", error);
      alert("Failed to save holiday.");
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete() {
    if (!deleteTarget) return;

    try {
      await holidayService.remove(deleteTarget.id);
      alert("Holiday deleted successfully.");
      setDeleteTarget(null);
      await loadData();
    } catch (error) {
      console.error("Error deleting holiday:", error);
      alert("Failed to delete holiday.");
    }
  }

  const filteredHolidays = useMemo(() => {
    const keyword = search.toLowerCase().trim();

    if (!keyword) return holidays;

    return holidays.filter((holiday) => {
      const locationName =
        locations.find((loc) => loc.id === holiday.location_id)?.name || "";

      return (
        holiday.name.toLowerCase().includes(keyword) ||
        holiday.holiday_date.toLowerCase().includes(keyword) ||
        holiday.type.toLowerCase().includes(keyword) ||
        (holiday.description || "").toLowerCase().includes(keyword) ||
        locationName.toLowerCase().includes(keyword)
      );
    });
  }, [holidays, search, locations]);

  function getLocationName(locationId: string | null) {
    if (!locationId) return "All Locations";
    return locations.find((loc) => loc.id === locationId)?.name || "Unknown";
  }

  return (
    <AdminLayout>
      <div className="space-y-6 p-6">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <div>
              <CardTitle>Holiday Management</CardTitle>
              <p className="mt-1 text-sm text-muted-foreground">
                Manage holidays used in your attendance and HRIS system.
              </p>
            </div>

            <Button onClick={openAddModal} className="flex items-center gap-2">
              <Plus size={16} />
              Add Holiday
            </Button>
          </CardHeader>

          <CardContent>
            <div className="mb-4 flex items-center gap-2">
              <div className="relative w-full max-w-md">
                <Search
                  size={16}
                  className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground"
                />
                <Input
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Search by name, date, type, location..."
                  className="pl-9"
                />
              </div>
            </div>

            <div className="rounded-md border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Name</TableHead>
                    <TableHead>Date</TableHead>
                    <TableHead>Type</TableHead>
                    <TableHead>Paid</TableHead>
                    <TableHead>Location</TableHead>
                    <TableHead>Description</TableHead>
                    <TableHead className="w-[140px] text-right">
                      Actions
                    </TableHead>
                  </TableRow>
                </TableHeader>

                <TableBody>
                  {loading ? (
                    <TableRow>
                      <TableCell colSpan={7} className="py-6 text-center">
                        Loading holidays...
                      </TableCell>
                    </TableRow>
                  ) : filteredHolidays.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={7} className="py-6 text-center">
                        No holidays found.
                      </TableCell>
                    </TableRow>
                  ) : (
                    filteredHolidays.map((holiday) => (
                      <TableRow key={holiday.id}>
                        <TableCell className="font-medium">
                          {holiday.name}
                        </TableCell>
                        <TableCell>{holiday.holiday_date}</TableCell>
                        <TableCell className="capitalize">
                          {holiday.type}
                        </TableCell>
                        <TableCell>{holiday.is_paid ? "Yes" : "No"}</TableCell>
                        <TableCell>
                          {getLocationName(holiday.location_id)}
                        </TableCell>
                        <TableCell>{holiday.description || "-"}</TableCell>
                        <TableCell>
                          <div className="flex justify-end gap-2">
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => openEditModal(holiday)}
                            >
                              <Pencil size={14} />
                            </Button>
                            <Button
                              variant="destructive"
                              size="sm"
                              onClick={() => setDeleteTarget(holiday)}
                            >
                              <Trash2 size={14} />
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>
      </div>

      <Dialog open={openForm} onOpenChange={setOpenForm}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>
              {editingHoliday ? "Edit Holiday" : "Add Holiday"}
            </DialogTitle>
            <DialogDescription>
              Fill out the holiday details below.
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <Label htmlFor="name">Holiday Name</Label>
              <Input
                id="name"
                name="name"
                value={form.name}
                onChange={handleInputChange}
                placeholder="e.g. New Year's Day"
              />
            </div>

            <div>
              <Label htmlFor="holiday_date">Holiday Date</Label>
              <Input
                id="holiday_date"
                name="holiday_date"
                type="date"
                value={form.holiday_date}
                onChange={handleInputChange}
              />
            </div>

            <div>
              <Label htmlFor="type">Type</Label>
              <select
                id="type"
                name="type"
                value={form.type}
                onChange={handleInputChange}
                className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
              >
                <option value="regular">Regular</option>
                <option value="special">Special</option>
                <option value="company">Company Holiday</option>
                <option value="local">Local Holiday</option>
              </select>
            </div>

            <div>
              <Label htmlFor="location_id">Location</Label>
              <select
                id="location_id"
                name="location_id"
                value={form.location_id}
                onChange={handleInputChange}
                className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
              >
                <option value="">All Locations</option>
                {locations.map((location) => (
                  <option key={location.id} value={location.id}>
                    {location.name}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <Label htmlFor="description">Description</Label>
              <textarea
                id="description"
                name="description"
                value={form.description}
                onChange={handleInputChange}
                placeholder="Optional notes..."
                className="min-h-[90px] w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
              />
            </div>

            <div className="flex items-center gap-2">
              <input
                id="is_paid"
                name="is_paid"
                type="checkbox"
                checked={form.is_paid}
                onChange={handleInputChange}
              />
              <Label htmlFor="is_paid">Paid Holiday</Label>
            </div>

            <DialogFooter>
              <Button type="button" variant="outline" onClick={closeFormModal}>
                Cancel
              </Button>
              <Button type="submit" disabled={saving}>
                {saving
                  ? "Saving..."
                  : editingHoliday
                    ? "Update Holiday"
                    : "Add Holiday"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <Dialog
        open={!!deleteTarget}
        onOpenChange={(open) => !open && setDeleteTarget(null)}
      >
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Delete Holiday</DialogTitle>
            <DialogDescription>
              Are you sure you want to delete{" "}
              <span className="font-semibold">{deleteTarget?.name}</span>?
            </DialogDescription>
          </DialogHeader>

          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteTarget(null)}>
              Cancel
            </Button>
            <Button variant="destructive" onClick={handleDelete}>
              Delete
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </AdminLayout>
  );
}