import { supabase } from "../lib/supabase";

export interface AdminLeaveRequest {
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

  employee_name: string;
  employee_email: string | null;
  leave_type_code: string;
  leave_type_name: string;
}

export interface AdminLeaveRequestFilters {
  search?: string;
  status?: string;
  user_id?: string;
  leave_type_id?: string;
}

type LeaveRequestDateInsert = {
  leave_request_id: string;
  leave_date: string;
  day_value: number;
};

const formatDateOnly = (date: Date) => {
  const year = date.getFullYear();
  const month = `${date.getMonth() + 1}`.padStart(2, "0");
  const day = `${date.getDate()}`.padStart(2, "0");
  return `${year}-${month}-${day}`;
};

const getDatesBetween = (startDate: string, endDate: string) => {
  const dates: string[] = [];
  const current = new Date(`${startDate}T00:00:00`);
  const end = new Date(`${endDate}T00:00:00`);

  while (current <= end) {
    dates.push(formatDateOnly(current));
    current.setDate(current.getDate() + 1);
  }

  return dates;
};

const buildLeaveRequestDateRows = (
  requestId: string,
  dateFrom: string,
  dateTo: string,
  isHalfDay: boolean
): LeaveRequestDateInsert[] => {
  const dates = getDatesBetween(dateFrom, dateTo);

  return dates.map((date) => ({
    leave_request_id: requestId,
    leave_date: date,
    day_value: isHalfDay && dates.length === 1 ? 0.5 : 1,
  }));
};

const replaceLeaveRequestDates = async (
  requestId: string,
  dateFrom: string,
  dateTo: string,
  isHalfDay: boolean
) => {
  const { error: deleteError } = await supabase
    .from("leave_request_dates")
    .delete()
    .eq("leave_request_id", requestId);

  if (deleteError) {
    throw new Error(deleteError.message || "Failed to clear old leave dates.");
  }

  const rows = buildLeaveRequestDateRows(requestId, dateFrom, dateTo, isHalfDay);

  if (rows.length === 0) return;

  const { error: insertError } = await supabase
    .from("leave_request_dates")
    .insert(rows);

  if (insertError) {
    throw new Error(insertError.message || "Failed to create leave date rows.");
  }
};

const removeLeaveRequestDates = async (requestId: string) => {
  const { error } = await supabase
    .from("leave_request_dates")
    .delete()
    .eq("leave_request_id", requestId);

  if (error) {
    throw new Error(error.message || "Failed to delete leave date rows.");
  }
};

const mapLeaveRequest = (record: any): AdminLeaveRequest => ({
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
  employee_name: record.employee?.name ?? record.users?.name ?? "",
  employee_email: record.employee?.email ?? record.users?.email ?? null,
  leave_type_code: record.leave_types?.code ?? "",
  leave_type_name: record.leave_types?.name ?? "",
});

