-- Owner-managed dashboard access with optional expiration.
-- The public survey submission path is intentionally unchanged.

alter table public.admin_users
    add column role text not null default 'admin',
    add column is_active boolean not null default true,
    add column expires_at timestamptz,
    add column created_by uuid references auth.users (id) on delete set null,
    add column updated_at timestamptz not null default now();

alter table public.admin_users
    add constraint admin_users_role_check
        check (role = any (array['owner', 'admin'])),
    add constraint admin_users_owner_invariants_check
        check (role <> 'owner' or (is_active and expires_at is null));

create unique index admin_users_single_owner_idx
    on public.admin_users ((role))
    where role = 'owner';

comment on table public.admin_users is
    'Dashboard access records. The owner is permanent; secondary admins may be disabled or expire.';

comment on column public.admin_users.expires_at is
    'Null means unlimited access. Otherwise access stops at this instant.';

create or replace function public.protect_admin_owner()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
    if tg_op = 'DELETE' then
        if old.role = 'owner' then
            raise exception using
                errcode = '42501',
                message = 'The owner account cannot be deleted';
        end if;
        return old;
    end if;

    if old.role = 'owner' and (
        new.user_id is distinct from old.user_id
        or new.role <> 'owner'
        or not new.is_active
        or new.expires_at is not null
    ) then
        raise exception using
            errcode = '42501',
            message = 'The owner account cannot be demoted, disabled, expired, or reassigned';
    end if;

    new.updated_at := now();
    return new;
end;
$$;

revoke all on function public.protect_admin_owner() from public, anon, authenticated;

create trigger protect_admin_owner_before_change
before update or delete on public.admin_users
for each row execute function public.protect_admin_owner();

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
              and is_active
              and (expires_at is null or expires_at > now())
        );
$$;

comment on function public.is_admin() is
    'Checks active, non-expired dashboard access for the current authenticated user.';

revoke all on function public.is_admin() from public, anon, authenticated;
grant execute on function public.is_admin() to authenticated;

create or replace function public.is_owner()
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
              and role = 'owner'
              and is_active
              and expires_at is null
        );
$$;

comment on function public.is_owner() is
    'Checks permanent owner access for the current authenticated user.';

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
    'Returns only the current user dashboard access state, without exposing the allowlist.';

revoke all on function public.admin_access_status() from public, anon, authenticated;
grant execute on function public.admin_access_status() to authenticated;

create or replace function public.list_admin_users()
returns table (
    user_id uuid,
    email text,
    role text,
    is_active boolean,
    expires_at timestamptz,
    created_at timestamptz,
    created_by uuid,
    updated_at timestamptz,
    access_status text
)
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
    if not public.is_owner() then
        raise exception using
            errcode = '42501',
            message = 'Owner access required';
    end if;

    return query
    select
        admins.user_id,
        users.email::text,
        admins.role,
        admins.is_active,
        admins.expires_at,
        admins.created_at,
        admins.created_by,
        admins.updated_at,
        case
            when admins.role = 'owner' then 'owner'
            when not admins.is_active then 'disabled'
            when admins.expires_at is not null and admins.expires_at <= now() then 'expired'
            else 'active'
        end
    from public.admin_users as admins
    join auth.users as users on users.id = admins.user_id
    order by
        case when admins.role = 'owner' then 0 else 1 end,
        admins.created_at;
end;
$$;

comment on function public.list_admin_users() is
    'Owner-only directory of dashboard administrators, including their Auth email.';

revoke all on function public.list_admin_users() from public, anon, authenticated;
grant execute on function public.list_admin_users() to authenticated;

-- No browser role may read or mutate the allowlist directly. Owner listing is
-- deliberately limited to list_admin_users(); mutations go through the Edge Function.
revoke all on table public.admin_users from public, anon, authenticated;
