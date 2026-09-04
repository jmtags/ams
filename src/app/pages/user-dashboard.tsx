import { ChangeEvent, useEffect, useMemo, useRef, useState } from 'react';
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
  Camera,
  LoaderCircle,
  Pause,
  Play,
  CalendarDays,
  Wallet,
  CalendarClock,
  UserRound,
  MapPin,
  BriefcaseBusiness,
  RefreshCw,
  X,
  CircleAlert,
  Timer,
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
import { Skeleton } from '../components/ui/skeleton';
import {
  Avatar,
  AvatarFallback,
  AvatarImage,
} from '../components/ui/avatar';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogBody,
  DialogFooter,
} from '../components/ui/dialog';
import {
  attendanceService,
  type TodayOverview,
} from "../services/attendance.service";
import { attendanceActivityLogService } from "../services/attendance-activity-log.service";
import { locationService } from "../services/location.service";
import { attendanceAdjustmentRequestService } from "../services/attendance-adjustment-request.service";
import {
  announcementService,
  type Announcement,
} from "../services/announcement.service";
import { appSettingsService } from "../services/app-settings.service";
import { userService } from "../services/user.service";
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
const ANNOUNCEMENT_ROTATION_INTERVAL_MS = 12000;
const ATTENDANCE_HEATMAP_DAYS = 91;
const heatmapDayLabels = ["", "Mon", "", "Wed", "", "Fri", ""];

const heatmapStatusStyles: Record<string, { className: string; label: string }> = {
  present: { className: "bg-emerald-600", label: "Present" },
  overtime: { className: "bg-emerald-700", label: "Overtime" },
  late: { className: "bg-amber-400", label: "Late" },
  late_overtime: { className: "bg-amber-500", label: "Late + overtime" },
  absent: { className: "bg-red-500", label: "Absent" },
  holiday: { className: "bg-sky-300", label: "Holiday" },
  restday: { className: "bg-slate-300", label: "Rest day" },
  holiday_restday: { className: "bg-sky-400", label: "Holiday + rest day" },
  worked_holiday: { className: "bg-teal-500", label: "Worked holiday" },
  worked_restday: { className: "bg-teal-600", label: "Worked rest day" },
  worked_holiday_restday: {
    className: "bg-teal-700",
    label: "Worked holiday + rest day",
  },
};

const formatHeatmapDateKey = (date: Date) => {
  const year = date.getFullYear();
  const month = `${date.getMonth() + 1}`.padStart(2, "0");
  const day = `${date.getDate()}`.padStart(2, "0");
  return `${year}-${month}-${day}`;
};

const getRecentHeatmapDates = () => {
  const today = new Date();
  const start = new Date(today);
  start.setDate(today.getDate() - ATTENDANCE_HEATMAP_DAYS + 1);

  const dates: Date[] = [];
  const cursor = new Date(start);

  while (cursor <= today) {
    dates.push(new Date(cursor));
    cursor.setDate(cursor.getDate() + 1);
  }

  return dates;
};

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

function formatShiftTime(time?: string | null) {
  if (!time) return "--:--";
  const [hourString, minute = "00"] = time.split(":");
  const hour = Number(hourString);
  const suffix = hour >= 12 ? "PM" : "AM";
  const displayHour = hour % 12 || 12;
  return `${displayHour}:${minute} ${suffix}`;
}

function formatMinuteDuration(totalMinutes: number) {
  const safeMinutes = Math.max(0, Math.round(totalMinutes));
  const hours = Math.floor(safeMinutes / 60);
  const minutes = safeMinutes % 60;

  if (hours === 0) return `${minutes} min`;
  if (minutes === 0) return `${hours} hr${hours === 1 ? "" : "s"}`;
  return `${hours} hr ${minutes} min`;
}

