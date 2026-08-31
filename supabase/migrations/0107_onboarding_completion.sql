-- Mandatory step-by-step onboarding wizard (see the published blueprint,
-- "Onboarding Wizard Blueprint") — gates real dashboard access on
-- completing the rest of a profile that signup only partially collects.
--
-- profile_completed_at lives on `profiles` alone, not on
-- teacher_profiles/class_profiles too — dashboard-page gating is keyed off
-- the logged-in auth id, which is exactly profiles.id for every role, so one
-- column here is enough to gate access regardless of role. The per-role
-- tables still hold the actual profile data the wizard collects; this
-- column only tracks whether that collection is done. Deliberately
-- separate from teacher_profiles.status/class_profiles.status (admin
-- approval) and owner_published (public visibility) — those gate whether
-- strangers can find you, this gates whether you can use your own
-- dashboard, and the two must never be conflated.
--
-- Backfilled to now() for every existing row in this same migration —
-- Gehan confirmed existing accounts should be grandfathered in rather than
-- forced through the wizard retroactively. Only accounts created after this
-- migration runs start out null (incomplete).

alter table profiles add column profile_completed_at timestamptz;

update profiles set profile_completed_at = now() where profile_completed_at is null;
