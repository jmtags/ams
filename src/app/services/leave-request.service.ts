import { supabase } from "../lib/supabase";

export interface LeaveRequest {
  id: string;
  user_id: string;
  leave_type_id: string;
  date_from: string;
  date_to: string;
  is_half_day: boolean;
  half_day_portion: "AM" | "PM" | null;
  total_days: number;
  reason: string | null;
  attachment_url: string | null;
  status: "pending" | "approved" | "rejected" | "cancelled";
  approver_id: string | null;
  approver_remarks: string | null;
  approved_at: string | null;
  rejected_at: string | null;
  cancelled_at: string | null;
  created_at: string;
  updated_at: string | null;
  leave_type_code?: string;
  leave_type_name?: string;
  requires_attachment?: boolean;
}

export interface CreateLeaveRequestPayload {
  user_id: string;
  leave_type_id: string;
  date_from: string;
  date_to: string;
  is_half_day: boolean;
  half_day_portion?: "AM" | "PM" | null;
  reason: string;
  attachment?: File | null;
}

const mapLeaveRequest = (record: any): LeaveRequest => ({
  id: record.id,
  user_id: record.user_id,
  leave_type_id: record.leave_type_id,
  date_from: record.date_from,
  date_to: record.date_to,
  is_half_day: Boolean(record.is_half_day),
  half_day_portion: record.half_day_portion ?? null,
  total_days: Number(record.total_days ?? 0),
  reason: record.reason ?? null,
  attachment_url: record.attachment_url ?? null,
  status: record.status,
  approver_id: record.approver_id ?? null,
  approver_remarks: record.approver_remarks ?? null,
  approved_at: record.approved_at ?? null,
  rejected_at: record.rejected_at ?? null,
  cancelled_at: record.cancelled_at ?? null,
  created_at: record.created_at,
  updated_at: record.updated_at ?? null,
  leave_type_code: record.leave_types?.code ?? "",
  leave_type_name: record.leave_types?.name ?? "",
  requires_attachment: Boolean(record.leave_types?.requires_attachment),
});

function enumerateDates(startDate: string, endDate: string) {
  const dates: string[] = [];
  const current = new Date(startDate);
  const end = new Date(endDate);

  while (current <= end) {
    dates.push(current.toISOString().slice(0, 10));
    current.setDate(current.getDate() + 1);
  }

  return dates;
}

function calculateTotalDays(
  dateFrom: string,
  dateTo: string,
  isHalfDay: boolean
): number {
  if (isHalfDay) return 0.5;

  const start = new Date(dateFrom);
  const end = new Date(dateTo);
  const diffTime = end.getTime() - start.getTime();
  const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24)) + 1;

  return diffDays > 0 ? diffDays : 0;
}

