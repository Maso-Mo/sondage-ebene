begin;

select plan(47);

insert into auth.users (id, email) values
    ('11111111-1111-4111-8111-111111111111', 'owner@example.com'),
    ('22222222-2222-4222-8222-222222222222', 'active@example.com'),
    ('33333333-3333-4333-8333-333333333333', 'expired@example.com'),
    ('44444444-4444-4444-8444-444444444444', 'disabled@example.com'),
    ('55555555-5555-4555-8555-555555555555', 'regular@example.com'),
    ('66666666-6666-4666-8666-666666666666', 'second-owner@example.com');

insert into auth.sessions (id, user_id) values
    ('10000000-0000-4000-8000-000000000001', '11111111-1111-4111-8111-111111111111'),
    ('20000000-0000-4000-8000-000000000001', '22222222-2222-4222-8222-222222222222'),
    ('30000000-0000-4000-8000-000000000001', '33333333-3333-4333-8333-333333333333'),
    ('40000000-0000-4000-8000-000000000001', '44444444-4444-4444-8444-444444444444'),
    ('50000000-0000-4000-8000-000000000001', '55555555-5555-4555-8555-555555555555');

insert into public.admin_users (user_id, role, is_active, expires_at, created_by) values
    ('11111111-1111-4111-8111-111111111111', 'owner', true, null, null),
    ('22222222-2222-4222-8222-222222222222', 'admin', true, now() + interval '1 day', '11111111-1111-4111-8111-111111111111'),
    ('33333333-3333-4333-8333-333333333333', 'admin', true, now() - interval '1 minute', '11111111-1111-4111-8111-111111111111'),
    ('44444444-4444-4444-8444-444444444444', 'admin', false, null, '11111111-1111-4111-8111-111111111111');

insert into public.survey_responses (
    submission_id,
    schema_version,
    age,
    purchase_frequency,
    products,
    desired_products,
    makeup_style,
    preferred_texture,
    colors,
    brand_issues,
    gloss_budget,
    purchase_triggers,
    packaging_style,
    purchase_channel,
    local_brand_interest,
    followed_influencer,
    ideal_brand
) values (
    '77777777-7777-4777-8777-777777777777',
    1,
    'age_19_22',
    'monthly',
    array['gloss'],
    'Un gloss durable',
    'natural',
    'glossy',
    array['nude'],
    array['poor_wear'],
    'ar_25_40k',
    array['quality'],
    'luxury_minimalist',
    'boutique',
    'yes',
    'Aucun en particulier',
    'Inclusive et durable'
);

select has_column('public', 'admin_users', 'role', 'admin_users has a role column');
select has_column('public', 'admin_users', 'is_active', 'admin_users has an active flag');
select has_column('public', 'admin_users', 'expires_at', 'admin_users has an expiration');
select has_column('public', 'admin_users', 'created_by', 'admin_users tracks its creator');
select has_column('public', 'admin_users', 'updated_at', 'admin_users tracks updates');

select ok(
    not has_function_privilege('anon', 'public.is_owner()', 'execute'),
    'anon cannot check owner membership'
);
select ok(
    has_function_privilege('authenticated', 'public.is_owner()', 'execute'),
    'authenticated can check only its own owner membership'
);
select ok(
    not has_function_privilege('anon', 'public.list_admin_users()', 'execute'),
    'anon cannot list administrators'
);
select ok(
    not has_table_privilege('authenticated', 'public.admin_users', 'select'),
    'authenticated cannot select the administrator table directly'
);
select ok(
    not has_table_privilege('authenticated', 'public.admin_users', 'insert'),
    'authenticated cannot insert an administrator directly'
);
select ok(
    not has_table_privilege('authenticated', 'public.admin_users', 'update'),
    'authenticated cannot update an administrator directly'
);
select ok(
    not has_table_privilege('authenticated', 'public.admin_users', 'delete'),
    'authenticated cannot delete an administrator directly'
);

set local role authenticated;
select set_config('request.jwt.claim.sub', '55555555-5555-4555-8555-555555555555', true);
select set_config('request.jwt.claim.session_id', '50000000-0000-4000-8000-000000000001', true);
select is(public.is_admin(), false, 'a regular user is not an admin');
select is(public.is_owner(), false, 'a regular user is not the owner');
select is(public.admin_access_status(), 'not_admin', 'a regular user receives not_admin status');
select is((select count(*) from public.survey_responses), 0::bigint, 'RLS blocks a regular user');
select throws_ok(
    'select * from public.list_admin_users()',
    '42501',
    'Owner access required',
    'a regular user cannot list administrators'
);

