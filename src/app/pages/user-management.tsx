import { useState, useEffect, FormEvent } from "react";
import { Plus, Search, Pencil, Trash2, CalendarDays } from "lucide-react";
import { AdminLayout } from "../layouts/admin-layout";
import { Button } from "../components/ui/button";
import { Input } from "../components/ui/input";
import { Select } from "../components/ui/select";
import {
  Card,
  CardContent,
  CardHeader,
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
  DialogBody,
  DialogFooter,
} from "../components/ui/dialog";
import { userService } from "../services/user.service";
import { departmentService } from "../services/department.service";
import { shiftService } from "../services/shift.service";
import { restDayService, type RestDay } from "../services/restday.service";
import type { User, Department } from "../lib/types";

type Shift = {
  id: string;
  name: string;
  location_id: string | null;
  start_time: string;
  end_time: string;
  grace_minutes: number;
  overtime_after_minutes: number;
  is_active: boolean;
  created_at: string;
  locations?: {
    id: string;
    name: string;
  } | null;
};

type UserFormData = {
  name: string;
  email: string;
  password: string;
  department: string;
  role: "user" | "admin";
  shift_id: string;
  sss: string;
  pagibig: string;
  philhealth: string;
  atm_number: string;
};

type RestDayFormData = {
  day_of_week: string;
  effective_from: string;
  effective_to: string;
};

const initialFormData: UserFormData = {
  name: "",
  email: "",
  password: "",
  department: "",
  role: "user",
  shift_id: "",
  sss: "",
  pagibig: "",
  philhealth: "",
  atm_number: "",
};

const initialRestDayFormData: RestDayFormData = {
  day_of_week: "",
  effective_from: "",
  effective_to: "",
};