function getShiftTimingLabel(
  overview: TodayOverview | null,
  attendance: AttendanceRecord | null,
  now: Date
) {
  if (!overview) return "No shift assigned";
  if (overview.isHoliday && overview.isRestDay) return "Holiday and rest day";
  if (overview.isHoliday) return "Holiday today";
  if (overview.isRestDay) return "Scheduled rest day";
  if (attendance?.clockOut) return "Shift completed";

  const start = new Date(
    `${overview.date}T${overview.startTime}+08:00`
  );
  let end = new Date(`${overview.date}T${overview.endTime}+08:00`);
  if (end <= start) {
    end = new Date(end.getTime() + 24 * 60 * 60 * 1000);
  }

  const minutesUntilStart = (start.getTime() - now.getTime()) / 60000;
  const minutesUntilEnd = (end.getTime() - now.getTime()) / 60000;

  if (attendance?.clockIn) {
    return minutesUntilEnd > 0
      ? `${formatMinuteDuration(minutesUntilEnd)} remaining`
      : `Shift ended ${formatMinuteDuration(-minutesUntilEnd)} ago`;
  }

  if (minutesUntilStart > 0) {
    return `Starts in ${formatMinuteDuration(minutesUntilStart)}`;
  }

  const graceEnds = new Date(
    start.getTime() + overview.graceMinutes * 60 * 1000
  );
  const minutesUntilGraceEnds =
    (graceEnds.getTime() - now.getTime()) / 60000;

  if (minutesUntilGraceEnds > 0) {
    return `Grace period · ${formatMinuteDuration(minutesUntilGraceEnds)} left`;
  }

  return `${formatMinuteDuration(-minutesUntilGraceEnds)} late`;
}

