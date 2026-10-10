-- Close the normal JWT revocation window for protected dashboard requests.
-- Supabase access tokens can remain cryptographically valid after sign-out;
-- dashboard authorization therefore also requires the Auth session row.

create or replace function public.has_valid_auth_session()
returns boolean
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
    v_session_id text;
    v_is_valid boolean := false;
begin
    v_session_id := coalesce(
        nullif(pg_catalog.current_setting('request.jwt.claim.session_id', true), ''),
        nullif(pg_catalog.current_setting('request.jwt.claims', true), '')::jsonb ->> 'session_id'
    );

    if auth.uid() is null
        or v_session_id is null
        or pg_catalog.to_regclass('auth.sessions') is null
    then
        return false;
    end if;

    begin
        execute
            'select exists (
                select 1
                from auth.sessions
                where id = $1 and user_id = $2
            )'
        into v_is_valid
        using v_session_id::uuid, auth.uid();
    exception
        when invalid_text_representation then
            return false;
    end;

    return coalesce(v_is_valid, false);
end;
$$;

comment on function public.has_valid_auth_session() is
    'Rejects signed JWTs whose Supabase Auth session has already been removed.';

revoke all on function public.has_valid_auth_session() from public, anon, authenticated;

create or replace function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
    select public.has_valid_auth_session()
        and exists (
            select 1
            from public.admin_users
            where user_id = auth.uid()
              and is_active
              and (expires_at is null or expires_at > now())
        );
$$;

comment on function public.is_admin() is
    'Checks the live Auth session and active, non-expired dashboard access.';

revoke all on function public.is_admin() from public, anon, authenticated;
grant execute on function public.is_admin() to authenticated;

create or replace function public.is_owner()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
    select public.has_valid_auth_session()
        and exists (
            select 1
            from public.admin_users
            where user_id = auth.uid()
              and role = 'owner'
              and is_active
              and expires_at is null
        );
$$;

comment on function public.is_owner() is
    'Checks permanent owner access backed by a live Supabase Auth session.';

revoke all on function public.is_owner() from public, anon, authenticated;
grant execute on function public.is_owner() to authenticated;

create or replace function public.admin_access_status()
returns text
language sql
stable
security definer
set search_path = ''
as $$
    select case
        when auth.uid() is null then 'unauthenticated'
        when not public.has_valid_auth_session() then 'invalid_session'
        when not exists (
            select 1 from public.admin_users where user_id = auth.uid()
        ) then 'not_admin'
        when exists (
            select 1
            from public.admin_users
            where user_id = auth.uid() and not is_active
        ) then 'disabled'
        when exists (
            select 1
            from public.admin_users
            where user_id = auth.uid()
              and expires_at is not null
              and expires_at <= now()
        ) then 'expired'
        else 'active'
    end;
$$;

comment on function public.admin_access_status() is
    'Returns the current user session and dashboard access state without exposing the allowlist.';

revoke all on function public.admin_access_status() from public, anon, authenticated;
grant execute on function public.admin_access_status() to authenticated;
