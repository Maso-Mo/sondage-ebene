-- Read-only administration access for the survey dashboard.
-- This migration is additive: the anonymous submission RPC is unchanged.

create table public.admin_users (
    user_id uuid primary key references auth.users (id) on delete cascade,
    created_at timestamptz not null default now()
);

comment on table public.admin_users is
    'Allowlist of Supabase Auth users permitted to read survey responses.';

alter table public.admin_users enable row level security;

-- Membership is managed only from a trusted SQL/admin context. The browser
-- receives no direct privilege on this table and therefore cannot self-enrol.
revoke all on table public.admin_users from public, anon, authenticated;

create or replace function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
    select auth.uid() is not null
        and exists (
            select 1
            from public.admin_users
            where user_id = auth.uid()
        );
$$;

comment on function public.is_admin() is
    'Returns whether the current authenticated user belongs to the admin allowlist.';

revoke all on function public.is_admin() from public, anon, authenticated;
grant execute on function public.is_admin() to authenticated;

-- The authenticated role can issue SELECT requests, but RLS exposes rows only
-- when is_admin() confirms allowlist membership. No INSERT, UPDATE or DELETE is
-- granted; anonymous access remains unchanged.
grant select on table public.survey_responses to authenticated;

create policy "Allow admins to read survey responses"
    on public.survey_responses
    for select
    to authenticated
    using ((select public.is_admin()));