export function UserDashboardPage() {
  const { user, updateUser } = useAuth();
  const navigate = useNavigate();
  const profilePictureInputRef = useRef<HTMLInputElement>(null);
  const [currentTime, setCurrentTime] = useState(new Date());

  const [attendanceHistory, setAttendanceHistory] = useState<AttendanceRecord[]>([]);
  const [attendanceHeatmapHistory, setAttendanceHeatmapHistory] = useState<AttendanceRecord[]>([]);
  const [todayAttendance, setTodayAttendance] = useState<AttendanceRecord | null>(null);
  const [todayOverview, setTodayOverview] = useState<TodayOverview | null>(null);
  const [locations, setLocations] = useState<Location[]>([]);

  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [lastUpdatedAt, setLastUpdatedAt] = useState<Date | null>(null);
  const [isProfileReminderDismissed, setIsProfileReminderDismissed] =
    useState(false);

  const [error, setError] = useState('');
  const [isUploadingProfilePicture, setIsUploadingProfilePicture] =
    useState(false);
  const [profilePictureError, setProfilePictureError] = useState('');

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
  const [isAnnouncementCarouselPaused, setIsAnnouncementCarouselPaused] =
    useState(false);
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
    if (
      !isAnnouncementDialogOpen ||
      isAnnouncementCarouselPaused ||
      announcements.length <= 1
    ) {
      return;
    }

    const timer = setInterval(() => {
      setCurrentAnnouncementIndex((prev) => (prev + 1) % announcements.length);
    }, ANNOUNCEMENT_ROTATION_INTERVAL_MS);

    return () => clearInterval(timer);
  }, [
    announcements.length,
    isAnnouncementCarouselPaused,
    isAnnouncementDialogOpen,
  ]);

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

  const loadAnnouncements = async (showPopup = true) => {
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
      setIsAnnouncementCarouselPaused(false);

      if (
        showPopup &&
        config.showAnnouncementPopup &&
        activeAnnouncements.length > 0
      ) {
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

  const loadAllData = async (manualRefresh = false) => {
    if (!user?.id) return;

    try {
      if (manualRefresh) {
        setIsRefreshing(true);
      } else {
        setIsLoading(true);
      }
      setError('');

      const [history, heatmapHistory, today, locs, overview] = await Promise.all([
        attendanceService.getAttendanceHistory(user.id, 10),
        attendanceService.getAttendanceHistory(user.id, ATTENDANCE_HEATMAP_DAYS),
        attendanceService.getTodayAttendance(user.id),
        locationService.getAllLocations(),
        attendanceService.getTodayOverview(user.id).catch((overviewError) => {
          console.error("Error loading today's overview:", overviewError);
          return null;
        }),
      ]);

      setAttendanceHistory(history);
      setAttendanceHeatmapHistory(heatmapHistory);
      setTodayAttendance(today);
      setLocations(locs);
      setTodayOverview(overview);

      await Promise.all([
        loadTodayShiftRequirementAndLogs(user.id),
        loadAnnouncements(!manualRefresh),
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
      setLastUpdatedAt(new Date());
    } catch (err: any) {
      setError(err.message || 'Failed to load dashboard data.');
    } finally {
      if (manualRefresh) {
        setIsRefreshing(false);
      } else {
        setIsLoading(false);
      }
    }
  };

  const loadAttendance = async () => {
    if (!user?.id) return;

    try {
      const [history, heatmapHistory, today, overview] = await Promise.all([
        attendanceService.getAttendanceHistory(user.id, 10),
        attendanceService.getAttendanceHistory(user.id, ATTENDANCE_HEATMAP_DAYS),
        attendanceService.getTodayAttendance(user.id),
        attendanceService.getTodayOverview(user.id).catch((overviewError) => {
          console.error("Error refreshing today's overview:", overviewError);
          return null;
        }),
      ]);

      setAttendanceHistory(history);
      setAttendanceHeatmapHistory(heatmapHistory);
      setTodayAttendance(today);
      setTodayOverview(overview);

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
      setLastUpdatedAt(new Date());
    } catch (err) {
      console.error("Error loading attendance:", err);
    }
  };

  const handleClockIn = async () => {
    if (!user?.id) return;

    const clockInLocationId =
      todayOverview?.locationId ?? locations?.[0]?.id ?? null;

    if (!clockInLocationId) {
      setError("Your shift does not have an assigned clock-in location.");
      return;
    }

    try {
      setIsLoading(true);
      setError('');

      const record = await attendanceService.clockIn(
        user.id,
        clockInLocationId
      );
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

  const handleProfilePictureChange = async (
    event: ChangeEvent<HTMLInputElement>
  ) => {
    const file = event.target.files?.[0];
    event.target.value = "";

    if (!file || !user?.id) return;

    try {
      setIsUploadingProfilePicture(true);
      setProfilePictureError("");
      const updatedUser = await userService.uploadProfilePicture(user.id, file);
      updateUser(updatedUser);
    } catch (err) {
      setProfilePictureError(
        err instanceof Error ? err.message : "Failed to upload profile picture."
      );
    } finally {
      setIsUploadingProfilePicture(false);
    }
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
    if (!expandedAnnouncementIds.includes(announcementId)) {
      setIsAnnouncementCarouselPaused(true);
    }

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
  const attendanceHeatmap = useMemo(() => {
    const recordsByDate = new Map(
      attendanceHeatmapHistory.map((record) => [record.date, record])
    );
    const dates = getRecentHeatmapDates();
    const firstDayOffset = dates[0]?.getDay() ?? 0;
    const cells: Array<{
      key: string;
      dayIndex: number;
      className: string;
      title: string;
      monthLabel?: string;
    }> = [];

    for (let index = 0; index < firstDayOffset; index += 1) {
      cells.push({
        key: `empty-${index}`,
        dayIndex: index,
        className: "bg-transparent",
        title: "",
      });
    }

    dates.forEach((date, index) => {
      const key = formatHeatmapDateKey(date);
      const record = recordsByDate.get(key);
      const status = String(record?.status ?? "");
      const style = heatmapStatusStyles[status];

      cells.push({
        key,
        dayIndex: date.getDay(),
        className: style?.className ?? "bg-neutral-200",
        title: record
          ? `${formatDate(key)} | ${style?.label ?? record.status}`
          : `${formatDate(key)} | No record`,
        monthLabel:
          date.getDate() <= 7 && (index === 0 || date.getDate() === 1)
            ? date.toLocaleDateString("en-US", { month: "short" })
            : undefined,
      });
    });

    return {
      cells,
      weekCount: Math.max(1, Math.ceil(cells.length / 7)),
    };
  }, [attendanceHeatmapHistory]);
  const attendanceState = todayAttendance?.clockOut
    ? "Shift completed"
    : todayAttendance?.clockIn
    ? "Currently clocked in"
    : "Ready to clock in";
  const assignedLocation =
    locations.find((location) => location.id === todayOverview?.locationId) ??
    null;
  const shiftTimingLabel = getShiftTimingLabel(
    todayOverview,
    todayAttendance,
    currentTime
  );
  const missingProfileFields = [
    !user?.profile_picture_url ? "profile photo" : null,
    !user?.sss?.trim() ? "SSS number" : null,
    !user?.pagibig?.trim() ? "Pag-IBIG number" : null,
    !user?.philhealth?.trim() ? "PhilHealth number" : null,
    !user?.atm_number?.trim() ? "ATM number" : null,
  ].filter((field): field is string => Boolean(field));
  const isProfilePhotoMissing = !user?.profile_picture_url;
  const hasMissingProfileDetails = missingProfileFields.some(
    (field) => field !== "profile photo"
  );
  const quickLinks = [
    { label: "Leave", href: "/my-leave", icon: CalendarDays },
    { label: "Payroll", href: "/my-payroll", icon: Wallet },
    { label: "Policies", href: "/policies", icon: BookOpen },
    {
      label: "Shift Change",
      href: "/shift-change-requests",
      icon: CalendarClock,
    },
    { label: "Profile", href: "/profile", icon: UserRound },
  ];
  const isInitialLoading = isLoading && !lastUpdatedAt;

  if (isInitialLoading) {
    return (
      <UserLayout>
        <div
          className="mx-auto w-full max-w-7xl space-y-5 sm:space-y-6"
          aria-label="Loading employee dashboard"
          aria-busy="true"
        >
          <Skeleton className="h-52 w-full rounded-3xl" />
          <div className="grid grid-cols-5 gap-2 sm:gap-3">
            {Array.from({ length: 5 }).map((_, index) => (
              <Skeleton key={index} className="h-20 rounded-2xl" />
            ))}
          </div>
          <Skeleton className="h-36 w-full rounded-2xl" />
          <div className="grid grid-cols-1 gap-5 xl:grid-cols-[minmax(0,1.65fr)_minmax(280px,0.65fr)]">
            <Skeleton className="h-96 rounded-2xl" />
            <Skeleton className="h-96 rounded-2xl" />
          </div>
        </div>
      </UserLayout>
    );
  }

  return (
    <UserLayout>
      <div className="mx-auto w-full max-w-7xl space-y-5 sm:space-y-6">
        <div className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-neutral-950 via-neutral-900 to-slate-800 px-5 py-6 text-white shadow-xl shadow-neutral-900/10 sm:px-8 sm:py-8">
          <div className="pointer-events-none absolute -right-16 -top-24 h-64 w-64 rounded-full bg-white/10 blur-3xl" />
          <div className="pointer-events-none absolute -bottom-28 left-1/3 h-56 w-56 rounded-full bg-blue-400/10 blur-3xl" />
          <div className="relative flex flex-col gap-6 sm:flex-row sm:items-end sm:justify-between">
            <div className="flex items-center gap-4 sm:gap-5">
              <div className="shrink-0">
                <input
                  ref={profilePictureInputRef}
                  type="file"
                  accept="image/jpeg,image/png,image/webp"
                  className="sr-only"
                  onChange={handleProfilePictureChange}
                  disabled={isUploadingProfilePicture}
                />
                <button
                  type="button"
                  onClick={() => profilePictureInputRef.current?.click()}
                  disabled={isUploadingProfilePicture}
                  className="group relative rounded-full focus:outline-none focus-visible:ring-2 focus-visible:ring-white focus-visible:ring-offset-2 focus-visible:ring-offset-neutral-900 disabled:cursor-wait"
                  aria-label="Upload profile picture"
                  title="Upload profile picture"
                >
                  <Avatar className="h-20 w-20 border-2 border-white/30 bg-white/10 shadow-lg sm:h-24 sm:w-24">
                    {user?.profile_picture_url && (
                      <AvatarImage
                        src={user.profile_picture_url}
                        alt={`${user.name || "Employee"} profile`}
                        className="object-cover"
                      />
                    )}
                    <AvatarFallback className="bg-white/10 text-xl font-semibold text-white sm:text-2xl">
                      {(user?.name || user?.email || "E")
                        .split(/\s+/)
                        .slice(0, 2)
                        .map((part) => part[0]?.toUpperCase())
                        .join("")}
                    </AvatarFallback>
                  </Avatar>
                  <span className="absolute bottom-0 right-0 flex h-8 w-8 items-center justify-center rounded-full border-2 border-neutral-900 bg-white text-neutral-900 shadow-md transition-transform group-hover:scale-105">
                    {isUploadingProfilePicture ? (
                      <LoaderCircle className="h-4 w-4 animate-spin" />
                    ) : (
                      <Camera className="h-4 w-4" />
                    )}
                  </span>
                </button>
              </div>

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
                  {isUploadingProfilePicture
                    ? "Uploading your profile picture..."
                    : "Here is your attendance overview for today."}
                </p>
                {profilePictureError && (
                  <p className="mt-2 text-sm text-red-300" role="alert">
                    {profilePictureError}
                  </p>
                )}
              </div>
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
              <Button
                type="button"
                variant="outline"
                onClick={() => loadAllData(true)}
                disabled={isRefreshing}
                className="border-white/20 bg-white/10 text-white hover:bg-white/20"
                aria-label="Refresh dashboard data"
              >
                <RefreshCw
                  className={`mr-2 h-4 w-4 ${
                    isRefreshing ? "animate-spin" : ""
                  }`}
                />
                {isRefreshing ? "Refreshing..." : "Refresh"}
              </Button>
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
          {lastUpdatedAt && (
            <p className="relative mt-4 text-right text-xs text-neutral-400">
              Last updated{" "}
              {lastUpdatedAt.toLocaleTimeString("en-US", {
                hour: "numeric",
                minute: "2-digit",
                second: "2-digit",
              })}
            </p>
          )}
        </div>

        {missingProfileFields.length > 0 && !isProfileReminderDismissed && (
          <div className="flex flex-col gap-4 rounded-2xl border border-amber-200 bg-amber-50 px-4 py-4 sm:flex-row sm:items-center sm:justify-between sm:px-5">
            <div className="flex min-w-0 gap-3">
              <CircleAlert className="mt-0.5 h-5 w-5 shrink-0 text-amber-700" />
              <div>
                <p className="font-medium text-amber-950">
                  Your profile is {5 - missingProfileFields.length} of 5 complete
                </p>
                <p className="mt-1 text-sm text-amber-800">
                  Add your {missingProfileFields.join(", ")} to complete your
                  employee profile.
                </p>
              </div>
            </div>
            <div className="flex shrink-0 items-center gap-2">
              {isProfilePhotoMissing && (
                <Button
                  type="button"
                  size="sm"
                  variant={hasMissingProfileDetails ? "outline" : "default"}
                  onClick={() => profilePictureInputRef.current?.click()}
                >
                  Upload Photo
                </Button>
              )}
              {hasMissingProfileDetails && (
                <Button
                  type="button"
                  size="sm"
                  onClick={() => navigate("/profile")}
                >
                  Complete Details
                </Button>
              )}
              <Button
                type="button"
                size="sm"
                variant="ghost"
                onClick={() => setIsProfileReminderDismissed(true)}
                aria-label="Dismiss profile reminder"
              >
                <X className="h-4 w-4" />
              </Button>
            </div>
          </div>
        )}

        <nav
          aria-label="Employee quick links"
          className="grid grid-cols-5 gap-2 sm:gap-3"
        >
          {quickLinks.map((link) => {
            const Icon = link.icon;
            return (
              <button
                key={link.href}
                type="button"
                onClick={() => navigate(link.href)}
                className="group flex min-w-0 flex-col items-center justify-center gap-2 rounded-2xl border border-neutral-200 bg-white px-2 py-3 text-center shadow-sm transition hover:-translate-y-0.5 hover:border-neutral-300 hover:shadow-md sm:flex-row sm:justify-start sm:px-4"
              >
                <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-neutral-100 text-neutral-700 transition group-hover:bg-neutral-900 group-hover:text-white">
                  <Icon className="h-4 w-4" />
                </span>
                <span className="truncate text-[11px] font-medium text-neutral-700 sm:text-sm">
                  {link.label}
                </span>
              </button>
            );
          })}
        </nav>

        <Card className="overflow-hidden rounded-2xl border-neutral-200/80 shadow-sm">
          <CardHeader className="border-b border-neutral-100 p-5 sm:p-6">
            <div className="flex items-center justify-between gap-3">
              <div>
                <CardTitle className="flex items-center gap-2 text-lg font-semibold">
                  <BriefcaseBusiness className="h-5 w-5" />
                  My Day
                </CardTitle>
                <CardDescription>
                  Today&apos;s assigned schedule and workday status
                </CardDescription>
              </div>
              {todayOverview?.shiftName && (
                <Badge variant="default">{todayOverview.shiftName}</Badge>
              )}
            </div>
          </CardHeader>
          <CardContent className="grid grid-cols-1 gap-3 p-5 sm:grid-cols-2 sm:p-6 lg:grid-cols-4">
            <div className="rounded-xl bg-neutral-50 p-4">
              <div className="flex items-center gap-2 text-xs font-medium uppercase tracking-wide text-neutral-500">
                <Clock className="h-4 w-4" />
                Shift hours
              </div>
              <p className="mt-2 font-semibold text-neutral-950">
                {todayOverview
                  ? `${formatShiftTime(todayOverview.startTime)} – ${formatShiftTime(
                      todayOverview.endTime
                    )}`
                  : "Not assigned"}
              </p>
            </div>

            <div className="rounded-xl bg-neutral-50 p-4">
              <div className="flex items-center gap-2 text-xs font-medium uppercase tracking-wide text-neutral-500">
                <MapPin className="h-4 w-4" />
                Location
              </div>
              <p className="mt-2 font-semibold text-neutral-950">
                {assignedLocation?.name || "Not assigned"}
              </p>
            </div>

            <div className="rounded-xl bg-neutral-50 p-4">
              <div className="flex items-center gap-2 text-xs font-medium uppercase tracking-wide text-neutral-500">
                <CalendarDays className="h-4 w-4" />
                Day status
              </div>
              <p className="mt-2 font-semibold text-neutral-950">
                {todayOverview?.isHoliday && todayOverview?.isRestDay
                  ? `${todayOverview.holidayName || "Holiday"} · Rest day`
                  : todayOverview?.isHoliday
                  ? todayOverview.holidayName || "Holiday"
                  : todayOverview?.isRestDay
                  ? "Rest day"
                  : todayOverview
                  ? "Regular workday"
                  : "Unavailable"}
              </p>
            </div>

            <div className="rounded-xl bg-neutral-950 p-4 text-white">
              <div className="flex items-center gap-2 text-xs font-medium uppercase tracking-wide text-neutral-400">
                <Timer className="h-4 w-4" />
                Live indicator
              </div>
              <p className="mt-2 font-semibold">{shiftTimingLabel}</p>
            </div>
          </CardContent>
        </Card>

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

            <Card className="rounded-2xl border-neutral-200/80 shadow-sm">
              <CardHeader className="p-5 pb-3 sm:p-6 sm:pb-3">
                <CardTitle className="text-lg font-semibold">
                  Attendance Activity
                </CardTitle>
                <CardDescription>Last 13 weeks</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4 p-5 pt-2 sm:p-6 sm:pt-2">
                <div className="overflow-x-auto pb-1">
                  <div
                    className="grid min-w-max gap-1"
                    style={{
                      gridTemplateColumns: `28px repeat(${attendanceHeatmap.weekCount}, 12px)`,
                      gridTemplateRows: "18px repeat(7, 12px)",
                    }}
                  >
                    <div />
                    {Array.from({ length: attendanceHeatmap.weekCount }).map(
                      (_, weekIndex) => {
                        const monthLabel = attendanceHeatmap.cells.find(
                          (cell, cellIndex) =>
                            Math.floor(cellIndex / 7) === weekIndex &&
                            cell.monthLabel
                        )?.monthLabel;

                        return (
                          <div
                            key={`month-${weekIndex}`}
                            className="text-[9px] leading-none text-neutral-500"
                          >
                            {monthLabel}
                          </div>
                        );
                      }
                    )}

                    {heatmapDayLabels.map((label, index) => (
                      <div
                        key={`day-${index}`}
                        className="text-[9px] leading-3 text-neutral-500"
                        style={{ gridColumn: 1, gridRow: index + 2 }}
                      >
                        {label}
                      </div>
                    ))}

                    {attendanceHeatmap.cells.map((cell, index) => (
                      <div
                        key={cell.key}
                        title={cell.title}
                        aria-label={cell.title || undefined}
                        className={`h-3 w-3 rounded-[3px] ${cell.className}`}
                        style={{
                          gridColumn: Math.floor(index / 7) + 2,
                          gridRow: cell.dayIndex + 2,
                        }}
                      />
                    ))}
                  </div>
                </div>

                <div className="flex flex-wrap items-center gap-x-3 gap-y-2 text-[11px] text-neutral-600">
                  <div className="flex items-center gap-1.5">
                    <span className="h-2.5 w-2.5 rounded-[3px] bg-emerald-600" />
                    Present
                  </div>
                  <div className="flex items-center gap-1.5">
                    <span className="h-2.5 w-2.5 rounded-[3px] bg-amber-400" />
                    Late
                  </div>
                  <div className="flex items-center gap-1.5">
                    <span className="h-2.5 w-2.5 rounded-[3px] bg-red-500" />
                    Absent
                  </div>
                  <div className="flex items-center gap-1.5">
                    <span className="h-2.5 w-2.5 rounded-[3px] bg-neutral-200" />
                    No record
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

                      <div className="flex flex-wrap items-center justify-center gap-3">
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
                          aria-pressed={isAnnouncementCarouselPaused}
                          onClick={() =>
                            setIsAnnouncementCarouselPaused((paused) => !paused)
                          }
                          className="flex items-center gap-1.5"
                        >
                          {isAnnouncementCarouselPaused ? (
                            <>
                              <Play className="h-3.5 w-3.5" />
                              Resume
                            </>
                          ) : (
                            <>
                              <Pause className="h-3.5 w-3.5" />
                              Pause
                            </>
                          )}
                        </Button>
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