export const adminLeaveRequestService = {
  async getAll(filters?: AdminLeaveRequestFilters): Promise<AdminLeaveRequest[]> {
    let query = supabase
      .from("leave_requests")
      .select(`
        *,
        employee:users!leave_requests_user_id_fkey (
          id,
          name,
          email
        ),
        approver:users!leave_requests_approver_id_fkey (
          id,
          name,
          email
        ),
        leave_types (
          id,
          code,
          name
        )
      `)
      .order("created_at", { ascending: false });

    if (filters?.status && filters.status !== "all") {
      query = query.eq("status", filters.status);
    }

    if (filters?.user_id && filters.user_id !== "all") {
      query = query.eq("user_id", filters.user_id);
    }

    if (filters?.leave_type_id && filters.leave_type_id !== "all") {
      query = query.eq("leave_type_id", filters.leave_type_id);
    }

    const { data, error } = await query;

    if (error) {
      throw new Error(error.message || "Failed to load leave requests.");
    }

    let results = (data ?? []).map(mapLeaveRequest);

    if (filters?.search?.trim()) {
      const keyword = filters.search.trim().toLowerCase();

      results = results.filter((item) => {
        return (
          item.employee_name.toLowerCase().includes(keyword) ||
          (item.employee_email ?? "").toLowerCase().includes(keyword) ||
          item.leave_type_code.toLowerCase().includes(keyword) ||
          item.leave_type_name.toLowerCase().includes(keyword) ||
          (item.reason ?? "").toLowerCase().includes(keyword) ||
          item.status.toLowerCase().includes(keyword) ||
          item.date_from.toLowerCase().includes(keyword) ||
          item.date_to.toLowerCase().includes(keyword)
        );
      });
    }

    return results;
  },

  async approve(
    requestId: string,
    approverId: string,
    remarks?: string | null
  ): Promise<void> {
    const { data: requestRow, error: requestError } = await supabase
      .from("leave_requests")
      .select("*")
      .eq("id", requestId)
      .single();

    if (requestError || !requestRow) {
      throw new Error("Leave request not found.");
    }

    if (requestRow.status !== "pending") {
      throw new Error("Only pending leave requests can be approved.");
    }

    const year = new Date(requestRow.date_from).getFullYear();

    const { data: balanceRow, error: balanceError } = await supabase
      .from("leave_balances")
      .select("*")
      .eq("user_id", requestRow.user_id)
      .eq("leave_type_id", requestRow.leave_type_id)
      .eq("year", year)
      .single();

    if (balanceError || !balanceRow) {
      throw new Error("Leave balance not found.");
    }

    const currentPending = Number(balanceRow.pending ?? 0);
    const currentUsed = Number(balanceRow.used ?? 0);
    const totalDays = Number(requestRow.total_days ?? 0);

    const nextPending = Math.max(0, currentPending - totalDays);
    const nextUsed = currentUsed + totalDays;

    const nowIso = new Date().toISOString();

    const { error: updateRequestError } = await supabase
      .from("leave_requests")
      .update({
        status: "approved",
        approver_id: approverId,
        approver_remarks: remarks?.trim() || null,
        approved_at: nowIso,
        rejected_at: null,
        cancelled_at: null,
        updated_at: nowIso,
      })
      .eq("id", requestId);

    if (updateRequestError) {
      throw new Error(updateRequestError.message || "Failed to approve leave request.");
    }

    const { error: updateBalanceError } = await supabase
      .from("leave_balances")
      .update({
        pending: nextPending,
        used: nextUsed,
        updated_at: nowIso,
      })
      .eq("id", balanceRow.id);

    if (updateBalanceError) {
      throw new Error(updateBalanceError.message || "Leave approved but balance update failed.");
    }

    await replaceLeaveRequestDates(
      requestId,
      requestRow.date_from,
      requestRow.date_to,
      Boolean(requestRow.is_half_day)
    );
  },

  async reject(
    requestId: string,
    approverId: string,
    remarks?: string | null
  ): Promise<void> {
    const { data: requestRow, error: requestError } = await supabase
      .from("leave_requests")
      .select("*")
      .eq("id", requestId)
      .single();

    if (requestError || !requestRow) {
      throw new Error("Leave request not found.");
    }

    if (requestRow.status !== "pending") {
      throw new Error("Only pending leave requests can be rejected.");
    }

    const year = new Date(requestRow.date_from).getFullYear();

    const { data: balanceRow, error: balanceError } = await supabase
      .from("leave_balances")
      .select("*")
      .eq("user_id", requestRow.user_id)
      .eq("leave_type_id", requestRow.leave_type_id)
      .eq("year", year)
      .single();

    if (balanceError || !balanceRow) {
      throw new Error("Leave balance not found.");
    }

    const currentPending = Number(balanceRow.pending ?? 0);
    const totalDays = Number(requestRow.total_days ?? 0);
    const nextPending = Math.max(0, currentPending - totalDays);

    const nowIso = new Date().toISOString();

    const { error: updateRequestError } = await supabase
      .from("leave_requests")
      .update({
        status: "rejected",
        approver_id: approverId,
        approver_remarks: remarks?.trim() || null,
        rejected_at: nowIso,
        approved_at: null,
        cancelled_at: null,
        updated_at: nowIso,
      })
      .eq("id", requestId);

    if (updateRequestError) {
      throw new Error(updateRequestError.message || "Failed to reject leave request.");
    }

    const { error: updateBalanceError } = await supabase
      .from("leave_balances")
      .update({
        pending: nextPending,
        updated_at: nowIso,
      })
      .eq("id", balanceRow.id);

    if (updateBalanceError) {
      throw new Error(updateBalanceError.message || "Leave rejected but balance update failed.");
    }

    await removeLeaveRequestDates(requestId);
  },
};