export function UserManagementPage() {
  const [users, setUsers] = useState<User[]>([]);
  const [departments, setDepartments] = useState<Department[]>([]);
  const [shifts, setShifts] = useState<Shift[]>([]);
  const [filteredUsers, setFilteredUsers] = useState<User[]>([]);
  const [searchQuery, setSearchQuery] = useState("");

  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [isRestDialogOpen, setIsRestDialogOpen] = useState(false);

  const [editingUser, setEditingUser] = useState<User | null>(null);
  const [deletingUser, setDeletingUser] = useState<User | null>(null);
  const [selectedUser, setSelectedUser] = useState<User | null>(null);

  const [isLoading, setIsLoading] = useState(false);
  const [isPageLoading, setIsPageLoading] = useState(true);
  const [isRestLoading, setIsRestLoading] = useState(false);
  const [error, setError] = useState("");
  const [restError, setRestError] = useState("");

  const [formData, setFormData] = useState<UserFormData>(initialFormData);
  const [restDays, setRestDays] = useState<RestDay[]>([]);
  const [restDayFormData, setRestDayFormData] = useState<RestDayFormData>(
    initialRestDayFormData
  );
  const [editingRestDay, setEditingRestDay] = useState<RestDay | null>(null);

  useEffect(() => {
    loadData();
  }, []);

  useEffect(() => {
    const query = searchQuery.trim().toLowerCase();

    if (!query) {
      setFilteredUsers(users);
      return;
    }

    setFilteredUsers(
      users.filter((user) => {
        const name = user.name?.toLowerCase() ?? "";
        const email = user.email?.toLowerCase() ?? "";
        const department = user.department?.toLowerCase() ?? "";
        const role = user.role?.toLowerCase() ?? "";
        const shiftName = (user as any).shift_name?.toLowerCase?.() ?? "";

        return (
          name.includes(query) ||
          email.includes(query) ||
          department.includes(query) ||
          role.includes(query) ||
          shiftName.includes(query)
        );
      })
    );
  }, [searchQuery, users]);

  const loadData = async () => {
    try {
      setIsPageLoading(true);

      const [usersData, departmentsData, shiftsData] = await Promise.all([
        userService.getUsers(),
        departmentService.getAllDepartments(),
        shiftService.getShifts(),
      ]);

      setUsers(usersData ?? []);
      setDepartments(departmentsData ?? []);
      setShifts((shiftsData ?? []).filter((shift) => shift.is_active));
    } catch (error) {
      console.error("Error loading data:", error);
      setError(error instanceof Error ? error.message : "Failed to load data");
    } finally {
      setIsPageLoading(false);
    }
  };

  const loadRestDays = async (userId: string) => {
    try {
      setIsRestLoading(true);
      const data = await restDayService.getUserRestDays(userId);
      setRestDays(data ?? []);
    } catch (err) {
      console.error("Error loading rest days:", err);
      setRestError(
        err instanceof Error ? err.message : "Failed to load rest days"
      );
    } finally {
      setIsRestLoading(false);
    }
  };

  const resetForm = () => {
    setFormData(initialFormData);
  };

  const resetRestDayForm = () => {
    setRestDayFormData(initialRestDayFormData);
    setEditingRestDay(null);
  };

  const handleOpenDialog = (user?: User) => {
    setError("");

    if (user) {
      setEditingUser(user);
      setFormData({
        name: user.name ?? "",
        email: user.email ?? "",
        password: "",
        department: user.department ?? "",
        role: user.role ?? "user",
        shift_id: (user as any).shift_id ?? "",
        sss: user.sss ?? "",
        pagibig: user.pagibig ?? "",
        philhealth: user.philhealth ?? "",
        atm_number: user.atm_number ?? "",
      });
    } else {
      setEditingUser(null);
      resetForm();
    }

    setIsDialogOpen(true);
  };

  const handleCloseDialog = () => {
    if (isLoading) return;

    setIsDialogOpen(false);
    setEditingUser(null);
    setError("");
    resetForm();
  };

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setError("");

    try {
      if (editingUser) {
        await userService.updateUserByAdmin({
          id: editingUser.id,
          name: formData.name.trim(),
          email: formData.email.trim(),
          department: formData.department || null,
          role: formData.role,
          shift_id: formData.shift_id || null,
          sss: formData.sss || null,
          pagibig: formData.pagibig || null,
          philhealth: formData.philhealth || null,
          atm_number: formData.atm_number || null,
          password: formData.password.trim() ? formData.password : undefined,
        });
      } else {
        if (!formData.password.trim()) {
          throw new Error("Password is required when creating a new user.");
        }

        await userService.createUserByAdmin({
          name: formData.name.trim(),
          email: formData.email.trim(),
          password: formData.password,
          department: formData.department || null,
          role: formData.role,
          shift_id: formData.shift_id || null,
          sss: formData.sss || null,
          pagibig: formData.pagibig || null,
          philhealth: formData.philhealth || null,
          atm_number: formData.atm_number || null,
        });
      }

      await loadData();
      handleCloseDialog();
    } catch (err) {
      console.error(err);
      setError(err instanceof Error ? err.message : "Failed to save user");
    } finally {
      setIsLoading(false);
    }
  };

  const handleDeleteClick = (user: User) => {
    setError("");
    setDeletingUser(user);
    setIsDeleteDialogOpen(true);
  };

  const handleDeleteClose = () => {
    if (isLoading) return;
    setIsDeleteDialogOpen(false);
    setDeletingUser(null);
  };

  const handleDeleteConfirm = async () => {
    if (!deletingUser) return;

    setIsLoading(true);
    setError("");

    try {
      await userService.deleteUser(deletingUser.id);
      await loadData();
      handleDeleteClose();
    } catch (err) {
      console.error(err);
      setError(err instanceof Error ? err.message : "Failed to delete user");
    } finally {
      setIsLoading(false);
    }
  };

  const handleOpenRestDays = async (user: User) => {
    setSelectedUser(user);
    setRestError("");
    resetRestDayForm();
    setIsRestDialogOpen(true);
    await loadRestDays(user.id);
  };

  const handleCloseRestDialog = () => {
    if (isRestLoading) return;
    setIsRestDialogOpen(false);
    setSelectedUser(null);
    setRestDays([]);
    setRestError("");
    resetRestDayForm();
  };

  const handleEditRestDay = (restDay: RestDay) => {
    setEditingRestDay(restDay);
    setRestDayFormData({
      day_of_week: restDay.day_of_week,
      effective_from: restDay.effective_from,
      effective_to: restDay.effective_to ?? "",
    });
  };

  const handleSaveRestDay = async () => {
    if (!selectedUser) return;

    if (!restDayFormData.day_of_week || !restDayFormData.effective_from) {
      setRestError("Day of week and effective from are required.");
      return;
    }

    setIsRestLoading(true);
    setRestError("");

    try {
      if (editingRestDay) {
        await restDayService.updateRestDay(editingRestDay.id, {
          day_of_week: restDayFormData.day_of_week,
          effective_from: restDayFormData.effective_from,
          effective_to: restDayFormData.effective_to || null,
        });
      } else {
        await restDayService.addRestDay({
          user_id: selectedUser.id,
          day_of_week: restDayFormData.day_of_week,
          effective_from: restDayFormData.effective_from,
          effective_to: restDayFormData.effective_to || null,
        });
      }

      resetRestDayForm();
      await loadRestDays(selectedUser.id);
    } catch (err) {
      console.error(err);
      setRestError(
        err instanceof Error ? err.message : "Failed to save rest day"
      );
    } finally {
      setIsRestLoading(false);
    }
  };

  const handleDeleteRestDay = async (id: string) => {
    if (!selectedUser) return;

    setIsRestLoading(true);
    setRestError("");

    try {
      await restDayService.deleteRestDay(id);
      if (editingRestDay?.id === id) {
        resetRestDayForm();
      }
      await loadRestDays(selectedUser.id);
    } catch (err) {
      console.error(err);
      setRestError(
        err instanceof Error ? err.message : "Failed to delete rest day"
      );
    } finally {
      setIsRestLoading(false);
    }
  };

  return (
    <AdminLayout>
      <div className="space-y-6">
        <div className="flex justify-between items-start">
          <div>
            <h1 className="text-neutral-900 mb-1">User Management</h1>
            <p className="text-neutral-600">
              Manage employee accounts, information, assigned shifts, and rest
              days
            </p>
          </div>

          <Button
            onClick={() => handleOpenDialog()}
            className="flex items-center gap-2"
          >
            <Plus className="w-4 h-4" />
            Add User
          </Button>
        </div>

        {error && !isDialogOpen && !isDeleteDialogOpen && !isRestDialogOpen && (
          <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg text-sm">
            {error}
          </div>
        )}

        <Card>
          <CardHeader>
            <div className="flex items-center gap-4">
              <div className="flex-1 relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-neutral-400" />
                <Input
                  placeholder="Search by name, email, department, role, or shift..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-10"
                />
              </div>
            </div>
          </CardHeader>

          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead>Email</TableHead>
                  <TableHead>Department</TableHead>
                  <TableHead>Role</TableHead>
                  <TableHead>Shift</TableHead>
                  <TableHead>SSS</TableHead>
                  <TableHead>Pag-IBIG</TableHead>
                  <TableHead>PhilHealth</TableHead>
                  <TableHead>ATM Number</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>

              <TableBody>
                {isPageLoading ? (
                  <TableRow>
                    <TableCell colSpan={10} className="text-center text-neutral-500 py-8">
                      Loading users...
                    </TableCell>
                  </TableRow>
                ) : filteredUsers.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={10} className="text-center text-neutral-500 py-8">
                      {searchQuery
                        ? "No users found matching your search"
                        : "No users found"}
                    </TableCell>
                  </TableRow>
                ) : (
                  filteredUsers.map((user) => (
                    <TableRow key={user.id}>
                      <TableCell>{user.name || "-"}</TableCell>
                      <TableCell>{user.email || "-"}</TableCell>
                      <TableCell>{user.department || "-"}</TableCell>
                      <TableCell className="capitalize">{user.role || "-"}</TableCell>
                      <TableCell>{(user as any).shift_name || "-"}</TableCell>
                      <TableCell>{user.sss || "-"}</TableCell>
                      <TableCell>{user.pagibig || "-"}</TableCell>
                      <TableCell>{user.philhealth || "-"}</TableCell>
                      <TableCell>{user.atm_number || "-"}</TableCell>
                      <TableCell>
                        <div className="flex justify-end gap-2">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleOpenDialog(user)}
                          >
                            <Pencil className="w-4 h-4" />
                          </Button>

                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleOpenRestDays(user)}
                          >
                            <CalendarDays className="w-4 h-4 text-blue-600" />
                          </Button>

                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleDeleteClick(user)}
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
      </div>

      <Dialog open={isDialogOpen} onOpenChange={(open) => !open && handleCloseDialog()}>
        <DialogContent onClose={handleCloseDialog}>
          <DialogHeader>
            <DialogTitle>{editingUser ? "Edit User" : "Add New User"}</DialogTitle>
            <DialogDescription>
              {editingUser
                ? "Update user profile details and assigned shift. Leave password blank if you do not want to change it."
                : "Create a new user account and assign a shift."}
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
                  label="Full Name"
                  value={formData.name}
                  onChange={(e) =>
                    setFormData((prev) => ({ ...prev, name: e.target.value }))
                  }
                  required
                  disabled={isLoading}
                />

                <Input
                  label="Email"
                  type="email"
                  value={formData.email}
                  onChange={(e) =>
                    setFormData((prev) => ({ ...prev, email: e.target.value }))
                  }
                  required
                  disabled={isLoading}
                />

                <Input
                  label={editingUser ? "New Password (Optional)" : "Password"}
                  type="password"
                  value={formData.password}
                  onChange={(e) =>
                    setFormData((prev) => ({ ...prev, password: e.target.value }))
                  }
                  required={!editingUser}
                  disabled={isLoading}
                  placeholder={
                    editingUser ? "Leave blank to keep current password" : ""
                  }
                />

                <Select
                  label="Department"
                  value={formData.department}
                  onChange={(e) =>
                    setFormData((prev) => ({
                      ...prev,
                      department: e.target.value,
                    }))
                  }
                  disabled={isLoading}
                >
                  <option value="">Select Department</option>
                  {departments.map((dept) => (
                    <option key={dept.id} value={dept.name}>
                      {dept.name}
                    </option>
                  ))}
                </Select>

                <Select
                  label="Role"
                  value={formData.role}
                  onChange={(e) =>
                    setFormData((prev) => ({
                      ...prev,
                      role: e.target.value as "user" | "admin",
                    }))
                  }
                  required
                  disabled={isLoading}
                >
                  <option value="user">User</option>
                  <option value="admin">Admin</option>
                </Select>

                <Select
                  label="Assigned Shift"
                  value={formData.shift_id}
                  onChange={(e) =>
                    setFormData((prev) => ({
                      ...prev,
                      shift_id: e.target.value,
                    }))
                  }
                  disabled={isLoading}
                >
                  <option value="">Select Shift</option>
                  {shifts.map((shift) => (
                    <option key={shift.id} value={shift.id}>
                      {shift.name}
                      {shift.locations?.name ? ` - ${shift.locations.name}` : ""}
                      {" | "}
                      {shift.start_time?.slice(0, 5)} - {shift.end_time?.slice(0, 5)}
                    </option>
                  ))}
                </Select>

                <Input
                  label="SSS Number"
                  value={formData.sss}
                  onChange={(e) =>
                    setFormData((prev) => ({ ...prev, sss: e.target.value }))
                  }
                  disabled={isLoading}
                />

                <Input
                  label="Pag-IBIG Number"
                  value={formData.pagibig}
                  onChange={(e) =>
                    setFormData((prev) => ({ ...prev, pagibig: e.target.value }))
                  }
                  disabled={isLoading}
                />

                <Input
                  label="PhilHealth Number"
                  value={formData.philhealth}
                  onChange={(e) =>
                    setFormData((prev) => ({
                      ...prev,
                      philhealth: e.target.value,
                    }))
                  }
                  disabled={isLoading}
                />

                <Input
                  label="ATM Number"
                  value={formData.atm_number}
                  onChange={(e) =>
                    setFormData((prev) => ({
                      ...prev,
                      atm_number: e.target.value,
                    }))
                  }
                  disabled={isLoading}
                />
              </div>
            </DialogBody>

            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={handleCloseDialog}
                disabled={isLoading}
              >
                Cancel
              </Button>

              <Button type="submit" disabled={isLoading}>
                {isLoading
                  ? "Saving..."
                  : editingUser
                  ? "Update User"
                  : "Create User"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <Dialog
        open={isRestDialogOpen}
        onOpenChange={(open) => !open && handleCloseRestDialog()}
      >
        <DialogContent onClose={handleCloseRestDialog}>
          <DialogHeader>
            <DialogTitle>
              Manage Rest Days{selectedUser?.name ? ` - ${selectedUser.name}` : ""}
            </DialogTitle>
            <DialogDescription>
              Add, edit, or remove rest day schedules for this employee.
            </DialogDescription>
          </DialogHeader>

          <DialogBody>
            {restError && (
              <div className="mb-4 bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg text-sm">
                {restError}
              </div>
            )}

            <div className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
                <Select
                  label="Day of Week"
                  value={restDayFormData.day_of_week}
                  onChange={(e) =>
                    setRestDayFormData((prev) => ({
                      ...prev,
                      day_of_week: e.target.value,
                    }))
                  }
                  disabled={isRestLoading}
                >
                  <option value="">Select Day</option>
                  <option value="Monday">Monday</option>
                  <option value="Tuesday">Tuesday</option>
                  <option value="Wednesday">Wednesday</option>
                  <option value="Thursday">Thursday</option>
                  <option value="Friday">Friday</option>
                  <option value="Saturday">Saturday</option>
                  <option value="Sunday">Sunday</option>
                </Select>

                <Input
                  label="Effective From"
                  type="date"
                  value={restDayFormData.effective_from}
                  onChange={(e) =>
                    setRestDayFormData((prev) => ({
                      ...prev,
                      effective_from: e.target.value,
                    }))
                  }
                  disabled={isRestLoading}
                />

                <Input
                  label="Effective To"
                  type="date"
                  value={restDayFormData.effective_to}
                  onChange={(e) =>
                    setRestDayFormData((prev) => ({
                      ...prev,
                      effective_to: e.target.value,
                    }))
                  }
                  disabled={isRestLoading}
                />

                <div className="flex items-end gap-2">
                  <Button
                    type="button"
                    onClick={handleSaveRestDay}
                    disabled={isRestLoading}
                    className="w-full"
                  >
                    {isRestLoading
                      ? "Saving..."
                      : editingRestDay
                      ? "Update"
                      : "Add"}
                  </Button>
                </div>
              </div>

              {editingRestDay && (
                <div className="flex justify-end">
                  <Button
                    type="button"
                    variant="outline"
                    onClick={resetRestDayForm}
                    disabled={isRestLoading}
                  >
                    Cancel Edit
                  </Button>
                </div>
              )}

              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Day</TableHead>
                    <TableHead>Effective From</TableHead>
                    <TableHead>Effective To</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>

                <TableBody>
                  {isRestLoading && restDays.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={4} className="text-center text-neutral-500 py-8">
                        Loading rest days...
                      </TableCell>
                    </TableRow>
                  ) : restDays.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={4} className="text-center text-neutral-500 py-8">
                        No rest days found
                      </TableCell>
                    </TableRow>
                  ) : (
                    restDays.map((restDay) => (
                      <TableRow key={restDay.id}>
                        <TableCell>{restDay.day_of_week}</TableCell>
                        <TableCell>{restDay.effective_from}</TableCell>
                        <TableCell>{restDay.effective_to || "-"}</TableCell>
                        <TableCell>
                          <div className="flex justify-end gap-2">
                            <Button
                              type="button"
                              variant="ghost"
                              size="sm"
                              onClick={() => handleEditRestDay(restDay)}
                              disabled={isRestLoading}
                            >
                              <Pencil className="w-4 h-4" />
                            </Button>

                            <Button
                              type="button"
                              variant="ghost"
                              size="sm"
                              onClick={() => handleDeleteRestDay(restDay.id)}
                              disabled={isRestLoading}
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
            </div>
          </DialogBody>

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={handleCloseRestDialog}
              disabled={isRestLoading}
            >
              Close
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog
        open={isDeleteDialogOpen}
        onOpenChange={(open) => !open && handleDeleteClose()}
      >
        <DialogContent onClose={handleDeleteClose}>
          <DialogHeader>
            <DialogTitle>Delete User</DialogTitle>
            <DialogDescription>
              Are you sure you want to delete{" "}
              <span className="font-medium">{deletingUser?.name}</span>? This action
              cannot be undone.
            </DialogDescription>
          </DialogHeader>

          {error && (
            <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg text-sm">
              {error}
            </div>
          )}

          <DialogFooter>
            <Button
              variant="outline"
              onClick={handleDeleteClose}
              disabled={isLoading}
            >
              Cancel
            </Button>

            <Button
              variant="danger"
              onClick={handleDeleteConfirm}
              disabled={isLoading}
            >
              {isLoading ? "Deleting..." : "Delete User"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </AdminLayout>
  );
}