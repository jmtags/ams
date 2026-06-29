import { useEffect, useState } from 'react';
import {
  Clock,
  AlarmClock,
  CalendarCheck2,
  ListChecks,
  LogIn,
  LogOut as LogOutIcon,
  FileEdit,
  Plus,
  Trash2,
  ClipboardList,
  Megaphone,
  BookOpen,
  ChevronLeft,
  ChevronRight,
} from 'lucide-react';
import { useNavigate } from "react-router";
import { useAuth } from '../hooks/useAuth';
import { UserLayout } from '../layouts/user-layout';
import { Button } from '../components/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '../components/ui/card';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '../components/ui/table';
import { Badge } from '../components/ui/badge';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogBody,
  DialogFooter,
} from '../components/ui/dialog';
import { attendanceService } from "../services/attendance.service";
import { attendanceActivityLogService } from "../services/attendance-activity-log.service";
import { locationService } from "../services/location.service";
import { attendanceAdjustmentRequestService } from "../services/attendance-adjustment-request.service";
import {
  announcementService,
  type Announcement,
} from "../services/announcement.service";
import { appSettingsService } from "../services/app-settings.service";
import {
  policyDocumentService,
  type PolicyDocument,
} from "../services/policy-document.service";
import type { AttendanceRecord, Location } from '../lib/types';
import { formatDate, formatTime, getGreeting } from '../lib/utils';

type PunchAlterationFormState = {
  requested_clock_in: string;
  requested_clock_out: string;
  request_reason: string;
};

type ActivityLogRow = {
  activity_text: string;
  hours_spent: string;
  output_note: string;
};

type TodayShiftRequirement = {
  attendanceId: string;
  shiftId: string;
  clockIn: string | null;
  clockOut: string | null;
  requireActivityLogBeforeClockOut: boolean;
  minActivityEntries: number;
  shiftName: string | null;
} | null;

const ANNOUNCEMENT_PREVIEW_LENGTH = 420;

const initialPunchAlterationForm: PunchAlterationFormState = {
  requested_clock_in: '',
  requested_clock_out: '',
  request_reason: '',
};

const emptyActivityRow: ActivityLogRow = {
  activity_text: '',
  hours_spent: '',
  output_note: '',
};

function toLocalTimeInput(value?: string | null) {
  if (!value) return '';
  const date = new Date(value);
  return `${String(date.getHours()).padStart(2, '0')}:${String(date.getMinutes()).padStart(2, '0')}`;
}

function combineDateAndTime(date: string, time: string) {
  if (!date || !time) return null;
  return `${date}T${time}:00+08:00`;
}

