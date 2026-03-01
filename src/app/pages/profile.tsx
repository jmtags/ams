import { useState, FormEvent, useEffect } from "react";
import { UserLayout } from "../layouts/user-layout";
import { useAuth } from "../hooks/useAuth";
import { Button } from "../components/ui/button";
import { Input } from "../components/ui/input";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "../components/ui/card";
import { userService } from "../services/user.service";

export function ProfilePage() {
  const { user, updateUser } = useAuth();

  const [isEditing, setIsEditing] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [success, setSuccess] = useState("");
  const [error, setError] = useState("");

  const [formData, setFormData] = useState({
    name: "",
    email: "",
    department: "",
    sss: "",
    pagibig: "",
    philhealth: "",
    atmNumber: "",
  });

  // Load user data into form
  useEffect(() => {
    if (user) {
      setFormData({
        name: user.name || "",
        email: user.email || "",
        department: user.department || "",
        sss: user.sss || "",
        pagibig: user.pagibig || "",
        philhealth: user.philhealth || "",
        atmNumber: user.atm_number || "",
      });
    }
  }, [user]);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!user) return;

    setIsLoading(true);
    setError("");
    setSuccess("");

    try {
      const updatedUser = await userService.updateUserProfile(user.id, {
        name: formData.name,
        sss: formData.sss,
        pagibig: formData.pagibig,
        philhealth: formData.philhealth,
        atm_number: formData.atmNumber,
      });

      // Update auth context
      updateUser(updatedUser);

      setSuccess("Profile updated successfully");
      setIsEditing(false);
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Failed to update profile"
      );
    } finally {
      setIsLoading(false);
    }
  };

  const handleCancel = () => {
    if (!user) return;

    setFormData({
      name: user.name || "",
      email: user.email || "",
      department: user.department || "",
      sss: user.sss || "",
      pagibig: user.pagibig || "",
      philhealth: user.philhealth || "",
      atmNumber: user.atm_number || "",
    });

    setIsEditing(false);
    setError("");
    setSuccess("");
  };

  return (
    <UserLayout>
      <div className="max-w-3xl">
        <h1 className="text-neutral-900 mb-6">Profile</h1>

        <Card>
          <CardHeader>
            <div className="flex justify-between items-center">
              <div>
                <CardTitle>Personal Information</CardTitle>
                <CardDescription>
                  Manage your personal details
                </CardDescription>
              </div>

              {!isEditing && (
                <Button
                  onClick={() => setIsEditing(true)}
                  variant="outline"
                >
                  Edit Profile
                </Button>
              )}
            </div>
          </CardHeader>

          <CardContent>
            {success && (
              <div className="mb-4 text-green-600 text-sm">
                {success}
              </div>
            )}

            {error && (
              <div className="mb-4 text-red-600 text-sm">
                {error}
              </div>
            )}

            <form onSubmit={handleSubmit} className="space-y-6">
              {/* Basic Info */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <Input
                  label="Full Name"
                  value={formData.name}
                  onChange={(e) =>
                    setFormData({ ...formData, name: e.target.value })
                  }
                  disabled={!isEditing || isLoading}
                  required
                />

                {/* Email NOT editable */}
                <Input
                  label="Email"
                  value={formData.email}
                  disabled
                />
              </div>

              {/* Department (Read Only) */}
              <Input
                label="Department"
                value={formData.department}
                disabled
              />

              {/* Government & Bank */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <Input
                  label="SSS Number"
                  value={formData.sss}
                  onChange={(e) =>
                    setFormData({ ...formData, sss: e.target.value })
                  }
                  disabled={!isEditing || isLoading}
                />

                <Input
                  label="Pag-IBIG Number"
                  value={formData.pagibig}
                  onChange={(e) =>
                    setFormData({ ...formData, pagibig: e.target.value })
                  }
                  disabled={!isEditing || isLoading}
                />

                <Input
                  label="PhilHealth Number"
                  value={formData.philhealth}
                  onChange={(e) =>
                    setFormData({ ...formData, philhealth: e.target.value })
                  }
                  disabled={!isEditing || isLoading}
                />

                <Input
                  label="ATM Number"
                  value={formData.atmNumber}
                  onChange={(e) =>
                    setFormData({ ...formData, atmNumber: e.target.value })
                  }
                  disabled={!isEditing || isLoading}
                />
              </div>

              {isEditing && (
                <div className="flex gap-3">
                  <Button type="submit" disabled={isLoading}>
                    {isLoading ? "Saving..." : "Save Changes"}
                  </Button>

                  <Button
                    type="button"
                    variant="outline"
                    onClick={handleCancel}
                    disabled={isLoading}
                  >
                    Cancel
                  </Button>
                </div>
              )}
            </form>
          </CardContent>
        </Card>
      </div>
    </UserLayout>
  );
}
