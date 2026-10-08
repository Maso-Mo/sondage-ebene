create table public.survey_responses (
    submission_id uuid primary key,
    schema_version smallint not null,
    age text not null,
    purchase_frequency text not null,
    products text[] not null,
    desired_products text not null,
    makeup_style text not null,
    preferred_texture text not null,
    colors text[] not null,
    brand_issues text[] not null,
    gloss_budget text not null,
    purchase_triggers text[] not null,
    packaging_style text not null,
    purchase_channel text not null,
    local_brand_interest text not null,
    followed_influencer text not null,
    ideal_brand text,
    client_completed_at timestamptz,
    created_at timestamptz not null default now(),

    constraint survey_responses_schema_version_check
        check (schema_version = 1),
    constraint survey_responses_age_check
        check (age = any (array['under_16', 'age_16_18', 'age_19_22', 'age_23_27', 'age_28_plus'])),
    constraint survey_responses_purchase_frequency_check
        check (purchase_frequency = any (array['very_often', 'monthly', 'occasionally', 'rarely'])),
    constraint survey_responses_products_check
        check (
            cardinality(products) > 0
            and products <@ array['gloss', 'lip_oil', 'lipstick', 'blush', 'foundation', 'powder', 'highlighter', 'false_eyelashes', 'lip_liner']::text[]
        ),
    constraint survey_responses_desired_products_check
        check (char_length(btrim(desired_products)) between 3 and 500),
    constraint survey_responses_makeup_style_check
        check (makeup_style = any (array['clean_girl', 'soft_glam', 'full_glam', 'natural', 'glow_makeup', 'artistic_trendy'])),
    constraint survey_responses_preferred_texture_check
        check (preferred_texture = any (array['glossy', 'matte', 'creamy', 'lightweight_natural', 'highly_pigmented'])),
    constraint survey_responses_colors_check
        check (
            cardinality(colors) > 0
            and colors <@ array['nude', 'brown_caramel', 'pink', 'red', 'coral_sunset', 'transparent', 'burgundy_chocolate']::text[]
        ),
    constraint survey_responses_brand_issues_check
        check (
            cardinality(brand_issues) > 0
            and brand_issues <@ array['insufficient_shades', 'poor_wear', 'too_expensive', 'unattractive_packaging', 'hard_to_find', 'average_quality', 'not_trendy_enough']::text[]
        ),
    constraint survey_responses_gloss_budget_check
        check (gloss_budget = any (array['ar_15_25k', 'ar_25_40k', 'ar_40_60k', 'ar_60k_plus'])),
    constraint survey_responses_purchase_triggers_check
        check (
            cardinality(purchase_triggers) > 0
            and purchase_triggers <@ array['packaging', 'influencers', 'quality', 'price', 'tiktok_instagram', 'trendy_products', 'customer_reviews']::text[]
        ),
    constraint survey_responses_packaging_style_check
        check (packaging_style = any (array['luxury_minimalist', 'colorful_fun', 'tropical_chic', 'modern_glossy', 'simple_clean'])),
    constraint survey_responses_purchase_channel_check
        check (purchase_channel = any (array['instagram_facebook', 'boutique', 'resellers', 'shopping_mall', 'tiktok_shop', 'markets'])),
    constraint survey_responses_local_brand_interest_check
        check (local_brand_interest = any (array['yes', 'maybe', 'no'])),
    constraint survey_responses_followed_influencer_check
        check (char_length(btrim(followed_influencer)) between 3 and 500),
    constraint survey_responses_ideal_brand_check
        check (ideal_brand is null or char_length(ideal_brand) <= 2000)
);

create index survey_responses_created_at_idx
    on public.survey_responses (created_at desc);

alter table public.survey_responses enable row level security;

revoke all on table public.survey_responses from public, anon, authenticated;

create or replace function public.submit_survey_response(
    p_submission_id uuid,
    p_schema_version smallint,
    p_answers jsonb,
    p_client_completed_at timestamptz default null
)
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
    v_products text[];
    v_colors text[];
    v_brand_issues text[];
    v_purchase_triggers text[];
    v_row_count bigint;
    v_allowed_keys constant text[] := array[
        'age', 'purchase_frequency', 'products', 'desired_products',
        'makeup_style', 'preferred_texture', 'colors', 'brand_issues',
        'gloss_budget', 'purchase_triggers', 'packaging_style',
        'purchase_channel', 'local_brand_interest', 'followed_influencer',
        'ideal_brand'
    ];
    v_required_keys constant text[] := array[
        'age', 'purchase_frequency', 'products', 'desired_products',
        'makeup_style', 'preferred_texture', 'colors', 'brand_issues',
        'gloss_budget', 'purchase_triggers', 'packaging_style',
        'purchase_channel', 'local_brand_interest', 'followed_influencer'
    ];