export function UserDashboardPage() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [currentTime, setCurrentTime] = useState(new Date());

  const [attendanceHistory, setAttendanceHistory] = useState<AttendanceRecord[]>([]);
  const [todayAttendance, setTodayAttendance] = useState<AttendanceRecord | null>(null);
  const [locations, setLocations] = useState<Location[]>([]);

  const [isLoading, setIsLoading] = useState(false);

  const [error, setError] = useState('');

  const [isPunchDialogOpen, setIsPunchDialogOpen] = useState(false);
  const [selectedAttendance, setSelectedAttendance] = useState<AttendanceRecord | null>(null);
  const [punchAlterationForm, setPunchAlterationForm] = useState<PunchAlterationFormState>(initialPunchAlterationForm);
  const [isPunchSubmitting, setIsPunchSubmitting] = useState(false);
  const [punchError, setPunchError] = useState('');
  const [punchSuccess, setPunchSuccess] = useState('');
  const [pendingRequestAttendanceIds, setPendingRequestAttendanceIds] = useState<string[]>([]);

  const [todayShiftRequirement, setTodayShiftRequirement] = useState<TodayShiftRequirement>(null);
  const [activityLogs, setActivityLogs] = useState<ActivityLogRow[]>([emptyActivityRow]);
  const [isSavingActivityLogs, setIsSavingActivityLogs] = useState(false);
  const [activityLogError, setActivityLogError] = useState('');
  const [activityLogSuccess, setActivityLogSuccess] = useState('');
  const [savedActivityLogCount, setSavedActivityLogCount] = useState(0);
  const [announcements, setAnnouncements] = useState<Announcement[]>([]);
  const [isAnnouncementDialogOpen, setIsAnnouncementDialogOpen] = useState(false);
  const [announcementPopupEnabled, setAnnouncementPopupEnabled] = useState(true);
  const [announcementImageErrors, setAnnouncementImageErrors] = useState<string[]>([]);
  const [currentAnnouncementIndex, setCurrentAnnouncementIndex] = useState(0);
  const [expandedAnnouncementIds, setExpandedAnnouncementIds] = useState<string[]>([]);
  const [policyDocuments, setPolicyDocuments] = useState<PolicyDocument[]>([]);
  const [unseenPolicyDocuments, setUnseenPolicyDocuments] = useState<
    PolicyDocument[]
  >([]);

  useEffect(() => {
    const timer = setInterval(() => {
      setCurrentTime(new Date());
    }, 1000);

    return () => clearInterval(timer);
  }, []);

  useEffect(() => {
    loadAllData();
  }, [user]);

  useEffect(() => {
    if (!isAnnouncementDialogOpen || announcements.length <= 1) return;

    const timer = setInterval(() => {
      setCurrentAnnouncementIndex((prev) => (prev + 1) % announcements.length);
    }, 7000);

    return () => clearInterval(timer);
  }, [announcements.length, isAnnouncementDialogOpen]);

  const loadTodayShiftRequirementAndLogs = async (userId: string) => {
    try {
      const requirement = await attendanceService.getTodayShiftRequirement(userId);
      setTodayShiftRequirement(requirement);

      if (requirement?.attendanceId) {
        const logs = await attendanceActivityLogService.getByAttendanceId(
          requirement.attendanceId
        );

        setSavedActivityLogCount(logs.length);

        if (logs.length > 0) {
          setActivityLogs(
            logs.map((log) => ({
              activity_text: log.activity_text || '',
              hours_spent:
                log.hours_spent === null || log.hours_spent === undefined
                  ? ''
                  : String(log.hours_spent),
              output_note: log.output_note || '',
            }))
          );
        } else {
          setActivityLogs([emptyActivityRow]);
        }
      } else {
        setSavedActivityLogCount(0);
        setActivityLogs([emptyActivityRow]);
      }
    } catch (err) {
      console.error("Error loading today shift requirement/activity logs:", err);
    }
  };

  const loadAnnouncements = async () => {
    if (!user?.id) return;

    try {
      const [config, activeAnnouncements] = await Promise.all([
        appSettingsService.getInstanceConfig(),
        announcementService.getPublicAnnouncements(),
      ]);

      setAnnouncementPopupEnabled(config.showAnnouncementPopup);
      setAnnouncements(activeAnnouncements);
      setAnnouncementImageErrors([]);
      setCurrentAnnouncementIndex(0);
      setExpandedAnnouncementIds([]);

      if (config.showAnnouncementPopup && activeAnnouncements.length > 0) {
        setIsAnnouncementDialogOpen(true);
      }
    } catch (err) {
      console.error("Error loading announcements:", err);
    }
  };

  const loadPolicyNotifications = async (userId: string) => {
    try {
      const publishedDocuments = await policyDocumentService.getPublished();
      setPolicyDocuments(publishedDocuments);
      setUnseenPolicyDocuments(
        policyDocumentService.getUnseen(publishedDocuments, userId)
      );
    } catch (err) {
      console.error("Error loading policy document notifications:", err);
      setPolicyDocuments([]);
      setUnseenPolicyDocuments([]);
    }
  };

  const loadAllData = async () => {
    if (!user?.id) return;

    try {
      setIsLoading(true);
      setError('');

      const [history, today, locs] = await Promise.all([
        attendanceService.getAttendanceHistory(user.id, 10),
        attendanceService.getTodayAttendance(user.id),
        locationService.getAllLocations(),
      ]);

      setAttendanceHistory(history);
      setTodayAttendance(today);
      setLocations(locs);

      await Promise.all([
        loadTodayShiftRequirementAndLogs(user.id),
        loadAnnouncements(),
        loadPolicyNotifications(user.id),
      ]);

      const pendingChecks = await Promise.all(
        (history ?? []).map(async (record) => {
          const pending = await attendanceAdjustmentRequestService.getPendingRequestByAttendanceId(record.id);
          return pending ? record.id : null;
        })
      );

      setPendingRequestAttendanceIds(
        pendingChecks.filter((id): id is string => Boolean(id))
      );
    } catch (err: any) {
      setError(err.message || 'Failed to load dashboard data.');
    } finally {
      setIsLoading(false);
    }
  };

  const loadAttendance = async () => {
    if (!user?.id) return;

    try {
      const [history, today] = await Promise.all([
        attendanceService.getAttendanceHistory(user.id, 10),
        attendanceService.getTodayAttendance(user.id),
      ]);

      setAttendanceHistory(history);
      setTodayAttendance(today);

      await loadTodayShiftRequirementAndLogs(user.id);

      const pendingChecks = await Promise.all(
        (history ?? []).map(async (record) => {
          const pending = await attendanceAdjustmentRequestService.getPendingRequestByAttendanceId(record.id);
          return pending ? record.id : null;
        })
      );

      setPendingRequestAttendanceIds(
        pendingChecks.filter((id): id is string => Boolean(id))
      );
    } catch (err) {
      console.error("Error loading attendance:", err);
    }
  };

  const handleClockIn = async () => {
    if (!user?.id || !locations?.length) return;

    try {
      setIsLoading(true);
      setError('');

      const record = await attendanceService.clockIn(user.id, locations[0].id);
      setTodayAttendance(record);
      await loadAttendance();
    } catch (err: any) {
      setError(err.message || 'Failed to clock in.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleClockOut = async () => {
    if (!todayAttendance?.id) return;

    try {
      setIsLoading(true);
      setError('');

      const updated = await attendanceService.clockOut(todayAttendance.id);
      setTodayAttendance(updated);
      await loadAttendance();
    } catch (err: any) {
      setError(err.message || 'Failed to clock out.');
    } finally {
      setIsLoading(false);
    }
  };

  const closeAnnouncementDialog = () => {
    setIsAnnouncementDialogOpen(false);
  };

  const handleOpenPolicyDocuments = () => {
    if (user?.id) {
      policyDocumentService.markAsSeen(policyDocuments, user.id);
    }
    setUnseenPolicyDocuments([]);
    navigate("/policies");
  };

  const handleAnnouncementImageError = (announcementId: string) => {
    setAnnouncementImageErrors((prev) =>
      prev.includes(announcementId) ? prev : [...prev, announcementId]
    );
  };

  const goToPreviousAnnouncement = () => {
    setCurrentAnnouncementIndex((prev) =>
      announcements.length === 0
        ? 0
        : (prev - 1 + announcements.length) % announcements.length
    );
  };

  const goToNextAnnouncement = () => {
    setCurrentAnnouncementIndex((prev) =>
      announcements.length === 0 ? 0 : (prev + 1) % announcements.length
    );
  };

  const toggleFullAnnouncement = (announcementId: string) => {
    setExpandedAnnouncementIds((prev) =>
      prev.includes(announcementId)
        ? prev.filter((id) => id !== announcementId)
        : [...prev, announcementId]
    );
  };

  const handleOpenPunchDialog = (record: AttendanceRecord) => {
    setSelectedAttendance(record);
    setPunchAlterationForm({
      requested_clock_in: toLocalTimeInput(record.clockIn),
      requested_clock_out: toLocalTimeInput(record.clockOut),
      request_reason: '',
    });
    setPunchError('');
    setPunchSuccess('');
    setIsPunchDialogOpen(true);
  };

  const handleClosePunchDialog = () => {
    setIsPunchDialogOpen(false);
    setSelectedAttendance(null);
    setPunchAlterationForm(initialPunchAlterationForm);
    setPunchError('');
  };

  const handleSubmitPunchAlterationRequest = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!user?.id || !selectedAttendance) return;

    try {
      setIsPunchSubmitting(true);
      setPunchError('');
      setPunchSuccess('');

      if (!punchAlterationForm.request_reason.trim()) {
        throw new Error('Please provide a reason for the punch alteration request.');
      }

      const requestedClockIn = punchAlterationForm.requested_clock_in
        ? combineDateAndTime(selectedAttendance.date, punchAlterationForm.requested_clock_in)
        : null;

      const requestedClockOut = punchAlterationForm.requested_clock_out
        ? combineDateAndTime(selectedAttendance.date, punchAlterationForm.requested_clock_out)
        : null;

      await attendanceAdjustmentRequestService.createRequest({
        attendance_id: selectedAttendance.id,
        user_id: user.id,
        previous_clock_in: selectedAttendance.clockIn ?? null,
        previous_clock_out: selectedAttendance.clockOut ?? null,
        requested_clock_in: requestedClockIn,
        requested_clock_out: requestedClockOut,
        request_reason: punchAlterationForm.request_reason.trim(),
        created_by: user.id,
      });

      setPunchSuccess('Punch alteration request submitted successfully.');
      await loadAttendance();

      setTimeout(() => {
        handleClosePunchDialog();
      }, 800);
    } catch (err: any) {
      setPunchError(err.message || 'Failed to submit punch alteration request.');
    } finally {
      setIsPunchSubmitting(false);
    }
  };

  const addActivityLogRow = () => {
    setActivityLogs((prev) => [...prev, { ...emptyActivityRow }]);
  };

  const removeActivityLogRow = (index: number) => {
    setActivityLogs((prev) => {
      if (prev.length === 1) return prev;
      return prev.filter((_, i) => i !== index);
    });
  };

  const updateActivityLogRow = (
    index: number,
    field: keyof ActivityLogRow,
    value: string
  ) => {
    setActivityLogs((prev) =>
      prev.map((row, i) =>
        i === index
          ? {
              ...row,
              [field]: value,
            }
          : row
      )
    );
  };

  const handleSaveActivityLogs = async () => {
    if (!user?.id || !todayShiftRequirement?.attendanceId) return;

    try {
      setIsSavingActivityLogs(true);
      setActivityLogError('');
      setActivityLogSuccess('');

      const cleaned = activityLogs.filter((row) => row.activity_text.trim());

      if (
        todayShiftRequirement.requireActivityLogBeforeClockOut &&
        cleaned.length < (todayShiftRequirement.minActivityEntries || 1)
      ) {
        throw new Error(
          `Please enter at least ${todayShiftRequirement.minActivityEntries} activity log(s).`
        );
      }

      await attendanceActivityLogService.replaceLogs(
        todayShiftRequirement.attendanceId,
        user.id,
        cleaned.map((row) => ({
          activity_text: row.activity_text,
          hours_spent: row.hours_spent ? Number(row.hours_spent) : null,
          output_note: row.output_note || null,
        }))
      );

      setSavedActivityLogCount(cleaned.length);
      setActivityLogSuccess('Activity logs saved successfully.');
    } catch (err: any) {
      setActivityLogError(err.message || 'Failed to save activity logs.');
    } finally {
      setIsSavingActivityLogs(false);
    }
  };

  const getStatusBadgeVariant = (status: string) => {
    switch (status) {
      case 'present':
        return 'success';
      case 'late':
        return 'warning';
      case 'absent':
        return 'danger';
      default:
        return 'default';
    }
  };

  const requiresActivityLogs =
    !!todayShiftRequirement?.requireActivityLogBeforeClockOut &&
    !!todayAttendance?.clockIn &&
    !todayAttendance?.clockOut;

  const currentAnnouncement =
    announcements[currentAnnouncementIndex] ?? announcements[0] ?? null;
  const isCurrentAnnouncementExpanded = currentAnnouncement
    ? expandedAnnouncementIds.includes(currentAnnouncement.id)
    : false;
  const isCurrentAnnouncementLong =
    (currentAnnouncement?.message.length ?? 0) > ANNOUNCEMENT_PREVIEW_LENGTH;
  const currentAnnouncementMessage =
    currentAnnouncement && isCurrentAnnouncementLong && !isCurrentAnnouncementExpanded
      ? `${currentAnnouncement.message.slice(0, ANNOUNCEMENT_PREVIEW_LENGTH).trim()}...`
      : currentAnnouncement?.message ?? "";
  const presentDays = attendanceHistory.filter(
    (record) => record.status === "present"
  ).length;
  const lateDays = attendanceHistory.filter(
    (record) => record.status === "late"
  ).length;
  const attendanceState = todayAttendance?.clockOut
    ? "Shift completed"
    : todayAttendance?.clockIn
    ? "Currently clocked in"
    : "Ready to clock in";

  return (
    <UserLayout>
      <div className="mx-auto w-full max-w-7xl space-y-5 sm:space-y-6">
        <div className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-neutral-950 via-neutral-900 to-slate-800 px-5 py-6 text-white shadow-xl shadow-neutral-900/10 sm:px-8 sm:py-8">
          <div className="pointer-events-none absolute -right-16 -top-24 h-64 w-64 rounded-full bg-white/10 blur-3xl" />
          <div className="pointer-events-none absolute -bottom-28 left-1/3 h-56 w-56 rounded-full bg-blue-400/10 blur-3xl" />
          <div className="relative flex flex-col gap-6 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <div className="mb-3 inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/10 px-3 py-1 text-xs text-neutral-200 backdrop-blur">
                <span
                  className={`h-2 w-2 rounded-full ${
                    todayAttendance?.clockIn && !todayAttendance?.clockOut
                      ? "bg-emerald-400"
                      : "bg-neutral-400"
                  }`}
                />
                {attendanceState}
              </div>
              <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">
                {getGreeting()}, {user?.name?.split(" ")[0] || "there"}
              </h1>
              <p className="mt-2 max-w-xl text-sm text-neutral-300 sm:text-base">
                Here is your attendance overview for today.
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-3">
              <div className="rounded-xl border border-white/10 bg-white/10 px-4 py-2.5 backdrop-blur">
                <p className="text-xs text-neutral-400">Today</p>
                <p className="mt-0.5 text-sm font-medium">
                  {currentTime.toLocaleDateString("en-US", {
                    month: "short",
                    day: "numeric",
                    year: "numeric",
                  })}
                </p>
              </div>
              {unseenPolicyDocuments.length > 0 && (
                <Button
                  type="button"
                  variant="outline"
                  onClick={handleOpenPolicyDocuments}
                  className="border-emerald-300/30 bg-emerald-400/15 text-white hover:bg-emerald-400/25"
                >
                  <BookOpen className="mr-2 h-4 w-4" />
                  New Policies &amp; Documents
                  <span className="ml-2 rounded-full bg-emerald-300 px-1.5 py-0.5 text-[10px] font-semibold text-emerald-950">
                    {unseenPolicyDocuments.length}
                  </span>
                </Button>
              )}
              {announcementPopupEnabled && announcements.length > 0 && (
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setIsAnnouncementDialogOpen((prev) => !prev)}
                  className="border-white/20 bg-white/10 text-white hover:bg-white/20"
                >
                  <Megaphone className="mr-2 w-4 h-4" />
                  Announcements
                  <span className="ml-2 rounded-full bg-white px-1.5 py-0.5 text-[10px] font-semibold text-neutral-900">
                    {announcements.length}
                  </span>
                </Button>
              )}
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 gap-5 xl:grid-cols-[minmax(0,1.65fr)_minmax(280px,0.65fr)]">
          <Card className="overflow-hidden rounded-2xl border-neutral-200/80 shadow-sm">
            <CardHeader className="border-b border-neutral-100 p-5 sm:p-6">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <CardTitle className="text-lg font-semibold">
                    Today&apos;s Attendance
                  </CardTitle>
                  <CardDescription>Record and review your workday</CardDescription>
                </div>
                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-neutral-100">
                  <Clock className="h-5 w-5 text-neutral-700" />
                </div>
              </div>
            </CardHeader>
            <CardContent className="p-5 sm:p-6">
              <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(260px,0.8fr)] lg:items-center">
                <div className="rounded-2xl bg-neutral-50 px-5 py-7 text-center sm:px-8">
                  <p className="text-xs font-medium uppercase tracking-[0.18em] text-neutral-500">
                    Local time
                  </p>
                  <div className="mt-2 text-4xl font-semibold tracking-tight text-neutral-950 sm:text-5xl">
                    {currentTime.toLocaleTimeString("en-US", {
                      hour: "2-digit",
                      minute: "2-digit",
                      hour12: true,
                    })}
                  </div>
                  <div className="mt-2 text-sm text-neutral-500">
                    {currentTime.toLocaleDateString("en-US", {
                      weekday: "long",
                      month: "long",
                      day: "numeric",
                    })}
                  </div>
                </div>

                <div className="space-y-4">
                  <div className="grid grid-cols-2 gap-3">
                    <div className="rounded-xl border border-neutral-200 p-4">
                      <p className="text-xs text-neutral-500">Clock in</p>
                      <p className="mt-1 text-lg font-semibold text-neutral-900">
                        {todayAttendance?.clockIn
                          ? formatTime(todayAttendance.clockIn)
                          : "--:--"}
                      </p>
                    </div>
                    <div className="rounded-xl border border-neutral-200 p-4">
                      <p className="text-xs text-neutral-500">Clock out</p>
                      <p className="mt-1 text-lg font-semibold text-neutral-900">
                        {todayAttendance?.clockOut
                          ? formatTime(todayAttendance.clockOut)
                          : "--:--"}
                      </p>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                    <Button
                      size="lg"
                      onClick={handleClockIn}
                      disabled={isLoading || todayAttendance?.clockIn !== undefined}
                      className="w-full"
                    >
                      <LogIn className="mr-2 h-4 w-4" />
                      Clock In
                    </Button>
                    <Button
                      size="lg"
                      onClick={handleClockOut}
                      disabled={
                        isLoading ||
                        !todayAttendance?.clockIn ||
                        todayAttendance?.clockOut !== null
                      }
                      variant="secondary"
                      className="w-full"
                    >
                      <LogOutIcon className="mr-2 h-4 w-4" />
                      Clock Out
                    </Button>
                  </div>
                </div>
              </div>

              {error && (
                <div className="mt-5 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
                  {error}
                </div>
              )}

              {requiresActivityLogs && (
                <div className="mt-5 flex gap-3 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
                  <ClipboardList className="mt-0.5 h-4 w-4 shrink-0" />
                  <span>
                    Add at least{" "}
                    <strong>
                      {todayShiftRequirement?.minActivityEntries || 1}
                    </strong>{" "}
                    activity log(s) before clocking out.
                  </span>
                </div>
              )}
            </CardContent>
          </Card>

          <div className="space-y-5">
            <Card className="rounded-2xl border-neutral-200/80 shadow-sm">
              <CardHeader className="p-5 pb-3 sm:p-6 sm:pb-3">
                <CardTitle className="text-lg font-semibold">
                  Recent Overview
                </CardTitle>
                <CardDescription>Based on your latest records</CardDescription>
              </CardHeader>
              <CardContent className="space-y-3 p-5 pt-2 sm:p-6 sm:pt-2">
                <div className="flex items-center gap-4 rounded-xl bg-emerald-50/70 p-4">
                  <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-emerald-100 text-emerald-700">
                    <CalendarCheck2 className="h-5 w-5" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-sm text-neutral-600">Present days</p>
                    <p className="text-2xl font-semibold text-neutral-950">
                      {presentDays}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-4 rounded-xl bg-amber-50/70 p-4">
                  <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-amber-100 text-amber-700">
                    <AlarmClock className="h-5 w-5" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-sm text-neutral-600">Late days</p>
                    <p className="text-2xl font-semibold text-neutral-950">
                      {lateDays}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-4 rounded-xl bg-neutral-100/80 p-4">
                  <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-white text-neutral-700 shadow-sm">
                    <ListChecks className="h-5 w-5" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-sm text-neutral-600">Total records</p>
                    <p className="text-2xl font-semibold text-neutral-950">
                      {attendanceHistory.length}
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Wallet className="w-5 h-5" />
                  Payroll & Payslips
                </CardTitle>
                <CardDescription>
                  View your latest payroll information and payslips.
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  <div className="bg-neutral-50 rounded-lg p-4">
                    <p className="text-sm text-neutral-600 mb-1">Latest Pay Date</p>
                    <p className="text-lg text-neutral-900">
                      {latestPayrollRecord?.payroll_period_pay_date || 'No payroll yet'}
                    </p>
                  </div>

                  <div className="bg-neutral-50 rounded-lg p-4">
                    <p className="text-sm text-neutral-600 mb-1">Latest Net Pay</p>
                    <p className="text-2xl text-neutral-900">
                      {latestPayrollRecord ? currency(latestPayrollRecord.net_pay) : '0.00'}
                    </p>
                  </div>

                  <div className="bg-neutral-50 rounded-lg p-4">
                    <p className="text-sm text-neutral-600 mb-1">Latest Status</p>
                    <div className="mt-2">
                      {latestPayrollRecord ? (
                        <Badge variant={getPayrollStatusBadgeVariant(latestPayrollRecord.status)}>
                          {latestPayrollRecord.status}
                        </Badge>
                      ) : (
                        <span className="text-sm text-neutral-500">No payroll record</span>
                      )}
                    </div>
                  </div>

                  <div className="flex flex-col gap-2">
                    <Link to="/my-payroll">
                      <Button className="w-full">
                        <Receipt className="w-4 h-4 mr-2" />
                        View My Payroll
                      </Button>
                    </Link>

                    {latestPayrollRecord && (
                      <Link to={`/my-payroll/${latestPayrollRecord.id}`}>
                        <Button variant="outline" className="w-full">
                          View Latest Payslip
                        </Button>
                      </Link>
                    )}
                  </div>
                </div>
              </CardContent>
            </Card>
             */}
          </div>
        </div>

        {/* {payrollRecords.length > 0 && (
          <Card>
            <CardHeader>
              <CardTitle>Recent Payroll Records</CardTitle>
              <CardDescription>
                Your most recent finalized or released payroll entries.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Payroll Period</TableHead>
                    <TableHead>Pay Date</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="text-right">Net Pay</TableHead>
                    <TableHead className="text-right">Action</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {payrollRecords.map((record) => (
                    <TableRow key={record.id}>
                      <TableCell>
                        <div className="font-medium">
                          {record.payroll_period_name || 'Payroll Period'}
                        </div>
                        <div className="text-xs text-neutral-500">
                          {record.payroll_period_date_from || '-'} to {record.payroll_period_date_to || '-'}
                        </div>
                      </TableCell>
                      <TableCell>{record.payroll_period_pay_date || '-'}</TableCell>
                      <TableCell>
                        <Badge variant={getPayrollStatusBadgeVariant(record.status)}>
                          {record.status}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right font-semibold">
                        {currency(record.net_pay)}
                      </TableCell>
                      <TableCell className="text-right">
                        <Link to={`/my-payroll/${record.id}`}>
                          <Button variant="outline" size="sm">
                            View Payslip
                          </Button>
                        </Link>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        )} */}

        {requiresActivityLogs && (
          <Card className="overflow-hidden rounded-2xl border-neutral-200/80 shadow-sm">
            <CardHeader className="border-b border-neutral-100 p-5 sm:p-6">
              <CardTitle className="flex items-center gap-2">
                <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-amber-50 text-amber-700">
                  <ClipboardList className="h-4 w-4" />
                </span>
                Daily Activity Log
              </CardTitle>
              <CardDescription>
                Enter your work activities before clocking out.
                {todayShiftRequirement?.shiftName
                  ? ` Shift: ${todayShiftRequirement.shiftName}.`
                  : ''}
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-5 p-5 sm:p-6">
              {(activityLogError || activityLogSuccess) && (
                <div className="space-y-2">
                  {activityLogError && (
                    <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg text-sm">
                      {activityLogError}
                    </div>
                  )}
                  {activityLogSuccess && (
                    <div className="bg-green-50 border border-green-200 text-green-700 px-4 py-3 rounded-lg text-sm">
                      {activityLogSuccess}
                    </div>
                  )}
                </div>
              )}

              <div className="flex flex-wrap items-center justify-between gap-2 rounded-xl bg-neutral-50 px-4 py-3 text-sm text-neutral-600">
                <span>Completion progress</span>
                <span className="font-medium text-neutral-900">
                  {savedActivityLogCount} of{" "}
                  {todayShiftRequirement?.minActivityEntries || 1} required
                </span>
              </div>

              <div className="space-y-4">
                {activityLogs.map((row, index) => (
                  <div
                    key={index}
                    className="space-y-4 rounded-xl border border-neutral-200 bg-white p-4 sm:p-5"
                  >
                    <div className="flex items-center justify-between">
                      <div className="text-sm font-medium text-neutral-900">
                        Activity #{index + 1}
                      </div>
                      {activityLogs.length > 1 && (
                        <button
                          type="button"
                          onClick={() => removeActivityLogRow(index)}
                          className="text-red-600 hover:text-red-700"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      )}
                    </div>

                    <div>
                      <label className="block text-sm text-neutral-700 mb-2">
                        Activity
                      </label>
                      <textarea
                        value={row.activity_text}
                        onChange={(e) =>
                          updateActivityLogRow(index, "activity_text", e.target.value)
                        }
                        rows={3}
                        className="w-full rounded-xl border border-neutral-300 px-3 py-2.5 text-sm outline-none transition focus:border-neutral-500 focus:ring-2 focus:ring-neutral-200"
                        placeholder="Describe the task or work completed"
                      />
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div>
                        <label className="block text-sm text-neutral-700 mb-2">
                          Hours Spent
                        </label>
                        <input
                          type="number"
                          step="0.25"
                          min="0"
                          value={row.hours_spent}
                          onChange={(e) =>
                            updateActivityLogRow(index, "hours_spent", e.target.value)
                          }
                          className="w-full rounded-xl border border-neutral-300 px-3 py-2.5 text-sm outline-none transition focus:border-neutral-500 focus:ring-2 focus:ring-neutral-200"
                          placeholder="Optional"
                        />
                      </div>

                      <div>
                        <label className="block text-sm text-neutral-700 mb-2">
                          Output / Note
                        </label>
                        <input
                          type="text"
                          value={row.output_note}
                          onChange={(e) =>
                            updateActivityLogRow(index, "output_note", e.target.value)
                          }
                          className="w-full rounded-xl border border-neutral-300 px-3 py-2.5 text-sm outline-none transition focus:border-neutral-500 focus:ring-2 focus:ring-neutral-200"
                          placeholder="Optional"
                        />
                      </div>
                    </div>
                  </div>
                ))}
              </div>

              <div className="flex flex-col-reverse gap-3 sm:flex-row sm:justify-between">
                <Button
                  type="button"
                  variant="outline"
                  onClick={addActivityLogRow}
                  className="w-full sm:w-auto"
                >
                  <Plus className="w-4 h-4" />
                  Add Activity
                </Button>

                <Button
                  type="button"
                  onClick={handleSaveActivityLogs}
                  disabled={isSavingActivityLogs}
                  className="w-full sm:w-auto"
                >
                  {isSavingActivityLogs ? 'Saving...' : 'Save Activity Logs'}
                </Button>
              </div>
            </CardContent>
          </Card>
        )}


        <Card className="overflow-hidden rounded-2xl border-neutral-200/80 shadow-sm">
          <CardHeader className="border-b border-neutral-100 p-5 sm:p-6">
            <div className="flex items-center justify-between gap-3">
              <div>
                <CardTitle className="text-lg font-semibold">
                  Attendance History
                </CardTitle>
                <CardDescription>Your most recent attendance records</CardDescription>
              </div>
              <div className="rounded-full bg-neutral-100 px-3 py-1 text-xs font-medium text-neutral-600">
                {attendanceHistory.length} records
              </div>
            </div>
          </CardHeader>
          <CardContent className="p-0">
            <div className="divide-y divide-neutral-100 md:hidden">
              {attendanceHistory.length === 0 ? (
                <div className="px-5 py-10 text-center text-sm text-neutral-500">
                  No attendance records found
                </div>
              ) : (
                attendanceHistory.map((record) => {
                  const hasPendingRequest =
                    pendingRequestAttendanceIds.includes(record.id);

                  return (
                    <div key={record.id} className="space-y-4 p-5">
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <p className="font-medium text-neutral-900">
                            {formatDate(record.date)}
                          </p>
                          <p className="mt-1 text-xs text-neutral-500">
                            {formatTime(record.clockIn)} –{" "}
                            {record.clockOut
                              ? formatTime(record.clockOut)
                              : "Not clocked out"}
                          </p>
                        </div>
                        <Badge variant={getStatusBadgeVariant(record.status)}>
                          {record.status}
                        </Badge>
                      </div>
                      <Button
                        variant="outline"
                        size="sm"
                        className="w-full"
                        disabled={hasPendingRequest}
                        onClick={() => handleOpenPunchDialog(record)}
                      >
                        <FileEdit className="mr-2 h-4 w-4" />
                        {hasPendingRequest
                          ? "Alteration request pending"
                          : "Request punch alteration"}
                      </Button>
                    </div>
                  );
                })
              )}
            </div>

            <div className="hidden md:block">
              <Table>
                <TableHeader className="bg-neutral-50/80">
                  <TableRow>
                    <TableHead>Date</TableHead>
                    <TableHead>Clock In</TableHead>
                    <TableHead>Clock Out</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Action</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {attendanceHistory.length === 0 ? (
                    <TableRow>
                      <TableCell
                        colSpan={5}
                        className="py-10 text-center text-neutral-500"
                      >
                        No attendance records found
                      </TableCell>
                    </TableRow>
                  ) : (
                    attendanceHistory.map((record) => {
                      const hasPendingRequest =
                        pendingRequestAttendanceIds.includes(record.id);

                      return (
                        <TableRow key={record.id}>
                          <TableCell>{formatDate(record.date)}</TableCell>
                          <TableCell>{formatTime(record.clockIn)}</TableCell>
                          <TableCell>
                            {record.clockOut ? formatTime(record.clockOut) : "-"}
                          </TableCell>
                          <TableCell>
                            <Badge variant={getStatusBadgeVariant(record.status)}>
                              {record.status}
                            </Badge>
                          </TableCell>
                          <TableCell>
                            <Button
                              variant="outline"
                              size="sm"
                              disabled={hasPendingRequest}
                              onClick={() => handleOpenPunchDialog(record)}
                            >
                              <FileEdit className="mr-2 h-4 w-4" />
                              {hasPendingRequest
                                ? "Request Pending"
                                : "Request Alteration"}
                            </Button>
                          </TableCell>
                        </TableRow>
                      );
                    })
                  )}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>

        <Dialog
          open={isAnnouncementDialogOpen}
          onOpenChange={(open) => !open && closeAnnouncementDialog()}
        >
          <DialogContent
            onClose={closeAnnouncementDialog}
            className="max-w-2xl max-h-[90vh] flex flex-col overflow-hidden"
          >
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <Megaphone className="w-5 h-5" />
                Announcements
              </DialogTitle>
              <DialogDescription>
                Latest announcements from HRIS management.
              </DialogDescription>
            </DialogHeader>

            <DialogBody className="min-h-0 overflow-y-auto">
              {currentAnnouncement && (
                <div className="space-y-4">
                  <div className="rounded-lg border border-neutral-200 bg-neutral-50 p-4">
                    <div className="mb-3 flex flex-wrap items-start justify-between gap-3">
                      <div>
                        <p className="mb-1 text-xs text-neutral-500">
                          {currentAnnouncementIndex + 1} of {announcements.length}
                        </p>
                        <h3 className="text-base font-medium text-neutral-900">
                          {currentAnnouncement.title}
                        </h3>
                      </div>
                      <Badge
                        variant={
                          currentAnnouncement.severity === 'urgent'
                            ? 'danger'
                            : currentAnnouncement.severity === 'warning'
                            ? 'warning'
                            : 'default'
                        }
                      >
                        {currentAnnouncement.severity}
                      </Badge>
                    </div>

                    {currentAnnouncement.image_url &&
                      !announcementImageErrors.includes(currentAnnouncement.id) && (
                        <div className="mb-3 overflow-hidden rounded-lg border border-neutral-200 bg-white">
                          <img
                            src={currentAnnouncement.image_url}
                            alt={currentAnnouncement.title}
                            className="max-h-80 w-full object-contain"
                            onError={() =>
                              handleAnnouncementImageError(currentAnnouncement.id)
                            }
                          />
                        </div>
                      )}

                    {currentAnnouncement.image_url &&
                      announcementImageErrors.includes(currentAnnouncement.id) && (
                        <div className="mb-3 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-700">
                          <div>Announcement image is unavailable.</div>
                          <a
                            href={currentAnnouncement.image_url}
                            target="_blank"
                            rel="noreferrer"
                            className="mt-1 inline-block text-amber-800 underline"
                          >
                            Open image
                          </a>
                        </div>
                      )}

                    <p className="whitespace-pre-wrap text-sm text-neutral-700">
                      {currentAnnouncementMessage}
                    </p>

                    {isCurrentAnnouncementLong && (
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        className="mt-3 px-0 text-neutral-900"
                        onClick={() =>
                          toggleFullAnnouncement(currentAnnouncement.id)
                        }
                      >
                        {isCurrentAnnouncementExpanded
                          ? "Show less"
                          : "Read full announcement"}
                      </Button>
                    )}
                  </div>

                  {announcements.length > 1 && (
                    <div className="flex items-center justify-between gap-3">
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={goToPreviousAnnouncement}
                        className="flex items-center gap-1"
                      >
                        <ChevronLeft className="h-4 w-4" />
                        Previous
                      </Button>

                      <div className="flex items-center gap-1">
                        {announcements.map((announcement, index) => (
                          <button
                            key={announcement.id}
                            type="button"
                            aria-label={`Show announcement ${index + 1}`}
                            onClick={() => setCurrentAnnouncementIndex(index)}
                            className={`h-2.5 w-2.5 rounded-full transition-colors ${
                              index === currentAnnouncementIndex
                                ? 'bg-neutral-900'
                                : 'bg-neutral-300'
                            }`}
                          />
                        ))}
                      </div>

                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={goToNextAnnouncement}
                        className="flex items-center gap-1"
                      >
                        Next
                        <ChevronRight className="h-4 w-4" />
                      </Button>
                    </div>
                  )}
                </div>
              )}
            </DialogBody>

            <DialogFooter>
              <Button type="button" onClick={closeAnnouncementDialog}>
                Close
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        <Dialog open={isPunchDialogOpen} onOpenChange={(open) => !open && handleClosePunchDialog()}>
          <DialogContent
            onClose={handleClosePunchDialog}
            className="w-full max-w-xl max-h-[90vh] overflow-hidden p-0 flex flex-col"
          >
            <DialogHeader className="px-6 pt-6 pb-4 border-b">
              <DialogTitle>Request Punch Alteration</DialogTitle>
              <DialogDescription>
                Submit a request to correct your time in or time out for this attendance record.
              </DialogDescription>
            </DialogHeader>

            <form onSubmit={handleSubmitPunchAlterationRequest} className="flex-1 flex flex-col min-h-0">
              <DialogBody className="flex-1 overflow-y-auto px-6 py-4 min-h-0">
                {punchError && (
                  <div className="mb-4 bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg text-sm">
                    {punchError}
                  </div>
                )}

                {punchSuccess && (
                  <div className="mb-4 bg-green-50 border border-green-200 text-green-700 px-4 py-3 rounded-lg text-sm">
                    {punchSuccess}
                  </div>
                )}

                {selectedAttendance && (
                  <div className="space-y-4">
                    <div className="rounded-lg bg-neutral-50 border border-neutral-200 p-4">
                      <div className="grid grid-cols-2 gap-4 text-sm">
                        <div>
                          <p className="text-neutral-500 mb-1">Date</p>
                          <p className="text-neutral-900">{formatDate(selectedAttendance.date)}</p>
                        </div>
                        <div>
                          <p className="text-neutral-500 mb-1">Status</p>
                          <p className="text-neutral-900 capitalize">{selectedAttendance.status}</p>
                        </div>
                        <div>
                          <p className="text-neutral-500 mb-1">Current Time In</p>
                          <p className="text-neutral-900">{formatTime(selectedAttendance.clockIn)}</p>
                        </div>
                        <div>
                          <p className="text-neutral-500 mb-1">Current Time Out</p>
                          <p className="text-neutral-900">
                            {selectedAttendance.clockOut ? formatTime(selectedAttendance.clockOut) : '-'}
                          </p>
                        </div>
                      </div>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div>
                        <label className="block text-sm text-neutral-700 mb-2">Requested Time In</label>
                        <input
                          type="time"
                          value={punchAlterationForm.requested_clock_in}
                          onChange={(e) =>
                            setPunchAlterationForm((prev) => ({
                              ...prev,
                              requested_clock_in: e.target.value,
                            }))
                          }
                          className="w-full rounded-lg border border-neutral-300 px-3 py-2 text-sm"
                        />
                      </div>

                      <div>
                        <label className="block text-sm text-neutral-700 mb-2">Requested Time Out</label>
                        <input
                          type="time"
                          value={punchAlterationForm.requested_clock_out}
                          onChange={(e) =>
                            setPunchAlterationForm((prev) => ({
                              ...prev,
                              requested_clock_out: e.target.value,
                            }))
                          }
                          className="w-full rounded-lg border border-neutral-300 px-3 py-2 text-sm"
                        />
                      </div>
                    </div>

                    <div>
                      <label className="block text-sm text-neutral-700 mb-2">Reason for Request</label>
                      <textarea
                        value={punchAlterationForm.request_reason}
                        onChange={(e) =>
                          setPunchAlterationForm((prev) => ({
                            ...prev,
                            request_reason: e.target.value,
                          }))
                        }
                        rows={4}
                        className="w-full rounded-lg border border-neutral-300 px-3 py-2 text-sm"
                        placeholder="Explain why your punch record needs correction"
                        required
                      />
                    </div>
                  </div>
                )}
              </DialogBody>

              <DialogFooter className="px-6 py-4 border-t bg-white shrink-0">
                <Button
                  type="button"
                  variant="outline"
                  onClick={handleClosePunchDialog}
                  disabled={isPunchSubmitting}
                >
                  Cancel
                </Button>
                <Button type="submit" disabled={isPunchSubmitting}>
                  {isPunchSubmitting ? 'Submitting...' : 'Submit Request'}
                </Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>
      </div>
    </UserLayout>
  );
}
