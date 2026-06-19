import { FormEvent, useEffect, useState } from "react";
import { Settings } from "lucide-react";

import { AdminLayout } from "../layouts/admin-layout";
import { Button } from "../components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "../components/ui/card";
import { Input } from "../components/ui/input";
import { Select } from "../components/ui/select";
import { Switch } from "../components/ui/switch";
import { useAuth } from "../hooks/useAuth";
import {
  appSettingsService,
  type InstanceConfig,
} from "../services/app-settings.service";

const initialConfig: InstanceConfig = {
  mode: "sub",
  mainAnnouncementApiUrl: "",
  showAnnouncementPopup: true,
};

export function AdminSettingsPage() {
  const { user } = useAuth();
  const [config, setConfig] = useState<InstanceConfig>(initialConfig);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  const loadSettings = async () => {
    try {
      setIsLoading(true);
      setError("");
      const data = await appSettingsService.getInstanceConfig();
      setConfig(data);
    } catch (err: any) {
      setError(err.message || "Failed to load settings.");
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadSettings();
  }, []);

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault();

    try {
      setIsSaving(true);
      setError("");
      setSuccess("");

      if (config.mode === "sub" && !config.mainAnnouncementApiUrl.trim()) {
        throw new Error("Main announcement API URL is required for sub instances.");
      }

      const saved = await appSettingsService.saveInstanceConfig(config, user?.id);
      setConfig(saved);
      setSuccess("Settings saved successfully. Refresh the page to update the sidebar.");
    } catch (err: any) {
      setError(err.message || "Failed to save settings.");
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <AdminLayout>
      <div className="space-y-6">
        <div>
          <h1 className="text-neutral-900 mb-1">Settings</h1>
          <p className="text-neutral-600">
            Configure this instance and shared announcement behavior.
          </p>
        </div>

        {error && (
          <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg text-sm">
            {error}
          </div>
        )}

        {success && (
          <div className="bg-green-50 border border-green-200 text-green-700 px-4 py-3 rounded-lg text-sm">
            {success}
          </div>
        )}

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Settings className="w-5 h-5" />
              Instance Configuration
            </CardTitle>
            <CardDescription>
              Main instances manage announcements. Sub instances read announcements from a main instance.
            </CardDescription>
          </CardHeader>

          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-5">
              <Select
                label="Instance Type"
                value={config.mode}
                onChange={(event) =>
                  setConfig((prev) => ({
                    ...prev,
                    mode: event.target.value === "main" ? "main" : "sub",
                  }))
                }
                disabled={isLoading || isSaving}
              >
                <option value="sub">Sub Instance</option>
                <option value="main">Main Instance</option>
              </Select>

              <Input
                label="Main Announcement API URL"
                value={config.mainAnnouncementApiUrl}
                onChange={(event) =>
                  setConfig((prev) => ({
                    ...prev,
                    mainAnnouncementApiUrl: event.target.value,
                  }))
                }
                placeholder="https://main-project.supabase.co/functions/v1/get-public-announcements"
                disabled={isLoading || isSaving || config.mode === "main"}
              />

              <div className="flex items-center justify-between rounded-lg border border-neutral-200 p-4">
                <div>
                  <p className="text-sm font-medium text-neutral-900">
                    Show announcement popup
                  </p>
                  <p className="text-sm text-neutral-600">
                    Employees can still open the announcement board after closing it.
                  </p>
                </div>
                <Switch
                  checked={config.showAnnouncementPopup}
                  onCheckedChange={(checked) =>
                    setConfig((prev) => ({
                      ...prev,
                      showAnnouncementPopup: checked,
                    }))
                  }
                  disabled={isLoading || isSaving}
                />
              </div>

              <div className="flex justify-end">
                <Button type="submit" disabled={isLoading || isSaving}>
                  {isSaving ? "Saving..." : "Save Settings"}
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>
      </div>
    </AdminLayout>
  );
}
