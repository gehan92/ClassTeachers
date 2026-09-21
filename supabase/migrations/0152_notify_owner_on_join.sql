-- Gap: nothing notified the owner (teacher/institute) when a qna_open
-- request actually completed (fee paid or waived) and the student became
-- a real roster member — they'd only find out by revisiting their
-- Students tab. Every other meaningful transition in this app fires a
-- notification (join_request_received/accepted/declined, inquiry_reply,
-- etc.); this closes the gap for the one this feature added. Both paths
-- that can produce status='joined' — the free-waiver RPC (0150) and the
-- PayHere webhook's completion RPC (0147) — get the same notify call via
-- one shared helper, so the copy/logic can't drift between them.
create or replace function public.notify_owner_of_join(p_enrollment_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  e record;
  recipient_id uuid;
  student_name text;
begin
  select * into e from enrollments where id = p_enrollment_id;
  if not found then
    return;
  end if;

  if e.owner_type = 'teacher' then
    recipient_id := e.owner_id;
  else
    select owner_id into recipient_id from class_profiles where id = e.owner_id;
  end if;

  select full_name into student_name from profiles where id = e.student_id;

  perform create_notification(
    recipient_id,
    'platform_fee_join_completed',
    jsonb_build_object('studentName', coalesce(student_name, '—')),
    'students'
  );
end;
$$;

create or replace function public.waive_platform_fee(p_enrollment_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  e record;
begin
  select * into e from enrollments where id = p_enrollment_id and student_id = auth.uid();
  if not found then
    raise exception 'enrollment_not_found';
  end if;
  if e.status != 'qna_open' then
    raise exception 'not_qna_open';
  end if;
  if not is_first_platform_connection() then
    raise exception 'not_first_connection';
  end if;

  update enrollments
  set status = 'joined', platform_fee_waived = true
  where id = p_enrollment_id;

  perform notify_owner_of_join(p_enrollment_id);
end;
$$;

create or replace function public.mark_payment_completed(p_payhere_order_id text, p_payhere_payment_id text)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  pay record;
begin
  update platform_payments
  set status = 'completed', paid_at = now(), payhere_payment_id = p_payhere_payment_id
  where payhere_order_id = p_payhere_order_id and status = 'pending'
  returning * into pay;

  if pay.id is null then
    return; -- already completed (retry) or unknown order id; nothing to cascade.
  end if;

  if pay.purpose in ('teacher_connection', 'class_join') then
    update enrollments
    set status = 'joined', platform_fee_paid = true
    where id = pay.enrollment_id;
    perform notify_owner_of_join(pay.enrollment_id);
  elsif pay.purpose = 'institute_unlock' then
    insert into institute_access (student_id, institute_id, payment_id)
    values (pay.student_id, pay.institute_id, pay.id)
    on conflict (student_id, institute_id) do nothing;
  end if;
end;
$$;

-- create or replace preserves existing grants, so 0151's revoke still holds
-- here — nothing to re-apply.
