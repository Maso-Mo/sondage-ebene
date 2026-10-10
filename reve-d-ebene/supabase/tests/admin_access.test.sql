begin;

select plan(15);

-- Only the stable auth.users primary key is needed for the allowlist FK. This
-- keeps the test independent from GoTrue's internal, version-specific columns.
insert into auth.users (id) values
    ('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'),
    ('bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb');

insert into auth.sessions (id, user_id) values
    ('a0000000-0000-4000-8000-000000000001', 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'),
    ('b0000000-0000-4000-8000-000000000001', 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb');

insert into public.admin_users (user_id)
values ('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa');

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
    'cccccccc-cccc-4ccc-8ccc-cccccccccccc',
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

select ok(
    not has_table_privilege('anon', 'public.survey_responses', 'select'),
    'anon has no SELECT privilege on survey responses'
);

select ok(
    has_table_privilege('authenticated', 'public.survey_responses', 'select'),
    'authenticated receives the SELECT privilege required for RLS evaluation'
);

select ok(
    not has_table_privilege('authenticated', 'public.survey_responses', 'insert'),
    'authenticated cannot insert survey responses directly'
);

select ok(
    not has_table_privilege('authenticated', 'public.survey_responses', 'update'),
    'authenticated cannot update survey responses'
);

select ok(
    not has_table_privilege('authenticated', 'public.survey_responses', 'delete'),
    'authenticated cannot delete survey responses'
);

select ok(
    not has_table_privilege('authenticated', 'public.admin_users', 'select'),
    'authenticated cannot read the admin allowlist directly'
);

select ok(
    not has_table_privilege('authenticated', 'public.admin_users', 'insert'),
    'authenticated cannot add itself to the admin allowlist'
);

select ok(
    not has_function_privilege('anon', 'public.is_admin()', 'execute'),
    'anon cannot call the admin membership function'
);

select ok(
    has_function_privilege('authenticated', 'public.is_admin()', 'execute'),
    'authenticated can check its own admin membership'
);

set local role authenticated;
select set_config('request.jwt.claim.sub', 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb', true);
select set_config('request.jwt.claim.session_id', 'b0000000-0000-4000-8000-000000000001', true);

select is(public.is_admin(), false, 'a normal authenticated user is not an admin');

select is(
    (select count(*) from public.survey_responses),
    0::bigint,
    'RLS hides every response from a non-admin user'
);

reset role;
set local role authenticated;
select set_config('request.jwt.claim.sub', 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', true);
select set_config('request.jwt.claim.session_id', 'a0000000-0000-4000-8000-000000000001', true);

select is(public.is_admin(), true, 'an allowlisted user is an admin');

select is(
    (select count(*) from public.survey_responses),
    1::bigint,
    'an admin can read survey responses'
);

reset role;

select ok(
    has_function_privilege(
        'anon',
        'public.submit_survey_response(uuid,smallint,jsonb,timestamptz)',
        'execute'
    ),
    'the anonymous submission RPC remains executable'
);

select ok(
    not has_function_privilege(
        'authenticated',
        'public.submit_survey_response(uuid,smallint,jsonb,timestamptz)',
        'execute'
    ),
    'the public submission RPC remains unavailable to authenticated users'
);

select * from finish();
rollback;