export const leaveRequestService = {
  async getMyLeaveRequests(userId: string): Promise<LeaveRequest[]> {
    const { data, error } = await supabase
      .from("leave_requests")
      .select(`
        *,
        leave_types (
          code,
          name,
          requires_attachment
        )
      `)
      .eq("user_id", userId)
      .order("created_at", { ascending: false });

    if (error) {
      throw new Error(error.message || "Failed to load leave requests.");
    }

    return (data ?? []).map(mapLeaveRequest);
  },

  async create(payload: CreateLeaveRequestPayload): Promise<LeaveRequest> {
    if (!payload.user_id) throw new Error("User is required.");
    if (!payload.leave_type_id) throw new Error("Leave type is required.");
    if (!payload.date_from) throw new Error("Start date is required.");
    if (!payload.date_to) throw new Error("End date is required.");
    if (!payload.reason?.trim()) throw new Error("Reason is required.");

    if (payload.is_half_day && payload.date_from !== payload.date_to) {
      throw new Error("Half day leave must use the same date for start and end.");
    }

    if (payload.is_half_day && !payload.half_day_portion) {
      throw new Error("Please select AM or PM for half day leave.");
    }

    const totalDays = calculateTotalDays(
      payload.date_from,
      payload.date_to,
      payload.is_half_day
    );

    if (totalDays <= 0) {
      throw new Error("Invalid leave duration.");
    }

    const { data: leaveTypeData, error: leaveTypeError } = await supabase
      .from("leave_types")
      .select("id, code, name, requires_attachment")
      .eq("id", payload.leave_type_id)
      .single();

    if (leaveTypeError || !leaveTypeData) {
      throw new Error("Leave type not found.");
    }

    if (leaveTypeData.requires_attachment && !payload.attachment) {
      throw new Error("Attachment is required for this leave type.");
    }

    const year = new Date(payload.date_from).getFullYear();

    const { data: balanceRow, error: balanceError } = await supabase
      .from("leave_balances")
      .select("*")
      .eq("user_id", payload.user_id)
      .eq("leave_type_id", payload.leave_type_id)
      .eq("year", year)
      .single();

    if (balanceError || !balanceRow) {
      throw new Error("Leave balance not found for the selected year.");
    }

    const available =
      Number(balanceRow.entitled ?? 0) -
      Number(balanceRow.used ?? 0) -
      Number(balanceRow.pending ?? 0);

    if (available < totalDays) {
      throw new Error(`Insufficient leave balance. Available: ${available}`);
    }

    const requestedDates = enumerateDates(payload.date_from, payload.date_to);

    const { data: overlapping, error: overlapError } = await supabase
      .from("leave_requests")
      .select("id, date_from, date_to, status")
      .eq("user_id", payload.user_id)
      .in("status", ["pending", "approved"]);

    if (overlapError) {
      throw new Error(overlapError.message || "Failed to validate overlapping leave.");
    }

    const hasOverlap = (overlapping ?? []).some((row: any) => {
      const existingDates = enumerateDates(row.date_from, row.date_to);
      return requestedDates.some((d) => existingDates.includes(d));
    });

    if (hasOverlap) {
      throw new Error("You already have an overlapping pending or approved leave request.");
    }

    let attachmentUrl: string | null = null;

    if (payload.attachment) {
      const fileExt = payload.attachment.name.split(".").pop();
      const filePath = `leave-attachments/${payload.user_id}/${Date.now()}.${fileExt}`;

      const { error: uploadError } = await supabase.storage
        .from("leave-attachments")
        .upload(filePath, payload.attachment, {
          upsert: false,
        });

      if (uploadError) {
        throw new Error(uploadError.message || "Failed to upload attachment.");
      }

      const {
        data: { publicUrl },
      } = supabase.storage.from("leave-attachments").getPublicUrl(filePath);

      attachmentUrl = publicUrl;
    }

    const { data, error } = await supabase
      .from("leave_requests")
      .insert([
        {
          user_id: payload.user_id,
          leave_type_id: payload.leave_type_id,
          date_from: payload.date_from,
          date_to: payload.date_to,
          is_half_day: payload.is_half_day,
          half_day_portion: payload.is_half_day ? payload.half_day_portion ?? null : null,
          total_days: totalDays,
          reason: payload.reason.trim(),
          attachment_url: attachmentUrl,
          status: "pending",
        },
      ])
      .select(`
        *,
        leave_types (
          code,
          name,
          requires_attachment
        )
      `)
      .single();

    if (error) {
      throw new Error(error.message || "Failed to create leave request.");
    }

    const { error: balanceUpdateError } = await supabase
      .from("leave_balances")
      .update({
        pending: Number(balanceRow.pending ?? 0) + totalDays,
        updated_at: new Date().toISOString(),
      })
      .eq("id", balanceRow.id);

    if (balanceUpdateError) {
      throw new Error(balanceUpdateError.message || "Leave filed but failed to update pending balance.");
    }

    return mapLeaveRequest(data);
  },

  async cancelLeaveRequest(requestId: string, userId: string): Promise<void> {
    const { data: requestRow, error: requestError } = await supabase
      .from("leave_requests")
      .select("*")
      .eq("id", requestId)
      .eq("user_id", userId)
      .single();

    if (requestError || !requestRow) {
      throw new Error("Leave request not found.");
    }

    if (requestRow.status !== "pending") {
      throw new Error("Only pending leave requests can be cancelled.");
    }

    const year = new Date(requestRow.date_from).getFullYear();

    const { data: balanceRow, error: balanceError } = await supabase
      .from("leave_balances")
      .select("*")
      .eq("user_id", userId)
      .eq("leave_type_id", requestRow.leave_type_id)
      .eq("year", year)
      .single();

    if (balanceError || !balanceRow) {
      throw new Error("Leave balance not found.");
    }

    const nextPending =
      Number(balanceRow.pending ?? 0) - Number(requestRow.total_days ?? 0);

    const { error: updateRequestError } = await supabase
      .from("leave_requests")
      .update({
        status: "cancelled",
        cancelled_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .eq("id", requestId)
      .eq("user_id", userId);

    if (updateRequestError) {
      throw new Error(updateRequestError.message || "Failed to cancel leave request.");
    }

    const { error: updateBalanceError } = await supabase
      .from("leave_balances")
      .update({
        pending: nextPending < 0 ? 0 : nextPending,
        updated_at: new Date().toISOString(),
      })
      .eq("id", balanceRow.id);

    if (updateBalanceError) {
      throw new Error(updateBalanceError.message || "Leave request cancelled but failed to update balance.");
    }
  }
};