reset role;
set local role authenticated;
select set_config('request.jwt.claim.sub', '22222222-2222-4222-8222-222222222222', true);
select set_config('request.jwt.claim.session_id', '20000000-0000-4000-8000-000000000001', true);
select is(public.is_admin(), true, 'an active secondary admin is an admin');
select is(public.is_owner(), false, 'a secondary admin is not the owner');
select is(public.admin_access_status(), 'active', 'an active secondary admin receives active status');
select is((select count(*) from public.survey_responses), 1::bigint, 'RLS allows an active secondary admin');
select throws_ok(
    'select * from public.list_admin_users()',
    '42501',
    'Owner access required',
    'a secondary admin cannot list administrators'
);
select throws_ok(
    $$update public.admin_users set role = 'owner' where user_id = '22222222-2222-4222-8222-222222222222'$$,
    '42501',
    'permission denied for table admin_users',
    'a secondary admin cannot promote itself to owner'
);
select throws_ok(
    $$update public.admin_users set expires_at = null where user_id = '22222222-2222-4222-8222-222222222222'$$,
    '42501',
    'permission denied for table admin_users',
    'a secondary admin cannot change its own expiration'
);

reset role;
set local role authenticated;
select set_config('request.jwt.claim.sub', '33333333-3333-4333-8333-333333333333', true);
select set_config('request.jwt.claim.session_id', '30000000-0000-4000-8000-000000000001', true);
select is(public.is_admin(), false, 'an expired admin is no longer an admin');
select is(public.admin_access_status(), 'expired', 'an expired admin receives expired status');
select is((select count(*) from public.survey_responses), 0::bigint, 'RLS immediately blocks an expired admin');

reset role;
set local role authenticated;
select set_config('request.jwt.claim.sub', '44444444-4444-4444-8444-444444444444', true);
select set_config('request.jwt.claim.session_id', '40000000-0000-4000-8000-000000000001', true);
select is(public.is_admin(), false, 'a disabled admin is no longer an admin');
select is(public.admin_access_status(), 'disabled', 'a disabled admin receives disabled status');
select is((select count(*) from public.survey_responses), 0::bigint, 'RLS immediately blocks a disabled admin');

reset role;
set local role authenticated;
select set_config('request.jwt.claim.sub', '11111111-1111-4111-8111-111111111111', true);
select set_config('request.jwt.claim.session_id', '10000000-0000-4000-8000-000000000001', true);
select is(public.is_admin(), true, 'the owner is an admin');
select is(public.is_owner(), true, 'the owner is recognized');
select is(public.admin_access_status(), 'active', 'the owner is permanently active');
select is((select count(*) from public.survey_responses), 1::bigint, 'RLS allows the owner');
select is((select count(*) from public.list_admin_users()), 4::bigint, 'the owner can list all administrators');
select is(
    (select email from public.list_admin_users() where role = 'owner'),
    'owner@example.com',
    'the owner directory includes Auth email addresses'
);

reset role;
delete from auth.sessions
where id = '20000000-0000-4000-8000-000000000001';

set local role authenticated;
select set_config('request.jwt.claim.sub', '22222222-2222-4222-8222-222222222222', true);
select set_config('request.jwt.claim.session_id', '20000000-0000-4000-8000-000000000001', true);
select is(public.is_admin(), false, 'a revoked Auth session is no longer an admin');
select is(public.admin_access_status(), 'invalid_session', 'a revoked Auth session is reported as invalid');
select is((select count(*) from public.survey_responses), 0::bigint, 'RLS blocks a still-signed JWT after its Auth session is removed');

reset role;
select throws_ok(
    $$update public.admin_users set is_active = false where role = 'owner'$$,
    '42501',
    'The owner account cannot be demoted, disabled, expired, or reassigned',
    'the owner cannot be disabled even from a privileged context'
);
select throws_ok(
    $$update public.admin_users set role = 'admin' where role = 'owner'$$,
    '42501',
    'The owner account cannot be demoted, disabled, expired, or reassigned',
    'the owner cannot be demoted even from a privileged context'
);
select throws_ok(
    $$update public.admin_users set expires_at = now() + interval '1 day' where role = 'owner'$$,
    '42501',
    'The owner account cannot be demoted, disabled, expired, or reassigned',
    'the owner cannot receive an expiration even from a privileged context'
);
select throws_ok(
    $$delete from public.admin_users where role = 'owner'$$,
    '42501',
    'The owner account cannot be deleted',
    'the owner cannot be deleted even from a privileged context'
);
select throws_ok(
    $$delete from auth.users where id = '11111111-1111-4111-8111-111111111111'$$,
    '42501',
    'The owner account cannot be deleted',
    'deleting the owner Auth user is also blocked'
);
select throws_ok(
    $$insert into public.admin_users (user_id, role) values ('66666666-6666-4666-8666-666666666666', 'owner')$$,
    '23505',
    null,
    'a second owner is rejected'
);
select throws_ok(
    $$insert into public.admin_users (user_id, role, is_active) values ('66666666-6666-4666-8666-666666666666', 'owner', false)$$,
    '23514',
    null,
    'an inactive owner is rejected by the database constraint'
);
select ok(
    has_function_privilege(
        'anon',
        'public.submit_survey_response(uuid,smallint,jsonb,timestamptz)',
        'execute'
    ),
    'the public submission RPC remains executable'
);

select * from finish();
rollback;
