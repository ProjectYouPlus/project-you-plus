-- Make v3 duplicate detection and activation use the same normalized-title rule.
-- The legacy v2 activation RPC matches case-insensitively by exact title. During the v3
-- compatibility projection, substitute the canonical existing title when trim/case/spacing
-- normalization identifies the same active goal or habit. This makes the user-visible
-- "connect existing" notice truthful without changing the legacy RPC for other callers.

create or replace function private.guard_autobuild_v3_legacy_projection()
returns trigger
language plpgsql
set search_path = public, private, pg_temp
as $$
declare
  v_active_ids text[] := '{}'::text[];
  v_projected jsonb;
  v_has_health boolean := false;
  v_has_money boolean := false;
begin
  if old.proposal_status='approved'
     and new.proposal_status='edited'
     and coalesce(new.activation_state->>'overall','')='activating'
     and jsonb_typeof(old.generated_plan->'metadata')='object'
  then
    select coalesce(array_agg(value->>'clientId'),'{}'::text[])
      into v_active_ids
      from jsonb_array_elements(coalesce(old.generated_plan->'goals','[]'::jsonb))
     where coalesce((value->>'deferred')::boolean,false)=false;

    select exists(select 1 from jsonb_array_elements(coalesce(old.generated_plan->'goals','[]'::jsonb)) g where coalesce((g->>'deferred')::boolean,false)=false and g->>'domain'='health') into v_has_health;
    select exists(select 1 from jsonb_array_elements(coalesce(old.generated_plan->'goals','[]'::jsonb)) g where coalesce((g->>'deferred')::boolean,false)=false and g->>'domain'='money') into v_has_money;

    v_projected := old.generated_plan;
    v_projected := jsonb_set(
      v_projected,
      '{goals}',
      coalesce((
        select jsonb_agg(
          case when matched.title is null then source.value
               else jsonb_set(source.value,'{title}',to_jsonb(matched.title),true)
          end
          order by source.ordinality
        )
        from jsonb_array_elements(coalesce(old.generated_plan->'goals','[]'::jsonb)) with ordinality source(value, ordinality)
        left join lateral (
          select g.title
            from public.goals g
           where g.user_id=new.user_id
             and g.status='active'
             and regexp_replace(lower(btrim(g.title)),'\s+',' ','g')=regexp_replace(lower(btrim(source.value->>'title')),'\s+',' ','g')
           order by g.created_at asc
           limit 1
        ) matched on true
        where coalesce((source.value->>'deferred')::boolean,false)=false
      ),'[]'::jsonb),
      true
    );

    v_projected := jsonb_set(
      v_projected,
      '{habits}',
      coalesce((
        select jsonb_agg(
          case when matched.title is null then source.value
               else jsonb_set(source.value,'{title}',to_jsonb(matched.title),true)
          end
          order by source.ordinality
        )
        from jsonb_array_elements(coalesce(old.generated_plan->'habits','[]'::jsonb)) with ordinality source(value, ordinality)
        left join lateral (
          select h.title
            from public.habits h
           where h.user_id=new.user_id
             and regexp_replace(lower(btrim(h.title)),'\s+',' ','g')=regexp_replace(lower(btrim(source.value->>'title')),'\s+',' ','g')
           order by h.created_at asc
           limit 1
        ) matched on true
        where coalesce(source.value->>'goalClientId','')='' or source.value->>'goalClientId'=any(v_active_ids)
      ),'[]'::jsonb),
      true
    );

    v_projected := jsonb_set(v_projected,'{priorities}',coalesce((select jsonb_agg(value) from jsonb_array_elements(coalesce(old.generated_plan->'priorities','[]'::jsonb)) where coalesce(value->>'goalClientId','')='' or value->>'goalClientId'=any(v_active_ids)),'[]'::jsonb),true);
    if not v_has_health then v_projected := jsonb_set(v_projected,'{healthPlan}','null'::jsonb,true); end if;
    if not v_has_money then v_projected := jsonb_set(v_projected,'{financialFocus}','null'::jsonb,true); end if;

    new.generated_plan := v_projected;
    new.activation_state := coalesce(new.activation_state,'{}'::jsonb) || jsonb_build_object('_full_plan',old.generated_plan);
  elsif old.proposal_status='confirmed'
        and new.proposal_status='active'
        and old.activation_state ? '_full_plan'
  then
    new.generated_plan := old.activation_state->'_full_plan';
    new.activation_state := coalesce(new.activation_state,'{}'::jsonb) - '_full_plan';
  end if;
  return new;
end;
$$;

revoke all on function private.guard_autobuild_v3_legacy_projection() from public,anon,authenticated;
