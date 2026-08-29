-- Growth Plan item 5: "invite a teacher, both get a free month of
-- Premium" — nothing like this exists yet. Only teacher/campus_lecturer/
-- class accounts can ever hold a platform_subscriptions row (0017,
-- owner_type check), so this is scoped to those — a student referring a
-- friend still gets tracked, it just never has anything to reward.
--
-- 0017 deliberately documents that Premium is only ever granted by an
-- admin or the (not-yet-built) PayHere webhook, specifically so a
-- compromised account can't self-grant it. A referral reward has to
-- respect that same boundary rather than route around it with a service
-- role — so referrals are tracked automatically at signup, but actually
-- granting the reward is its own admin-only step (grant_referral_reward
-- below), the same trust shape as every other admin action in this schema.

alter table profiles add column if not exists referral_code text unique;

create table referrals (
  id uuid primary key default gen_random_uuid(),
  referrer_id uuid not null references profiles (id) on delete cascade,
  referred_id uuid not null references profiles (id) on delete cascade unique,
  reward_status text not null default 'pending' check (reward_status in ('pending', 'granted', 'declined')),
  created_at timestamptz not null default now(),
  reward_granted_at timestamptz,
  check (referrer_id != referred_id)
);

alter table referrals enable row level security;

create policy "referrer or admin can view a referral"
  on referrals for select
  using (referrer_id = auth.uid() or is_admin());

-- Written by ensureProfile (auth/actions.ts) right after a new profile is
-- created, in that same signed-in request — the referred party's own
-- session is what writes the row.
create policy "a new signup can record who referred them"
  on referrals for insert
  with check (referred_id = auth.uid());

-- Same trust boundary platform_subscriptions itself documents (0017): no
-- automated path grants a reward on its own.
create policy "only admin updates a referral"
  on referrals for update
  using (is_admin())
  with check (is_admin());

-- Resolves a shareable code to its owner — anon-callable since this runs
-- during signup, before a session exists.
create or replace function public.resolve_referral_code(p_code text)
returns uuid
language sql
stable
security definer
set search_path = public
as $$
  select id from profiles where referral_code = upper(trim(p_code));
$$;

grant execute on function public.resolve_referral_code(text) to anon, authenticated;

-- Lazily assigns the caller's own code the first time their dashboard's
-- Refer & Earn panel asks for one — nothing needs backfilling up front.
create or replace function public.ensure_referral_code()
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  existing text;
  candidate text;
begin
  select referral_code into existing from profiles where id = auth.uid();
  if existing is not null then
    return existing;
  end if;

  loop
    candidate := upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 8));
    begin
      update profiles set referral_code = candidate where id = auth.uid();
      return candidate;
    exception when unique_violation then
      -- 8 hex chars colliding is astronomically unlikely; just retry.
    end;
  end loop;
end;
$$;

grant execute on function public.ensure_referral_code() to authenticated;

-- Refer & Earn panel's own list — profiles' RLS is "your own row or admin"
-- (0003), so a plain select on referrals alone can't also show who each
-- referred_id actually is. Narrow, referrer-scoped projection instead of
-- exposing the full profiles row.
create or replace function public.list_my_referrals()
returns table (id uuid, referred_name text, reward_status text, created_at timestamptz)
language sql
stable
security definer
set search_path = public
as $$
  select r.id, p.full_name, r.reward_status, r.created_at
  from referrals r
  join profiles p on p.id = r.referred_id
  where r.referrer_id = auth.uid()
  order by r.created_at desc;
$$;

grant execute on function public.list_my_referrals() to authenticated;

-- One side's subscription bump — teacher accounts are keyed by their own
-- profile id, but a class account's platform_subscriptions row is keyed by
-- class_profiles.id, not the owner's profile id, so that needs its own
-- lookup. Silently no-ops for a student (or an institute owner with no
-- class_profiles row yet) rather than erroring the whole grant.
create or replace function public.extend_premium_subscription(p_profile_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_role text;
  v_owner_type text;
  v_owner_id uuid;
begin
  select role into v_role from profiles where id = p_profile_id;
  if v_role is null or v_role not in ('teacher', 'campus_lecturer', 'class') then
    return;
  end if;

  if v_role = 'class' then
    select id into v_owner_id from class_profiles where owner_id = p_profile_id;
    if v_owner_id is null then
      return;
    end if;
    v_owner_type := 'class';
  else
    v_owner_type := 'teacher';
    v_owner_id := p_profile_id;
  end if;

  insert into platform_subscriptions (owner_type, owner_id, plan, status, renews_at)
  values (v_owner_type, v_owner_id, 'premium', 'active', now() + interval '30 days')
  on conflict (owner_type, owner_id) do update
    set plan = 'premium',
        status = 'active',
        renews_at = greatest(coalesce(platform_subscriptions.renews_at, now()), now()) + interval '30 days';
end;
$$;

-- Admin Referrals tab -> "Grant reward". is_admin() re-checked internally
-- (security definer bypasses RLS) rather than trusting the caller only got
-- here through an admin-gated server action — same defense-in-depth as
-- every other admin-only write added this session.
create or replace function public.grant_referral_reward(p_referral_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  r record;
begin
  if not is_admin() then
    raise exception 'Only an admin can grant a referral reward.';
  end if;

  select referrer_id, referred_id, reward_status into r from referrals where id = p_referral_id;
  if r is null then
    raise exception 'Referral not found.';
  end if;
  if r.reward_status = 'granted' then
    raise exception 'This referral has already been rewarded.';
  end if;

  perform public.extend_premium_subscription(r.referrer_id);
  perform public.extend_premium_subscription(r.referred_id);

  update referrals set reward_status = 'granted', reward_granted_at = now() where id = p_referral_id;
end;
$$;

grant execute on function public.grant_referral_reward(uuid) to authenticated;
