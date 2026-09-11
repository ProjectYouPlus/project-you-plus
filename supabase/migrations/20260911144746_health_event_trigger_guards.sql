do $$ declare definition text; begin
 select pg_get_functiondef('public.capture_behavior_event()'::regprocedure) into definition;
 definition:=replace(definition,'if tg_table_name=''tasks'' and tg_op=''UPDATE'' and old.completed_at is null and new.completed_at is not null then','if tg_table_name=''tasks'' then
    if tg_op=''UPDATE'' and old.completed_at is null and new.completed_at is not null then');
 definition:=replace(definition,'elsif tg_table_name=''habit_logs''','end if;
  elsif tg_table_name=''habit_logs''');
 definition:=replace(definition,'elsif tg_table_name=''goals'' and tg_op=''UPDATE'' and old.progress is distinct from new.progress then','elsif tg_table_name=''goals'' then
    if tg_op=''UPDATE'' and old.progress is distinct from new.progress then');
 definition:=replace(definition,'elsif tg_table_name=''transactions'' and tg_op=''INSERT'' and new.amount<0 then','end if;
  elsif tg_table_name=''transactions'' then
    if tg_op=''INSERT'' and new.amount<0 then');
 definition:=replace(definition,'  return coalesce(new,old);','  end if;
  return coalesce(new,old);');
 execute definition;
end $$;
