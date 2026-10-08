begin;

select plan(9);

select ok(
    not has_table_privilege('anon', 'public.survey_responses', 'select'),
    'anon cannot read survey responses'
);

select ok(
    not has_table_privilege('anon', 'public.survey_responses', 'insert'),
    'anon cannot insert directly into survey responses'
);

select ok(
    not has_table_privilege('anon', 'public.survey_responses', 'update'),
    'anon cannot update survey responses'
);

select ok(
    not has_table_privilege('anon', 'public.survey_responses', 'delete'),
    'anon cannot delete survey responses'
);

select ok(
    has_function_privilege(
        'anon',
        'public.submit_survey_response(uuid,smallint,jsonb,timestamptz)',
        'execute'
    ),
    'anon can call only the submission RPC'
);

select ok(
    not has_function_privilege(
        'authenticated',
        'public.submit_survey_response(uuid,smallint,jsonb,timestamptz)',
        'execute'
    ),
    'authenticated users cannot call the public survey RPC'
);

select throws_ok(
    $$
        select public.submit_survey_response(
            '11111111-1111-4111-8111-111111111111'::uuid,
            1::smallint,
            '{"age":"under_16"}'::jsonb,
            now()
        )
    $$,
    '22023',
    'Required answers are missing',
    'the RPC rejects incomplete payloads'
);

set local role anon;

select is(
    public.submit_survey_response(
        '22222222-2222-4222-8222-222222222222'::uuid,
        1::smallint,
        '{
            "age":"age_19_22",
            "purchase_frequency":"monthly",
            "products":["gloss"],
            "desired_products":"Un gloss durable",
            "makeup_style":"natural",
            "preferred_texture":"glossy",
            "colors":["nude"],
            "brand_issues":["poor_wear"],
            "gloss_budget":"ar_25_40k",
            "purchase_triggers":["quality"],
            "packaging_style":"luxury_minimalist",
            "purchase_channel":"instagram_facebook",
            "local_brand_interest":"yes",
            "followed_influencer":"Aucun en particulier",
            "ideal_brand":"Inclusive et durable"
        }'::jsonb,
        now()
    ),
    'stored',
    'anon can submit a valid response through the RPC'
);

select is(
    public.submit_survey_response(
        '22222222-2222-4222-8222-222222222222'::uuid,
        1::smallint,
        '{
            "age":"age_19_22",
            "purchase_frequency":"monthly",
            "products":["gloss"],
            "desired_products":"Un gloss durable",
            "makeup_style":"natural",
            "preferred_texture":"glossy",
            "colors":["nude"],
            "brand_issues":["poor_wear"],
            "gloss_budget":"ar_25_40k",
            "purchase_triggers":["quality"],
            "packaging_style":"luxury_minimalist",
            "purchase_channel":"instagram_facebook",
            "local_brand_interest":"yes",
            "followed_influencer":"Aucun en particulier",
            "ideal_brand":"Inclusive et durable"
        }'::jsonb,
        now()
    ),
    'already_stored',
    'retrying the same submission does not create a duplicate'
);

reset role;

select * from finish();
rollback;
