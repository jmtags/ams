import React, { useEffect, useMemo, useState } from "react";
import {
  shiftService,
  Shift,
  Location,
  ShiftFormData,
} from "../services/shift.service";

const initialForm: ShiftFormData = {
  name: "",
  location_id: "",
  start_time: "08:00",
  end_time: "17:00",
  grace_minutes: 15,
  overtime_after_minutes: 0,
  is_active: true,
};

export default function ShiftManagementPage() {
  const [shifts, setShifts] = useState<Shift[]>([]);
  const [locations, setLocations] = useState<Location[]>([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);

  const [search, setSearch] = useState("");
  const [selectedLocation, setSelectedLocation] = useState("");

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingShift, setEditingShift] = useState<Shift | null>(null);
  const [form, setForm] = useState<ShiftFormData>(initialForm);

  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    loadInitialData();
  }, []);

  async function loadInitialData() {
    try {
      setLoading(true);
      setError(null);

      const [locationsData, shiftsData] = await Promise.all([
        shiftService.getLocations(),
        shiftService.getShifts(),
      ]);

      setLocations(locationsData);
      setShifts(shiftsData);
    } catch (err: any) {
      console.error(err);
      setError(err.message || "Failed to load data.");
    } finally {
      setLoading(false);
    }
  }

  async function refreshShifts() {
    try {
      setLoading(true);
      const shiftsData = await shiftService.getShifts();
      setShifts(shiftsData);
    } catch (err: any) {
      console.error(err);
      setError(err.message || "Failed to load shifts.");
    } finally {
      setLoading(false);
    }
  }

  const filteredShifts = useMemo(() => {
    return shifts.filter((shift) => {
      const matchesSearch =
        shift.name.toLowerCase().includes(search.toLowerCase()) ||
        (shift.locations?.name || "")
          .toLowerCase()
          .includes(search.toLowerCase());

      const matchesLocation =
        !selectedLocation || shift.location_id === selectedLocation;

      return matchesSearch && matchesLocation;
    });
  }, [shifts, search, selectedLocation]);

  function openAddModal() {
    setEditingShift(null);
    setForm(initialForm);
    setIsModalOpen(true);
  }

  function openEditModal(shift: Shift) {
    setEditingShift(shift);
    setForm({
      name: shift.name,
      location_id: shift.location_id || "",
      start_time: shift.start_time?.slice(0, 5) || "08:00",
      end_time: shift.end_time?.slice(0, 5) || "17:00",
      grace_minutes: shift.grace_minutes ?? 0,
      overtime_after_minutes: shift.overtime_after_minutes ?? 0,
      is_active: shift.is_active,
    });
    setIsModalOpen(true);
  }

  function closeModal() {
    if (saving) return;
    setEditingShift(null);
    setForm(initialForm);
    setIsModalOpen(false);
  }

  function handleInputChange<K extends keyof ShiftFormData>(
    field: K,
    value: ShiftFormData[K]
  ) {
    setForm((prev) => ({
      ...prev,
      [field]: value,
    }));
  }

  function validateForm() {
    if (!form.name.trim()) return "Shift name is required.";
    if (!form.location_id) return "Location is required.";
    if (!form.start_time) return "Start time is required.";
    if (!form.end_time) return "End time is required.";
    if (form.grace_minutes < 0) return "Grace minutes cannot be negative.";
    if (form.overtime_after_minutes < 0) {
      return "Overtime after minutes cannot be negative.";
    }
    return null;
  }

  async function handleSaveShift(e: React.FormEvent) {
    e.preventDefault();

    const validationError = validateForm();
    if (validationError) {
      alert(validationError);
      return;
    }

    try {
      setSaving(true);

      if (editingShift) {
        await shiftService.updateShift(editingShift.id, form);
        alert("Shift updated successfully.");
      } else {
        await shiftService.addShift(form);
        alert("Shift added successfully.");
      }

      closeModal();
      await refreshShifts();
    } catch (err: any) {
      console.error(err);
      alert(err.message || "Failed to save shift.");
    } finally {
      setSaving(false);
    }
  }

  async function handleDeleteShift(id: string) {
    const confirmed = window.confirm(
      "Are you sure you want to delete this shift?"
    );
    if (!confirmed) return;

    try {
      await shiftService.deleteShift(id);
      alert("Shift deleted successfully.");
      await refreshShifts();
    } catch (err: any) {
      console.error(err);
      alert(
        err.message ||
          "Failed to delete shift. It may already be assigned to users."
      );
    }
  }

  async function handleToggleActive(shift: Shift) {
    try {
      await shiftService.toggleShiftStatus(shift.id, shift.is_active);
      await refreshShifts();
    } catch (err: any) {
      console.error(err);
      alert(err.message || "Failed to update shift status.");
    }
  }

  return (
    <div className="p-6 max-w-7xl mx-auto">
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 mb-6">
        <div>
          <h1 className="text-2xl font-bold">Shift Management</h1>
          <p className="text-sm text-gray-600">
            Add, edit, delete, and manage work shifts.
          </p>
        </div>

        <button
          onClick={openAddModal}
          className="px-4 py-2 rounded-lg bg-blue-600 text-white hover:bg-blue-700"
        >
          + Add Shift
        </button>
      </div>

      <div className="bg-white rounded-xl shadow p-4 mb-6 border">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <input
            type="text"
            placeholder="Search by shift or location..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full border rounded-lg px-3 py-2"
          />

          <select
            value={selectedLocation}
            onChange={(e) => setSelectedLocation(e.target.value)}
            className="w-full border rounded-lg px-3 py-2"
          >
            <option value="">All Locations</option>
            {locations.map((location) => (
              <option key={location.id} value={location.id}>
                {location.name}
              </option>
            ))}
          </select>

          <button
            onClick={refreshShifts}
            className="w-full border rounded-lg px-3 py-2 hover:bg-gray-50"
          >
            Refresh
          </button>
        </div>
      </div>

      <div className="bg-white rounded-xl shadow border overflow-hidden">
        {loading ? (
          <div className="p-6 text-center text-gray-500">Loading shifts...</div>
        ) : error ? (
          <div className="p-6 text-center text-red-600">{error}</div>
        ) : filteredShifts.length === 0 ? (
          <div className="p-6 text-center text-gray-500">
            No shifts found.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-gray-100 text-left">
                <tr>
                  <th className="px-4 py-3">Shift Name</th>
                  <th className="px-4 py-3">Location</th>
                  <th className="px-4 py-3">Start</th>
                  <th className="px-4 py-3">End</th>
                  <th className="px-4 py-3">Grace</th>
                  <th className="px-4 py-3">OT After</th>
                  <th className="px-4 py-3">Status</th>
                  <th className="px-4 py-3 text-center">Actions</th>
                </tr>
              </thead>
              <tbody>
                {filteredShifts.map((shift) => (
                  <tr key={shift.id} className="border-t">
                    <td className="px-4 py-3 font-medium">{shift.name}</td>
                    <td className="px-4 py-3">
                      {shift.locations?.name || "-"}
                    </td>
                    <td className="px-4 py-3">
                      {shift.start_time?.slice(0, 5)}
                    </td>
                    <td className="px-4 py-3">
                      {shift.end_time?.slice(0, 5)}
                    </td>
                    <td className="px-4 py-3">{shift.grace_minutes} min</td>
                    <td className="px-4 py-3">
                      {shift.overtime_after_minutes} min
                    </td>
                    <td className="px-4 py-3">
                      <button
                        onClick={() => handleToggleActive(shift)}
                        className={`px-3 py-1 rounded-full text-xs font-medium ${
                          shift.is_active
                            ? "bg-green-100 text-green-700"
                            : "bg-gray-200 text-gray-700"
                        }`}
                      >
                        {shift.is_active ? "Active" : "Inactive"}
                      </button>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center justify-center gap-2">
                        <button
                          onClick={() => openEditModal(shift)}
                          className="px-3 py-1 rounded-md border hover:bg-gray-50"
                        >
                          Edit
                        </button>
                        <button
                          onClick={() => handleDeleteShift(shift.id)}
                          className="px-3 py-1 rounded-md border border-red-300 text-red-600 hover:bg-red-50"
                        >
                          Delete
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {isModalOpen && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
          <div className="bg-white w-full max-w-lg rounded-2xl shadow-xl">
            <div className="flex items-center justify-between p-5 border-b">
              <h2 className="text-lg font-semibold">
                {editingShift ? "Edit Shift" : "Add Shift"}
              </h2>
              <button
                onClick={closeModal}
                className="text-gray-500 hover:text-black"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleSaveShift} className="p-5 space-y-4">
              <div>
                <label className="block text-sm font-medium mb-1">
                  Shift Name
                </label>
                <input
                  type="text"
                  value={form.name}
                  onChange={(e) => handleInputChange("name", e.target.value)}
                  placeholder="e.g. Morning Shift"
                  className="w-full border rounded-lg px-3 py-2"
                />
              </div>

              <div>
                <label className="block text-sm font-medium mb-1">
                  Location
                </label>
                <select
                  value={form.location_id}
                  onChange={(e) =>
                    handleInputChange("location_id", e.target.value)
                  }
                  className="w-full border rounded-lg px-3 py-2"
                >
                  <option value="">Select location</option>
                  {locations.map((location) => (
                    <option key={location.id} value={location.id}>
                      {location.name}
                    </option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium mb-1">
                    Start Time
                  </label>
                  <input
                    type="time"
                    value={form.start_time}
                    onChange={(e) =>
                      handleInputChange("start_time", e.target.value)
                    }
                    className="w-full border rounded-lg px-3 py-2"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium mb-1">
                    End Time
                  </label>
                  <input
                    type="time"
                    value={form.end_time}
                    onChange={(e) =>
                      handleInputChange("end_time", e.target.value)
                    }
                    className="w-full border rounded-lg px-3 py-2"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium mb-1">
                    Grace Minutes
                  </label>
                  <input
                    type="number"
                    min="0"
                    value={form.grace_minutes}
                    onChange={(e) =>
                      handleInputChange(
                        "grace_minutes",
                        Number(e.target.value || 0)
                      )
                    }
                    className="w-full border rounded-lg px-3 py-2"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium mb-1">
                    Overtime After (Minutes)
                  </label>
                  <input
                    type="number"
                    min="0"
                    value={form.overtime_after_minutes}
                    onChange={(e) =>
                      handleInputChange(
                        "overtime_after_minutes",
                        Number(e.target.value || 0)
                      )
                    }
                    className="w-full border rounded-lg px-3 py-2"
                  />
                </div>
              </div>

              <div className="flex items-center gap-2">
                <input
                  id="is_active"
                  type="checkbox"
                  checked={form.is_active}
                  onChange={(e) =>
                    handleInputChange("is_active", e.target.checked)
                  }
                />
                <label htmlFor="is_active" className="text-sm font-medium">
                  Active Shift
                </label>
              </div>

              <div className="flex justify-end gap-3 pt-2">
                <button
                  type="button"
                  onClick={closeModal}
                  className="px-4 py-2 rounded-lg border hover:bg-gray-50"
                  disabled={saving}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  className="px-4 py-2 rounded-lg bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-60"
                >
                  {saving ? "Saving..." : editingShift ? "Update" : "Save"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}