begin
    if p_submission_id is null or p_schema_version <> 1 then
        raise exception using errcode = '22023', message = 'Invalid submission metadata';
    end if;

    if p_answers is null or pg_catalog.jsonb_typeof(p_answers) <> 'object' then
        raise exception using errcode = '22023', message = 'Answers must be a JSON object';
    end if;

    if pg_catalog.pg_column_size(p_answers) > 32768 then
        raise exception using errcode = '22023', message = 'Answers payload is too large';
    end if;

    if not (p_answers ?& v_required_keys) then
        raise exception using errcode = '22023', message = 'Required answers are missing';
    end if;

    if exists (
        select 1
        from pg_catalog.jsonb_object_keys(p_answers) as keys(answer_key)
        where answer_key <> all (v_allowed_keys)
    ) then
        raise exception using errcode = '22023', message = 'Unknown answer key';
    end if;

    if pg_catalog.jsonb_typeof(p_answers -> 'products') <> 'array'
        or pg_catalog.jsonb_typeof(p_answers -> 'colors') <> 'array'
        or pg_catalog.jsonb_typeof(p_answers -> 'brand_issues') <> 'array'
        or pg_catalog.jsonb_typeof(p_answers -> 'purchase_triggers') <> 'array'
    then
        raise exception using errcode = '22023', message = 'Multi-choice answers must be arrays';
    end if;

    if pg_catalog.jsonb_array_length(p_answers -> 'products') > 9
        or pg_catalog.jsonb_array_length(p_answers -> 'colors') > 7
        or pg_catalog.jsonb_array_length(p_answers -> 'brand_issues') > 7
        or pg_catalog.jsonb_array_length(p_answers -> 'purchase_triggers') > 7
    then
        raise exception using errcode = '22023', message = 'Too many multi-choice answers';
    end if;

    select coalesce(pg_catalog.array_agg(distinct item order by item), '{}'::text[])
    into v_products
    from pg_catalog.jsonb_array_elements_text(p_answers -> 'products') as values_list(item);

    select coalesce(pg_catalog.array_agg(distinct item order by item), '{}'::text[])
    into v_colors
    from pg_catalog.jsonb_array_elements_text(p_answers -> 'colors') as values_list(item);

    select coalesce(pg_catalog.array_agg(distinct item order by item), '{}'::text[])
    into v_brand_issues
    from pg_catalog.jsonb_array_elements_text(p_answers -> 'brand_issues') as values_list(item);

    select coalesce(pg_catalog.array_agg(distinct item order by item), '{}'::text[])
    into v_purchase_triggers
    from pg_catalog.jsonb_array_elements_text(p_answers -> 'purchase_triggers') as values_list(item);

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
        ideal_brand,
        client_completed_at
    ) values (
        p_submission_id,
        p_schema_version,
        p_answers ->> 'age',
        p_answers ->> 'purchase_frequency',
        v_products,
        btrim(p_answers ->> 'desired_products'),
        p_answers ->> 'makeup_style',
        p_answers ->> 'preferred_texture',
        v_colors,
        v_brand_issues,
        p_answers ->> 'gloss_budget',
        v_purchase_triggers,
        p_answers ->> 'packaging_style',
        p_answers ->> 'purchase_channel',
        p_answers ->> 'local_brand_interest',
        btrim(p_answers ->> 'followed_influencer'),
        nullif(btrim(p_answers ->> 'ideal_brand'), ''),
        p_client_completed_at
    )
    on conflict (submission_id) do nothing;

    get diagnostics v_row_count = row_count;
    return case when v_row_count > 0 then 'stored' else 'already_stored' end;
end;
$$;

revoke execute on function public.submit_survey_response(uuid, smallint, jsonb, timestamptz)
    from public, anon, authenticated;
grant execute on function public.submit_survey_response(uuid, smallint, jsonb, timestamptz)
    to anon;
