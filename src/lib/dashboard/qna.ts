import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/types/database";
import type { QnaMessageRow } from "@/components/features/qna-thread";
import { createDateTimeFormatter } from "@/lib/format-date";

/**
 * Batch-loads the Q&A thread (open_qna_thread(), 0148) for every 'qna_open'
 * enrollment a teacher/institute Students tab needs to render at once —
 * two queries total regardless of how many rows, same "batch it, don't
 * N+1" convention as everywhere else in these dashboard loaders.
 */
export async function loadQnaThreadsForEnrollments(
  supabase: SupabaseClient<Database>,
  enrollmentIds: string[],
  locale: string,
): Promise<Map<string, { inquiryId: string; studentName: string; messages: QnaMessageRow[] }>> {
  const result = new Map<string, { inquiryId: string; studentName: string; messages: QnaMessageRow[] }>();
  if (enrollmentIds.length === 0) return result;

  // sender_name is a snapshot open_qna_thread() (0148) took of the
  // student's profile at accept time — used instead of a roster lookup
  // (get_roster_student_info only returns accepted/joined students, not
  // qna_open ones, since contact info specifically must stay locked until
  // the platform fee is paid) so the owner can still see who they're
  // talking to before that.
  const { data: inquiryRows } = await supabase
    .from("inquiries")
    .select("id, enrollment_id, sender_name")
    .in("enrollment_id", enrollmentIds);
  if (!inquiryRows || inquiryRows.length === 0) return result;

  const inquiryIds = inquiryRows.map((r) => r.id);
  const { data: messageRows } = await supabase
    .from("inquiry_messages")
    .select("id, inquiry_id, sender_role, body, created_at")
    .in("inquiry_id", inquiryIds)
    .order("created_at", { ascending: true });

  const timeFormatter = createDateTimeFormatter(locale);
  const messagesByInquiryId = new Map<string, QnaMessageRow[]>();
  for (const m of messageRows ?? []) {
    const list = messagesByInquiryId.get(m.inquiry_id) ?? [];
    list.push({ id: m.id, senderRole: m.sender_role, body: m.body, createdLabel: timeFormatter.format(new Date(m.created_at)) });
    messagesByInquiryId.set(m.inquiry_id, list);
  }

  for (const row of inquiryRows) {
    if (!row.enrollment_id) continue;
    result.set(row.enrollment_id, {
      inquiryId: row.id,
      studentName: row.sender_name,
      messages: messagesByInquiryId.get(row.id) ?? [],
    });
  }
  return result;
}
