do $$
declare ddl text;
begin
  ddl := pg_get_functiondef('public.activate_onboarding_system(uuid)'::regprocedure);
  if position('''weekly_review''' in ddl) > 0 then
    ddl := replace(ddl, '''weekly_review''', '''custom''');
    execute ddl;
  end if;
end $$;
